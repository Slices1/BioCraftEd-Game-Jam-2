import { Entity } from './base.js';
import { P, tileTop, box, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class Plate extends Entity {
  constructor(def) { super(def); this.base = 0; }
  update(dt, w) {
    this.base = Math.max(0, w.baseHeight(this.x, this.y));
    const was = this.on;
    this.on = w.bodies.some((b) => !b.flying && !b.held && b.onTile(this.x, this.y) && Math.abs(b.z - this.base) < 0.5);
    if (this.on !== was && this.on) w.juice('click', this.x + 0.5, this.y + 0.5);
    if (this.on !== was) w.sfx(this.on ? 'plate_on' : 'ui_click', { volume: 0.7 });
  }
  get depth() { return this.x + this.y + 0.2; }
  draw(ctx, t) {
    if (this.on !== this._was) { if (this.on) this._flash = 1; this._was = this.on; }
    this._flash = Math.max(0, (this._flash || 0) - 0.04);
    const z = this.base + (this.on ? 0.0 : 0.07);
    const [sx, sy] = P(this.x + 0.5, this.y + 0.5, z);
    if (sprites.draw(ctx, 'plate', null, sx, sy + 12, 56)) return;
    const col = this.on ? C.green : C.amber;
    tileTop(ctx, this.x + 0.08, this.y + 0.08, this.base, '#151411', null, 0.84);
    if (!this.on) box(ctx, this.x + 0.12, this.y + 0.12, this.base, 0.76, 0.76, 0.07, { top: '#4f4b40', left: '#26241f', right: '#34322b', edge: 'rgba(0,0,0,.5)' });
    else tileTop(ctx, this.x + 0.12, this.y + 0.12, z + 0.005, '#3a372f', 'rgba(0,0,0,.6)', 0.76);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = this.on ? 0.9 : 0.5 + 0.2 * Math.sin(t * 3);
    tileTop(ctx, this.x + 0.25, this.y + 0.25, z + 0.01, null, col, 0.5);
    if (this.on || this._flash > 0) { ctx.globalAlpha = 0.25 + this._flash * 0.7; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40 + this._flash * 30); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, 40 + this._flash * 30, 20 + this._flash * 15, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}
