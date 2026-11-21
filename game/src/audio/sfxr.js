// Original compact sfxr-style procedural SFX synth. ES module, no deps.
// Params (all optional, seconds / Hz / octaves):
//  wave: 'square'|'saw'|'sine'|'noise'|'tri'   freq: start Hz   slide: octaves/sec   dslide: octaves/sec^2
//  attack, sustain, decay: envelope seconds    punch: 0..1 extra gain at start of sustain
//  vibDepth (0..1 fraction of freq), vibSpeed (Hz)
//  arpMult (freq multiplier), arpTime (s when the jump happens; 0 = off)
//  duty (0..1 square width), dutySweep (duty change per sec)
//  lowpass / highpass: cutoff Hz (0 = off)   repeat: restart pitch every N s (0 = off)   volume 0..1
//  minFreq: stop pitch slide at this Hz (0=off)

const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULTS = {
  wave: 'square', freq: 440, slide: 0, dslide: 0, attack: 0.005, sustain: 0.1, decay: 0.15, punch: 0,
  vibDepth: 0, vibSpeed: 0, arpMult: 1, arpTime: 0, duty: 0.5, dutySweep: 0,
  lowpass: 0, highpass: 0, repeat: 0, volume: 0.6, minFreq: 0, seed: 1,
};

/** Core renderer: returns Float32Array (mono). Node-testable. */
export function renderCore(params, sampleRate = 22050) {
  const p = Object.assign({}, DEFAULTS, params);
  const rnd = mulberry32(p.seed | 0);
  const total = p.attack + p.sustain + p.decay;
  const n = Math.max(1, Math.ceil(total * sampleRate));
  const out = new Float32Array(n);
  const dt = 1 / sampleRate;
  let f = p.freq, phase = 0, noiseVal = rnd() * 2 - 1, tPitch = 0;
  // filter state: 2 cascaded one-poles LP, 1 one-pole HP
  let lp1 = 0, lp2 = 0, hpPrev = 0, hpOut = 0;
  const lpA = p.lowpass > 0 ? 1 - Math.exp(-TAU * Math.min(p.lowpass, sampleRate * 0.45) * dt) : 1;
  const hpA = p.highpass > 0 ? Math.exp(-TAU * p.highpass * dt) : 0;
  let duty = p.duty;
  let triLast = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    if (p.repeat > 0 && t > 0 && Math.floor(t / p.repeat) !== Math.floor((t - dt) / p.repeat)) { tPitch = 0; }
    // pitch (control rate: recomputed every 16 samples, cheap enough for phones)
    if ((i & 15) === 0) {
      f = p.freq * Math.pow(2, p.slide * tPitch + 0.5 * p.dslide * tPitch * tPitch);
      if (p.minFreq > 0 && f < p.minFreq) f = p.minFreq;
      if (p.arpTime > 0 && tPitch >= p.arpTime) f *= p.arpMult;
      if (p.vibDepth > 0) f *= 1 + p.vibDepth * Math.sin(TAU * p.vibSpeed * t);
      if (f > sampleRate * 0.45) f = sampleRate * 0.45;
      duty = Math.min(0.95, Math.max(0.05, duty + p.dutySweep * dt * 16));
    }
    tPitch += dt;
    // oscillator
    phase += f * dt;
    let wrapped = false;
    if (phase >= 1) { phase -= Math.floor(phase); wrapped = true; }
    let s;
    switch (p.wave) {
      case 'saw': s = 1 - 2 * phase; break;
      case 'sine': s = Math.sin(TAU * phase); break;
      case 'tri': s = 1 - 4 * Math.abs(phase - 0.5); break;
      case 'noise':
        if (wrapped) noiseVal = rnd() * 2 - 1;
        s = noiseVal; break;
      default: s = phase < duty ? 1 : -1;
    }
    // envelope
    let e;
    if (t < p.attack) e = t / p.attack;
    else if (t < p.attack + p.sustain) e = 1 + p.punch * (1 - (t - p.attack) / Math.max(p.sustain, 1e-4));
    else { const d = 1 - (t - p.attack - p.sustain) / Math.max(p.decay, 1e-4); e = d * d; }
    s *= e;
    // filters
    if (p.lowpass > 0) { lp1 += lpA * (s - lp1); lp2 += lpA * (lp1 - lp2); s = lp2; }
    if (p.highpass > 0) { hpOut = hpA * (hpOut + s - hpPrev); hpPrev = s; s = hpOut; }
    out[i] = s;
  }
  // volume + soft clip (guarantees |x| < 1) + 2 ms edge fade to avoid clicks
  const fade = Math.min(n >> 1, Math.floor(0.002 * sampleRate));
  for (let i = 0; i < n; i++) {
    const x = out[i] * p.volume * 1.2;
    let v = x / (1 + Math.abs(x)) * 1.3; if (v > 0.98) v = 0.98; else if (v < -0.98) v = -0.98;
    if (i > n - fade) v *= (n - i) / fade;
    out[i] = v;
  }
  return out;
}

/** Render to an AudioBuffer (mono). Rendered at 22.05 kHz: cheap, fine for chip sounds. */
export function renderSfx(ctx, params, sampleRate = 22050) {
  const data = renderCore(params, sampleRate);
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  if (buf.copyToChannel) buf.copyToChannel(data, 0); else buf.getChannelData(0).set(data);
  return buf;
}

export const presets = {
  coin:    { wave: 'square', freq: 988, arpMult: 1.5, arpTime: 0.07, sustain: 0.09, decay: 0.2, duty: 0.4, punch: 0.3 },
  pickup:  { wave: 'square', freq: 520, slide: 1.6, sustain: 0.06, decay: 0.16, duty: 0.3, punch: 0.4 },
  jump:    { wave: 'square', freq: 260, slide: 2.2, dslide: -1, sustain: 0.08, decay: 0.16, duty: 0.35, lowpass: 5000 },
  dash:    { wave: 'noise', freq: 900, slide: -1.2, attack: 0.01, sustain: 0.06, decay: 0.18, lowpass: 3500, highpass: 400, volume: 0.5 },
  hit:     { wave: 'noise', freq: 220, slide: -2.5, sustain: 0.04, decay: 0.13, lowpass: 2500, punch: 0.6 },
  hurt:    { wave: 'saw', freq: 330, slide: -2, sustain: 0.1, decay: 0.25, vibDepth: 0.05, vibSpeed: 40, lowpass: 3000, punch: 0.3 },
  explode: { wave: 'noise', freq: 70, slide: -0.7, dslide: -0.5, attack: 0.005, sustain: 0.18, decay: 0.7, lowpass: 1200, punch: 0.8, volume: 0.8 },
  powerup: { wave: 'square', freq: 330, slide: 1.2, repeat: 0.12, sustain: 0.3, decay: 0.25, duty: 0.5, vibDepth: 0.03, vibSpeed: 14 },
  laser:   { wave: 'saw', freq: 1800, slide: -3.5, sustain: 0.05, decay: 0.2, lowpass: 6000, duty: 0.5 },
  blip:    { wave: 'square', freq: 700, sustain: 0.03, decay: 0.05, duty: 0.5, volume: 0.45 },
  select:  { wave: 'square', freq: 600, arpMult: 1.333, arpTime: 0.045, sustain: 0.05, decay: 0.08, duty: 0.25, volume: 0.45 },
  lose:    { wave: 'saw', freq: 392, slide: -0.9, dslide: -0.4, sustain: 0.45, decay: 0.7, vibDepth: 0.025, vibSpeed: 6, lowpass: 2500 },
  win:     { wave: 'square', freq: 523, arpMult: 1.5, arpTime: 0.1, repeat: 0.2, sustain: 0.5, decay: 0.5, duty: 0.45, vibDepth: 0.01, vibSpeed: 8 },
};

const R = { slide: 0.3, dslide: 0.3, freq: 0.12, sustain: 0.2, decay: 0.2, arpMult: 0.05, duty: 0.1, lowpass: 0.15, vibDepth: 0.2 };

/** Variation of a preset (name or params object): deterministic per seed. */
export function randomize(preset, seed = 1) {
  const base = typeof preset === 'string' ? presets[preset] : preset;
  if (!base) throw new Error('unknown preset ' + preset);
  const r = mulberry32((seed * 2654435761) >>> 0);
  const p = Object.assign({}, base, { seed: (seed | 0) || 1 });
  for (const k in R) {
    if (typeof p[k] !== 'number' || p[k] === 0) continue;
    p[k] = p[k] * (1 + (r() * 2 - 1) * R[k]);
  }
  if (p.duty) p.duty = Math.min(0.9, Math.max(0.1, p.duty));
  return p;
}

/** Registers all presets immediately (~15 ms warm), then renders variants (`jump_1`, `hit_2`...) in small
 *  timeslices so startup never blocks. Aliases: ui_click, ui_confirm. Returns the preset names. */
export function registerSynthSfx(audio, { variants = 2 } = {}) {
  const ctx = audio.ctx;
  const aliases = { ui_click: 'blip', ui_confirm: 'select' };
  const many = ['jump', 'hit', 'pickup', 'coin', 'blip', 'select', 'hurt'];
  const names = Object.keys(presets);
  for (const name of names) audio.register(name, renderSfx(ctx, presets[name]));
  for (const a in aliases) audio.register(a, audio.buffers?.get?.(aliases[a]) || renderSfx(ctx, presets[aliases[a]]));
  const queue = [];
  for (const name of many) for (let i = 1; i <= variants; i++) queue.push([name, i]);
  const step = () => {
    const j = queue.shift();
    if (!j) return;
    audio.register(`${j[0]}_${j[1]}`, renderSfx(ctx, randomize(j[0], j[1] * 7 + j[0].length)));
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
  return names;
}
