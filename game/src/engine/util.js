// Math, vectors, RNG, collision and angle helpers. Pure functions, no dependencies.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

// ---- Scalars -----------------------------------------------------------------
export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v, a0, a1, b0, b1, clamped = false) => {
  let t = invLerp(a0, a1, v);
  if (clamped) t = clamp(t);
  return lerp(b0, b1, t);
};
export const smoothstep = (a, b, v) => { const t = clamp(invLerp(a, b, v)); return t * t * (3 - 2 * t); };
/** Frame-rate independent smoothing toward b. lambda ~ 1..20 (higher = snappier). */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
/** Move v toward target by at most delta. */
export const approach = (v, target, delta) => (v < target ? Math.min(v + delta, target) : Math.max(v - delta, target));
export const wrap = (v, min, max) => { const r = max - min; return ((((v - min) % r) + r) % r) + min; };
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

// ---- Vectors (plain {x, y} objects) -----------------------------------------------
export const vec = (x = 0, y = 0) => ({ x, y });
export const len = (x, y) => Math.hypot(x, y);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
/** Normalize (x, y) into out (default new object). Zero vector stays zero. */
export const norm = (x, y, out = { x: 0, y: 0 }) => {
  const l = Math.hypot(x, y);
  out.x = l > 0 ? x / l : 0; out.y = l > 0 ? y / l : 0;
  return out;
};
export const v2 = {
  add: (a, b, o = vec()) => ((o.x = a.x + b.x), (o.y = a.y + b.y), o),
  sub: (a, b, o = vec()) => ((o.x = a.x - b.x), (o.y = a.y - b.y), o),
  scale: (a, s, o = vec()) => ((o.x = a.x * s), (o.y = a.y * s), o),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  len: (a) => Math.hypot(a.x, a.y),
  dist: (a, b) => Math.hypot(b.x - a.x, b.y - a.y),
  norm: (a, o = vec()) => norm(a.x, a.y, o),
  lerp: (a, b, t, o = vec()) => ((o.x = lerp(a.x, b.x, t)), (o.y = lerp(a.y, b.y, t)), o),
  angle: (a) => Math.atan2(a.y, a.x),
  fromAngle: (ang, length = 1, o = vec()) => ((o.x = Math.cos(ang) * length), (o.y = Math.sin(ang) * length), o),
  rotate: (a, ang, o = vec()) => {
    const c = Math.cos(ang), s = Math.sin(ang), x = a.x * c - a.y * s, y = a.x * s + a.y * c;
    o.x = x; o.y = y; return o;
  },
  limit: (a, max, o = a) => {
    const l = Math.hypot(a.x, a.y);
    if (l > max && l > 0) { o.x = (a.x / l) * max; o.y = (a.y / l) * max; } else { o.x = a.x; o.y = a.y; }
    return o;
  },
  copy: (a) => ({ x: a.x, y: a.y }),
};

// ---- Angles ------------------------------------------------------------------
export const normAngle = (a) => wrap(a, -Math.PI, Math.PI);
/** Shortest signed difference from a to b, in (-PI, PI]. */
export const angleDiff = (a, b) => normAngle(b - a);
export const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const deg2rad = (d) => d * DEG;
export const rad2deg = (r) => r / DEG;

// ---- Seeded RNG (mulberry32) ---------------------------------------------------------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function createRng(seed = (Math.random() * 4294967296) >>> 0) {
  let s = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    seed,
    next,
    /** float in [a, b) */
    range: (a = 0, b = 1) => a + (b - a) * next(),
    /** integer in [a, b] inclusive */
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p = 0.5) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    angle: () => next() * TAU,
    pick: (arr) => (arr && arr.length ? arr[Math.floor(next() * arr.length)] : undefined),
    /** In-place Fisher-Yates; returns arr. */
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    },
  };
  return r;
}

/** Shared default RNG (random seed). Use createRng(seed) for reproducible streams. */
export const rng = createRng();
export const rand = (a = 0, b = 1) => rng.range(a, b);
export const randInt = (a, b) => rng.int(a, b);
export const chance = (p) => rng.chance(p);
export const pick = (arr) => rng.pick(arr);
export const shuffle = (arr) => rng.shuffle(arr);

// ---- Collision (rects are {x, y, w, h} top-left; circles are {x, y, r}) -----------------
export const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const circleCircle = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
};
export const circleRect = (c, rect) => {
  const nx = clamp(c.x, rect.x, rect.x + rect.w), ny = clamp(c.y, rect.y, rect.y + rect.h);
  const dx = c.x - nx, dy = c.y - ny;
  return dx * dx + dy * dy < c.r * c.r;
};
export const pointInRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
export const pointInCircle = (px, py, c) => { const dx = px - c.x, dy = py - c.y; return dx * dx + dy * dy <= c.r * c.r; };
/** Push circle c out of rect (mutates c). Returns true if they overlapped. */
export function resolveCircleRect(c, rect) {
  const nx = clamp(c.x, rect.x, rect.x + rect.w), ny = clamp(c.y, rect.y, rect.y + rect.h);
  let dx = c.x - nx, dy = c.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2), push = c.r - d;
    c.x += (dx / d) * push; c.y += (dy / d) * push;
  } else { // center inside rect: push out along the shallowest axis
    const l = c.x - rect.x, r = rect.x + rect.w - c.x, t = c.y - rect.y, b = rect.y + rect.h - c.y;
    const m = Math.min(l, r, t, b);
    if (m === l) c.x = rect.x - c.r; else if (m === r) c.x = rect.x + rect.w + c.r;
    else if (m === t) c.y = rect.y - c.r; else c.y = rect.y + rect.h + c.r;
  }
  return true;
}
