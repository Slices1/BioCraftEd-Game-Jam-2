// Game feel: trauma screen shake, hitstop, screen flash, tweens + easing, pooled particles,
// floating text popups, and a camera with smooth follow / bounds / zoom.
// createJuice({view, loop}) bundles them as `game.fx`; each piece is also exported on its own.

import { text } from './ui.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const range = (v, fallback) => (v == null ? fallback : Array.isArray(v) ? rnd(v[0], v[1]) : v);

// ---- Easing ---------------------------------------------------------------------------
export const ease = {
  linear: (t) => t,
  quadIn: (t) => t * t, quadOut: (t) => t * (2 - t), quadInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: (t) => t * t * t, cubicOut: (t) => --t * t * t + 1,
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  quartOut: (t) => 1 - --t * t * t * t, quintOut: (t) => 1 + --t * t * t * t * t,
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2), sineOut: (t) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  expoIn: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)), expoOut: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  circOut: (t) => Math.sqrt(1 - --t * t),
  backIn: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  backOut: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  elasticOut: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  bounceOut: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// ---- Tweens ---------------------------------------------------------------------------
/** tweens.to(target, {prop: endValue}, seconds, {ease, delay, yoyo, repeat (-1 = forever), onUpdate, onDone}) */
export class Tweens {
  constructor() { this.list = []; }
  to(target, props, duration = 0.3, o = {}) {
    const tw = {
      target, props, duration: Math.max(1e-4, duration), t: -(o.delay || 0),
      ease: typeof o.ease === 'string' ? ease[o.ease] || ease.linear : o.ease || ease.quadOut,
      yoyo: !!o.yoyo, repeat: o.repeat || 0, onUpdate: o.onUpdate, onDone: o.onDone,
      from: null, done: false, leg: 0,
      cancel() { tw.done = true; },
      then(fn) { const prev = tw.onDone; tw.onDone = (x) => { if (prev) prev(x); fn(x); }; return tw; },
    };
    this.list.push(tw);
    return tw;
  }
  /** Tween a plain number: tweens.value(0, 1, 0.5, v => ..., opts) */
  value(from, to, duration, onUpdate, o = {}) {
    const box = { v: from };
    return this.to(box, { v: to }, duration, { ...o, onUpdate: () => onUpdate(box.v) });
  }
  cancelOf(target) { for (const tw of this.list) if (tw.target === target) tw.done = true; }
  update(dt) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const tw = list[i];
      if (tw.done) continue;
      tw.t += dt;
      if (tw.t < 0) continue;
      if (!tw.from) { tw.from = {}; for (const k in tw.props) tw.from[k] = tw.target[k]; }
      const p = Math.min(1, tw.t / tw.duration);
      const e = tw.ease(p);
      for (const k in tw.props) tw.target[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
      if (tw.onUpdate) tw.onUpdate(tw.target, p);
      if (p >= 1) {
        tw.leg++;
        const legs = tw.repeat < 0 ? Infinity : (tw.repeat + 1) * (tw.yoyo ? 2 : 1);
        if (tw.leg >= legs) { tw.done = true; if (tw.onDone) tw.onDone(tw.target); }
        else {
          tw.t -= tw.duration;
          if (tw.yoyo) { const f = tw.from; tw.from = tw.props; tw.props = f; }
        }
      }
    }
    if (list.length > 64 || (list.length && list[0].done)) this.list = list.filter((t) => !t.done);
  }
  clear() { this.list.length = 0; }
}

// ---- Screen shake (trauma model: offset ~ trauma^2, decays linearly) ----------------------------
export class Shake {
  constructor({ maxOffset = 26, maxAngle = 0.045, decay = 1.6, frequency = 24 } = {}) {
    Object.assign(this, { maxOffset, maxAngle, decay, frequency });
    this.trauma = 0; this.x = 0; this.y = 0; this.angle = 0; this.t = 0;
    this.seed = [rnd(0, 100), rnd(0, 100), rnd(0, 100)];
  }
  /** Add trauma 0..1 (0.2 small bump, 0.5 hit, 1 explosion). */
  add(amount = 0.3) { this.trauma = Math.min(1, this.trauma + amount); }
  update(dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    const s = this.trauma * this.trauma, f = this.frequency * this.t, [a, b, c] = this.seed;
    const n = (o) => Math.sin(f + o) * 0.6 + Math.sin(f * 1.73 + o * 2.1) * 0.4; // cheap smooth noise
    this.x = this.maxOffset * s * n(a);
    this.y = this.maxOffset * s * n(b);
    this.angle = this.maxAngle * s * n(c);
  }
  reset() { this.trauma = 0; this.x = this.y = this.angle = 0; }
}

// ---- Particles (pooled) ------------------------------------------------------------------
export const particlePresets = {
  sparks: { count: 16, speed: [220, 560], life: [0.22, 0.5], size: [2.5, 4.5], shape: 'line', drag: 3.5, gravity: 0,
    color: ['#ffffff', '#ffe27a', '#ffb347'], endSize: 0.3 },
  dust: { count: 9, speed: [30, 120], life: [0.35, 0.8], size: [7, 13], shape: 'circle', drag: 2.5, gravity: -30,
    color: ['#c9c3d6', '#a8a2b8'], alpha: 0.55, endSize: 1.8 },
  confetti: { count: 48, speed: [260, 720], angle: -Math.PI / 2, spread: 1.4, life: [1.2, 2.2], size: [7, 12],
    shape: 'confetti', drag: 1.4, gravity: 700, spin: [-12, 12],
    color: ['#ff5d73', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'] },
};

export class Particles {
  constructor(max = 900) {
    this.max = max; this.n = 0;
    this.items = Array.from({ length: max }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, endSize: 1, color: '#fff', alpha: 1,
      gravity: 0, drag: 0, shape: 'circle', rot: 0, spin: 0, blend: null,
    }));
  }
  /** emit(x, y, opts): spawn opts.count particles. See particlePresets for option names. */
  emit(x, y, o = {}) {
    const count = Math.round(range(o.count, 10));
    const colors = Array.isArray(o.color) ? o.color : [o.color || '#fff'];
    const spread = o.spread ?? TAU, base = o.angle ?? 0;
    for (let i = 0; i < count; i++) {
      if (this.n >= this.max) return; // pool exhausted: drop, never allocate
      const p = this.items[this.n++];
      const a = base + (spread >= TAU ? Math.random() * TAU : (Math.random() - 0.5) * spread);
      const sp = range(o.speed, 200);
      const r = o.radius ? Math.random() * o.radius : 0, ra = Math.random() * TAU;
      p.x = x + Math.cos(ra) * r; p.y = y + Math.sin(ra) * r;
      p.vx = Math.cos(a) * sp + (o.vx || 0); p.vy = Math.sin(a) * sp + (o.vy || 0);
      p.maxLife = p.life = Math.max(0.01, range(o.life, 0.5));
      p.size = range(o.size, 4); p.endSize = o.endSize ?? 0;
      p.color = colors[(Math.random() * colors.length) | 0];
      p.alpha = o.alpha ?? 1; p.gravity = o.gravity ?? 0; p.drag = o.drag ?? 0;
      p.shape = o.shape || 'circle'; p.rot = Math.random() * TAU; p.spin = range(o.spin, 0);
      p.blend = o.blend || null;
    }
  }
  /** burst('sparks' | presetObject, x, y, overrides) */
  burst(preset, x, y, overrides) {
    const base = typeof preset === 'string' ? particlePresets[preset] : preset;
    if (!base) { console.warn(`[particles] unknown preset "${preset}"`); return; }
    this.emit(x, y, overrides ? { ...base, ...overrides } : base);
  }
  update(dt) {
    const it = this.items;
    for (let i = 0; i < this.n; i++) {
      const p = it[i];
      p.life -= dt;
      if (p.life <= 0) { // swap-remove
        this.n--; it[i] = it[this.n]; it[this.n] = p; i--; continue;
      }
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }
  render(ctx) {
    if (!this.n) return;
    ctx.save();
    const it = this.items;
    for (let i = 0; i < this.n; i++) {
      const p = it[i], t = p.life / p.maxLife, s = p.size * (p.endSize + (1 - p.endSize) * t);
      ctx.globalAlpha = p.alpha * Math.min(1, t * 2.5);
      ctx.globalCompositeOperation = p.blend || 'source-over';
      if (p.shape === 'line') {
        const k = 0.045;
        ctx.strokeStyle = p.color; ctx.lineWidth = s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k); ctx.stroke();
      } else if (p.shape === 'square' || p.shape === 'confetti') {
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        const conf = p.shape === 'confetti', sx = conf ? Math.cos(p.rot * 1.7) : 1, hh = conf ? s * 0.3 : s / 2;
        ctx.fillRect((-s / 2) * sx, -hh, s * sx, hh * 2);
        ctx.rotate(-p.rot); ctx.translate(-p.x, -p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, s / 2), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  clear() { this.n = 0; }
  get count() { return this.n; }
}

// ---- Floating text popups ---------------------------------------------------------------------
export class Popups {
  constructor() { this.list = []; }
  /** add(text, x, y, {color, size, life, rise, outline}) */
  add(str, x, y, o = {}) {
    if (this.list.length > 80) this.list.shift();
    this.list.push({ str: String(str), x, y, vy: -(o.rise ?? 90), life: o.life ?? 0.9, max: o.life ?? 0.9,
      color: o.color || '#fff', size: o.size || 40, outline: o.outline ?? 5 });
  }
  update(dt) {
    for (const p of this.list) { p.life -= dt; p.y += p.vy * dt; p.vy *= Math.exp(-2.5 * dt); }
    if (this.list.length && this.list.some((p) => p.life <= 0)) this.list = this.list.filter((p) => p.life > 0);
  }
  render(ctx) {
    for (const p of this.list) {
      const age = 1 - p.life / p.max;
      const pop = age < 0.15 ? ease.backOut(age / 0.15) : 1;
      text(ctx, p.str, p.x, p.y, { size: p.size * (0.5 + 0.5 * pop), color: p.color, outline: p.outline,
        alpha: Math.min(1, (p.life / p.max) * 3) });
    }
  }
  clear() { this.list.length = 0; }
}

// ---- Camera -------------------------------------------------------------------------
/** Camera centred on (x, y) in world units. begin(ctx)/end(ctx) wrap world drawing. */
export class Camera {
  constructor(view, shake = null) {
    this.view = view; this.shake = shake;
    this.x = 0; this.y = 0; this.zoom = 1;
    this.target = null; this.lerp = 8; this.offsetX = 0; this.offsetY = 0;
    this.bounds = null; this.round = false;
  }
  /** Follow an object with {x, y}. lerp: higher = snappier (0 = locked). */
  follow(target, lerp = 8) { this.target = target; this.lerp = lerp; return this; }
  setBounds(x, y, w, h) { this.bounds = w == null ? null : { x, y, w, h }; return this; }
  snap() { if (this.target) { this.x = this.target.x + this.offsetX; this.y = this.target.y + this.offsetY; } this.clamp(); return this; }
  reset() { this.x = this.y = 0; this.zoom = 1; this.target = null; this.bounds = null; this.offsetX = this.offsetY = 0; }
  update(dt) {
    if (this.target) {
      const tx = this.target.x + this.offsetX, ty = this.target.y + this.offsetY;
      if (this.lerp > 0) { const k = 1 - Math.exp(-this.lerp * dt); this.x += (tx - this.x) * k; this.y += (ty - this.y) * k; }
      else { this.x = tx; this.y = ty; }
    }
    this.clamp();
  }
  clamp() {
    const b = this.bounds;
    if (!b) return;
    const hw = this.view.w / 2 / this.zoom, hh = this.view.h / 2 / this.zoom;
    this.x = b.w <= hw * 2 ? b.x + b.w / 2 : Math.min(Math.max(this.x, b.x + hw), b.x + b.w - hw);
    this.y = b.h <= hh * 2 ? b.y + b.h / 2 : Math.min(Math.max(this.y, b.y + hh), b.y + b.h - hh);
  }
  begin(ctx) {
    const v = this.view, s = this.shake;
    let cx = this.x, cy = this.y;
    if (this.round) { cx = Math.round(cx * this.zoom) / this.zoom; cy = Math.round(cy * this.zoom) / this.zoom; }
    ctx.save();
    ctx.translate(v.w / 2 + (s ? s.x : 0), v.h / 2 + (s ? s.y : 0));
    if (s && s.angle) ctx.rotate(s.angle);
    if (this.zoom !== 1) ctx.scale(this.zoom, this.zoom);
    ctx.translate(-cx, -cy);
  }
  end(ctx) { ctx.restore(); }
  screenToWorld(sx, sy, out = { x: 0, y: 0 }) {
    out.x = (sx - this.view.w / 2) / this.zoom + this.x;
    out.y = (sy - this.view.h / 2) / this.zoom + this.y;
    return out;
  }
  worldToScreen(wx, wy, out = { x: 0, y: 0 }) {
    out.x = (wx - this.x) * this.zoom + this.view.w / 2;
    out.y = (wy - this.y) * this.zoom + this.view.h / 2;
    return out;
  }
  /** Visible world rect {x, y, w, h}. */
  get visible() {
    const w = this.view.w / this.zoom, h = this.view.h / this.zoom;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }
  isVisible(x, y, r = 0) {
    const hw = this.view.w / 2 / this.zoom + r, hh = this.view.h / 2 / this.zoom + r;
    return Math.abs(x - this.x) <= hw && Math.abs(y - this.y) <= hh;
  }
}

// ---- Bundle ---------------------------------------------------------------------------
export function createJuice({ view, loop }) {
  const shake = new Shake();
  const fx = {
    shake,
    camera: new Camera(view, shake),
    particles: new Particles(),
    popups: new Popups(),
    tweens: new Tweens(),
    ease,
    _flash: { color: '#fff', t: 0, dur: 0, alpha: 0 },
    tween(target, props, dur, opts) { return fx.tweens.to(target, props, dur, opts); },
    /** Full-screen flash that fades out. */
    flash(color = '#fff', dur = 0.15, alpha = 0.7) { Object.assign(fx._flash, { color, t: dur, dur, alpha }); },
    /** Freeze game updates for a few frames (0.05-0.15 s feels good). */
    hitstop(seconds = 0.08) { if (loop) loop.hitstop(seconds); },
    burst(preset, x, y, o) { fx.particles.burst(preset, x, y, o); },
    popup(str, x, y, o) { fx.popups.add(str, x, y, o); },
    update(dt) {
      fx.tweens.update(dt); fx.particles.update(dt); fx.popups.update(dt);
      shake.update(dt); fx.camera.update(dt);
      if (fx._flash.t > 0) fx._flash.t = Math.max(0, fx._flash.t - dt);
    },
    /** Particles + popups, in whatever transform is active (inside camera.begin/end for world space). */
    drawWorld(ctx) { fx.particles.render(ctx); fx.popups.render(ctx); },
    /** Screen-space effects (flash). main.js calls this after the scene renders. */
    drawScreen(ctx) {
      const f = fx._flash;
      if (f.t <= 0) return;
      ctx.save();
      ctx.globalAlpha = f.alpha * (f.t / f.dur);
      ctx.fillStyle = f.color;
      ctx.fillRect(-10, -10, view.w + 20, view.h + 20);
      ctx.restore();
    },
    reset() {
      fx.tweens.clear(); fx.particles.clear(); fx.popups.clear(); shake.reset(); fx.camera.reset();
      fx._flash.t = 0;
    },
  };
  return fx;
}
