import { sprites } from '../sprites.js';
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
    const [sx, sy] = P(this.x + 0.5, this.y + 0.5, 0);
    if (sprites.draw(ctx, 'emitter', null, sx, sy + 12, 46, this.dir[1] > 0 || this.dir[0] < 0)) return;
    box(ctx, this.x + 0.2, this.y + 0.2, 0, 0.6, 0.6, 1.15, METAL);
    glow(ctx, this.x + 0.5 + this.dir[0] * 0.3, this.y + 0.5 + this.dir[1] * 0.3, 1, 4, C.red);
  }
  drawBeam(ctx, t) {
    if (!this.end) return;
    const [dx, dy] = this.dir;
    const a = P(this.x + 0.5 + dx * 0.3, this.y + 0.5 + dy * 0.3, 1);
    const e = this.end, b = P(e[0] + 0.5 - dx * 0.5, e[1] + 0.5 - dy * 0.5, 1);
    const fl = 0.8 + 0.2 * Math.sin(t * 53) * Math.sin(t * 17);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,40,70,${0.16 * fl})`; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = `rgba(255,60,90,${0.45 * fl})`; ctx.lineWidth = 7 + Math.sin(t * 40) * 1.5; ctx.stroke();
    ctx.strokeStyle = '#ffe0e6'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 6; i++) { // hit-point sparks
      const k = (t * 3 + i / 6) % 1, ang = i * 2.1 + Math.floor(t * 3 + i / 6) * 1.7;
      ctx.fillStyle = `rgba(255,${180 + i * 10},150,${1 - k})`; ctx.fillRect(b[0] + Math.cos(ang) * 18 * k - 1.5, b[1] + Math.sin(ang) * 10 * k - k * k * 14 - 1.5, 3, 3);
    }
    const g = ctx.createRadialGradient(b[0], b[1], 0, b[0], b[1], 18 * fl); g.addColorStop(0, 'rgba(255,220,200,.9)'); g.addColorStop(1, 'rgba(255,40,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b[0], b[1], 18 * fl, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
export class Receiver extends Entity {
  get depth() { return this.x + this.y + 1; }
  draw(ctx) {
    const [sx, sy] = P(this.x + 0.5, this.y + 0.5, 0);
    if (sprites.draw(ctx, this.on ? 'receiver_on' : 'receiver', null, sx, sy + 12, 46)) return;
    box(ctx, this.x + 0.2, this.y + 0.2, 0, 0.6, 0.6, 1.15, METAL);
    glow(ctx, this.x + 0.5, this.y + 0.5, 1, 4.5, this.on ? C.green : '#402028');
  }
}
