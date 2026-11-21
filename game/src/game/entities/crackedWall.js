import { Entity } from './base.js';
import { box, P } from '../iso.js';
import { sprites } from '../sprites.js';

const CW = { top: '#4d4740', left: '#24211d', right: '#332f29', edge: 'rgba(0,0,0,.6)' };
export class CrackedWall extends Entity {
  constructor(def) { super(def); this.broken = false; }
  tiles() { return this.broken ? null : [[this.x, this.y, 2]]; }
  draw(ctx) {
    if (this.broken) {
      for (let i = 0; i < 5; i++) box(ctx, this.x + 0.15 + (i * 0.37) % 0.7, this.y + 0.1 + (i * 0.53) % 0.7, 0, 0.18, 0.18, 0.12, CW);
      return;
    }
    const [sx, sy] = P(this.x + 0.5, this.y + 0.5, 0);
    if (sprites.draw(ctx, 'cracked', null, sx, sy + 16, 64)) return;
    box(ctx, this.x, this.y, 0, 1, 1, 2, CW);
    const [a, b] = P(this.x + 1, this.y + 0.5, 1);
    ctx.save(); ctx.strokeStyle = 'rgba(255,182,59,0.8)'; ctx.shadowColor = '#ffb63b'; ctx.shadowBlur = 8; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a - 10, b - 26); ctx.lineTo(a - 3, b - 8); ctx.lineTo(a - 12, b + 4); ctx.lineTo(a - 5, b + 22); ctx.stroke(); ctx.restore();
  }
}
