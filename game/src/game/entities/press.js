// Hydraulic press (machine). Jack a suit in at its console; ACT slams the head over every `zone` tile:
// cracked walls break, scrap piles are crushed into a crate.
import { Entity } from './base.js';
import { P, box, glow, tileTop, C, METAL } from '../iso.js';
import { sprites } from '../sprites.js';

const HEAD = { top: '#6a5a3a', left: '#3a2e1e', right: '#4a3a26', edge: 'rgba(0,0,0,.6)' };
export class Press extends Entity {
  constructor(def) {
    super(def);
    this.zone = def.zone; this.console = { x: def.console[0], y: def.console[1] };
    this.head = 1; this.slam = 0; this.hit = false; this.pilot = null;
  }
  label() { return this.slam > 0 ? '' : 'Slam'; }
  control() {}
  act(w) {
    if (this.slam > 0) return;
    this.slam = 0.9; this.hit = false;
  }
  update(dt, w) {
    if (this.slam > 0) {
      this.slam -= dt;
      const k = 0.9 - this.slam;
      if (k < 0.18) this.head = 1 - k / 0.18;
      else { this.head = Math.min(1, (k - 0.3) / 0.6); if (this.head < 0) this.head = 0; }
      if (!this.hit && k >= 0.18) {
        this.hit = true;
        let broke = false;
        for (const [tx, ty] of this.zone) for (const e of w.entities) {
          if (e.type === 'cracked' && !e.broken && e.x === tx && e.y === ty) { e.broken = true; broke = true; }
          if (e.type === 'scrap' && !e.crushed && e.x === tx && e.y === ty) e.crush(w);
        }
        const c = this.center();
        w.juice('slam', c.x, c.y, 0.3);
        w.sfx('press_slam');
        if (broke) w.sfx('wall_break', { delay: 0.05 });
      }
      if (this.slam <= 0) this.head = 1;
    }
  }
  center() {
    let x = 0, y = 0;
    for (const [a, b] of this.zone) { x += a + 0.5; y += b + 0.5; }
    return { x: x / this.zone.length, y: y / this.zone.length };
  }
  get depth() { const c = this.center(); return c.x + c.y + 0.9; }
  draw(ctx, t, w) {
    // console
    const cx = this.console.x, cy = this.console.y, live = w.ctrl.jack === this.id;
    box(ctx, cx + 0.25, cy + 0.25, 0, 0.5, 0.5, 0.45, METAL);
    glow(ctx, cx + 0.5, cy + 0.5, 0.5, 3, live ? C.cyan : C.amber);
    // gantry + head over zone
    const xs = this.zone.map((z) => z[0]), ys = this.zone.map((z) => z[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
    const [sx, sy] = P((x0 + x1) / 2, (y0 + y1) / 2, 3.2);
    if (!sprites.draw(ctx, 'press', null, sx, sy + 110, 140)) {
      box(ctx, x0 - 0.1, y0 - 0.1, 0, 0.2, 0.2, 3.3, METAL);
      box(ctx, x1 - 0.1, y1 - 0.1, 0, 0.2, 0.2, 3.3, METAL);
      box(ctx, x0 - 0.1, y0 - 0.1, 3.1, x1 - x0 + 0.2, y1 - y0 + 0.2, 0.35, METAL);
      const hz = 0.05 + this.head * 2.2;
      box(ctx, x0 + 0.5, y0 + 0.5, hz + 0.4, x1 - x0 - 1 + 0.01 || 0.2, y1 - y0 - 1 + 0.01 || 0.2, 3.1 - hz - 0.4, { top: '#8a8778', left: '#4a4840', right: '#6a675c', edge: 'rgba(0,0,0,.5)' });
      box(ctx, x0 + 0.05, y0 + 0.05, hz, x1 - x0 - 0.1, y1 - y0 - 0.1, 0.4, HEAD);
      // hazard stripes on the ram face + warning shadow on the floor while armed
      const [hx, hy] = P(x0 + (x1 - x0) / 2, y1 - 0.05, hz + 0.2);
      ctx.save(); ctx.beginPath(); ctx.rect(hx - 60, hy - 6, 120, 12); ctx.clip(); ctx.fillStyle = '#c49a30'; ctx.fillRect(hx - 60, hy - 6, 120, 12);
      ctx.fillStyle = '#1a1510'; for (let i = -8; i < 8; i++) { ctx.beginPath(); ctx.moveTo(hx + i * 14, hy + 8); ctx.lineTo(hx + i * 14 + 7, hy + 8); ctx.lineTo(hx + i * 14 + 15, hy - 8); ctx.lineTo(hx + i * 14 + 8, hy - 8); ctx.fill(); } ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.25 + (1 - this.head) * 0.4; tileTop(ctx, x0 + 0.05, y0 + 0.05, 0.01, 'rgba(0,0,0,.6)', null, Math.min(x1 - x0, y1 - y0) - 0.1); ctx.restore();
      if (live) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 8); tileTop(ctx, x0 + 0.1, y0 + 0.1, 0.02, null, C.amber, Math.min(x1 - x0, y1 - y0) - 0.2); ctx.restore(); }
    }
  }
}
