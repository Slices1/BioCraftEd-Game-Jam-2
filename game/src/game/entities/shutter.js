// Beat-clock hazards for the finale (world.beatPos = t*174/60). All kill the crow only; suits are immune.
//  shutter: laser line that flashes on the beat: on while ((beat - from) mod cycle) < len; stopped by suits/crates like a laser.
//  piston:  crusher in a 1-tile lane: extended (solid, deadly to the crow) while on, retracted otherwise.
//  cp:      invisible-ish checkpoint: the crow respawns here after dying.
import { Entity } from './base.js';
import { Emitter } from './laser.js';
import { P, box, glow, tileTop, C, METAL } from '../iso.js';

const cyc = (bp, from, cycle) => (((bp - from) % cycle) + cycle) % cycle;

export class Shutter extends Emitter {
  constructor(def) {
    super(def);
    this.isBeam = true; this.from = def.from ?? 0; this.len = def.len ?? 3; this.cycle = def.cycle ?? 8;
    this.isOn = false; this.warn = false; this.pulse = 0;
  }
  update(dt, w) {
    const bp = w.beatPos || 0;
    this.isOn = cyc(bp, this.from, this.cycle) < this.len;
    this.warn = !this.isOn && cyc(bp, this.from - 1, this.cycle) < 1;
    this.pulse = 1 - (bp % 1);
    const [dx, dy] = this.dir;
    let tx = this.x + dx, ty = this.y + dy;
    const path = [];
    for (let i = 0; i < 40; i++) {
      if (w.heightAt(tx, ty) >= 2) break;
      if (w.bodies.some((b) => !b.flying && !b.hidden && !b.held && b.onTile(tx, ty))) break;
      path.push([tx, ty]); tx += dx; ty += dy;
    }
    this.beam = this.isOn ? path : [];
    this.end = [tx, ty];
  }
  draw(ctx, t) {
    box(ctx, this.x + 0.2, this.y + 0.2, 0, 0.6, 0.6, 1.15, METAL);
    glow(ctx, this.x + 0.5 + this.dir[0] * 0.3, this.y + 0.5 + this.dir[1] * 0.3, 1, this.isOn ? 5 : 3, this.isOn ? C.red : this.warn ? C.amber : '#402028');
  }
  drawBeam(ctx, t) {
    if (!this.end || (!this.isOn && !this.warn)) return;
    const [dx, dy] = this.dir;
    const a = P(this.x + 0.5 + dx * 0.3, this.y + 0.5 + dy * 0.3, 1);
    const e = this.end, b = P(e[0] + 0.5 - dx * 0.5, e[1] + 0.5 - dy * 0.5, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (this.isOn) {
      ctx.strokeStyle = 'rgba(255,40,80,0.4)'; ctx.lineWidth = 8 + this.pulse * 8;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = '#ffd0d8'; ctx.lineWidth = 2; ctx.stroke();
    } else if (Math.floor(t * 12) % 2) { // telegraph: amber flicker one beat before
      ctx.strokeStyle = 'rgba(255,182,59,0.45)'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();
  }
}

export class Piston extends Entity {
  constructor(def) {
    super(def);
    this.isBeam = true; this.from = def.from ?? 0; this.len = def.len ?? 3; this.cycle = def.cycle ?? 8;
    this.ext = 0; this.want = false; this.warn = false; this.pulse = 0;
  }
  tiles() { return this.ext > 0.6 ? [[this.x, this.y, 2]] : null; }
  hits(x, y, r) { return this.ext > 0.6 && Math.abs(x - (this.x + 0.5)) < 0.5 + r && Math.abs(y - (this.y + 0.5)) < 0.5 + r; }
  update(dt, w) {
    const bp = w.beatPos || 0;
    let want = cyc(bp, this.from, this.cycle) < this.len;
    this.warn = !want && cyc(bp, this.from - 1, this.cycle) < 1;
    this.pulse = 1 - (bp % 1);
    if (want && this.ext < 0.3 && w.anyOnTile(this.x, this.y, false)) want = false; // never crush a suit/crate
    this.want = want;
    this.ext += Math.sign((want ? 1 : 0) - this.ext) * Math.min(Math.abs((want ? 1 : 0) - this.ext), dt * 7);
  }
  drawBeam() {}
  get depth() { return this.x + this.y + 0.9; }
  draw(ctx, t) {
    const x = this.x, y = this.y;
    tileTop(ctx, x, y, 0.01, '#14161b', this.warn ? C.amber : 'rgba(255,59,79,0.35)');
    const h = Math.max(0.08, this.ext * 2);
    box(ctx, x + 0.06, y + 0.06, 0, 0.88, 0.88, h, { top: this.ext > 0.6 ? '#7a2630' : '#3d4552', left: '#1d2129', right: '#2a303a', edge: 'rgba(0,0,0,0.6)' });
    glow(ctx, x + 0.5, y + 0.5, h + 0.05, 3 + this.pulse * 2, this.ext > 0.6 ? C.red : this.warn ? C.amber : '#553a10');
  }
}

export class Checkpoint extends Entity {
  update(dt, w) {
    const c = w.crow;
    if (c.hidden || c.dead > 0) return;
    if (Math.hypot(c.x - (this.x + 0.5), c.y - (this.y + 0.5)) < 0.9 && !(w.cp && w.cp.id === this.id)) {
      w.cp = { id: this.id, x: this.x + 0.5, y: this.y + 0.5, room: this.room };
      w.sfx('ui_click', { volume: 0.5, rate: 1.4 });
    }
  }
  get depth() { return this.x + this.y; }
  draw(ctx, t, w) {
    const on = w.cp && w.cp.id === this.id;
    tileTop(ctx, this.x + 0.25, this.y + 0.25, 0.02, null, on ? 'rgba(79,243,255,0.7)' : 'rgba(79,243,255,0.2)', 0.5);
  }
}
