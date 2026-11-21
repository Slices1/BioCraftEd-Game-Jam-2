// Decorative scenery (no collision). Scattered by world.js along room walls.
import { Entity } from './base.js';
import { P } from '../iso.js';
import { sprites } from '../sprites.js';

export const DECO = { deco_ivy: 46, deco_moss: 50, deco_mushrooms: 30, deco_plant: 42, deco_barrel: 34, deco_lamp: 26, deco_console: 44, deco_arm: 52, deco_log: 48, deco_tree: 46, deco_rock: 30, deco_slab: 40 };
export class Deco extends Entity {
  constructor(def) { super(def); this.spr = def.spr; this.flip = !!def.flip; this.ox = def.ox || 0.5; this.oy = def.oy || 0.5; }
  get depth() { return this.x + this.y + 0.4; }
  draw(ctx) {
    const [sx, sy] = P(this.x + this.ox, this.y + this.oy, 0);
    sprites.draw(ctx, this.spr, null, sx, sy + 4, DECO[this.spr] || 40, this.flip);
  }
}
