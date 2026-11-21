import { Entity } from './base.js';
import { P, shadow, glow } from '../iso.js';
import { sprites } from '../sprites.js';

export class Stick extends Entity {
  constructor(def) {
    super(def);
    this.x = def.x + 0.5; this.y = def.y + 0.5; this.rx = this.x; this.ry = this.y;
    this.carried = false; this.used = false;
  }
  get depth() { return this.x + this.y; }
  rest(x, y) { this.x = this.rx = x; this.y = this.ry = y; this.carried = false; }
  returnToRest() { this.x = this.rx; this.y = this.ry; this.carried = false; }
  draw(ctx, t) {
    if (this.carried || this.used) return;
    const [sx, sy] = P(this.x, this.y, 0.05);
    const pu = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(sx, sy - 2, 0, sx, sy - 2, 30 + pu * 6); gr.addColorStop(0, `rgba(255,214,120,${0.28 + 0.2 * pu})`); gr.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 34 + pu * 6, 20 + pu * 3, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i / 3) % 1, a = Math.sin(ph * Math.PI);
      ctx.fillStyle = `rgba(255,236,170,${0.8 * a})`; const px = sx + Math.sin(i * 2.1 + 1) * 14, py = sy - 4 - ph * 22, r = 1.2 + a * 1.2;
      ctx.fillRect(px - r, py - 0.5, r * 2, 1); ctx.fillRect(px - 0.5, py - r, 1, r * 2); }
    ctx.restore();
    if (sprites.draw(ctx, 'stick', null, sx, sy + 6, 34)) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + 0.2 * pu; sprites.draw(ctx, 'stick', null, sx, sy + 6, 36); ctx.restore(); return;
    }
    shadow(ctx, this.x, this.y, 0, 12, 0.25);
    glow(ctx, this.x, this.y, 0.1, 6, 'rgba(255,182,59,0.12)', 3);
    ctx.save(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - 12, sy - 2); ctx.lineTo(sx + 12, sy - 6); ctx.moveTo(sx + 2, sy - 4); ctx.lineTo(sx + 6, sy - 10); ctx.stroke(); ctx.restore();
  }
}
