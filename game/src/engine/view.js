// DPR-aware canvas sizing with a logical "design size".
//   mode 'expand' (default): the design rect always fits; the logical size grows on the
//     relatively-longer axis so the canvas fills the screen (no bars). Use view.w / view.h.
//   mode 'fit': logical size is exactly the design size, letterboxed with bars.
//   autoRotate: true swaps design width/height to match the screen orientation, so a
//     720x1280 design becomes 1280x720 on landscape screens (same UI scale both ways).
// All game drawing happens in logical units after view.begin(ctx).

export function createView(canvas, opts = {}) {
  const o = Object.assign({
    width: 720, height: 1280, mode: 'expand', autoRotate: true, maxDpr: 2,
    background: '#000', letterbox: '#000', pixelated: false,
  }, opts);

  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);

  const mq = (q) => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
  const listeners = new Set();
  let lastW = -1, lastH = -1, lastDpr = -1;

  const view = {
    canvas,
    mode: o.mode,
    autoRotate: o.autoRotate,
    designW: o.width, designH: o.height,
    w: o.width, h: o.height,      // logical size (use these for layout)
    scale: 1,                      // CSS px per logical unit
    dpr: 1,                        // backing pixels per CSS px (capped)
    cssW: 1, cssH: 1,
    offsetX: 0, offsetY: 0,        // CSS px offset of the logical origin (fit mode bars)
    rectLeft: 0, rectTop: 0,
    isPortrait: true,
    /** Best guess at "is a touch device"; input.js keeps it updated from the last input used. */
    isTouch: mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && mq('(hover: none)')),
    safe: { top: 0, right: 0, bottom: 0, left: 0 }, // safe-area insets in logical units
    background: o.background,
    letterbox: o.letterbox,
    pixelated: o.pixelated,

    configure(next) {
      Object.assign(o, next);
      if (next.mode) view.mode = next.mode;
      if ('autoRotate' in next) view.autoRotate = next.autoRotate;
      if ('background' in next) view.background = next.background;
      if ('pixelated' in next) view.pixelated = next.pixelated;
      view.resize(true);
    },

    /** Recompute sizes. Cheap to call; does nothing unless something changed (or force). */
    resize(force = false) {
      const cssW = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1));
      const cssH = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1));
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), o.maxDpr);
      if (!force && cssW === lastW && cssH === lastH && dpr === lastDpr) return false;
      lastW = cssW; lastH = cssH; lastDpr = dpr;

      view.cssW = cssW; view.cssH = cssH; view.dpr = dpr;
      view.isPortrait = cssH >= cssW;
      let dw = o.width, dh = o.height;
      if (view.autoRotate && (dh >= dw) !== view.isPortrait) { const t = dw; dw = dh; dh = t; }
      view.designW = dw; view.designH = dh;

      const scale = Math.min(cssW / dw, cssH / dh);
      view.scale = scale;
      if (view.mode === 'fit') {
        view.w = dw; view.h = dh;
        view.offsetX = (cssW - dw * scale) / 2; view.offsetY = (cssH - dh * scale) / 2;
      } else {
        view.w = cssW / scale; view.h = cssH / scale;
        view.offsetX = 0; view.offsetY = 0;
      }

      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.style.imageRendering = view.pixelated ? 'pixelated' : 'auto';
      const bw = Math.max(1, Math.round(cssW * dpr)), bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw) canvas.width = bw;
      if (canvas.height !== bh) canvas.height = bh;

      const r = canvas.getBoundingClientRect();
      view.rectLeft = r.left; view.rectTop = r.top;
      readSafe();
      for (const fn of listeners) { try { fn(view); } catch (e) { console.error('[view] resize listener', e); } }
      return true;
    },

    /** Call once per frame (main does): catches missed/late resize events (iOS rotation, address bar). */
    check() { view.resize(false); },

    /** Clear the canvas and set the logical transform. */
    begin(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = view.mode === 'fit' ? view.letterbox : view.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const k = view.dpr * view.scale;
      ctx.setTransform(k, 0, 0, k, view.offsetX * view.dpr, view.offsetY * view.dpr);
      if (view.mode === 'fit') { ctx.fillStyle = view.background; ctx.fillRect(0, 0, view.w, view.h); }
      ctx.imageSmoothingEnabled = !view.pixelated;
    },

    /** Draw letterbox bars over anything that spilled outside the design rect (fit mode). */
    end(ctx) {
      if (view.mode !== 'fit') return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = view.letterbox;
      const d = view.dpr, ox = view.offsetX * d, oy = view.offsetY * d, W = canvas.width, H = canvas.height;
      if (ox > 0.5) { ctx.fillRect(0, 0, ox, H); ctx.fillRect(W - ox, 0, ox, H); }
      if (oy > 0.5) { ctx.fillRect(0, 0, W, oy); ctx.fillRect(0, H - oy, W, oy); }
    },

    /** Client (CSS px) -> logical view coordinates. */
    toLogical(clientX, clientY, out = { x: 0, y: 0 }) {
      out.x = (clientX - view.rectLeft - view.offsetX) / view.scale;
      out.y = (clientY - view.rectTop - view.offsetY) / view.scale;
      return out;
    },
    /** Logical -> client CSS px. */
    toClient(x, y, out = { x: 0, y: 0 }) {
      out.x = x * view.scale + view.offsetX + view.rectLeft;
      out.y = y * view.scale + view.offsetY + view.rectTop;
      return out;
    },
    /** Register fn(view) for resizes; returns an unsubscribe function. */
    onResize(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  view.screenToWorld = view.toLogical; // alias; use camera.screenToWorld for camera space

  function readSafe() {
    let t = 0, r = 0, b = 0, l = 0;
    try {
      const cs = getComputedStyle(probe);
      t = parseFloat(cs.paddingTop) || 0; r = parseFloat(cs.paddingRight) || 0;
      b = parseFloat(cs.paddingBottom) || 0; l = parseFloat(cs.paddingLeft) || 0;
    } catch (e) { /* ignore */ }
    const s = view.scale;
    view.safe.top = Math.max(0, t - view.offsetY) / s;
    view.safe.bottom = Math.max(0, b - view.offsetY) / s;
    view.safe.left = Math.max(0, l - view.offsetX) / s;
    view.safe.right = Math.max(0, r - view.offsetX) / s;
  }

  const kick = () => {
    view.resize(true);
    // iOS reports stale sizes / safe areas right after rotation; re-check a bit later.
    setTimeout(() => view.resize(true), 120);
    setTimeout(() => view.resize(true), 600);
  };
  window.addEventListener('resize', () => view.resize(false));
  window.addEventListener('orientationchange', kick);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => view.resize(false));
  // iOS can leave the page scrolled after rotation / bar changes; we never scroll.
  window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); }, { passive: true });

  view.resize(true);
  return view;
}
