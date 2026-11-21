// Magnet crane (machine): trolley runs along rail row `y` between x0..x1. Joystick moves it,
// ACT grabs the metal body (suit/crate) on the tile under the magnet, or sets it down on the tile below
// (floor or raised level). It can't lift the suit it's being piloted from.
import { Entity } from './base.js';
import { P, box, glow, C, METAL } from '../iso.js';
import { sprites } from '../sprites.js';

export class MagnetCrane extends Entity {
  constructor(def) {
    super(def);
    this.x0 = def.x0; this.x1 = def.x1; this.tx = def.x + 0.5; this.ry = def.y;
    this.console = { x: def.console[0], y: def.console[1] };
    this.holding = null; this.drop = 0; this.pilot = null;
  }
  get tileX() { return Math.floor(this.tx); }
  label(w) { return this.holding ? 'Drop' : (this.target(w) ? 'Grab' : 'Magnet'); }
  target(w) {
    return w.bodies.find((b) => !b.flying && !b.hidden && !b.held && b.id !== this.pilot && b.onTile(this.tileX, this.ry)) || null;
  }
  control(dt, it, w) {
    this.tx = Math.max(this.x0 + 0.5, Math.min(this.x1 + 0.5, this.tx + it.mx * dt * 3));
    if (Math.abs(it.mx) < 0.15) this.tx += (this.tileX + 0.5 - this.tx) * Math.min(1, dt * 8);
  }
  act(w) {
    if (this.holding) {
      const b = w.get(this.holding), tx = this.tileX, ty = this.ry, h = w.heightAt(tx, ty);
      if (h < 0 || h > 1 || w.anyOnTile(tx, ty, false, b)) { w.sfx('ui_click'); return; }
      b.held = false; b.x = tx + 0.5; b.y = ty + 0.5; b.z = h; this.holding = null;
      w.sfx('magnet_drop'); w.juice('land', b.x, b.y, 0.2);
    } else {
      const b = this.target(w);
      if (!b) { w.sfx('ui_click'); return; }
      b.held = true; this.holding = b.id; w.sfx('magnet_on');
    }
  }
  update(dt, w) {
    if (this.holding) { const b = w.get(this.holding); if (b) { b.x = this.tx; b.y = this.ry + 0.5; b.z = 2.1; } }
  }
  get depth() { return this.tx + this.ry + 0.5 + 0.6; }
  draw(ctx, t, w) {
    const live = w.ctrl.jack === this.id;
    box(ctx, this.console.x + 0.25, this.console.y + 0.25, 0, 0.5, 0.5, 0.45, METAL);
    glow(ctx, this.console.x + 0.5, this.console.y + 0.5, 0.5, 3, live ? C.cyan : C.amber);
    // rail (drawn along the row, high up)
    const [ax, ay] = P(this.x0, this.ry + 0.5, 3.4), [bx, by] = P(this.x1 + 1, this.ry + 0.5, 3.4);
    ctx.save(); ctx.strokeStyle = '#2c313a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,182,59,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    const mz = this.holding ? 2.85 : 2.4;
    const [tx, ty] = P(this.tx, this.ry + 0.5, 3.4), [mx, my] = P(this.tx, this.ry + 0.5, mz);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(mx, my); ctx.stroke();
    if (!sprites.draw(ctx, 'magnet', null, mx, my + 14, 50)) {
      box(ctx, this.tx - 0.3, this.ry + 0.2, mz - 0.25, 0.6, 0.6, 0.25, METAL);
      const col = this.holding ? C.magenta : (live ? C.cyan : '#2a4a50');
      glow(ctx, this.tx, this.ry + 0.5, mz - 0.27, 5, col, 3);
    }
    if (live) { // target marker on the tile below
      const [gx, gy] = P(this.tileX + 0.5, this.ry + 0.5, Math.max(0, w.heightAt(this.tileX, this.ry)));
      ctx.save(); ctx.strokeStyle = C.magenta; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(gx, gy, 22, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
}
