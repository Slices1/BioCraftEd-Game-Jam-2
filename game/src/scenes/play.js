// CORVID play scene: isometric factory rooms, crow + suits. Debug: ']' = next room, R = reset room.
import { createWorld } from '../game/world.js';
import { P, box, tileTop, poly, METAL, DARK } from '../game/iso.js';
import { text } from '../engine/ui.js';

let env = null, bloomMod = null;
import('../game/env.js').then((m) => { env = m; }).catch(() => {});
import('../game/bloom.js').then((m) => { bloomMod = m; }).catch(() => {});

export function playScene(game) {
  const { view, input, audio, fx, scenes } = game;
  const cam = fx.camera;
  const stick = { x: 0, y: 0, len: 0 };
  const camT = { x: 0, y: 0 };
  let w, t = 0, bloom = null, envOk = true, bloomOk = true, banner = 0, bannerText = '', hum = null, winT = 0;

  function safe(fn) { try { fn(); return true; } catch (e) { console.warn('[play] env/bloom error', e); return false; } }

  function updateCamTarget(snap) {
    const c = w.ctrl, a = c.jack ? (w.get(w.get(c.jack).pilot) || w.activeBody()) : w.activeBody();
    const [sx, sy] = P(a.x, a.y, a.z || 0);
    camT.x = sx; camT.y = sy - 30;
    cam.zoom = Math.min(view.w, view.h) / 720;
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

  function render(ctx) {
    ctxRef = ctx;
    ctx.fillStyle = '#07080b'; ctx.fillRect(0, 0, view.w, view.h);
    if (env && envOk && env.drawBackdrop) envOk = safe(() => env.drawBackdrop(ctx, view, t));
    cam.begin(ctx);
    const cur = w.rooms[w.roomIdx];
    const vis = cam.visible;
    const items = [];
    for (const r of w.rooms) {
      for (let ty = r.oy; ty < r.oy + r.h; ty++) for (let tx = r.ox; tx < r.ox + r.w; tx++) {
        const [sx, sy] = P(tx, ty, 0);
        if (sx < vis.x - 80 || sx > vis.x + vis.w + 80 || sy < vis.y - 120 || sy > vis.y + vis.h + 60) continue;
        const bh = w.baseHeight(tx, ty);
        if (bh <= 0) floor(sx, sy, bh < 0 ? 'pit' : 'floor', tx, ty);
        else if (w.isVent(tx, ty)) floor(sx, sy, 'grate', tx, ty);
        else {
          let h = bh, face = 'stub';
          if (bh >= 2) {
            const back = r === cur && (ty === r.oy || tx === r.ox);
            h = back ? 2 : 0.45; face = back ? (ty === r.oy ? 'n' : 'w') : 'stub';
          }
          items.push({ d: tx + ty + 1, z: 0, f: () => wallBlock(sx, sy, h, face, tx, ty) });
        }
      }
    }
    for (const e of w.entities) items.push({ d: e.depth, z: e.z || 0, f: () => e.draw(ctx, t, w) });
    items.sort((a, b) => a.d - b.d || a.z - b.z);
    for (const it of items) it.f();
    for (const e of w.emitters) e.drawBeam(ctx, t);
    fx.drawWorld(ctx);
    drawPrompt(ctx);
    cam.end(ctx);
    if (bloomMod && bloomOk) { if (!bloom) bloomOk = safe(() => { bloom = bloomMod.createBloom(); }); if (bloom) bloomOk = safe(() => bloom.apply(ctx, game.canvas)); }
    hud(ctx, cur);
  }

  function drawPrompt(ctx) {
    const p = w.prompt();
    if (!p || w.crow.dead > 0) return;
    const c = w.ctrl, a = c.jack ? (w.get(w.get(c.jack).pilot) || w.activeBody()) : w.activeBody();
    const [sx, sy] = P(a.x, a.y, (a.z || 0) + (a.type === 'suit' ? 2.1 : 1.0));
    ctx.save(); ctx.font = '600 16px system-ui, sans-serif';
    const tw = ctx.measureText(p).width + 18;
    ctx.fillStyle = 'rgba(8,12,16,0.85)'; ctx.strokeStyle = 'rgba(79,243,255,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - tw / 2, sy - 30, tw, 24, 6) : ctx.rect(sx - tw / 2, sy - 30, tw, 24); ctx.fill(); ctx.stroke();
    poly(ctx, [[sx - 5, sy - 6], [sx + 5, sy - 6], [sx, sy]], 'rgba(79,243,255,0.7)');
    ctx.fillStyle = '#dffcff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p, sx, sy - 18); ctx.restore();
  }

  function hud(ctx, cur) {
    const top = view.safe.top + 16, left = view.safe.left + 16;
    text(ctx, `${cur.idx + 1} · ${cur.name}`, left, top + 14, { size: 22, align: 'left', color: '#9fdfe6', outline: 4 });
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
    enter() {
      w = createWorld(game);
      t = 0; banner = 3; winT = 0;
      w.onEnterRoom = () => { banner = 3; audio.play('ui_click'); };
      cam.reset(); cam.follow(camT, 6);
      updateCamTarget(true);
      game.state.world = w;
    },
    exit() { if (hum) { hum.stop(0.2); hum = null; } },
    update(dt) {
      t += dt; banner = Math.max(0, banner - dt);
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
      if (w.won) { winT += dt; if (winT > 5 && !scenes.transitioning) scenes.go(scenes.has && scenes.has('ending') ? 'ending' : 'title', {}, { fade: 1 }); }
    },
    render,
  };
}
