import { Body } from './base.js';
import { move, settle } from '../physics.js';
import { P, box, shadow, glow, facing, C, METAL } from '../iso.js';
import { sprites, dir8 } from '../sprites.js';

const SUIT = { top: '#4a5260', left: '#232831', right: '#333a46', edge: 'rgba(0,0,0,0.6)' };
export class Suit extends Body {
  constructor(def) {
    super(def, 0.34);
    this.pusher = true; this.stepT = 0; this.walkT = 0; this.carried = !!def.carried;
  }
  walk(dt, mx, my, w) {
    const sp = 2.1;
    this.vx = mx * sp; this.vy = my * sp;
    const moved = move(w, this, this.vx * dt, this.vy * dt);
    this.face = facing(this.vx, this.vy, this.face);
    if (Math.hypot(mx, my) > 0.2) this.dir = dir8(this.vx, this.vy, this.dir);
    if (moved && Math.hypot(mx, my) > 0.2) {
      this.walkT += dt; this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.38; w.sfx('step', { volume: 0.55, pitchVar: 0.12 }); }
    }
  }
  update(dt, w) { if (!this.held) settle(w, this); }
  draw(ctx, t, w) {
    if (this.hidden) return;
    const piloted = w.ctrl.active === this.id, z = this.z;
    shadow(ctx, this.x, this.y, this.held ? w.heightAt(Math.floor(this.x), Math.floor(this.y)) : z, 24, 0.45);
    const [sx, sy] = P(this.x, this.y, z);
    const jackM = w.ctrl.jack && w.get(w.ctrl.jack), jacked = jackM && jackM.pilot === this.id;
    if (jacked) drawCable(ctx, t, sx, sy, jackM);
    const d = this.dir || this.face, walking = piloted && Math.hypot(this.vx, this.vy) > 0.2;
    let ok;
    if (!piloted && !jacked) ok = sprites.drawH(ctx, 'suit_off', sx, sy + 6, 92, d.includes('w'));
    else if (walking && Math.floor(this.walkT * 6) % 2 && (d === 'e' || d === 'w' || d === 'se' || d === 'sw')) ok = sprites.drawH(ctx, 'suit_walk_a', sx, sy + 6, 92, d.includes('w'));
    else ok = sprites.drawDir(ctx, 'suit', d, sx, sy + 6 - (walking ? Math.abs(Math.sin(this.walkT * 10)) * 2 : 0), 92);
    if (!ok) drawMech(ctx, t, sx, sy, this, piloted, jacked);
    if (this.carried && !piloted) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3);
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 26, 13, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
}

function drawCable(ctx, t, sx, sy, m) {
  const c = m.console; const [cx, cy] = P(c.x + 0.5, c.y + 0.5, 0.5);
  const ax = sx - 4, ay = sy - 46, mx = (ax + cx) / 2, my = Math.min(ay, cy) - 50 - Math.sin(t * 4) * 6;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#141619'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, cx, cy); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(79,243,255,0.35)'; ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = 1.8; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -t * 60; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(79,243,255,0.6)'; ctx.beginPath(); ctx.arc(cx, cy, 5 + Math.sin(t * 10) * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMech(ctx, t, sx, sy, s, piloted, jacked) {
  const flip = s.face[1] === 'w' ? -1 : 1, back = s.face[0] === 'n';
  const wk = piloted ? s.walkT * 9 : 0, bob = Math.abs(Math.sin(wk)) * 3;
  const steel = (y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#6d6a5e'); g.addColorStop(0.5, '#4a4840'); g.addColorStop(1, '#2c2b27'); return g; };
  ctx.save(); ctx.translate(sx, sy); ctx.scale(flip, 1);
  // legs (far then near), reverse-jointed
  const leg = (ox, ph, col) => {
    const lift = Math.max(0, Math.sin(wk + ph)) * 6, fwd = Math.cos(wk + ph) * 5 * (piloted ? 1 : 0);
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ox, -36 + bob); ctx.lineTo(ox + 7 + fwd * .5, -20 - lift * .5); ctx.lineTo(ox + fwd, -4 - lift); ctx.stroke();
    ctx.fillStyle = '#23221f'; ctx.beginPath(); ctx.ellipse(ox + fwd + 2, -2 - lift, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(ox + 4 + fwd * .5, -23 - lift * .5, 4, 4); // rust joint
  };
  leg(-8, Math.PI, '#34332e'); 
  // torso
  const ty = -38 + bob;
  ctx.fillStyle = steel(ty - 34, ty + 6); ctx.beginPath(); ctx.moveTo(-20, ty); ctx.lineTo(-24, ty - 22); ctx.lineTo(-14, ty - 34); ctx.lineTo(16, ty - 34); ctx.lineTo(24, ty - 22); ctx.lineTo(18, ty + 4); ctx.lineTo(-14, ty + 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,.25)'; ctx.beginPath(); ctx.moveTo(-23, ty - 22); ctx.lineTo(-14, ty - 33); ctx.lineTo(16, ty - 33); ctx.stroke(); // worn edge highlight
  ctx.fillStyle = 'rgba(110,60,30,.45)'; ctx.beginPath(); ctx.ellipse(10, ty - 4, 7, 3, 0.3, 0, Math.PI * 2); ctx.fill(); // rust streak
  ctx.fillStyle = '#c4a24a'; for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(-16 + i * 6, ty + 1); ctx.fillRect(0, 0, 3, 3); ctx.restore(); }
  // arms
  ctx.fillStyle = '#3a3934'; ctx.fillRect(20, ty - 24, 9, 22); ctx.fillStyle = '#25241f'; ctx.fillRect(21, ty - 3, 10, 7);
  // cyan core
  const pulse = piloted ? 0.75 + 0.25 * Math.sin(t * 6) : 0.25 + 0.1 * Math.sin(t * 2);
  if (!back) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(6, ty - 14, 0, 6, ty - 14, 16); g.addColorStop(0, `rgba(160,250,255,${pulse})`); g.addColorStop(1, 'rgba(79,243,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(6, ty - 14, 16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = piloted ? '#dffcff' : '#3d6a70'; ctx.beginPath(); ctx.arc(6, ty - 14, 4.5, 0, Math.PI * 2); ctx.fill(); }
  // cockpit cradle on top: a nest-like open seat
  const cy = ty - 34;
  ctx.fillStyle = '#25241f'; ctx.beginPath(); ctx.ellipse(-2, cy, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (piloted) { // the crow sits in the cradle
    ctx.fillStyle = '#0c0d11'; ctx.beginPath(); ctx.ellipse(-2, cy - 6, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, cy - 12 + Math.sin(t * 2) * 0.8, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26262b'; ctx.beginPath(); ctx.moveTo(11, cy - 14); ctx.lineTo(20, cy - 11); ctx.lineTo(11, cy - 9); ctx.fill();
    if (!back) { ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(8.5, cy - 13.5, 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#08090c'; ctx.beginPath(); ctx.moveTo(-10, cy - 6); ctx.lineTo(-20, cy - 3); ctx.lineTo(-10, cy - 2); ctx.fill();
  }
  ctx.strokeStyle = '#5a584e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-2, cy, 15, 6, 0, 0.1, Math.PI - 0.1); ctx.stroke();
  // tail cable socket
  ctx.strokeStyle = jacked ? '#4ff3ff' : '#1c1d20'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, ty - 6); ctx.quadraticCurveTo(-34, ty + 2, -30, ty + 22 - bob); ctx.stroke();
  ctx.restore();
  leg2(ctx, sx, sy, flip, wk, bob, piloted);
}
function leg2(ctx, sx, sy, flip, wk, bob, piloted) {
  ctx.save(); ctx.translate(sx, sy); ctx.scale(flip, 1);
  const lift = Math.max(0, Math.sin(wk)) * 6, fwd = Math.cos(wk) * 5 * (piloted ? 1 : 0), ox = 6;
  ctx.strokeStyle = '#4a4840'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ox, -36 + bob); ctx.lineTo(ox + 8 + fwd * .5, -20 - lift * .5); ctx.lineTo(ox + fwd, -4 - lift); ctx.stroke();
  ctx.fillStyle = '#2c2b27'; ctx.beginPath(); ctx.ellipse(ox + fwd + 2, -2 - lift, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
