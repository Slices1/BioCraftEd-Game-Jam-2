// DEMO play scene (replace me). Shows: stick() movement (keys / gamepad / virtual joystick),
// an action with edge detection (dash), camera follow + bounds, particles, popups, shake,
// hitstop, flash, tweens, sounds that may not exist yet, pause support, scene change.

import { TAU, rand, dist, norm, damp, circleCircle } from '../engine/util.js';
import { text } from '../engine/ui.js';

const WORLD_W = 1800, WORLD_H = 1800;

export function playScene(game) {
  const { view, input, audio, fx, scenes } = game;
  const cam = fx.camera;
  const stick = { x: 0, y: 0, len: 0 };
  const tmp = { x: 0, y: 0 };
  let player, pickups, enemies, score, time, level, over, overTimer;

  function spawnPickup() {
    const k = { x: rand(90, WORLD_W - 90), y: rand(90, WORLD_H - 90), r: 24, s: 0, phase: rand(0, TAU) };
    fx.tween(k, { s: 1 }, 0.45, { ease: 'backOut' });
    return k;
  }
  function spawnEnemy() {
    let x, y, tries = 0;
    do { x = rand(80, WORLD_W - 80); y = rand(80, WORLD_H - 80); }
    while (dist(x, y, player.x, player.y) < 650 && ++tries < 40);
    const e = { x, y, r: 30, vx: 0, vy: 0, speed: 160 + level * 22, s: 0, wob: rand(0, TAU) };
    fx.tween(e, { s: 1 }, 0.6, { ease: 'elasticOut' });
    fx.burst('dust', x, y, { count: 14, color: ['#ff5d73', '#a8a2b8'] });
    return e;
  }
  function die() {
    over = true; overTimer = 1.1; player.dead = true;
    fx.hitstop(0.12);
    fx.shake.add(0.9);
    fx.flash('#ff3b5c', 0.35, 0.5);
    fx.burst('sparks', player.x, player.y, { count: 46, speed: [300, 950], color: ['#ffffff', '#7df9ff', '#ff5d73'] });
    audio.play('hit');
    audio.play('lose', { delay: 0.2 });
    audio.duck(0.7, 1400);
  }

  return {
    pausable: true,
    touch: { joystick: true, buttons: [{ id: 'buttonA', label: 'DASH' }] },

    enter() {
      score = 0; time = 0; level = 0; over = false; overTimer = 0;
      player = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, r: 26, dash: 0, cooldown: 0, fx: 1, fy: 0, squash: 1, grace: 1, dead: false };
      pickups = Array.from({ length: 7 }, spawnPickup);
      enemies = [spawnEnemy()];
      cam.setBounds(0, 0, WORLD_W, WORLD_H).follow(player, 7).snap();
      audio.music('music', { fade: 1.5 });
    },

    update(dt) {
      time += dt;
      if (over) {
        overTimer -= dt;
        if (overTimer <= 0 && !scenes.transitioning) scenes.go('gameover', { score }, { fade: 0.5 });
        return;
      }
      const p = player;
      input.stick(stick);
      if (stick.len > 0.1) { p.fx = stick.x / stick.len; p.fy = stick.y / stick.len; }
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.grace = Math.max(0, p.grace - dt);

      if (input.pressed('action') && p.cooldown <= 0) {
        if (input.lastDevice === 'mouse' && stick.len < 0.1) { // click: dash toward the cursor
          cam.screenToWorld(input.mouse.x, input.mouse.y, tmp);
          norm(tmp.x - p.x, tmp.y - p.y, tmp);
          if (tmp.x || tmp.y) { p.fx = tmp.x; p.fy = tmp.y; }
        }
        p.vx = p.fx * 1300; p.vy = p.fy * 1300;
        p.dash = 0.16; p.cooldown = 0.45; p.squash = 1.4;
        fx.burst('dust', p.x, p.y, { count: 10 });
        fx.shake.add(0.12);
        audio.play('dash', { pitchVar: 0.08 });
      }
      if (p.dash > 0) {
        p.dash -= dt;
        fx.particles.emit(p.x, p.y, { count: 1, speed: [5, 30], life: [0.18, 0.3], size: [26, 34], color: '#7df9ff', alpha: 0.35 });
      } else {
        p.vx = damp(p.vx, stick.x * 440, 14, dt);
        p.vy = damp(p.vy, stick.y * 440, 14, dt);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx) * 0.4; }
      if (p.x > WORLD_W - p.r) { p.x = WORLD_W - p.r; p.vx = -Math.abs(p.vx) * 0.4; }
      if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy) * 0.4; }
      if (p.y > WORLD_H - p.r) { p.y = WORLD_H - p.r; p.vy = -Math.abs(p.vy) * 0.4; }
      p.squash = damp(p.squash, 1, 10, dt);

      for (let i = 0; i < pickups.length; i++) {
        const k = pickups[i];
        if (k.s > 0.6 && circleCircle(p, k)) {
          score += 10;
          fx.burst('sparks', k.x, k.y);
          fx.popup('+10', k.x, k.y - 30, { color: '#ffd166', size: 44 });
          fx.shake.add(0.22);
          audio.play('pickup');
          pickups[i] = spawnPickup();
          if (score % 50 === 0) {
            level++;
            enemies.push(spawnEnemy());
            fx.popup('DANGER UP!', p.x, p.y - 70, { color: '#ff5d73', size: 40, life: 1.3 });
            audio.play('powerup');
          }
        }
      }

      for (const e of enemies) {
        e.wob += dt * 6;
        norm(p.x - e.x, p.y - e.y, tmp);
        e.vx = damp(e.vx, tmp.x * e.speed, 2.5, dt);
        e.vy = damp(e.vy, tmp.y * e.speed, 2.5, dt);
        e.x += e.vx * dt; e.y += e.vy * dt;
      }
      for (let i = 0; i < enemies.length; i++) { // keep enemies from stacking
        for (let j = i + 1; j < enemies.length; j++) {
          const a = enemies[i], b = enemies[j], d = dist(a.x, a.y, b.x, b.y), min = a.r + b.r;
          if (d > 0 && d < min) {
            const push = (min - d) / 2 / d, dx = (b.x - a.x) * push, dy = (b.y - a.y) * push;
            a.x -= dx; a.y -= dy; b.x += dx; b.y += dy;
          }
        }
      }
      if (p.grace <= 0) for (const e of enemies) if (e.s > 0.8 && circleCircle(p, e)) { die(); break; }
    },

    render(ctx) {
      ctx.fillStyle = '#0d0d14';
      ctx.fillRect(0, 0, view.w, view.h);
      cam.begin(ctx);
      const v = cam.visible;
      ctx.fillStyle = '#1c1c2a';
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
      ctx.beginPath();
      const G = 100;
      for (let x = Math.max(0, Math.floor(v.x / G) * G); x <= Math.min(WORLD_W, v.x + v.w); x += G) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); }
      for (let y = Math.max(0, Math.floor(v.y / G) * G); y <= Math.min(WORLD_H, v.y + v.h); y += G) { ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, WORLD_W, WORLD_H);

      for (const k of pickups) {
        if (!cam.isVisible(k.x, k.y, 40)) continue;
        const bob = Math.sin(time * 4 + k.phase) * 6, s = Math.max(0.001, k.s);
        ctx.save(); ctx.translate(k.x, k.y + bob); ctx.scale(s, s);
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, k.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(-7, -7, k.r * 0.35, 0, TAU); ctx.fill();
        ctx.restore();
      }
      for (const e of enemies) {
        const s = Math.max(0.001, e.s), r = e.r;
        ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s * (1 + Math.sin(e.wob) * 0.06), s * (1 - Math.sin(e.wob) * 0.06));
        ctx.fillStyle = '#ff5d73'; ctx.fillRect(-r, -r, r * 2, r * 2);
        norm(player.x - e.x, player.y - e.y, tmp);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-10 + tmp.x * 4, -6 + tmp.y * 4, 7, 0, TAU); ctx.arc(10 + tmp.x * 4, -6 + tmp.y * 4, 7, 0, TAU); ctx.fill();
        ctx.restore();
      }
      const p = player;
      if (!p.dead) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.fy, p.fx));
        ctx.scale(p.squash, 1 / p.squash);
        ctx.globalAlpha = p.grace > 0 && Math.floor(time * 16) % 2 ? 0.5 : 1;
        ctx.fillStyle = '#7df9ff'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#10313a'; ctx.beginPath(); ctx.arc(p.r * 0.45, 0, 6, 0, TAU); ctx.fill();
        ctx.restore();
        if (p.cooldown > 0) {
          ctx.strokeStyle = 'rgba(125,249,255,0.6)'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.cooldown / 0.45)); ctx.stroke();
        }
      }
      fx.drawWorld(ctx);
      cam.end(ctx);

      const top = view.safe.top + 14;
      text(ctx, String(score), view.w / 2, top + 44, { size: 68, outline: 6, color: '#fff' });
      text(ctx, `BEST ${Math.max(game.best.get(), score)}`, view.w / 2, top + 100, { size: 26, outline: 4, color: '#b8b8cc' });
      if (time < 4) {
        const hint = view.isTouch ? 'Drag left side to move · DASH to dash' : 'WASD / Arrows to move · Space / Click to dash';
        text(ctx, hint, view.w / 2, view.h * 0.62, { size: 30, outline: 5, alpha: Math.min(1, 4 - time), maxWidth: view.w - 40 });
      }
    },
  };
}
