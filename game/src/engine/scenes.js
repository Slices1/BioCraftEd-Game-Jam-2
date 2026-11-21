// Scene manager with a fade-through-color transition.
//
// A scene is a factory `(game) => ({...})` (recommended: fresh state on every visit), a class
// (constructed with `new Scene(game)`), or a plain object (reused; reset state in enter()).
// Scene hooks (all optional):
//   enter(params, game)  exit()  update(dt)  render(ctx)
//   touch: {joystick, buttons}   on-screen controls for this scene (applied by main.js)
//   pausable: true               allow the pause menu (Esc / P / pause button)
//   onPause() onResume()
// go() during a transition retargets it. The old scene is frozen while fading out.

export function createScenes(game, { onSwitch } = {}) {
  const defs = new Map();
  let phase = null, t = 0, dur = 0, pending = null, lastParams = {};

  const sm = {
    current: null,
    name: null,
    prevName: null,
    fadeAlpha: 0,
    fadeColor: '#000',
    get transitioning() { return phase !== null; },

    add(name, def) { defs.set(name, def); return sm; },
    has(name) { return defs.has(name); },

    /** go(name, params, {fade: seconds (0 = instant), color}) */
    go(name, params = {}, { fade = 0.35, color = '#000' } = {}) {
      if (!defs.has(name)) { console.error(`[scenes] unknown scene "${name}"`); return false; }
      sm.fadeColor = color;
      if (!sm.current || fade <= 0) {
        switchTo(name, params);
        if (fade > 0) { phase = 'in'; t = 0; dur = fade / 2; sm.fadeAlpha = 1; } else { phase = null; sm.fadeAlpha = 0; }
        return true;
      }
      pending = { name, params };
      if (phase !== 'out') { phase = 'out'; t = dur ? sm.fadeAlpha * (fade / 2) : 0; dur = fade / 2; }
      return true;
    },
    /** Re-enter the current scene (same params unless given). */
    restart(params, opts) { return sm.name ? sm.go(sm.name, params ?? lastParams, opts) : false; },

    /** dt = scaled game dt; realDt drives the fade so it works even at timeScale 0. */
    update(dt, realDt = dt) {
      if (phase === 'out') {
        t += realDt;
        sm.fadeAlpha = Math.min(1, dur > 0 ? t / dur : 1);
        if (sm.fadeAlpha >= 1) {
          const p = pending; pending = null;
          switchTo(p.name, p.params);
          phase = 'in'; t = 0;
        }
        return; // old scene frozen while fading out
      }
      if (phase === 'in') {
        t += realDt;
        sm.fadeAlpha = Math.max(0, 1 - (dur > 0 ? t / dur : 1));
        if (sm.fadeAlpha <= 0) phase = null;
      }
      if (sm.current && sm.current.update) sm.current.update(dt);
    },

    render(ctx) { if (sm.current && sm.current.render) sm.current.render(ctx); },

    /** Draw the fade overlay (main calls this last, in logical coords). */
    renderTransition(ctx, view) {
      if (sm.fadeAlpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = sm.fadeAlpha;
      ctx.fillStyle = sm.fadeColor;
      ctx.fillRect(-10, -10, view.w + 20, view.h + 20);
      ctx.restore();
    },
  };

  function instantiate(def) {
    if (typeof def !== 'function') return def;
    const isClass = /^class[\s{]/.test(Function.prototype.toString.call(def));
    return isClass ? new def(game) : def(game);
  }

  function switchTo(name, params) {
    const prev = sm.current;
    if (prev && prev.exit) { try { prev.exit(); } catch (e) { console.error(`[scenes] ${sm.name}.exit()`, e); } }
    let scene;
    try { scene = instantiate(defs.get(name)) || {}; } catch (e) { console.error(`[scenes] creating "${name}"`, e); scene = {}; }
    sm.prevName = sm.name;
    sm.current = scene; sm.name = name; lastParams = params;
    if (onSwitch) { try { onSwitch(scene, name, prev); } catch (e) { console.error('[scenes] onSwitch', e); } }
    if (scene.enter) { try { scene.enter(params, game); } catch (e) { console.error(`[scenes] ${name}.enter()`, e); } }
  }

  return sm;
}
