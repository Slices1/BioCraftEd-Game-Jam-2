import { Entity } from './base.js';
import { P, box, glow, C } from '../iso.js';

const DOOR = { top: '#4a3a40', left: '#26191e', right: '#33232a', edge: 'rgba(0,0,0,0.6)' };
export class Door extends Entity {
  constructor(def) { super(def); this.open = 0; this.isOpen = false; }
  tiles() { return this.open < 0.8 ? [[this.x, this.y, 2]] : null; }
  update(dt, w) {
    const want = w.powered(this.inputs);
    const occupied = w.anyOnTile(this.x, this.y, true);
    if (want !== this.isOpen && (want || !occupied)) {
      this.isOpen = want;
      w.sfx('door_open', { volume: 0.7, rate: want ? 1 : 0.8 });
    }
    const tgt = this.isOpen ? 1 : 0;
    this.open += Math.sign(tgt - this.open) * Math.min(Math.abs(tgt - this.open), dt * 2.5);
  }
  draw(ctx, t) {
    const h = 2 * (1 - this.open);
    box(ctx, this.x, this.y + 0.3, 0, 1, 0.4, 0.08, { top: '#111', left: '#0a0a0a', right: '#0d0d0d' }); // track
    if (h > 0.02) box(ctx, this.x + 0.04, this.y + 0.32, 0, 0.92, 0.36, h, DOOR);
    const col = this.isOpen ? C.green : C.red;
    glow(ctx, this.x + 0.96, this.y + 0.5, Math.max(0.3, h) + 0.1, 2.5, col);
  }
}
