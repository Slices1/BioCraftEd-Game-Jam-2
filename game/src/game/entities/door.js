import { Entity } from './base.js';
import { P, box, glow, C } from '../iso.js';

const DOOR = { top: '#5a4a3a', left: '#3a2a20', right: '#4a3628', edge: 'rgba(0,0,0,0.6)' };
export class Door extends Entity {
  constructor(def) { super(def); this.open = 0; this.isOpen = false; }
  tiles() { return this.open < 0.8 ? [[this.x, this.y, 2]] : null; }
  update(dt, w) {
    const want = w.powered(this.inputs);
    const occupied = w.anyOnTile(this.x, this.y, true);
    if (want !== this.isOpen && (want || !occupied)) {
      this.isOpen = want;
      if (want) w.juice('steam', this.x + 0.5, this.y + 0.5);
      w.sfx('door_open', { volume: 0.7, rate: want ? 1 : 0.8 });
    }
    const tgt = this.isOpen ? 1 : 0;
    this.open += Math.sign(tgt - this.open) * Math.min(Math.abs(tgt - this.open), dt * 2.5);
  }
  draw(ctx, t) {
    const o = this.open, h = 2;
    const fr = { top: '#4a4840', left: '#22211d', right: '#2e2d28', edge: 'rgba(0,0,0,.6)' };
    box(ctx, this.x, this.y + 0.3, 0, 1, 0.4, 0.06, { top: '#141310', left: '#0b0a09', right: '#0f0e0c' });
    // two leaves slide apart along x
    const lw = 0.46 * (1 - o);
    if (lw > 0.01) {
      box(ctx, this.x + 0.04, this.y + 0.33, 0, lw, 0.34, h, DOOR);
      box(ctx, this.x + 0.96 - lw, this.y + 0.33, 0, lw, 0.34, h, DOOR);
      const [a, b] = P(this.x + 0.5, this.y + 0.67, h * 0.5);
      ctx.save(); ctx.strokeStyle = 'rgba(224,170,40,.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(a - 28 * (1 - o), b - 14 * (1 - o) - 20); ctx.lineTo(a - 28 * (1 - o), b - 14 * (1 - o) + 16); ctx.stroke(); ctx.restore();
    }
    box(ctx, this.x - 0.02, this.y + 0.3, 0, 0.08, 0.4, h + 0.15, fr);
    box(ctx, this.x + 0.94, this.y + 0.3, 0, 0.08, 0.4, h + 0.15, fr);
    box(ctx, this.x - 0.02, this.y + 0.3, h, 1.04, 0.4, 0.15, fr);
    glow(ctx, this.x + 0.5, this.y + 0.7, h + 0.05, 2.5, this.isOpen ? C.green : C.red);
  }
}
