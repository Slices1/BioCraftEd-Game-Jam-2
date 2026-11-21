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
    shadow(ctx, this.x, this.y, Math.max(0, this.groundZ || 0), 8, 0.45);
    const [sx, sy] = P(this.x, this.y, this.z);
    if (sprites.draw(ctx, 'crow', this.face, sx, sy + 6, 26)) return this.drawCarry(ctx, sx, sy);
    const flip = this.face[1] === 'w' ? -1 : 1, flap = Math.sin(t * 22) * 5;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(flip, 1);
    ctx.fillStyle = '#07080b';
    ctx.beginPath(); ctx.ellipse(0, -6, 9, 5, -0.15, 0, Math.PI * 2); ctx.fill();        // body
    ctx.beginPath(); ctx.arc(8, -10, 4, 0, Math.PI * 2); ctx.fill();                        // head
    poly(ctx, [[11, -11], [17, -9], [11, -8]], '#1a1c22');                                  // beak
    poly(ctx, [[-8, -6], [-15, -3], [-14, -8]], '#07080b');                                 // tail
    poly(ctx, [[-3, -8], [4, -8], [-2, -16 - flap]], '#0e1016', 'rgba(79,243,255,0.35)', 1); // wing
    ctx.restore();
    glow(ctx, this.x, this.y, this.z, 1.4, C.cyan, 4);
    ctx.save(); ctx.translate(sx + 9 * flip, sy - 11); ctx.fillStyle = C.cyan; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    this.drawCarry(ctx, sx, sy);
  }
  drawCarry(ctx, sx, sy) {
    if (!this.carry) return;
    ctx.save(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - 4, sy - 2); ctx.lineTo(sx + 14, sy - 8); ctx.stroke(); ctx.restore();
  }
}
