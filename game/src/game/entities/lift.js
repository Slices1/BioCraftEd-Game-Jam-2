// Lift tile: its height level switches between `off` and `on` levels.
// mode 'hold': powered -> on level, else off level (won't drop to a pit while something stands on it).
// mode 'cycle': while powered, alternates off/on every `period` s (carries riders); unpowered it stays.
import { Entity } from './base.js';
import { box, glow, tileTop, C } from '../iso.js';

const PLAT = { top: '#4b5563', left: '#22272f', right: '#2f3540', edge: 'rgba(0,0,0,0.6)' };
export class Lift extends Entity {
  constructor(def) {
    super(def);
    this.offL = def.off ?? 0; this.onL = def.on ?? 1; this.mode = def.mode || 'hold';
    this.period = def.period || 2.6; this.level = this.offL; this.vis = this.level; this.timer = this.period;
  }
  tiles() { return [[this.x, this.y, this.level]]; }
  setLevel(l, w) {
    if (l === this.level) return;
    if (l < 0 && w.anyOnTile(this.x, this.y, false)) return;
    this.level = l; w.sfx('magnet_drop', { volume: 0.35, rate: 0.6 });
  }
  update(dt, w) {
    const p = w.powered(this.inputs);
    this.on = p;
    if (this.mode === 'hold') this.setLevel(p ? this.onL : this.offL, w);
    else if (p) {
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = this.period; this.setLevel(this.level === this.onL ? this.offL : this.onL, w); }
    }
    this.vis += Math.sign(this.level - this.vis) * Math.min(Math.abs(this.level - this.vis), dt * 4);
  }
  get depth() { return this.x + this.y + 0.1; }
  draw(ctx, t) {
    const bottom = Math.min(this.offL, this.onL, 0) - (this.offL < 0 ? 0 : 0);
    if (this.offL < 0) tileTop(ctx, this.x, this.y, -1, '#050608');
    const h = this.vis - bottom;
    if (h > 0.05) box(ctx, this.x + 0.03, this.y + 0.03, bottom, 0.94, 0.94, h - 0.02, { top: '#1b1f26', left: '#14171c', right: '#181b21' });
    box(ctx, this.x + 0.03, this.y + 0.03, this.vis - 0.12, 0.94, 0.94, 0.12, PLAT);
    const col = this.on ? C.cyan : '#2a4a50';
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = this.on ? 10 : 0;
    tileTop(ctx, this.x + 0.2, this.y + 0.2, this.vis + 0.005, null, col, 0.6); ctx.restore();
  }
}
