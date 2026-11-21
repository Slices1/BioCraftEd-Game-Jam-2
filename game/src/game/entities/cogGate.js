// Huge cog mounted on a back wall; it drives a gate mechanism elsewhere (door inputs reference this id).
// A stick jammed in the glowing slot (crow ACT while carrying) locks it: on = true forever.
import { Entity } from './base.js';
import { P, glow, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class CogGate extends Entity {
  // axis 'x' (default): cog on a wall running along x, slot just south of it.  axis 'y': wall runs along y, slot just east.
  constructor(def) { super(def); this.jammed = false; this.ang = 0; this.axis = def.axis || 'x'; this._jt = 0; this._jit = 0; this._said = false; }
  get face() { return this.axis === 'y' ? { x: this.x + 1, y: this.y + 0.5 } : { x: this.x + 0.5, y: this.y + 1 }; }
  get slot() { return this.axis === 'y' ? { x: this.x + 1.3, y: this.y + 0.5 } : { x: this.x + 0.5, y: this.y + 1.3 }; }
  get attach() { const f = this.face; return { x: f.x, y: f.y, z: 1.0 }; }
  update(dt, w) {
    this.on = this.jammed;
    if (!this.jammed) { this.ang += dt * 1.4; return; }
    this._jit = Math.max(0, this._jit - dt * 4);
    this._jt += dt;
    if (this._jt >= 0.5) { // stutter every ~0.5s: twitch, sparks, occasional low grind
      this._jt = 0; this._jit = 1; this.ang += (Math.random() - 0.3) * 0.12;
      if (w) { w.juice('spark', this.slot.x, this.slot.y); if (Math.random() < 0.35) w.sfx('cog_jam', { volume: 0.12 }); }
    }
  }
  get depth() { return this.x + this.y + 0.5; }
  draw(ctx, t, w) {
    const f = this.face, [sx0, sy0] = P(f.x, f.y, 1.5), jx = this.jammed ? Math.sin(t * 95) * 2.5 * this._jit : 0, sx = sx0 + jx, sy = sy0 + (this.jammed ? Math.cos(t * 83) * 1.5 * this._jit : 0);
    const crow = w && w.crow, near = crow && crow.carry && !this.jammed && Math.hypot(this.slot.x - crow.x, this.slot.y - crow.y) < 2.6;
    // drive shaft + housing on the wall
    ctx.fillStyle = '#1e1d1a'; ctx.fillRect(sx - 5, sy + 30, 10, 46); ctx.fillStyle = 'rgba(120,70,35,.5)'; ctx.fillRect(sx - 5, sy + 50, 10, 6);
    if (!sprites.draw(ctx, 'cog', null, sx, sy + 60, 120)) {
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.9); ctx.rotate(this.ang);
      const n = 14, g = ctx.createRadialGradient(-10, -10, 4, 0, 0, 56); g.addColorStop(0, '#7a766a'); g.addColorStop(0.6, '#4b483f'); g.addColorStop(1, '#2a2824');
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, s = Math.PI / n;
        ctx.lineTo(Math.cos(a0 - s * .55) * 44, Math.sin(a0 - s * .55) * 44); ctx.lineTo(Math.cos(a0 - s * .35) * 54, Math.sin(a0 - s * .35) * 54);
        ctx.lineTo(Math.cos(a0 + s * .35) * 54, Math.sin(a0 + s * .35) * 54); ctx.lineTo(Math.cos(a0 + s * .55) * 44, Math.sin(a0 + s * .55) * 44); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2824'; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26, 8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(130,70,35,.5)'; ctx.beginPath(); ctx.arc(20, 14, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5f5b50'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1a1916'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // the stick slot, at the cog's teeth
    const col = this.jammed ? C.green : C.amber, pul = near ? 0.6 + 0.4 * Math.sin(t * 10) : 0.35;
    const [qx, qy] = [sx, sy + 44];
    ctx.fillStyle = '#0c0b09'; ctx.fillRect(qx - 6, qy - 14, 12, 26);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pul;
    const g2 = ctx.createRadialGradient(qx, qy, 0, qx, qy, near ? 34 : 18); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(qx, qy, near ? 34 : 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(qx - 6, qy - 14, 12, 26); ctx.restore();
    if (near) { const b = Math.sin(t * 6) * 4; ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(qx - 8, qy - 30 + b); ctx.lineTo(qx + 8, qy - 30 + b); ctx.lineTo(qx, qy - 20 + b); ctx.fill(); }
    if (this.jammed) { ctx.save(); ctx.strokeStyle = '#5a4128'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(qx - 20, qy + 14); ctx.lineTo(qx + 22, qy - 18); ctx.stroke();
      ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(qx - 19, qy + 12); ctx.lineTo(qx + 21, qy - 19); ctx.stroke(); ctx.restore(); }
  }
}
