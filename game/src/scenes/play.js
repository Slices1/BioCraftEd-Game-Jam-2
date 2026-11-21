// CORVID play scene: isometric factory rooms, crow + suits. Debug: ']' = next room, R = reset room.
import { createWorld } from '../game/world.js';
import { P, box, tileTop, poly, METAL, DARK } from '../game/iso.js';
import { text } from '../engine/ui.js';

let env = null, bloomMod = null;
import('../game/env.js').then((m) => { env = m; }).catch(() => {});
import('../game/bloom.js').then((m) => { bloomMod = m; }).catch(() => {});

import { setRoomMusic } from '../game/soundtrack.js';
export function playScene(game) {
  const { view, input, audio, fx, scenes } = game;
  const cam = fx.camera;
  const stick = { x: 0, y: 0, len: 0 };
  const camT = { x: 0, y: 0 };
  let slowmo = 0, clearT = 0;
  let w, t = 0, bloom = null, envOk = true, bloomOk = true, banner = 0, bannerText = '', hum = null, winT = 0;

  function safe(fn) { try { fn(); return true; } catch (e) { console.warn('[play] env/bloom error', e); return false; } }

  function updateCamTarget(snap) {
    const c = w.ctrl, a = c.jack ? (w.get(w.get(c.jack).pilot) || w.activeBody()) : w.activeBody();
    const [sx, sy] = P(a.x, a.y, a.z || 0);
    const r = w.rooms[w.roomIdx];
    // room screen bounds (incl. back-wall height)
    const rx0 = (r.ox - (r.oy + r.h)) * 32, rx1 = (r.ox + r.w - r.oy) * 32;
    const ry0 = (r.ox + r.oy) * 16 - 90, ry1 = (r.ox + r.w + r.oy + r.h) * 16 + 10;
    const hudTop = 70, hudBot = view.isTouch ? (view.isPortrait ? 250 : 40) : 30;
    const availW = view.w - 20, availH = view.h - hudTop - hudBot;
    let z, fit = false;
    if (view.isPortrait) z = view.w / (9 * 64);
    else {
      z = Math.min(availW / (rx1 - rx0), availH / (ry1 - ry0), 1.5);
      fit = z >= 0.8; if (!fit) z = 0.9;
    }
    if (fit) { camT.x = (rx0 + rx1) / 2; camT.y = (ry0 + ry1) / 2 + (hudBot - hudTop) / 2 / z; }
    else { camT.x = sx; camT.y = sy - 30 + (view.isTouch ? (view.isPortrait ? 0.13 : 0.05) * view.h / z : 0); }
    cam.zoom = snap ? z : cam.zoom + (z - cam.zoom) * 0.08;
    if (snap) cam.snap();
  }

  // ---- drawing helpers (fallback when env.js isn't there) -------------------------------
  function floor(sx, sy, kind, tx, ty) {
    if (env && envOk && env.drawFloor) { envOk = safe(() => env.drawFloor(ctxRef, sx, sy, kind, t, tx * 31 + ty * 17)); if (envOk) return; }
    tileTop(ctxRef, tx, ty, kind === 'pit' ? -1 : 0, kind === 'pit' ? '#030405' : ((tx + ty) % 2 ? '#1b1f26' : '#1e232b'), 'rgba(79,243,255,0.06)');
  }
  function wallBlock(sx, sy, h, face, tx, ty) {
    if (env && envOk && env.drawRaised) { envOk = safe(() => env.drawRaised(ctxRef, sx, sy, h, t, tx * 13 + ty * 7)); if (envOk) return; }
    box(ctxRef, tx, ty, 0, 1, 1, h, h >= 1.5 ? DARK : METAL);
  }
  let ctxRef = null;
  function envSafe(fn) { if (envOk) envOk = safe(fn); }

  // ---- deterministic per-room set dressing: props in empty corners + overgrowth ------------
  const decorCache = new Map();
  function rnd(s) { return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
  function decorFor(r) {
    let d = decorCache.get(r.idx); if (d) return d;
    const R = rnd(r.idx * 7919 + 17), lvl = r.overgrowth || (r.idx === 1 || r.idx === 3 ? 'heavy' : 'light'), heavy = lvl === 'heavy';
    const used = new Set();
    const mark = (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) used.add((x + a) * 1000 + y + b); };
    for (const e of w.entities) if (e.room === r.idx) {
      mark(Math.floor(e.x), Math.floor(e.y));
      if (e.console) mark(e.console.x ?? e.console[0], e.console.y ?? e.console[1]);
      if (e.zone) for (const [a, b] of e.zone) mark(a, b);
    }
    mark(r.ox + Math.floor(r.spawn[0]), r.oy + Math.floor(r.spawn[1]));
    const floorD = new Map(), props = [], kinds = ['barrel', 'toolcart', 'cables', 'scrap', 'lamp', 'pipe_stack', 'crate_small', 'monitor'];
    const over = ['moss', 'weeds', 'puddle', 'debris', 'moss', 'weeds'];
    for (let ty = r.oy + 1; ty < r.oy + r.h - 1; ty++) for (let tx = r.ox + 1; tx < r.ox + r.w - 1; tx++) {
      if (w.baseHeight(tx, ty) !== 0) continue;
      const k = tx * 1000 + ty;
      if (R() < (heavy ? 0.4 : 0.1)) floorD.set(k, over[(R() * over.length) | 0]);
      const corner = (ty === r.oy + 1 || tx === r.ox + 1 || ty === r.oy + r.h - 2 || tx === r.ox + r.w - 2);
      if (corner && !used.has(k) && R() < 0.22 && props.length < (heavy ? 5 : 3)) {
        props.push({ tx, ty, kind: kinds[(R() * kinds.length) | 0] }); mark(tx, ty);
      }
    }
    let shaft = null;
    if (heavy) { // a tree growing through the broken roof in the back corner
      for (let i = 0; i < 40 && !shaft; i++) {
        const tx = r.ox + 1 + ((R() * 3) | 0), ty = r.oy + 1 + ((R() * 3) | 0);
        if (w.baseHeight(tx, ty) === 0 && !used.has(tx * 1000 + ty)) { props.push({ tx, ty, kind: 'tree', over: true }); shaft = [tx + 0.5, ty + 0.5]; floorD.set(tx * 1000 + ty, 'moss'); }
      }
    }
    d = { floor: floorD, props, shaft, vine: (tx, ty, f) => ((tx * 73 + ty * 151 + (f === 'n' ? 7 : 3)) % 100) / 100 < (heavy ? 0.6 : 0.15) };
    decorCache.set(r.idx, d); return d;
  }
  // painterly colour grade: desaturate + warm/dark multiply + lamp pools
  function grade(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.42)'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(200,188,170)'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
  }

  function render(ctx) {
    ctxRef = ctx;
    ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, view.w, view.h);
    if (env && envOk && env.drawBackdrop) envOk = safe(() => env.drawBackdrop(ctx, view, t));
    cam.begin(ctx);
    const cur = w.rooms[w.roomIdx];
    const vis = cam.visible;
    const items = [];
    for (const r of w.rooms) {
      const dec = decorFor(r), isCur = r === cur, WH = isCur ? 2.6 : 0.5;
      for (let ty = r.oy; ty < r.oy + r.h; ty++) for (let tx = r.ox; tx < r.ox + r.w; tx++) {
        const [sx, sy] = P(tx, ty, 0);
        if (sx < vis.x - 80 || sx > vis.x + vis.w + 80 || sy < vis.y - 120 || sy > vis.y + vis.h + 200) continue;
        const bh = w.baseHeight(tx, ty), seed = tx * 13 + ty * 7;
        const border = ty === r.oy || tx === r.ox || ty === r.oy + r.h - 1 || tx === r.ox + r.w - 1;
        if (bh <= 0 || w.isVent(tx, ty)) {
          floor(sx, sy, bh < 0 ? 'pit' : w.isVent(tx, ty) ? 'grate' : 'floor', tx, ty);
          const d = dec.floor.get(tx * 1000 + ty);
          if (d && env && env.drawOvergrowth) envSafe(() => env.drawOvergrowth(ctx, sx, sy, d, seed, t));
          if (env && envOk && env.drawWall) {
            if (ty - 1 === r.oy && w.baseHeight(tx, ty - 1) >= 2) { envSafe(() => env.drawWall(ctx, sx, sy, WH, 'n', t, seed)); if (dec.vine(tx, ty, 'n')) envSafe(() => env.drawOvergrowth(ctx, sx, sy, 'vines_n', seed, t, WH * 32)); }
            if (tx - 1 === r.ox && w.baseHeight(tx - 1, ty) >= 2) { envSafe(() => env.drawWall(ctx, sx, sy, WH, 'w', t, seed + 5)); if (dec.vine(tx, ty, 'w')) envSafe(() => env.drawOvergrowth(ctx, sx, sy, 'vines_w', seed + 3, t, WH * 32)); }
            if (ty + 1 === r.oy + r.h - 1 && w.baseHeight(tx, ty + 1) >= 2) items.push({ d: tx + ty + 1.95, z: 0, f: () => envSafe(() => env.drawWall(ctx, sx, sy, 1, 'stub', t, seed)) });
            if (tx + 1 === r.ox + r.w - 1 && w.baseHeight(tx + 1, ty) >= 2) items.push({ d: tx + ty + 1.95, z: 0, f: () => envSafe(() => env.drawWall(ctx, sx, sy, 1, 'stubR', t, seed)) });
          }
        } else if (border && bh >= 2 && env && envOk && env.drawWall) {
          // walls are drawn as faces on the adjacent floor tiles
        } else {
          const h = bh >= 2 ? 0.45 : bh;
          items.push({ d: tx + ty + 1, z: 0, f: () => wallBlock(sx, sy, h, 'stub', tx, ty) });
        }
      }
      if (env && env.drawProp) for (const p of dec.props) { const [sx, sy] = P(p.tx, p.ty, 0); items.push({ d: p.tx + p.ty + 0.9, z: 0, f: () => envSafe(() => p.over ? env.drawOvergrowth(ctx, sx, sy, p.kind, p.tx * 7 + p.ty, t) : env.drawProp(ctx, sx, sy, p.kind, t, p.tx * 7 + p.ty)) }); }
      if (isCur && dec.shaft && env && env.drawOvergrowth) { const [sx, sy] = P(dec.shaft[0], dec.shaft[1], 0); items.push({ d: 999, z: 0, f: () => envSafe(() => env.drawOvergrowth(ctx, sx, sy + 16, 'shaft', 1, t)) }); }
    }
    for (const e of w.entities) items.push({ d: e.depth, z: e.z || 0, f: () => e.draw(ctx, t, w) });
    items.sort((a, b) => a.d - b.d || a.z - b.z);
    for (const it of items) it.f();
    for (const e of w.emitters) e.drawBeam(ctx, t);
    fx.drawWorld(ctx);
    cam.end(ctx);
    grade(ctx);
    if (bloomMod && bloomOk) { if (!bloom) bloomOk = safe(() => { bloom = bloomMod.createBloom({ strength: 0.45 }); }); if (bloom) bloomOk = safe(() => bloom.apply(ctx, game.canvas)); }
    cam.begin(ctx); drawPrompt(ctx); cam.end(ctx);
    hud(ctx, cur);
  }

  function drawPrompt(ctx) {
    const p = w.prompt();
    if (!p || w.crow.dead > 0) return;
    const c = w.ctrl, a = c.jack ? (w.get(w.get(c.jack).pilot) || w.activeBody()) : w.activeBody();
    const [sx, sy0] = P(a.x, a.y, (a.z || 0) + (a.type === 'suit' ? 2.6 : 1.5));
    const k = 1 / Math.max(0.6, cam.zoom), sy = sy0 - Math.abs(Math.sin(t * 3)) * 3 * k;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(k, k); ctx.font = '700 20px system-ui, sans-serif';
    const tw = ctx.measureText(p).width + 26;
    ctx.fillStyle = 'rgba(14,12,10,0.92)'; ctx.strokeStyle = 'rgba(255,196,110,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-tw / 2, -42, tw, 32, 9) : ctx.rect(-tw / 2, -42, tw, 32); ctx.fill(); ctx.stroke();
    poly(ctx, [[-7, -10], [7, -10], [0, -1]], 'rgba(255,196,110,0.9)');
    ctx.fillStyle = '#fff3dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p, 0, -25); ctx.restore();
  }

  function hud(ctx, cur) {
    const top = view.safe.top + 16, left = view.safe.left + 16;
    text(ctx, `${cur.idx + 1} · ${cur.name}`, left, top + 14, { size: 22, align: 'left', color: '#9fdfe6', outline: 4 });
    if (clearT > 0 && w.roomIdx > 0) text(ctx, 'ROOM CLEAR', view.w / 2, view.h * 0.36, { size: 54, outline: 7, color: '#ffd89a', alpha: Math.min(1, clearT * 2) });
    if (banner > 0) {
      text(ctx, cur.name, view.w / 2, view.h * 0.2, { size: 46, outline: 6, color: '#e9fbff', alpha: Math.min(1, banner) });
      text(ctx, cur.hint || '', view.w / 2, view.h * 0.2 + 44, { size: 24, outline: 4, color: '#ffb63b', alpha: Math.min(1, banner), maxWidth: view.w - 40 });
    }
    if (t < 6 && w.roomIdx === 0) {
      const h = view.isTouch ? 'Stick: move · A: act · B: enter/exit suit · ↺ reset' : 'WASD move · E act · Q/Shift suit · R reset';
      text(ctx, h, view.w / 2, view.h - view.safe.bottom - (view.isTouch ? (view.isPortrait ? 260 : 150) : 40), { size: 22, outline: 4, alpha: Math.min(1, 6 - t), maxWidth: view.w - 40 });
    }
    if (w.won) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, winT * 0.4)})`; ctx.fillRect(0, 0, view.w, view.h);
      text(ctx, 'THE GREAT SHINY IS YOURS', view.w / 2, view.h / 2, { size: 44, outline: 6, color: '#fff4b0', maxWidth: view.w - 40 });
    }
  }

  return {
    pausable: true,
    touch: { joystick: true, buttons: [{ id: 'buttonA', label: 'A' }, { id: 'buttonB', label: 'B' }, { id: 'buttonR', label: '↺', size: 28 }] },
    enter(params) {
      w = createWorld(game);
      t = 0; banner = 3; winT = 0;
      w.onEnterRoom = () => { banner = 3; slowmo = 0.6; clearT = 1.4; fx.flash('#fff1d0', 0.18, 0.4); audio.play('ui_click'); setRoomMusic(w.roomIdx, w.rooms.length); try { game.storage.set('save', w.getSave()); } catch (e) { /* ignore */ } };
      if (params && params.cont) w.loadSave(params.cont);
      setRoomMusic(w.roomIdx, w.rooms.length);
      cam.reset(); cam.follow(camT, 6);
      updateCamTarget(true);
      game.state.world = w;
      { // debug/preview hooks: ?room=N&demo=pilot|stick|jack
        const pr = game.params || new URLSearchParams(location.search), n = +(pr.get && pr.get('room')) || 0;
        const oe = w.onEnterRoom; w.onEnterRoom = null;
        for (let i = 0; i < n; i++) { w.teleportNext(); w.update(1 / 60, { mx: 0, my: 0 }); }
        const demo = pr.get && pr.get('demo'), cr = w.crow, rm = w.roomIdx;
        const near = (ty) => w.entities.find((e) => e.type === ty && e.room === rm);
        if (demo === 'stick') { const s = near('stick'); if (s) { cr.x = s.x; cr.y = s.y; w.update(1 / 60, { mx: 0, my: 0, act: true }); } }
        if (demo === 'pilot' || demo === 'jack') { const s = near('suit'); if (s) { cr.x = s.x; cr.y = s.y; w.update(1 / 60, { mx: 0, my: 0, swap: true });
          const m = demo === 'jack' && w.entities.find((e) => e.console && e.room === rm); if (m) { s.x = m.console.x + 0.5; s.y = m.console.y + 0.5; w.update(1 / 60, { mx: 0, my: 0, act: true }); } } }
        w.onEnterRoom = oe; updateCamTarget(true);
      }
    },
    exit() { game.loop.timeScale = 1; if (hum) { hum.stop(0.2); hum = null; } },
    update(dt) {
      t += dt; banner = Math.max(0, banner - dt); clearT = Math.max(0, clearT - dt);
      if (slowmo > 0) { slowmo -= dt / Math.max(0.05, game.loop.timeScale); game.loop.timeScale = slowmo > 0 ? 0.35 : 1; }
      input.stick(stick);
      // screen direction -> world: screen up = world (-x, -y)
      let mx = stick.x + stick.y, my = stick.y - stick.x;
      const l = Math.hypot(mx, my);
      if (l > 0.001) { mx = mx / l * stick.len; my = my / l * stick.len; }
      if (input.pressed('reset')) { w.reset(); audio.play('ui_click'); }
      if (input.pressed('debugNext')) w.teleportNext();
      w.update(dt, { mx, my, act: input.pressed('act'), swap: input.pressed('swap') });
      updateCamTarget(false);
      const wantHum = w.rooms[w.roomIdx].ents.some((e) => e.type === 'emitter');
      if (wantHum && !hum) { const h = audio.play('laser_hum', { loop: true, volume: 0.4 }); if (h && h.playing !== false) hum = h; }
      else if (!wantHum && hum) { hum.stop(0.5); hum = null; }
      if (w.won) { winT += dt; if (winT > 1.8 && !scenes.transitioning) { try { game.storage.remove('save'); } catch (e) { /* ignore */ } scenes.go(scenes.has && scenes.has('ending') ? 'ending' : 'title', { time: w.time, deaths: w.deaths }, { fade: 1.2 }); } }
    },
    render,
  };
}
