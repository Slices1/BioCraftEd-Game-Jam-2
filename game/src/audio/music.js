// Tiny procedural music sequencer (WebAudio oscillators + noise), lookahead scheduled.
//   startMusic(ctx, destination, {mood:'upbeat'|'tense'|'chill'|'dnb', bpm, seed, intensity})
//   stopMusic(fade=0.4)   setIntensity(0..1)   isPlaying()
//   renderMusicOffline(ctx, destination, opts, seconds)  // schedules synchronously (for OfflineAudioContext tests)
// Pause-safe: nothing is scheduled while ctx.state !== 'running'; on resume the clock re-syncs (no burst).
// Start it from a user gesture (ctx must be resumed by the audio manager).

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const P = (s) => s.split('').map((c) => (c === 'x' ? 1 : c === 'o' ? 0.5 : c === 'g' ? 0.3 : 0)); // 16-step bar strings

// ---- mood definitions. Patterns are per bar (cycle every N bars). prog = root semitone offsets per bar from `root` midi.
const MOODS = {
  dnb: {
    bpm: 172, root: 41 /* F2 */, minor: true, prog: [0, -4, 3, -2], swing: 0,
    kick:  ['x.........x.....', 'x.........x..x..', 'x.........x.....', 'x..x......x..x..'].map(P),
    snare: ['....x.......x...', '....x.......x...', '....x.......x...', '....x.......x.xx'].map(P),
    ghost: ['.......g.g....g.', '.g.....g.g....g.', '.......g.g.g..g.', '..g.g..g.g.g.ggg'].map(P),
    hat:   ['x.x.x.x.x.x.x.x.', 'x.xxx.x.x.xxx.x.', 'x.x.x.x.x.x.x.x.', 'x.xxx.xxx.xxxxxx'].map(P),
    open:  ['..o...o...o...o.', '..o...o...o...o.', '..o...o...o...o.', '..o.............'].map(P),
    bass: [ // [step, lenSteps, semitone offset]
      [[0, 6, 0], [6, 2, 0], [10, 5, 0], [15, 1, 12]],
      [[0, 4, 0], [4, 2, 12], [6, 4, 0], [10, 4, 7], [14, 2, 5]],
      [[0, 6, 0], [6, 2, 0], [10, 5, 0], [15, 1, 12]],
      [[0, 3, 0], [3, 3, 0], [6, 4, 7], [10, 6, 5]],
    ],
    bassKind: 'reese', arpStyle: 'pluck16', padVol: 0.07, leadVol: 0.09,
  },
  upbeat: {
    bpm: 128, root: 48, minor: false, prog: [0, 7, 9, 5], swing: 0,
    kick: ['x...x...x...x...'].map(P), snare: ['....x.......x...'].map(P), ghost: ['................'].map(P),
    hat: ['..x...x...x...x.'].map(P), open: ['..o...o...o...o.'].map(P),
    bass: [[[0, 2, 0], [2, 2, 0], [4, 2, 12], [6, 2, 0], [8, 2, 0], [10, 2, 7], [12, 2, 0], [14, 2, 12]]],
    bassKind: 'saw', arpStyle: 'up8', padVol: 0.05, leadVol: 0.07,
  },
  tense: {
    bpm: 138, root: 38, minor: true, prog: [0, 0, 1, -2], swing: 0,
    kick: ['x.......x.x.....', 'x.......x.......'].map(P), snare: ['........x.......'].map(P), ghost: ['..............g.'].map(P),
    hat: ['x.xxx.xxx.xxx.xx', 'x.x.x.x.x.x.xxxx'].map(P), open: ['................'].map(P),
    bass: [[[0, 1, 0], [1, 1, 0], [2, 1, 0], [3, 1, 0], [4, 1, 0], [5, 1, 0], [6, 1, 0], [7, 1, 0], [8, 1, 0], [9, 1, 0], [10, 1, 0], [11, 1, 0], [12, 1, 0], [13, 1, 0], [14, 1, 0], [15, 1, 0]]],
    bassKind: 'saw', arpStyle: 'tense', padVol: 0.06, leadVol: 0.05,
  },
  chill: {
    bpm: 84, root: 45, minor: true, prog: [0, -4, -2, -5], swing: 0.22,
    kick: ['x.....x...x.....', 'x.......x.x.....'].map(P), snare: ['....x.......x...'].map(P), ghost: ['..............g.'].map(P),
    hat: ['x.x.x.x.x.x.x.x.'].map(P), open: ['................'].map(P),
    bass: [[[0, 6, 0], [8, 4, 0], [12, 3, 7]]],
    bassKind: 'sine', arpStyle: 'soft', padVol: 0.07, leadVol: 0.05,
  },
};

const MINOR = [0, 3, 7, 10], MAJOR = [0, 4, 7, 11];

class Engine {
  constructor(ctx, dest, opts) {
    this.ctx = ctx;
    const m = (this.mood = MOODS[opts.mood] || MOODS.upbeat);
    this.bpm = opts.bpm || m.bpm;
    this.rand = rng(opts.seed ?? 1337);
    this.stepDur = 60 / this.bpm / 4;
    this.step = 0; // global 16th counter
    this.next = 0; // time of next step
    this.intensity = clamp01(opts.intensity ?? 0.5);
    this.timer = null; this.stopped = false;
    // graph: layer buses -> comp -> master -> dest ; delay send for arp/lead
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.attack.value = 0.005; this.comp.release.value = 0.12;
    this.comp.connect(this.master); this.master.connect(dest);
    const layer = (name, v = 1) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.comp); g.userGain = v; return (this[name] = g); };
    ['drums', 'bassBus', 'pad', 'arp', 'lead'].forEach((n) => layer(n));
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = this.stepDur * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2800;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(wet); wet.connect(this.comp);
    this.noise = this.makeNoise();
    this.applyLayers(0.001);
  }
  makeNoise() {
    const c = this.ctx, n = c.sampleRate, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    const r = rng(99); for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return b;
  }
  // layer gain targets by intensity
  applyLayers(tc = 0.25) {
    const i = this.intensity, t = this.ctx.currentTime, dnb = this.mood === MOODS.dnb;
    const ramp = (lo, hi) => clamp01((i - lo) / (hi - lo));
    const set = (g, v) => g.gain.setTargetAtTime(v, t, tc);
    set(this.drums, 0.9); set(this.bassBus, dnb ? 0.9 : 0.8 * (0.5 + 0.5 * ramp(0, 0.3)));
    set(this.pad, 0.5 + 0.5 * (1 - ramp(0.5, 1)));
    set(this.arp, ramp(0.3, 0.55)); set(this.lead, ramp(0.6, 0.85));
    this.master.gain.setTargetAtTime(this.stopped ? 0 : 0.55, t, 0.05);
  }
  // ---- instruments
  env(g, t, a, peak, d, hold = 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); if (hold) g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d); }
  kick(t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(this.mood === MOODS.dnb ? 190 : 150, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    this.env(g, t, 0.002, v, 0.28);
    o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 0.32);
  }
  noiseHit(t, v, { type = 'highpass', freq = 7000, q = 0.7, dur = 0.05 } = {}) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    this.env(g, t, 0.001, v, dur);
    s.connect(f); f.connect(g); g.connect(this.drums);
    s.start(t, Math.floor(this.rand() * 0.8 * 100) / 100); s.stop(t + dur + 0.02);
  }
  snare(t, v, ghost) {
    const body = ghost ? 0.05 : 0.16;
    this.noiseHit(t, v * 0.75, { type: 'bandpass', freq: 2100, q: 0.6, dur: body });
    this.noiseHit(t, v * 0.35, { type: 'highpass', freq: 5000, dur: body * 0.8 });
    if (!ghost) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.08);
      this.env(g, t, 0.001, v * 0.5, 0.09); o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 0.12);
    }
  }
  hat(t, v, open) { this.noiseHit(t, v * 0.32, { freq: open ? 6500 : 8500, dur: open ? 0.16 : 0.035 }); }
  bass(t, midi, dur, kind) {
    const c = this.ctx, g = c.createGain(), end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.01);
    g.gain.setValueAtTime(0.5, Math.max(t + 0.011, end - 0.03)); g.gain.linearRampToValueAtTime(0.0001, end);
    g.connect(this.bassBus);
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = mtof(midi - 12);
    const sg = c.createGain(); sg.gain.value = kind === 'sine' ? 1.1 : 0.9; sub.connect(sg); sg.connect(g); sub.start(t); sub.stop(end + 0.02);
    if (kind === 'sine') return;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = kind === 'reese' ? 6 : 3;
    f.frequency.setValueAtTime(kind === 'reese' ? 420 : 900, t);
    f.frequency.linearRampToValueAtTime(kind === 'reese' ? 1300 + 600 * this.intensity : 1500, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(kind === 'reese' ? 350 : 700, end);
    const mix = c.createGain(); mix.gain.value = kind === 'reese' ? 0.38 : 0.3; f.connect(mix); mix.connect(g);
    const fr = mtof(midi), n = kind === 'reese' ? 2 : 1;
    for (let k = 0; k < n; k++) { // reese = 2 detuned saws, slow beating (wobble via detune LFO-ish ramp)
      const o = c.createOscillator(); o.type = 'sawtooth';
      const det = k ? 9 : -9;
      o.detune.setValueAtTime(det * 0.6, t); o.detune.linearRampToValueAtTime(det * 1.6, t + dur * 0.5); o.detune.linearRampToValueAtTime(det * 0.6, end);
      o.frequency.value = fr; o.connect(f); o.start(t); o.stop(end + 0.02);
    }
  }
  tone(t, midi, dur, { type = 'square', vol = 0.2, lp = 3000, a = 0.004, bus, send = 0.4 } = {}) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = mtof(midi); f.type = 'lowpass'; f.frequency.setValueAtTime(lp, t); f.frequency.exponentialRampToValueAtTime(Math.max(300, lp * 0.25), t + dur);
    this.env(g, t, a, vol, dur);
    o.connect(f); f.connect(g); g.connect(bus);
    if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.delay); }
    o.start(t); o.stop(t + a + dur + 0.05);
  }
  padChord(t, rootMidi, dur, vol) {
    const c = this.ctx, scale = this.mood.minor ? MINOR : MAJOR;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 0.5;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(this.pad);
    [0, scale[1], scale[2], scale[3] + 0].forEach((iv, k) => {
      const o = c.createOscillator(); o.type = k % 2 ? 'sine' : 'triangle'; o.frequency.value = mtof(rootMidi + 12 + iv); o.detune.value = (k - 1.5) * 6;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  // ---- sequencing
  scheduleStep(t) {
    const m = this.mood, s = this.step, bar = Math.floor(s / 16), st = s % 16, I = this.intensity;
    const pick = (arr) => arr[bar % arr.length][st];
    const dnb = m === MOODS.dnb;
    const sw = st % 2 ? m.swing * this.stepDur : 0;
    const tt = t + sw;
    const k = pick(m.kick), sn = pick(m.snare), gh = pick(m.ghost), h = pick(m.hat), op = pick(m.open);
    if (k) this.kick(tt, 0.95 * (0.85 + 0.15 * k));
    if (sn) this.snare(tt, 0.9, false);
    if (gh && I > 0.25) this.snare(tt, 0.6 * (0.7 + this.rand() * 0.5), true);
    if (op && I > 0.15) this.hat(tt, 0.9, true);
    else if (h && I > 0.1) this.hat(tt, (st % 4 === 0 ? 0.9 : 0.55) * (0.8 + this.rand() * 0.3), false);
    // chops: dnb occasionally rolls the last bar of each 4
    if (dnb && bar % 4 === 3 && st >= 12 && I > 0.4 && this.rand() < 0.5) this.snare(tt + this.stepDur / 2, 0.45, true);
    const chordRoot = m.root + m.prog[bar % m.prog.length];
    // bass
    const bl = m.bass[bar % m.bass.length];
    for (const [bs, len, off] of bl) if (bs === st) this.bass(tt, chordRoot + off, len * this.stepDur * 0.95, m.bassKind);
    // pad: one chord per bar
    if (st === 0) this.padChord(t, chordRoot, this.stepDur * 16, m.padVol);
    // arp
    const scale = m.minor ? MINOR : MAJOR;
    if (I > 0.3) {
      const a = m.arpStyle;
      if (a === 'pluck16' && (st % 2 === 0 || this.rand() < 0.3) && (st % 4 !== 0 || bar % 2)) {
        const deg = [0, 2, 3, 1, 2, 3, 0, 2][(st >> 1) % 8];
        this.tone(tt, chordRoot + 24 + scale[deg] + (st > 8 && bar % 2 ? 12 : 0), 0.16, { type: 'square', vol: 0.11, lp: 3600, bus: this.arp });
      } else if (a === 'up8' && st % 2 === 0) {
        this.tone(tt, chordRoot + 24 + scale[(st >> 1) % 3] , 0.14, { type: 'square', vol: 0.09, lp: 3000, bus: this.arp });
      } else if (a === 'tense' && st % 4 === 2) {
        this.tone(tt, chordRoot + 36 + [0, 1, 0, 6][(st >> 2) % 4], 0.12, { type: 'sawtooth', vol: 0.07, lp: 2200, bus: this.arp });
      } else if (a === 'soft' && st % 3 === 0) {
        this.tone(tt, chordRoot + 24 + scale[(st / 3 | 0) % 4], 0.5, { type: 'triangle', vol: 0.14, lp: 2400, bus: this.arp, send: 0.5 });
      }
    }
    // lead: sparse melodic stabs at bar starts (seeded)
    if (I > 0.6 && (st === 0 || st === 6 || st === 10) && this.rand() < (st === 0 ? 0.9 : 0.45)) {
      const iv = scale[Math.floor(this.rand() * 4)] + (this.rand() < 0.3 ? 12 : 0);
      this.tone(tt, chordRoot + 36 + iv, 0.35, { type: 'sawtooth', vol: 0.12 * (m.leadVol / 0.07), lp: 2600, bus: this.lead, a: 0.01, send: 0.55 });
    }
  }
  // schedule all steps with time < until
  scheduleUntil(until) {
    while (this.next < until) { this.scheduleStep(this.next); this.next += this.stepDur; this.step++; }
  }
  tick() {
    const c = this.ctx;
    if (this.stopped) return;
    if (c.state !== 'running') { this.resync = true; return; }
    if (this.resync || this.next < c.currentTime - 0.05) { // after a suspend (or long stall): realign to a bar-aligned step
      this.next = c.currentTime + 0.06; this.step = Math.ceil(this.step / 16) * 16; this.resync = false;
    }
    this.scheduleUntil(c.currentTime + 0.12);
  }
  start() {
    this.next = this.ctx.currentTime + 0.06;
    this.applyLayers(0.05);
    this.tick();
    this.timer = setInterval(() => this.tick(), 30);
  }
  stop(fade) {
    this.stopped = true; clearInterval(this.timer);
    const c = this.ctx, t = c.currentTime;
    this.master.gain.cancelScheduledValues(t); this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { try { this.master.disconnect(); this.comp.disconnect(); this.delay.disconnect(); } catch (e) {} }, (fade + 0.8) * 1000);
  }
}

let current = null;

export function startMusic(ctx, destination, opts = {}) {
  stopMusic(0.2);
  current = new Engine(ctx, destination || ctx.destination, opts);
  current.start();
  return current;
}
export function stopMusic(fade = 0.4) { if (current) { current.stop(fade); current = null; } }
export function setIntensity(v) { if (current) { current.intensity = clamp01(v); current.applyLayers(0.4); } }
export function isPlaying() { return !!current; }
export const moods = Object.keys(MOODS);

/** For tests: synchronously schedules `seconds` of music into an OfflineAudioContext. */
export function renderMusicOffline(ctx, destination, opts, seconds) {
  const e = new Engine(ctx, destination, opts);
  e.next = 0.01; e.master.gain.value = 0.55; e.applyLayers(0.01);
  e.scheduleUntil(seconds);
  return e;
}
