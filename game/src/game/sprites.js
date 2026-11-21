// Sprites: assets/img/<name>.png (sliced by tools/slice_sprites.py). Missing files are ignored -> vector fallback.
const NAMES = ['cog_empty','cog_jammed','cracked','crane_chain','crane_console_on','crane_console','crane_rail','crane_trolley','crate','crow_flya_e','crow_flya_ne','crow_flya_n','crow_flya_se','crow_flya_s','crow_flyb_e','crow_flyb_ne','crow_flyb_n','crow_flyb_se','crow_flyb_s','crow_idle_e','crow_idle_ne','crow_idle_n','crow_idle_se','crow_idle_s','crow_stick_e','crow_stick_ne','crow_stick_se','deco_arm','deco_barrel','deco_console','deco_ivy','deco_lamp','deco_log','deco_moss','deco_mushrooms','deco_plant','deco_rock','deco_slab','deco_tree','door_open','door','emitter','gate_closed','gate_open','lift_high','lift_low','magnet_on','magnet','plate_on','plate','press_off','press_on','receiver_on','receiver','rubble','scrap','shiny','stick','suit_e','suit_ne','suit_n','suit_off','suit_se','suit_s','suit_walk_a','suit_walk_b','title_logo','vent'];
const imgs = new Map();
function load(name, ext = 'png') {
  if (typeof Image === 'undefined') return;
  const im = new Image();
  im.onload = () => imgs.set(name, im);
  im.onerror = () => {};
  im.src = `assets/img/${name}.${ext}`;
}
for (const n of NAMES) load(n);
load('cutscene_rooftop', 'jpg');

// 8 screen directions from world velocity; drawn with 5 painted views (s,se,e,ne,n) + mirroring.
const DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const MIRROR = { sw: 'se', w: 'e', nw: 'ne' };
export function dir8(vx, vy, prev = 'se') {
  if (Math.abs(vx) + Math.abs(vy) < 1e-3) return prev;
  const a = Math.atan2((vx + vy) * 0.5, vx - vy);
  return DIRS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
const FACE8 = { se: 'se', sw: 'sw', ne: 'ne', nw: 'nw' };

export const sprites = {
  get: (name) => imgs.get(name) || null,
  has: (name) => imgs.has(name),
  /** Draw sprite anchored at feet (sx, sy), width w (h derived). Returns false if not loaded. */
  draw(ctx, name, face, sx, sy, w, flip = false) {
    const im = imgs.get(name);
    if (!im) return false;
    const h = w * im.height / im.width;
    ctx.save(); ctx.translate(sx, sy); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
    return true;
  },
  /** Draw by height h, anchored at feet. */
  drawH(ctx, name, sx, sy, h, flip = false) {
    const im = imgs.get(name);
    if (!im) return false;
    const w = h * im.width / im.height;
    ctx.save(); ctx.translate(sx, sy); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
    return true;
  },
  /** Directional sprite: base + '_' + view, mirroring west-facing views. */
  drawDir(ctx, base, dir, sx, sy, h) {
    dir = FACE8[dir] || dir;
    const v = MIRROR[dir] || dir;
    return this.drawH(ctx, base + '_' + v, sx, sy, h, !!MIRROR[dir]);
  },
};
