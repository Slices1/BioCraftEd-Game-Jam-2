// CORVID play scene: owns the logic state + the 3D room view, translates input into logic actions,
// reacts to logic events (audio, narration, banners) and draws the 2D HUD overlay.
// Contract: REBUILD.md sections 1-4 and 6. Debug: ']' = next room (with ?debug), R = reset room.
import * as THREE from 'three';
import { ROOMS } from '../logic/rooms.js';
import { createState, step, tick, actions, pathTo } from '../logic/rules.js';
import { createRoomView } from '../render/roomView.js';
import { text, roundRect } from '../engine/ui.js';

const KEY_DIRS = [
  ['N', ['KeyW', 'ArrowUp']],
  ['E', ['KeyD', 'ArrowRight']],
  ['S', ['KeyS', 'ArrowDown']],
  ['W', ['KeyA', 'ArrowLeft']],
];
const BEAT_HZ = 174 / 60;

function roomDims(room) {
  let w = 1;
  for (const row of room.map) w = Math.max(w, row.length);
  return { w, h: room.map.length };
}

/** Upgrades granted by the consoles of every room before `index` (for ?room=N testing). */
function carryFor(index) {
  const upgrades = { arm: false, legs: false };
  for (let i = 0; i < index && i < ROOMS.length; i++) {
    for (const e of ROOMS[i].ents || []) if (e.type === 'console' && e.grants) upgrades[e.grants] = true;
  }
  return { upgrades };
}

function cloneCarry(c) {
  const u = (c && c.upgrades) || {};
  return { upgrades: { arm: !!u.arm, legs: !!u.legs } };
}

export function playScene(game) {
  const { view, input, audio, scenes } = game;
  const r3 = game.r3;

  let state = null, rv = null, roomIdx = 0, room = null, carryEntry = cloneCarry(null);
  let t = 0, cd = 0;
  let bannerT = 0, bannerText = '', bannerHint = '';
  let completeT = 0, wonT = 0;
  let path = [];
  let buffered = null, bufT = 0, prevDir = null, prevHeld = [], lastKeyDir = null, joyDir = null;
  let fitW = -1, fitH = -1, curAc = null;
  const tmpV = new THREE.Vector3();
  const tmpP = { x: 0, y: 0 };

  const sfx = (id, o) => { try { audio.play(id, o); } catch (e) { /* audio is optional */ } };

  function fit() {
    if (!rv || !r3) return;
    const d = roomDims(room);
    r3.fitIso(rv.camera, new THREE.Vector3(d.w / 2, 0.6, d.h / 2), d.w, d.h);
    fitW = view.w; fitH = view.h;
  }

  function buildView() {
    if (rv) { try { rv.dispose(); } catch (e) { /* ignore */ } rv = null; }
    rv = createRoomView(r3, state);
    r3.setView(rv.scene, rv.camera);
    fit();
  }

  function showBanner(title, hint) {
    bannerText = title || ''; bannerHint = hint || ''; bannerT = 3.4;
  }

  function resetInputState() {
    path = []; buffered = null; bufT = 0; prevDir = null; prevHeld = []; lastKeyDir = null; joyDir = null; cd = 0.1;
  }

  function loadRoom(idx, carry) {
    roomIdx = Math.max(0, Math.min(ROOMS.length - 1, idx | 0));
    room = ROOMS[roomIdx];
    carryEntry = cloneCarry(carry);
    game.state.carry = cloneCarry(carry);
    game.state.roomIndex = roomIdx;
    state = createState(roomIdx, cloneCarry(carry));
    completeT = 0; wonT = 0;
    resetInputState();
    buildView();
    try { audio.music(room.music || 'factory', { fade: room.music === 'dnb' ? 0.6 : 1.5 }); } catch (e) { /* ignore */ }
    showBanner(room.banner || room.name, null);
    if (roomIdx === 0) game.voice.say('vo_r1');
    if (room.music === 'dnb') game.voice.say('vo_r5');
  }

  function resetRoom() {
    state = createState(roomIdx, cloneCarry(carryEntry));
    completeT = 0; wonT = 0;
    resetInputState();
    buildView();
    sfx('ui_click');
  }

  function nextRoom() {
    const upgrades = state.mech && state.mech.upgrades ? state.mech.upgrades : {};
    const carry = cloneCarry({ upgrades });
    game.state.carry = carry;
    if (roomIdx + 1 >= ROOMS.length) { scenes.go('ending', {}, { fade: 1.2 }); return; }
    scenes.go('play', { room: roomIdx + 1, carry }, { fade: 0.9 });
  }

  // ---- input -> direction ------------------------------------------------------------------
  function readDir() {
    const held = [];
    for (const [d, ks] of KEY_DIRS) if (ks.some((k) => input.key(k))) held.push(d);
    let keyDir = null;
    for (const d of held) if (!prevHeld.includes(d)) lastKeyDir = d;
    prevHeld = held;
    if (held.length) keyDir = held.includes(lastKeyDir) ? lastKeyDir : held[held.length - 1];
    let dir = keyDir;
    if (!dir) {
      const j = input.joystick;
      if (j && j.active && j.mag > 0.5) {
        const ex = j.x + j.y, nz = j.y - j.x;
        const vals = { E: ex, W: -ex, S: nz, N: -nz };
        let best = 'E';
        for (const k of ['E', 'W', 'S', 'N']) if (vals[k] > vals[best]) best = k;
        if (joyDir && vals[joyDir] >= vals[best] - 0.15) best = joyDir; // hysteresis on diagonals
        joyDir = best;
        dir = best;
      } else joyDir = null;
    } else joyDir = null;
    return dir;
  }

  function pickTile(lx, ly) {
    if (!rv || !r3) return null;
    view.toClient(lx, ly, tmpP);
    const hit = r3.pick(tmpP.x, tmpP.y, rv.tileMeshes);
    if (!hit || !hit.point) return null;
    tmpV.copy(hit.point);
    try { // nudge into the surface so side faces of tall tiles resolve to their own tile
      if (hit.face && hit.object) {
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        tmpV.addScaledVector(n, -0.02);
      }
    } catch (e) { /* ignore */ }
    return { x: Math.floor(tmpV.x), z: Math.floor(tmpV.z) };
  }

  // ?debug test hook: window.__play.step({type:'move',dir:'N'}) drives the real scene (used for automated playthroughs).
  if (game.debug) window.__play = { step: (a) => doStep(a), state: () => state, busy: () => !!(rv && rv.busy()), room: () => roomIdx };
  function doStep(action) {
    let changed = false;
    try { changed = step(state, action); } catch (e) { console.error('[play] step failed', e); }
    return changed;
  }

  // ---- events -> audio / narration / banners -------------------------------------------------
  function handleEvents(evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'move':
          if (e.who === 'crow') sfx('flap'); else if (e.who === 'mech') sfx('step');
          break;
        case 'plate_on': sfx('plate_on'); break;
        case 'door_open': sfx('door_open'); break;
        case 'jam': sfx('cog_jam'); path = []; break;
        case 'pickup': sfx('stick_pick'); break;
        case 'drop': sfx('stick_pick', { volume: 0.6, rate: 0.85 }); break;
        case 'graft': {
          const part = e.part || e.id || e.what || e.name;
          sfx(audio.has && audio.has('graft') ? 'graft' : 'jack_in');
          if (part === 'arm') game.voice.say('vo_arm');
          else if (part === 'legs') game.voice.say('vo_legs');
          path = [];
          break;
        }
        case 'grab': sfx('magnet_on'); path = []; break;
        case 'release': sfx('magnet_drop'); break;
        case 'hop': sfx('land', { volume: 0.8 }); break;
        case 'swap': sfx(e.to === 'crow' ? 'jack_out' : 'jack_in'); path = []; break;
        case 'pushed': sfx('press_slam', { volume: 0.6 }); break;
        case 'death':
          sfx('zap_death');
          game.fx.flash('#ff2a3a', 0.4, 0.5);
          path = [];
          game.voice.say('vo_death');
          break;
        case 'bump': sfx('ui_click', { volume: 0.35 }); break;
        case 'zone': {
          const z = room.zones && room.zones[e.index != null ? e.index : e.i];
          if (z) {
            if (z.banner) showBanner(z.banner, null);
            if (z.say) game.voice.say(z.say);
          }
          break;
        }
        case 'complete':
          if (completeT === 0) { completeT = 1.0; sfx('ui_confirm'); path = []; }
          break;
        case 'won':
          if (wonT === 0) { wonT = 1.8; sfx('win'); path = []; }
          break;
        default: break;
      }
    }
  }

  // ---- finale beat clock ----------------------------------------------------------------------
  function beatIndex() {
    const actx = audio.ctx;
    if (actx && actx.state === 'running' && audio.currentMusic === room.music) {
      let h = null;
      try { h = audio.music(room.music, { fade: 0.6 }); } catch (e) { h = null; }
      if (h && h.playing !== false) {
        const bc = game.state.beatClock;
        if (!bc || bc.handle !== h) game.state.beatClock = { handle: h, t0: actx.currentTime };
        return Math.floor((actx.currentTime - game.state.beatClock.t0) * BEAT_HZ);
      }
    }
    return Math.floor(t * BEAT_HZ);
  }

  // ---- scene ----------------------------------------------------------------------------------
  return {
    pausable: true,
    touch: {
      joystick: { zone: { x0: 0, y0: 0.5, x1: 0.62, y1: 1 } },
      buttons: [{ id: 'buttonA', label: 'A' }, { id: 'buttonB', label: 'B' }, { id: 'buttonR', label: '↺', size: 28 }],
    },

    enter(params) {
      params = params || {};
      t = 0;
      if (!r3) return;
      let idx = 0, carry = null;
      if (params.room != null) { idx = params.room | 0; carry = params.carry || carryFor(idx); }
      else {
        const q = game.params && game.params.get ? parseInt(game.params.get('room'), 10) : NaN;
        if (q > 0) { idx = q; carry = carryFor(Math.min(q, ROOMS.length - 1)); }
        else carry = params.carry || null;
      }
      loadRoom(idx, carry);
      input.setTouchButton('buttonR', { visible: true });
    },

    exit() {
      if (rv) { try { rv.dispose(); } catch (e) { /* ignore */ } rv = null; }
    },

    update(dt) {
      t += dt;
      bannerT = Math.max(0, bannerT - dt);
      cd = Math.max(0, cd - dt);
      bufT = Math.max(0, bufT - dt);
      if (!rv || !state) return;
      if (view.w !== fitW || view.h !== fitH) fit();

      const locked = completeT > 0 || wonT > 0 || scenes.transitioning;

      if (!locked) {
        if (input.pressed('reset')) { resetRoom(); }
        else {
          if (input.pressed('debugNext') && game.debug && roomIdx + 1 < ROOMS.length) {
            scenes.go('play', { room: roomIdx + 1, carry: cloneCarry({ upgrades: state.mech.upgrades }) }, { fade: 0.3 });
          }
          if (input.pressed('act')) { path = []; doStep({ type: 'act' }); }
          if (input.pressed('swap')) { path = []; doStep({ type: 'swap' }); }

          // movement: keys / joystick (hold repeats), with a short buffer so quick taps are not lost
          const dir = readDir();
          if (dir && dir !== prevDir) { buffered = dir; bufT = 0.3; }
          prevDir = dir;
          const want = dir || (bufT > 0 ? buffered : null);

          // tap / click on a tile -> path
          const tap = input.tap;
          if (tap && (tap.type !== 'mouse' || tap.button === 0)) {
            const tile = pickTile(tap.x, tap.y);
            if (tile) {
              let p = [];
              try { p = pathTo(state, tile.x, tile.z) || []; } catch (e) { console.error('[play] pathTo failed', e); }
              path = p.slice();
              if (!path.length) sfx('ui_click', { volume: 0.3 });
            }
          }

          if (want) {
            path = [];
            if (cd <= 0 && !rv.busy()) {
              const changed = doStep({ type: 'move', dir: want });
              buffered = null; bufT = 0;
              cd = changed ? 0 : 0.12;
            }
          } else if (path.length && cd <= 0 && !rv.busy()) {
            const d = path.shift();
            const changed = doStep({ type: 'move', dir: d });
            if (!changed) { path = []; cd = 0.1; }
          }
        }
        if (!state) return;

        if (room.music === 'dnb' && !state.won) {
          try { tick(state, beatIndex()); } catch (e) { console.error('[play] tick failed', e); }
        }
      }

      rv.sync(state, dt);
      const evs = state.events || [];
      if (evs.length) {
        try { rv.handleEvents(evs); } catch (e) { console.error('[play] view events failed', e); }
        handleEvents(evs);
        evs.length = 0;
      }
      if (state.won && wonT === 0) { wonT = 1.8; sfx('win'); }

      // context buttons
      let ac = { act: null, swap: null };
      try { ac = actions(state) || ac; } catch (e) { /* ignore */ }
      curAc = locked ? null : ac;
      input.setTouchButton('buttonA', { visible: !!ac.act && !locked, hint: ac.act || '' });
      input.setTouchButton('buttonB', { visible: !!ac.swap && !locked, hint: ac.swap || '' });
      input.setTouchButton('buttonR', { visible: true });

      if (completeT > 0) {
        completeT -= dt;
        if (completeT <= 0 && !scenes.transitioning) { completeT = -1; nextRoom(); }
      }
      if (wonT > 0) {
        wonT -= dt;
        if (wonT <= 0 && !scenes.transitioning) { wonT = -1; scenes.go('ending', {}, { fade: 1.2 }); }
      }
    },

    render(ctx) {
      if (!r3) {
        ctx.fillStyle = '#0f1416'; ctx.fillRect(0, 0, view.w, view.h);
        text(ctx, 'WebGL is not available on this device.', view.w / 2, view.h / 2, { size: 30, maxWidth: view.w - 40 });
        return;
      }
      if (!rv || !state) return;
      const top = view.safe.top + 16, left = view.safe.left + 16;
      text(ctx, room.name || '', left, top + 14, { size: 22, align: 'left', color: '#bfe3e0', outline: 4, alpha: 0.85 });

      // desktop prompt above the controlled body
      const ac = curAc;
      if (!view.isTouch && ac && (ac.act || ac.swap)) drawPrompt(ctx, ac);

      // banner + hint
      if (bannerT > 0 && bannerText) {
        const a = Math.min(1, bannerT * 1.5, (3.4 - bannerT) * 4);
        const y = view.safe.top + Math.max(90, view.h * 0.14);
        text(ctx, bannerText, view.w / 2, y, { size: view.isPortrait ? 44 : 52, outline: 6, color: '#ffe3b0', alpha: a, maxWidth: view.w - 40 });
        const hint = bannerHint || (roomIdx === 0 && bannerText === (room.banner || room.name) ? controlsHint() : '');
        if (hint) text(ctx, hint, view.w / 2, y + 48, { size: 24, outline: 4, color: '#e9fbff', alpha: a, maxWidth: view.w - 40 });
      }
      if (!view.isTouch) {
        text(ctx, 'WASD move   E act   Q swap   R reset   click to walk', view.w / 2, view.h - view.safe.bottom - 22,
          { size: 18, outline: 3, color: '#ffffff', alpha: 0.4, maxWidth: view.w - 40 });
      }
    },
  };

  function controlsHint() {
    return view.isTouch ? 'Drag to move, or tap a tile to walk there' : 'WASD / arrows to move, or click a tile to walk there';
  }

  function drawPrompt(ctx, ac) {
    const b = state.control === 'mech' ? state.mech : state.crow;
    if (!b) return;
    const wy = state.control === 'mech' ? (b.h || 0) + 1.6 : 1.4;
    tmpV.set(b.x + 0.5, wy, b.z + 0.5);
    let s = null;
    try { s = rv.worldToScreen(tmpV); } catch (e) { s = null; }
    if (!s) return;
    view.toLogical(s.x, s.y, tmpP);
    const str = [ac.act && `[E] ${ac.act}`, ac.swap && `[Q] ${ac.swap}`].filter(Boolean).join('    ');
    const size = 22;
    ctx.save();
    ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const tw = ctx.measureText(str).width + 28, th = size + 16;
    const x = Math.max(tw / 2 + 8, Math.min(view.w - tw / 2 - 8, tmpP.x));
    const y = Math.max(th + 8, tmpP.y - 10 - Math.abs(Math.sin(t * 3)) * 4);
    roundRect(ctx, x - tw / 2, y - th, tw, th, 10);
    ctx.fillStyle = 'rgba(14,12,10,0.88)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,196,110,0.9)'; ctx.stroke();
    ctx.fillStyle = '#fff3dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y - th / 2 + 1);
    ctx.restore();
  }
}
