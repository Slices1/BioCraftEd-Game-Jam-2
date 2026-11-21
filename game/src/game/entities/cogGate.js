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
  draw(ctx, t) {
    const [sx, sy] = P(this.x + 0.5, this.y + 1, 1.3);
    if (sprites.draw(ctx, 'cog', null, sx, sy + 40, 90)) return;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.85);
    ctx.rotate(this.ang);
    ctx.fillStyle = '#3a3f48'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    const n = 12;
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 34 : 42; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#23272e'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#2f343c'; ctx.fillRect(-4, 6, 8, 16); }
    ctx.restore();
    const col = this.jammed ? C.green : C.amber;
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col;
    ctx.fillRect(sx - 3, sy - 9, 6, 18); ctx.restore();
    if (this.jammed) { ctx.save(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx - 14, sy + 10); ctx.lineTo(sx + 16, sy - 12); ctx.stroke(); ctx.restore(); }
    // drive shaft down the wall
    ctx.fillStyle = '#1b1e24'; ctx.fillRect(sx - 3, sy + 36, 6, 40);
  }
}
