// Bridge: a flat deck on a slide rail that extends HORIZONTALLY (along +x) across a one-tile chasm.
// The deck is flush with the floor (level 0); the chasm is level -1. Walkable only when fully extended (collision == visual).
// Powered (inputs) -> extends; unpowered -> retracts into the west lip, unless something is standing on it.
import { Entity } from './base.js';
import { P, box, poly, glow, C } from '../iso.js';

const DECK = { top: '#6b6a60', left: '#2c2b26', right: '#3f3d35', edge: 'rgba(0,0,0,0.65)' };
const RAIL = { top: '#d9a62a', left: '#6b4f12', right: '#8a6818', edge: 'rgba(0,0,0,0.6)' };
export class Bridge extends Entity {
  constructor(def) { super(def); this.ext = 0; this.want = false; }
  get solid() { return this.ext >= 0.98; }
  tiles() { return this.solid ? [[this.x, this.y, 0]] : null; }
  update(dt, w) {
    const p = w.powered(this.inputs);
    this.on = p;
    if (p) this.want = true;
    else if (!w.anyOnTile(this.x, this.y, false)) this.want = false;
    const tgt = this.want ? 1 : 0, prev = this.ext;
    this.ext += Math.sign(tgt - this.ext) * Math.min(Math.abs(tgt - this.ext), dt * 1.3);
    if (this.ext !== prev && (this.ext === 1 || this.ext === 0)) w.sfx('magnet_drop', { volume: 0.4, rate: 0.6 });
  }
  get depth() { return this.x + this.y - 0.2; }
  draw(ctx, t) {
    const { x, y } = this, e = this.ext, k = e * e * (3 - 2 * e), dx = -(1 - k);
    // slide-rail housing under the west lip
    box(ctx, x - 0.18, y + 0.1, -0.05, 0.18, 0.8, 0.05, { top: '#2a2a26', left: '#151512', right: '#1d1d1a', edge: 'rgba(0,0,0,.6)' });
    ctx.save();
    // clip to the chasm column so the retracted deck vanishes into the west wall of the gap
    const T = (a, b, z) => P(x + a, y + b, z), h = [T(0, 0, 1.2), T(1, 0, 1.2), T(1, 0, -1), T(1, 1, -1), T(0, 1, -1), T(0, 1, 1.2)];
    ctx.beginPath(); h.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.clip();
    const X = x + dx;
    // support truss under the deck (visible depth)
    box(ctx, X + 0.1, y + 0.1, -0.5, 0.8, 0.8, 0.38, { top: '#1a1915', left: '#14130f', right: '#191813', edge: 'rgba(0,0,0,.6)' });
    box(ctx, X, y, -0.12, 1, 1, 0.12, DECK);
    // planks across the deck (run along y)
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2;
    for (let i = 1; i < 5; i++) { const a = P(X + i / 5, y, 0), b = P(X + i / 5, y + 1, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // hazard-striped leading edge
    for (let i = 0; i < 6; i++) { const a = i / 6, b = (i + 1) / 6;
      poly(ctx, [P(X + 0.84, y + a, 0.005), P(X + 1, y + a, 0.005), P(X + 1, y + b, 0.005), P(X + 0.84, y + b, 0.005)], i % 2 ? '#15130e' : '#d9a62a'); }
    // side rails (both y edges, posts + top bar); the far rail first
    for (const yy of [y, y + 0.9]) {
      if (yy === y + 0.9) continue;
      box(ctx, X, yy, 0, 1, 0.1, 0.06, RAIL); for (const px of [0.02, 0.88]) box(ctx, X + px, yy, 0, 0.1, 0.1, 0.45, RAIL); box(ctx, X, yy, 0.4, 1, 0.1, 0.07, RAIL);
    }
    ctx.restore();
    // near rail drawn after bodies' level is not possible here; keep it low so it never hides a rider
    ctx.save(); ctx.beginPath(); h.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.clip();
    box(ctx, X, y + 0.92, 0, 1, 0.08, 0.1, RAIL); ctx.restore();
    // level indicator: GAP -1 (red) while retracted / moving, FLUSH 0 (green) when the deck is locked in place
    const col = this.solid ? C.green : this.on ? C.amber : C.red, [sx, sy] = P(x + 0.5, y + 0.5, 1.7);
    glow(ctx, x + 0.5, y + 0.5, 1.45, 3, col);
    ctx.save(); ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = col;
    const lab = this.solid ? 'LEVEL 0 · FLUSH' : e > 0.02 && this.want ? 'EXTENDING →' : e > 0.02 ? 'RETRACTING ←' : 'GAP · DROP -1';
    ctx.strokeText(lab, sx, sy); ctx.fillText(lab, sx, sy); ctx.restore();
  }
}
