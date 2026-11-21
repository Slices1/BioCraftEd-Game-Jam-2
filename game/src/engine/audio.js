// WebAudio manager. One AudioContext, buses: master <- (music -> duck) + sfx.
// Never throws: missing sounds warn once, a missing WebAudio API turns everything into no-ops.
//
//   audio.load({hit: 'assets/hit.mp3', step: ['assets/s1.ogg', 'assets/s2.ogg']})  -> Promise (never rejects)
//   audio.register(name, AudioBuffer | [names or AudioBuffers], {cooldown, maxVoices, volume, pitchVar})
//   audio.play(name, {volume, rate, pitchVar, pan, loop, delay, offset, bus}) -> handle {stop(fade), setVolume(v)}
//   audio.music(name | null, {fade, volume, loop})  crossfades; waits for the buffer if not loaded yet
//   audio.duck(amount, ms), audio.setMuted(bool) / toggleMute(), audio.setVolume('master'|'music'|'sfx', v)
// Variations: names that map to arrays pick randomly; buffers registered as `hit_1`, `hit_2`, ...
// are automatically used as variations of `hit`.
// Other modules can schedule their own nodes: audio.ctx, audio.master, audio.musicBus, audio.sfxBus.

import { storage } from './storage.js';

const NOOP = Object.freeze({ playing: false, source: null, gain: null, stop() {}, setVolume() {} });

export function createAudio({
  muteKey = 'muted', volumes = { master: 1, music: 0.7, sfx: 1 },
  defaultCooldown = 0.03, defaultMaxVoices = 6, iosPlayback = true, limiter = true,
} = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  if (AC) {
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } }
  }
  // iOS 17+: play through the silent switch like a game/video would.
  if (iosPlayback) { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ } }

  const buffers = new Map();   // name -> AudioBuffer
  const groups = new Map();    // name -> [names]   (explicit variations)
  const autoVars = new Map();  // base -> Set(names) (from `base_N` registrations)
  const settings = new Map();  // name -> {cooldown, maxVoices, volume, pitchVar, rate}
  const voices = new Map();    // name -> [handles]
  const lastPlay = new Map();
  const lastPick = new Map();
  const warned = new Set();
  const muteListeners = new Set();
  let musicState = { name: null, opts: {}, handle: null };
  let hiddenSuspended = false, everRan = false;

  const audio = {
    ctx,
    enabled: !!ctx,
    unlocked: false,
    muted: !!storage.get(muteKey, false),
    buffers,
    master: null, musicBus: null, sfxBus: null, duckGain: null, out: null,
    get state() { return ctx ? ctx.state : 'unavailable'; },
    get currentMusic() { return musicState.name; },
  };

  if (ctx) {
    audio.out = ctx.createGain();
    audio.out.gain.value = audio.muted ? 0 : 1;
    audio.master = ctx.createGain(); audio.master.gain.value = volumes.master ?? 1;
    audio.sfxBus = ctx.createGain(); audio.sfxBus.gain.value = volumes.sfx ?? 1;
    audio.musicBus = ctx.createGain(); audio.musicBus.gain.value = volumes.music ?? 0.7;
    audio.duckGain = ctx.createGain(); audio.duckGain.gain.value = 1;
    audio.sfxBus.connect(audio.master);
    audio.musicBus.connect(audio.duckGain); audio.duckGain.connect(audio.master);
    let tail = audio.master;
    if (limiter && ctx.createDynamicsCompressor) {
      try {
        const c = ctx.createDynamicsCompressor();
        c.threshold.value = -3; c.knee.value = 4; c.ratio.value = 12; c.attack.value = 0.003; c.release.value = 0.2;
        tail.connect(c); tail = c; audio.limiter = c;
      } catch (e) { /* ignore */ }
    }
    tail.connect(audio.out);
    audio.out.connect(ctx.destination);
    ctx.onstatechange = () => {
      audio.unlocked = ctx.state === 'running';
      if (audio.unlocked) { everRan = true; startPendingMusic(); }
    };
  }
  audio.bus = { master: audio.master, music: audio.musicBus, sfx: audio.sfxBus };

  const isBuffer = (v) => v && typeof v.getChannelData === 'function';
  const warnOnce = (key, msg) => { if (!warned.has(key)) { warned.add(key); console.warn(msg); } };

  /** Resume the context. Must run inside a user gesture on iOS; safe to call any time. */
  audio.unlock = () => {
    if (!ctx || hiddenSuspended) return;
    if (ctx.state !== 'running') {
      try {
        const p = ctx.resume();
        if (p && p.then) p.then(() => { if (ctx.state === 'running') { audio.unlocked = everRan = true; startPendingMusic(); } }, () => {});
      } catch (e) { /* ignore */ }
      try { // iOS: a sound started inside the gesture is what really unlocks output
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, 22050);
        s.connect(ctx.destination); s.start(0);
      } catch (e) { /* ignore */ }
    }
    audio.unlocked = ctx.state === 'running';
  };
  // Keep retrying on every gesture (iOS can re-suspend after calls/backgrounding: state 'interrupted').
  if (ctx) {
    const onGesture = () => { if (ctx.state !== 'running') audio.unlock(); };
    for (const t of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
      window.addEventListener(t, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenSuspended = true; try { ctx.suspend().catch(() => {}); } catch (e) { /* ignore */ } }
      else { hiddenSuspended = false; if (everRan) try { ctx.resume().catch(() => {}); } catch (e) { /* ignore */ } }
    });
  }

  function decode(ab) {
    return new Promise((resolve, reject) => {
      try {
        const p = ctx.decodeAudioData(ab, resolve, reject); // callback form for old Safari
        if (p && p.then) p.then(resolve, reject);
      } catch (e) { reject(e); }
    });
  }

  function loadOne(name, url) {
    return fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then(decode)
      .then((buf) => { audio.register(name, buf); return true; })
      .catch((e) => { console.warn(`[audio] could not load "${name}" (${url}): ${(e && e.message) || e}`); return false; });
  }

  /** Load files. Values may be arrays (variations). Resolves {loaded, failed}; never rejects. */
  audio.load = (map = {}) => {
    if (!ctx) return Promise.resolve({ loaded: 0, failed: 0 });
    const jobs = [];
    for (const [name, src] of Object.entries(map)) {
      if (Array.isArray(src)) {
        const names = src.map((_, i) => `${name}#${i + 1}`);
        groups.set(name, names);
        src.forEach((url, i) => jobs.push(loadOne(names[i], url)));
      } else jobs.push(loadOne(name, src));
    }
    return Promise.all(jobs).then((r) => ({ loaded: r.filter(Boolean).length, failed: r.filter((x) => !x).length }));
  };

  /** Register an AudioBuffer (e.g. procedurally generated) or a variation list. */
  audio.register = (name, value, opts) => {
    if (opts) audio.config(name, opts);
    if (Array.isArray(value)) {
      const names = value.map((v, i) => {
        if (typeof v === 'string') return v;
        const n = `${name}#${i + 1}`;
        if (isBuffer(v)) buffers.set(n, v);
        return n;
      });
      groups.set(name, names);
    } else if (isBuffer(value)) {
      buffers.set(name, value);
      const m = /^(.+)_(\d+)$/.exec(name);
      if (m) { if (!autoVars.has(m[1])) autoVars.set(m[1], new Set()); autoVars.get(m[1]).add(name); }
    } else {
      warnOnce('reg:' + name, `[audio] register("${name}") expects an AudioBuffer or an array`);
      return audio;
    }
    if (musicState.name === name && !musicState.handle) startPendingMusic();
    return audio;
  };

  /** Per-sound defaults: {cooldown (s), maxVoices, volume, pitchVar, rate}. */
  audio.config = (name, o = {}) => { settings.set(name, Object.assign(settings.get(name) || {}, o)); return audio; };
  audio.has = (name) => !!resolve(name, false);

  function resolve(name, pickRandom = true) {
    let list = groups.get(name);
    if (!list && autoVars.has(name)) list = [...(buffers.has(name) ? [name] : []), ...autoVars.get(name)];
    if (list) {
      const avail = list.filter((n) => buffers.has(n));
      if (!avail.length) return null;
      if (!pickRandom || avail.length === 1) return buffers.get(avail[0]);
      let i = Math.floor(Math.random() * avail.length);
      if (avail[i] === lastPick.get(name)) i = (i + 1) % avail.length; // avoid immediate repeats
      lastPick.set(name, avail[i]);
      return buffers.get(avail[i]);
    }
    return buffers.get(name) || null;
  }

  function makeHandle(name, src, gain, list) {
    const h = {
      name, source: src, gain, playing: true,
      stop(fade = 0) {
        if (!h.playing) return;
        h.playing = false;
        try {
          const t = ctx.currentTime;
          if (fade > 0) {
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(0, t + fade);
            src.stop(t + fade + 0.02);
          } else src.stop();
        } catch (e) { /* already stopped */ }
      },
      setVolume(v, time = 0.05) {
        try { gain.gain.setTargetAtTime(v, ctx.currentTime, Math.max(0.001, time / 3)); } catch (e) { /* ignore */ }
      },
    };
    src.onended = () => {
      h.playing = false;
      if (list) { const i = list.indexOf(h); if (i >= 0) list.splice(i, 1); }
      try { src.disconnect(); gain.disconnect(); } catch (e) { /* ignore */ }
    };
    return h;
  }

  function startSource(buf, name, o, bus, list) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = !!o.loop;
    src.playbackRate.value = o.rate;
    const g = ctx.createGain();
    g.gain.value = o.volume;
    src.connect(g);
    let node = g;
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p); node = p;
    }
    node.connect(bus);
    src.start(ctx.currentTime + (o.delay || 0), o.offset || 0);
    return makeHandle(name, src, g, list);
  }

  /** Play a one-shot (or loop). Returns a handle; a no-op handle if missing / muted / locked. */
  audio.play = (name, o = {}) => {
    if (!ctx || ctx.state !== 'running' || audio.muted) return NOOP; // never queue stale sounds
    const buf = resolve(name);
    if (!buf) { warnOnce('miss:' + name, `[audio] sound "${name}" not loaded/registered (ignored)`); return NOOP; }
    const cfg = settings.get(name) || {};
    const now = ctx.currentTime;
    const cooldown = o.cooldown ?? cfg.cooldown ?? defaultCooldown;
    const lp = lastPlay.get(name);
    if (lp != null && now - lp < cooldown) return NOOP;
    lastPlay.set(name, now);
    let list = voices.get(name);
    if (!list) voices.set(name, (list = []));
    const maxV = o.maxVoices ?? cfg.maxVoices ?? defaultMaxVoices;
    while (list.length >= maxV) list.shift().stop(0.02);
    let rate = (o.rate ?? 1) * (cfg.rate ?? 1);
    const pv = o.pitchVar ?? cfg.pitchVar ?? 0;
    if (pv) rate *= 1 + (Math.random() * 2 - 1) * pv;
    const bus = o.bus === 'music' ? audio.musicBus : audio.sfxBus;
    try {
      const h = startSource(buf, name, { ...o, rate, volume: (o.volume ?? 1) * (cfg.volume ?? 1) }, bus, list);
      list.push(h);
      return h;
    } catch (e) {
      warnOnce('err:' + name, `[audio] play("${name}") failed: ${e.message}`);
      return NOOP;
    }
  };

  function startPendingMusic() {
    const st = musicState;
    if (!ctx || !st.name || st.handle || ctx.state !== 'running') return;
    const buf = resolve(st.name);
    if (!buf) return;
    const fade = Math.max(0.01, st.opts.fade ?? 1), vol = st.opts.volume ?? 1;
    try {
      const h = startSource(buf, st.name, { loop: st.opts.loop ?? true, rate: st.opts.rate ?? 1, volume: 0 }, audio.musicBus, null);
      const t = ctx.currentTime;
      h.gain.gain.setValueAtTime(0, t);
      h.gain.gain.linearRampToValueAtTime(vol, t + fade);
      st.handle = h;
    } catch (e) { warnOnce('music:' + st.name, `[audio] music("${st.name}") failed: ${e.message}`); }
  }

  /** Crossfade to a looping track. music(null) stops. Same name again = no-op. */
  audio.music = (name, o = {}) => {
    const fade = o.fade ?? 1;
    if (name && name === musicState.name) return musicState.handle;
    if (musicState.handle) musicState.handle.stop(Math.max(0.01, fade));
    musicState = { name: name || null, opts: o, handle: null };
    if (!name) return null;
    if (ctx && !resolve(name)) warnOnce('music-miss:' + name, `[audio] music "${name}" not loaded yet (will start when registered)`);
    startPendingMusic();
    return musicState.handle;
  };
  audio.stopMusic = (fade = 1) => audio.music(null, { fade });

  /** Temporarily lower music (e.g. on a big hit). amount 0..1, ms = total duration. */
  audio.duck = (amount = 0.5, ms = 500) => {
    if (!ctx) return;
    const g = audio.duckGain.gain, t = ctx.currentTime, d = Math.max(0.05, ms / 1000);
    const low = Math.max(0, 1 - amount);
    try {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(low, t + 0.04);
      g.setValueAtTime(low, t + 0.04 + d * 0.4);
      g.linearRampToValueAtTime(1, t + d);
    } catch (e) { /* ignore */ }
  };

  audio.setMuted = (m) => {
    audio.muted = !!m;
    storage.set(muteKey, audio.muted);
    if (ctx) {
      try { audio.out.gain.setTargetAtTime(audio.muted ? 0 : 1, ctx.currentTime, 0.015); } catch (e) { audio.out.gain.value = audio.muted ? 0 : 1; }
    }
    for (const fn of muteListeners) { try { fn(audio.muted); } catch (e) { console.error(e); } }
    return audio.muted;
  };
  audio.toggleMute = () => audio.setMuted(!audio.muted);
  /** Subscribe to mute changes; returns unsubscribe. */
  audio.onMute = (fn) => { muteListeners.add(fn); return () => muteListeners.delete(fn); };

  audio.setVolume = (bus, v) => {
    const node = audio.bus[bus];
    if (node) { try { node.gain.setTargetAtTime(v, ctx.currentTime, 0.02); } catch (e) { node.gain.value = v; } }
  };
  audio.getVolume = (bus) => (audio.bus[bus] ? audio.bus[bus].gain.value : 0);

  audio.stopAll = (fade = 0.05) => {
    for (const list of voices.values()) for (const h of [...list]) h.stop(fade);
  };
  audio.suspend = () => { if (ctx) try { ctx.suspend().catch(() => {}); } catch (e) { /* ignore */ } };
  audio.resume = () => { if (ctx && !hiddenSuspended) try { ctx.resume().catch(() => {}); } catch (e) { /* ignore */ } };

  return audio;
}
