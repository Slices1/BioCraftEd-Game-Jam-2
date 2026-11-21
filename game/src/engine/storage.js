// Safe localStorage wrapper: never throws (private mode, blocked storage, quota, sandboxed iframes).
// Values are JSON. Keys are namespaced with a prefix so games on the same origin (itch.io) don't collide.

let prefix = 'jamkit:';
const mem = new Map(); // fallback / mirror when localStorage is unavailable
let store;

function getStore() {
  if (store !== undefined) return store;
  try {
    const s = window.localStorage, k = '__probe__';
    s.setItem(k, '1'); s.removeItem(k);
    store = s;
  } catch (e) { store = null; }
  return store;
}

export const storage = {
  setPrefix(p) { prefix = String(p); },
  get prefix() { return prefix; },
  get available() { return !!getStore(); },
  get(key, fallback = null) {
    const k = prefix + key;
    let raw = null;
    try { const s = getStore(); raw = s ? s.getItem(k) : null; } catch (e) { raw = null; }
    if (raw == null) raw = mem.has(k) ? mem.get(k) : null;
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  },
  set(key, value) {
    const k = prefix + key;
    let raw;
    try { raw = JSON.stringify(value); } catch (e) { return false; }
    mem.set(k, raw);
    try { const s = getStore(); if (s) { s.setItem(k, raw); return true; } } catch (e) { /* quota / blocked */ }
    return false;
  },
  remove(key) {
    const k = prefix + key;
    mem.delete(k);
    try { const s = getStore(); if (s) s.removeItem(k); } catch (e) { /* ignore */ }
  },
};

/** Highscore helper. const hs = highscore('best'); hs.get(); hs.submit(score) -> {best, prev, isNew} */
export function highscore(key = 'best', { lowerIsBetter = false } = {}) {
  const better = (a, b) => (lowerIsBetter ? a < b : a > b);
  return {
    get() {
      const v = Number(storage.get(key, null));
      return Number.isFinite(v) ? v : lowerIsBetter ? Infinity : 0;
    },
    has() { return storage.get(key, null) != null; },
    submit(score) {
      const prev = this.get();
      const isNew = Number.isFinite(score) && (!this.has() || better(score, prev));
      if (isNew) storage.set(key, score);
      return { best: isNew ? score : prev, prev, isNew };
    },
    reset() { storage.remove(key); },
  };
}
