import { Entity } from './base.js';
import { P, tileTop, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class Plate extends Entity {
  constructor(def) { super(def); this.base = 0; }
  update(dt, w) {
    this.base = Math.max(0, w.baseHeight(this.x, this.y));
    const was = this.on;
    this.on = w.bodies.some((b) => !b.flying && !b.held && b.onTile(this.x, this.y) && Math.abs(b.z - this.base) < 0.5);
    if (this.on !== was) w.sfx(this.on ? 'plate_on' : 'ui_click', { volume: 0.7 });
  }
  get depth() { return this.x + this.y + 0.2; }
  draw(ctx, t) {
    const z = this.base + (this.on ? 0.01 : 0.06);
    const [sx, sy] = P(this.x + 0.5, this.y + 0.5, z);
    if (sprites.draw(ctx, 'plate', null, sx, sy + 12, 56)) return;
    const col = this.on ? C.green : C.amber;
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = this.on ? 16 : 6;
    tileTop(ctx, this.x + 0.15, this.y + 0.15, z, '#2a2f38', col, 0.7); ctx.restore();
    tileTop(ctx, this.x + 0.3, this.y + 0.3, z, this.on ? 'rgba(93,255,138,0.35)' : 'rgba(255,182,59,0.15)', null, 0.4);
  }
}
