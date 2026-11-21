import { Body } from './base.js';
import { move } from '../physics.js';
import { P, shadow, glow, poly, facing, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class Crow extends Body {
  constructor(def) {
    super(def, 0.18);
    this.flying = true; this.z = 1.2; this.carry = null; this.inside = null; this.flapT = 0; this.dead = 0;
  }
  isSolidBody() { return false; }
  fly(dt, mx, my, w) {
    const sp = 3.4;
    this.vx += (mx * sp - this.vx) * Math.min(1, dt * 10);
    this.vy += (my * sp - this.vy) * Math.min(1, dt * 10);
    move(w, this, this.vx * dt, this.vy * dt);
    this.face = facing(this.vx, this.vy, this.face);
    const moving = Math.hypot(mx, my) > 0.2;
    this.flapT -= dt;
    if (moving && this.flapT <= 0) { this.flapT = 0.32; w.sfx('flap', { volume: 0.4, pitchVar: 0.1 }); }
  }
  update(dt, w) {
    if (this.inside) this.hidden = true;
    this.z = 1.2 + Math.sin(w.time * 5) * 0.06;
    if (this.inside || w.ctrl.active !== 'crow') { this.vx *= 0.8; this.vy *= 0.8; }
  }
  draw(ctx, t) {
    if (this.hidden) return;
    const gz = Math.max(0, this.groundZ || 0);
    shadow(ctx, this.x, this.y, gz, 14 - (this.z - gz) * 2, 0.4);
    const [sx, sy] = P(this.x, this.y, this.z);
    if (sprites.draw(ctx, 'crow', this.face, sx, sy + 10, 52)) return this.drawCarry(ctx, sx, sy, this.face[1] === 'w' ? -1 : 1);
    const flip = this.face[1] === 'w' ? -1 : 1, back = this.face[0] === 'n';
    const sp = Math.hypot(this.vx, this.vy), rate = 14 + sp * 3, ph = t * rate;
    const flap = Math.sin(ph), tilt = Math.min(0.25, sp * 0.05);
    ctx.save(); ctx.translate(sx, sy); ctx.scale(flip * 1.3, 1.3); ctx.rotate(tilt * 0.6);
    const wing = (dir, col) => { // dir: -1 far wing, 1 near wing
      const up = flap * 16 * dir;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(-4, -26 - up, -22, -30 - up * 1.3);
      ctx.lineTo(-17, -24 - up); ctx.lineTo(-24, -22 - up * 1.1); ctx.lineTo(-15, -17 - up * .6); ctx.lineTo(-20, -13 - up * .4); ctx.quadraticCurveTo(-4, -8, 6, -10); ctx.closePath(); ctx.fill();
    };
    wing(-1, '#08090c');
    // tail
    ctx.fillStyle = '#0a0b0f'; ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-28, -6); ctx.lineTo(-27, -11); ctx.lineTo(-30, -13); ctx.lineTo(-12, -15); ctx.closePath(); ctx.fill();
    // body with soft painterly sheen
    const g = ctx.createLinearGradient(0, -22, 0, -2); g.addColorStop(0, '#2a2c3a'); g.addColorStop(0.45, '#111218'); g.addColorStop(1, '#050507');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -12, 16, 9, -0.12, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.beginPath(); ctx.arc(14, -19, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,130,170,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(14, -19, 6, -2.6, -1.2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -14, 12, 5, -0.12, -2.8, -1.4); ctx.stroke();
    // beak
    ctx.fillStyle = '#26262b'; ctx.beginPath(); ctx.moveTo(19, -22); ctx.lineTo(31, -18); ctx.lineTo(19, -15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, -18.5); ctx.lineTo(29, -18); ctx.stroke();
    // eye (amber glint, not visible from behind)
    if (!back) { ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.arc(16, -21, 1.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(16.3, -22.3, 1, 1); }
    // legs tucked
    ctx.strokeStyle = '#1b1b20'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(-1, 1); ctx.moveTo(6, -4); ctx.lineTo(4, 1); ctx.stroke();
    wing(1, '#14151c');
    ctx.restore();
    this.drawCarry(ctx, sx, sy, flip);
  }
  drawCarry(ctx, sx, sy, flip = 1) {
    if (!this.carry) return;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(flip * 1.3, 1.3);
    ctx.strokeStyle = '#5a4128'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(44, -24); ctx.moveTo(34, -21); ctx.lineTo(40, -31); ctx.stroke();
    ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(11, -15.5); ctx.lineTo(43, -25.5); ctx.stroke();
    ctx.fillStyle = '#56663a'; ctx.beginPath(); ctx.ellipse(41, -33, 4, 2, -0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
