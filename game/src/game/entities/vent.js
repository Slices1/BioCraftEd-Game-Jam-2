// Vent: a 1-tile hole in a tall wall that only the crow fits through (tile char 'v' in the room map).
import { Entity } from './base.js';
import { box, P, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class Vent extends Entity {
  get depth() { return this.x + this.y + 1; }
  draw(ctx, t) {
    return; // the hole in the wall is drawn by the play scene (tallBlock)
    const [sx, sy] = P(this.x + 0.5, this.y + 0.5, 1.2);
    if (sprites.draw(ctx, 'vent', null, sx, sy + 30, 64)) return;
    box(ctx, this.x, this.y, 1.7, 1, 1, 0.3, { top: '#3d4552', left: '#1d2129', right: '#2a303a', edge: 'rgba(0,0,0,.5)' });
    box(ctx, this.x, this.y, 0, 1, 1, 0.2, { top: '#20242b', left: '#15181d', right: '#1a1d23' });
    ctx.save(); ctx.strokeStyle = 'rgba(79,243,255,0.5)'; ctx.shadowColor = C.cyan; ctx.shadowBlur = 8; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx - 18, sy - 14 + i * 9); ctx.lineTo(sx + 18, sy - 14 + i * 9); ctx.stroke(); }
    ctx.restore();
  }
}
