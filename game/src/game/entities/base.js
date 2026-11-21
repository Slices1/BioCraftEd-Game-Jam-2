// Base entity: plain-data state (anything not starting with '_') is snapshotted for room reset.
export class Entity {
  constructor(def) {
    this.id = def.id; this.type = def.type; this.room = def.room;
    this.x = def.x; this.y = def.y; this.z = 0;
    this.inputs = def.inputs || null;
    this.on = false;
  }
  save() { const o = {}; for (const k in this) if (k[0] !== '_') o[k] = this[k]; return JSON.parse(JSON.stringify(o)); }
  load(s) { Object.assign(this, JSON.parse(JSON.stringify(s))); }
  get depth() { return this.x + this.y + 1; } // tile entities: tile centre
  tiles() { return null; }                  // [[tx, ty, h]] height overrides
  update() {}
  draw() {}
}
// Physical body (centre coords, tile units).
export class Body extends Entity {
  constructor(def, hw) {
    super(def);
    this.x = def.x + 0.5; this.y = def.y + 0.5;
    this.hw = hw; this.flying = false; this.pusher = false; this.pushable = false;
    this.held = false; this.hidden = false; this.face = 'se'; this.vx = 0; this.vy = 0;
  }
  get depth() { return this.x + this.y; }
  isSolidBody() { return !this.held && !this.hidden && !this.flying; }
  onTile(tx, ty) { return !this.hidden && Math.floor(this.x) === tx && Math.floor(this.y) === ty; }
}
