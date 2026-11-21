// Optional sprites: assets/img/<name>.png (and <name>_se / _ne facing variants). Missing files are ignored.
const NAMES = ['crow', 'suit', 'crate', 'stick', 'plate', 'door', 'cog', 'press', 'crane', 'magnet', 'emitter', 'receiver', 'lift', 'scrap', 'cracked', 'shiny', 'vent'];
const FACED = ['crow', 'suit'];
const imgs = new Map();
function load(name) {
  if (typeof Image === 'undefined') return;
  const im = new Image();
  im.onload = () => imgs.set(name, im);
  im.onerror = () => {};
  im.src = `assets/img/${name}.png`;
}
for (const n of NAMES) load(n);
for (const n of FACED) { load(n + '_se'); load(n + '_ne'); }

export const sprites = {
  get: (name) => imgs.get(name) || null,
  /** Draw anchored at feet (sx, sy), width w. face: 'se'|'sw'|'ne'|'nw'. Returns false if no sprite. */
  draw(ctx, name, face, sx, sy, w) {
    let key = name, flip = false;
    if (face) {
      const k = name + (face[0] === 'n' ? '_ne' : '_se');
      if (imgs.has(k)) { key = k; flip = face[1] === 'w'; }
    }
    const im = imgs.get(key);
    if (!im) return false;
    const h = w * im.height / im.width;
    ctx.save(); ctx.translate(sx, sy); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
    return true;
  },
};
