import { Body } from './base.js';
import { settle } from '../physics.js';
import { P, box, shadow, glow, C } from '../iso.js';
import { sprites } from '../sprites.js';

const CR = { top: '#5a4b33', left: '#2b2318', right: '#3d3222', edge: 'rgba(0,0,0,0.6)' };
export class Crate extends Body {
  constructor(def) {
    super(def, 0.38);
    this.pushable = true; this.hidden = !!def.hidden; this.pushedT = 0; this.wasHeld = false;
  }
  update(dt, w) {
    if (this.hidden) return;
    this.pushedT = Math.max(0, this.pushedT - dt);
    if (!this.held) settle(w, this);
  }
  draw(ctx, t, w) {
    if (this.hidden) return;
    shadow(ctx, this.x, this.y, this.held ? w.heightAt(Math.floor(this.x), Math.floor(this.y)) : this.z, 22);
    const [sx, sy] = P(this.x, this.y, this.z);
    if (sprites.draw(ctx, 'crate', null, sx, sy + 8, 56)) return;
    box(ctx, this.x - 0.38, this.y - 0.38, this.z, 0.76, 0.76, 0.7, CR);
    const [a, b] = P(this.x + 0.38, this.y, this.z + 0.35);
    ctx.save(); ctx.shadowColor = C.amber; ctx.shadowBlur = 6; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    ctx.strokeRect(a - 4, b - 6, 8, 10); ctx.restore();
    glow(ctx, this.x, this.y, this.z + 0.72, 1.2, 'rgba(255,182,59,0.6)');
  }
}
