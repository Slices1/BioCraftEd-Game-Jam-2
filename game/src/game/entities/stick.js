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
    if (sprites.draw(ctx, 'stick', null, sx, sy + 6, 34)) return;
    shadow(ctx, this.x, this.y, 0, 12, 0.25);
    glow(ctx, this.x, this.y, 0.1, 6, 'rgba(255,182,59,0.12)', 3);
    ctx.save(); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - 12, sy - 2); ctx.lineTo(sx + 12, sy - 6); ctx.moveTo(sx + 2, sy - 4); ctx.lineTo(sx + 6, sy - 10); ctx.stroke(); ctx.restore();
  }
}
