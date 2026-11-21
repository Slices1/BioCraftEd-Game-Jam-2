// Laser emitter -> receiver. Beam runs along a grid row/column at z≈1 from the emitter in `dir`,
// stops at the first tall tile or suit/crate; lit receiver turns `on` (doors/lifts list it as input). Kills the crow.
import { Entity } from './base.js';
import { P, box, glow, C, METAL } from '../iso.js';

export class Emitter extends Entity {
  constructor(def) { super(def); this.dir = def.dir || [1, 0]; this.target = def.target; this.beam = []; this.end = null; }
  update(dt, w) {
    const [dx, dy] = this.dir;
    this.beam = [];
    let tx = this.x + dx, ty = this.y + dy, lit = false;
    const rx = w.get(this.target);
    for (let i = 0; i < 40; i++) {
      if (rx && tx === rx.x && ty === rx.y) { lit = true; break; }
      if (w.heightAt(tx, ty) >= 2) break;
      if (w.bodies.some((b) => !b.flying && !b.hidden && !b.held && b.onTile(tx, ty))) { this.end = [tx, ty]; break; }
      this.beam.push([tx, ty]);
      tx += dx; ty += dy;
    }
    this.end = [tx, ty];
    if (rx) rx.on = lit;
  }
  hits(x, y, r) {
    const [dx, dy] = this.dir;
    for (const [tx, ty] of this.beam) {
      const cx = tx + 0.5, cy = ty + 0.5;
      if (dx && Math.abs(y - cy) < 0.2 + r && x + r > tx && x - r < tx + 1) return true;
      if (dy && Math.abs(x - cx) < 0.2 + r && y + r > ty && y - r < ty + 1) return true;
    }
    return false;
  }
  get depth() { return this.x + this.y + 1; }
  draw(ctx, t) {
    box(ctx, this.x + 0.2, this.y + 0.2, 0, 0.6, 0.6, 1.15, METAL);
    glow(ctx, this.x + 0.5 + this.dir[0] * 0.3, this.y + 0.5 + this.dir[1] * 0.3, 1, 4, C.red);
  }
  drawBeam(ctx, t) {
    if (!this.end) return;
    const [dx, dy] = this.dir;
    const a = P(this.x + 0.5 + dx * 0.3, this.y + 0.5 + dy * 0.3, 1);
    const e = this.end, b = P(e[0] + 0.5 - dx * 0.5, e[1] + 0.5 - dy * 0.5, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,40,80,0.35)'; ctx.lineWidth = 9 + Math.sin(t * 40) * 1.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = '#ffd0d8'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
}
export class Receiver extends Entity {
  get depth() { return this.x + this.y + 1; }
  draw(ctx) {
    box(ctx, this.x + 0.2, this.y + 0.2, 0, 0.6, 0.6, 1.15, METAL);
    glow(ctx, this.x + 0.5, this.y + 0.5, 1, 4.5, this.on ? C.green : '#402028');
  }
}
