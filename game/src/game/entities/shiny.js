import { Entity } from './base.js';
import { P, box, glow, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class Shiny extends Entity {
  draw(ctx, t) {
    box(ctx, this.x + 0.15, this.y + 0.15, 0, 0.7, 0.7, 0.6, { top: '#55534a', left: '#26251f', right: '#37352e' });
    const z = 1.2 + Math.sin(t * 2) * 0.1, [sx, sy] = P(this.x + 0.5, this.y + 0.5, z);
    if (sprites.draw(ctx, 'shiny', null, sx, sy + 20, 56)) return;
    ctx.save(); ctx.translate(sx, sy); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { // prismatic rays
      const a = t * 0.4 + i * Math.PI / 3, hue = (t * 60 + i * 60) % 360;
      ctx.fillStyle = `hsla(${hue},90%,70%,0.18)`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - .08) * 70, Math.sin(a - .08) * 70); ctx.lineTo(Math.cos(a + .08) * 70, Math.sin(a + .08) * 70); ctx.fill();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34); g.addColorStop(0, 'rgba(255,250,220,.9)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.rotate(Math.sin(t) * 0.3);
    const fac = [[0, -22], [12, -4], [0, 18], [-12, -4]];
    for (let i = 0; i < 4; i++) { const p = fac[i], q = fac[(i + 1) % 4]; ctx.fillStyle = `hsl(${(t * 80 + i * 90) % 360},70%,${60 + i * 6}%)`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.fill(); }
    ctx.restore();
    for (let i = 0; i < 5; i++) { const k = (t * 0.7 + i / 5) % 1, a = i * 2.4 + t; ctx.fillStyle = `rgba(255,255,255,${1 - k})`; const px = sx + Math.cos(a) * 30 * k, py = sy + Math.sin(a) * 20 * k - k * 20; ctx.fillRect(px - 1.5, py - 1.5, 3, 3); }
  }
}
