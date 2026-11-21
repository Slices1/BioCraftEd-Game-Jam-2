// Huge cog mounted on a back wall; it drives a gate mechanism elsewhere (door inputs reference this id).
// A stick jammed in the glowing slot (crow ACT while carrying) locks it: on = true forever.
import { Entity } from './base.js';
import { P, glow, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class CogGate extends Entity {
  constructor(def) { super(def); this.jammed = false; this.ang = 0; }
  get slot() { return { x: this.x + 0.5, y: this.y + 1.3 }; }
  update(dt) { this.on = this.jammed; if (!this.jammed) this.ang += dt * 1.4; }
  get depth() { return this.x + this.y + 0.5; }
  draw(ctx, t, w) {
    const [sx, sy] = P(this.x + 0.5, this.y + 1, 1.5);
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
