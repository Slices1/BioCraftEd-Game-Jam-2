// bloom.js - threshold / downscale / blur / additive-composite bloom with auto quality.
//   const bloom = createBloom({ quality: 2 });
//   bloom.apply(ctx, canvas)   // call after drawing the scene, before HUD/vignette
//   bloom.enabled = false;     // toggle
//   bloom.quality              // 0 off, 1 cheap, 2 full (auto-lowered when frames get slow)
// apply() resets the transform itself and restores the context state.

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, w | 0); c.height = Math.max(2, h | 0);
  return c;
}

// Real feature test: Safari iOS exposes nothing (or a no-op) for ctx.filter, so check by pixels.
let FILTER_OK = null;
function detectFilter() {
  if (FILTER_OK !== null) return FILTER_OK;
  FILTER_OK = false;
  try {
    const c = mk(16, 16), g = c.getContext('2d');
    if (!('filter' in g)) return false;
    g.filter = 'blur(2px)';
    if (g.filter !== 'blur(2px)') return false;
    g.fillStyle = '#fff'; g.fillRect(7, 7, 2, 2);
    const a = g.getImageData(3, 8, 1, 1).data[3];     // blur must have spread alpha outward
    FILTER_OK = a > 0;
  } catch (e) { FILTER_OK = false; }
  return FILTER_OK;
}

export function createBloom(opts) {
  const o = Object.assign({ enabled: true, quality: 2, auto: true, targetMs: 25, strength: 1, forceFallback: false }, opts || {});
  const maxQ = Math.max(0, Math.min(2, o.quality | 0));
  const useFilter = !o.forceFallback && detectFilter();
  let B1 = null, b1 = null, B2 = null, b2 = null, B3 = null, b3 = null, bw = 0, bh = 0, bq = -1;
  let last = 0, ema = 16, frames = 0, lastChange = 0, fastFrames = 0, drops = 0;

  const api = {
    enabled: !!o.enabled,
    quality: maxQ,
    strength: o.strength,
    filterSupported: useFilter,
    get frameMs() { return ema; },
    apply,
  };

  function alloc(W, H, q) {
    const d = q >= 2 ? 4 : 8;
    B1 = mk(W / d, H / d); b1 = B1.getContext('2d');
    B2 = mk(W / d, H / d); b2 = B2.getContext('2d');
    B3 = mk(W / (d * 4), H / (d * 4)); b3 = B3.getContext('2d');
    bw = W; bh = H; bq = q;
  }

  function measure(now) {
    if (last) {
      const dt = now - last;
      if (dt < 250) { ema = ema * 0.92 + dt * 0.08; frames++; }
    }
    last = now;
    if (!o.auto || frames < 50 || now - lastChange < 1500) return;
    if (ema > o.targetMs && api.quality > 0) {
      api.quality--; lastChange = now; drops++; fastFrames = 0; ema = o.targetMs * 0.85;
    } else if (ema < o.targetMs * 0.68 && api.quality < maxQ && drops < 3) {
      if (++fastFrames > 300 && now - lastChange > 8000) { api.quality++; lastChange = now; fastFrames = 0; }
    } else fastFrames = 0;
  }

  function apply(ctx, canvas) {
    measure(performance.now());
    if (!api.enabled || api.quality <= 0) return;
    const W = canvas.width, H = canvas.height, q = api.quality;
    if (!B1 || bw !== W || bh !== H || bq !== q) alloc(W, H, q);
    const w1 = B1.width, h1 = B1.height;

    if (useFilter) {
      b1.filter = 'contrast(2.6) brightness(1.0)'; b1.globalCompositeOperation = 'copy';
      b1.drawImage(canvas, 0, 0, w1, h1); b1.filter = 'none';
      b2.filter = q >= 2 ? 'blur(2.2px)' : 'blur(1.2px)'; b2.globalCompositeOperation = 'copy';
      b2.drawImage(B1, 0, 0); b2.filter = 'none';
      if (q >= 2) {
        b3.filter = 'blur(1.3px)'; b3.globalCompositeOperation = 'copy';
        b3.drawImage(B2, 0, 0, B3.width, B3.height); b3.filter = 'none';
      }
    } else {
      // No ctx.filter (Safari iOS): pseudo-threshold by squaring with 'multiply', then box-ish blur via down/up scaling.
      b1.imageSmoothingEnabled = true; b1.imageSmoothingQuality = 'high';
      b1.globalCompositeOperation = 'copy'; b1.drawImage(canvas, 0, 0, w1, h1);
      b1.globalCompositeOperation = 'multiply'; b1.drawImage(B1, 0, 0); b1.drawImage(B1, 0, 0);
      b1.globalCompositeOperation = 'source-over';
      const hw = Math.max(2, w1 >> 1), hh = Math.max(2, h1 >> 1);
      b3.imageSmoothingEnabled = true;
      b3.globalCompositeOperation = 'copy'; b3.drawImage(B1, 0, 0, B3.width, B3.height);
      b2.imageSmoothingEnabled = true; b2.imageSmoothingQuality = 'high';
      b2.globalCompositeOperation = 'copy';
      b2.drawImage(B1, 0, 0, hw, hh);                 // down 2x (smoothed)
      b2.drawImage(B2, 0, 0, hw, hh, 0, 0, w1, h1);   // back up: soft
    }
    b1.globalCompositeOperation = b2.globalCompositeOperation = b3.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.85 * api.strength; ctx.drawImage(B2, 0, 0, W, H);
    if (q >= 2 || !useFilter) { ctx.globalAlpha = 0.5 * api.strength; ctx.drawImage(B3, 0, 0, W, H); }
    ctx.restore();
  }
  return api;
}
