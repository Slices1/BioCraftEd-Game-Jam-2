// Floor-plane AABB movement on the tile grid with height levels. Bodies: {x, y (centre, tiles), z, hw, flying, pusher, pushable}.
const EPS = 1e-6;
function badTiles(w, b, x, y) {
  let n = 0;
  const x0 = Math.floor(x - b.hw), x1 = Math.floor(x + b.hw - EPS), y0 = Math.floor(y - b.hw), y1 = Math.floor(y + b.hw - EPS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const h = w.heightAt(tx, ty);
    if (b.flying) { if (h >= 2 && !w.isVent(tx, ty)) n++; } else if (h > b.z + 0.01) n++;
  }
  if (!b.flying && w.heightAt(Math.floor(x), Math.floor(y)) < 0) n += 10;
  return n;
}
function bodyAt(w, b, x, y) {
  if (b.flying) return null;
  for (const o of w.bodies) {
    if (o === b || !o.isSolidBody() || Math.abs(o.z - b.z) > 0.5) continue;
    const m = o.hw + b.hw;
    if (Math.abs(o.x - x) < m && Math.abs(o.y - y) < m) {
      const dNew = Math.max(Math.abs(o.x - x), Math.abs(o.y - y)), dOld = Math.max(Math.abs(o.x - b.x), Math.abs(o.y - b.y));
      if (dOld < m && dNew >= dOld) continue; // already overlapping: allow separating
      return o;
    }
  }
  return null;
}
export function canStand(w, b, x, y) { return badTiles(w, b, x, y) === 0 && !bodyAt(w, b, x, y); }

function step(w, b, dx, dy, depth) {
  const nx = b.x + dx, ny = b.y + dy;
  const bad = badTiles(w, b, nx, ny);
  if (bad > 0) {
    const cur = badTiles(w, b, b.x, b.y);
    if (!(cur > 0 && bad < cur)) return false;
  }
  const o = bodyAt(w, b, nx, ny);
  if (!o) { b.x = nx; b.y = ny; return true; }
  if (b.pusher && o.pushable && depth < 2 && move(w, o, dx * 0.9, dy * 0.9, depth + 1)) {
    if (!bodyAt(w, b, nx, ny)) { b.x = nx; b.y = ny; }
    o.pushedT = 0.15;
    return true;
  }
  return false;
}
/** Move with substeps (<=0.08 tiles) + corner assist. Returns true if moved at all. */
export function move(w, b, dx, dy, depth = 0) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.08));
  const sx = dx / n, sy = dy / n;
  let moved = false;
  for (let i = 0; i < n; i++) {
    if (sx) {
      if (step(w, b, sx, 0, depth)) moved = true;
      else if (!sy) { // nudge toward lane centre so 1-tile doorways are easy to hit
        const c = Math.floor(b.y) + 0.5 - b.y;
        if (Math.abs(c) > 0.02 && Math.abs(c) < 0.45) step(w, b, 0, Math.sign(c) * Math.min(Math.abs(c), Math.abs(sx)), depth);
      }
    }
    if (sy) {
      if (step(w, b, 0, sy, depth)) moved = true;
      else if (!sx) {
        const c = Math.floor(b.x) + 0.5 - b.x;
        if (Math.abs(c) > 0.02 && Math.abs(c) < 0.45) step(w, b, Math.sign(c) * Math.min(Math.abs(c), Math.abs(sy)), 0, depth);
      }
    }
  }
  if (!b.flying) settle(w, b);
  return moved;
}
// z = highest tile under the footprint, so stepping DOWN a ledge never leaves the body 'sunk' half on the higher tile.
export function settle(w, b) {
  const x0 = Math.floor(b.x - b.hw), x1 = Math.floor(b.x + b.hw - EPS), y0 = Math.floor(b.y - b.hw), y1 = Math.floor(b.y + b.hw - EPS);
  let z = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const h = w.heightAt(tx, ty); if (h > z && h <= 1.01) z = h; }
  b.z = z;
}
