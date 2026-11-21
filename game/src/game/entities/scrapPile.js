// Scrap pile (low obstacle). The press crushes it into the hidden crate `crate` placed on the same tile.
import { Entity } from './base.js';
import { box, P, glow, C } from '../iso.js';
import { sprites } from '../sprites.js';

export class ScrapPile extends Entity {
  constructor(def) { super(def); this.crushed = false; this.crate = def.crate; }
  tiles() { return this.crushed ? null : [[this.x, this.y, 1]]; }
  crush(w) {
    this.crushed = true;
    const c = w.get(this.crate);
    if (c) { c.hidden = false; c.x = this.x + 0.5; c.y = this.y + 0.5; c.z = 0; }
    w.sfx('crate_land', { delay: 0.1 });
  }
  draw(ctx, t) {
    if (this.crushed) return;
    const [sx, sy] = P(this.x + 0.5, this.y + 0.5, 0);
    if (sprites.draw(ctx, 'scrap', null, sx, sy + 16, 64)) return;
    const parts = [[0.1, 0.2, 0.4, 0.3, 0.35], [0.45, 0.1, 0.4, 0.4, 0.5], [0.2, 0.55, 0.5, 0.35, 0.3], [0.3, 0.3, 0.3, 0.3, 0.7]];
    for (const [x, y, w, d, h] of parts) box(ctx, this.x + x, this.y + y, 0, w, d, h, { top: '#4a4f58', left: '#1f2228', right: '#2d3139', edge: 'rgba(0,0,0,.6)' });
    glow(ctx, this.x + 0.6, this.y + 0.4, 0.75, 1.5, C.magenta);
  }
}
