// CORVID intro cutscene (~21 s, skippable): rain city -> glint in the tower window -> crow on the antenna -> dive through a vent
// -> lands on a dormant mech suit whose cradle lights up -> room 1.
import { text } from '../engine/ui.js';
import { sprites } from '../game/sprites.js';
import { W, H, framePanel, sky, skyline, tower, glint, rain, crow, mech, caption, vignette, letterbox, seg, smooth, lerp } from './storyart.js';

const DUR = 21.5;
const CUTS = [4.5, 9, 13.5, 16.5];

export function introScene(game) {
  const { view, input, audio, scenes } = game;
  let t = 0, done = false, keyHandler = null;

  function skip() {
    if (done || t < 0.45) return;
    done = true; scenes.go('play', {}, { fade: 0.7 });
  }

  function city(ctx, sx, sy, zoom, o = {}) {
    framePanel(ctx, view, sx, sy, zoom);
    sky(ctx, '#05060b', '#10131f', '#2a1826');
    skyline(ctx, 800, 11, { color: '#0b0e16', lit: 0.1, minH: 100, maxH: 330 });
    // antenna building
    ctx.fillStyle = '#080a10'; ctx.fillRect(320, 520, 120, 420);
    ctx.fillStyle = '#12151d'; ctx.fillRect(316, 514, 128, 10);
    ctx.fillStyle = '#10131a'; ctx.fillRect(378, 400, 5, 116); ctx.fillRect(360, 430, 40, 4); ctx.fillRect(366, 455, 28, 3);
    ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ff3b4f' : '#3a1018'; ctx.beginPath(); ctx.arc(380, 398, 5, 0, 7); ctx.fill();
    skyline(ctx, 880, 12, { color: '#07090e', lit: 0.16, minH: 80, maxH: 220 });
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    const win = tower(ctx, 1020, 900, t, { pulse });
    return win;
  }

  function sceneRain(ctx, k = 1) { rain(ctx, view, t, k); }

  function render(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, view.w, view.h);
    const img = sprites.get('cutscene_rooftop');
    let cap = null, capA = 0;
    ctx.save();
    if (t < CUTS[0]) { // 1: night city in the rain, slow pan toward the tower
      const p = seg(t, 0, CUTS[0]);
      city(ctx, lerp(380, 900, smooth(p)), 560, 1.0);
      ctx.restore(); ctx.save(); sceneRain(ctx);
      cap = 'The city sleeps. The factory does not.'; capA = Math.min(seg(t, 0.8, 1.6), 1 - seg(t, 3.8, 4.4));
    } else if (t < CUTS[1]) { // 2: push in on the window, prismatic glint
      const p = seg(t, CUTS[0], CUTS[1]);
      const win = city(ctx, 1000, lerp(520, 330, smooth(p)), lerp(1.0, 2.3, smooth(p)));
      glint(ctx, win.x, win.y, lerp(30, 150, smooth(seg(p, 0.1, 0.6))), seg(p, 0.1, 0.5), t);
      ctx.restore(); ctx.save(); sceneRain(ctx, 0.8);
      cap = 'The Great Shiny.'; capA = Math.min(seg(t, CUTS[0] + 1.6, CUTS[0] + 2.4), 1 - seg(t, CUTS[1] - 0.6, CUTS[1] - 0.1));
    } else if (t < CUTS[2]) { // 3: crow on the antenna, head tilt
      const p = seg(t, CUTS[1], CUTS[2]);
      const win = city(ctx, lerp(470, 440, smooth(p)), 400, 1.8);
      const tilt = Math.sin(seg(p, 0.25, 0.55) * Math.PI) * 0.6 + (p > 0.55 ? 0.12 * Math.sin((p - 0.55) * 14) : 0);
      crow(ctx, 380, 380, 0.9, { perch: true, tilt: -tilt * 0.9, flap: 0, lean: 0.03 });
      glint(ctx, win.x, win.y, 120 + 30 * Math.sin(t * 3), 0.9, t);
      ctx.restore(); ctx.save(); sceneRain(ctx, 1);
      cap = 'Crows remember shiny things.'; capA = Math.min(seg(t, CUTS[1] + 1.6, CUTS[1] + 2.4), 1 - seg(t, CUTS[2] - 0.6, CUTS[2] - 0.1));
    } else if (t < CUTS[3]) { // 4: dive into the vent
      const p = seg(t, CUTS[2], CUTS[3]);
      const win = city(ctx, lerp(640, 760, p), 640, 1.15);
      const e = p * p * (3 - 2 * p), vx = win.x - 150, vy = 600;
      const bx = lerp(380, vx, e), by = lerp(380, vy, e) - Math.sin(e * Math.PI) * 200 * (1 - e);
      const sc = lerp(0.9, 0.35, seg(p, 0.6, 1));
      ctx.globalAlpha = 1 - seg(p, 0.9, 1);
      crow(ctx, bx, by, sc, { flap: Math.sin(t * 18), flip: false, lean: 0.35 + 0.5 * e });
      ctx.globalAlpha = 1;
      glint(ctx, win.x, win.y, 90, 0.7, t);
      ctx.restore(); ctx.save(); sceneRain(ctx, 1);
    } else { // 5: interior - dormant mech, cradle lights up
      const p = seg(t, CUTS[3], DUR);
      ctx.restore(); ctx.save();
      framePanel(ctx, view, 800, lerp(600, 540, smooth(p)), lerp(0.85, 1.05, smooth(p)));
      const lit = smooth(seg(t, 18.3, 19.4));
      sky(ctx, '#05070b', '#090c12', '#10141c');
      // back wall pipes + warning strips
      ctx.fillStyle = '#0c0f15'; for (let i = 0; i < 8; i++) ctx.fillRect(i * 220 - 40, 0, 40, 920);
      ctx.fillStyle = '#12161e'; ctx.fillRect(-100, 900, W + 200, 200);
      ctx.fillStyle = 'rgba(255,182,59,0.25)'; for (let i = 0; i < 40; i++) ctx.fillRect(i * 44, 896, 22, 6);
      const g = ctx.createRadialGradient(800, 520, 20, 800, 520, 520);
      g.addColorStop(0, `rgba(79,243,255,${0.28 * lit})`); g.addColorStop(1, 'rgba(79,243,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // a stray light shaft from the vent
      ctx.fillStyle = 'rgba(255,190,100,0.05)'; ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(520, 0); ctx.lineTo(900, 900); ctx.lineTo(560, 900); ctx.fill();
      mech(ctx, 800, 900, 440, lit, t);
      // crow glides in and lands on the shoulder (shoulder ~ (800+0.36*520... ) in ref space)
      const lp = smooth(seg(t, CUTS[3] + 0.4, 17.8)), sx = 800 - 0.39 * 440, sy = 900 - 0.98 * 440 - 14;
      const cx = lerp(300, sx, lp), cy = lerp(160, sy, lp) - Math.sin(lp * Math.PI) * 90;
      const landed = lp >= 1;
      crow(ctx, cx, cy, 1.1, landed ? { perch: false, tilt: 0.25 * Math.sin(t * 4), flap: 0 } : { flap: Math.sin(t * 16), lean: 0.2 }, 0);
      cap = 'Too small to carry it. Big enough to drive something that can.'; capA = Math.min(seg(t, 18.9, 19.8), 1 - seg(t, DUR - 0.9, DUR - 0.2));
    }
    ctx.restore();
    vignette(ctx, view, 0.7);
    // fade through black at cuts
    let fade = 0;
    for (const c of CUTS) fade = Math.max(fade, 1 - Math.min(1, Math.abs(t - c) / 0.35));
    if (t < 0.5) fade = Math.max(fade, 1 - t / 0.5);
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, view.w, view.h); }
    letterbox(ctx, view, 0.07);
    if (cap) caption(ctx, view, cap, capA);
    // skip hint
    const a = 0.5 + 0.25 * Math.sin(t * 4);
    text(ctx, view.isTouch ? 'tap to skip  ▸▸' : 'any key to skip  ▸▸', view.w - view.safe.right - 24, view.h - view.safe.bottom - 24, { size: 22, align: 'right', color: '#fff', alpha: a, outline: 4 });
  }

  return {
    enter() {
      const o = game.params && game.params.get && +game.params.get('t'); if (o) t = o; // debug: ?t=<seconds>
      keyHandler = (e) => { if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Escape' || /^F\d+$/.test(e.key)) return; skip(); };
      window.addEventListener('keydown', keyHandler);
    },
    exit() { if (keyHandler) window.removeEventListener('keydown', keyHandler); keyHandler = null; },
    update(dt) {
      t += dt;
      if (input.tap || input.downs.length) skip();
      if (t >= DUR && !done) { done = true; scenes.go('play', {}, { fade: 0.8 }); }
    },
    render,
  };
}
