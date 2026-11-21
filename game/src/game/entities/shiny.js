import { Entity } from './base.js';
import { P, box, glow, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class Shiny extends Entity {
  draw(ctx, t) {
    box(ctx, this.x + 0.15, this.y + 0.15, 0, 0.7, 0.7, 0.6, { top: '#3d4552', left: '#1d2129', right: '#2a303a' });
    const z = 1.1 + Math.sin(t * 2) * 0.08, [sx, sy] = P(this.x + 0.5, this.y + 0.5, z);
    if (sprites.draw(ctx, 'shiny', null, sx, sy + 14, 40)) return;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.8);
    ctx.shadowColor = '#fff4b0'; ctx.shadowBlur = 30; ctx.fillStyle = '#fff4b0';
    ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 6 : 15; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
    glow(ctx, this.x + 0.5, this.y + 0.5, z, 3, C.magenta, 6);
  }
}
