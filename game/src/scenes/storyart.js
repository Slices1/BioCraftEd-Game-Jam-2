// Canvas-drawn art shared by the title, intro and ending scenes (no image assets needed).
// Everything is drawn in a 1600x1000 "reference space"; framePanel() maps it to the screen with cover-fit + pan/zoom,
// so portrait phones and landscape desktops both get a nice crop.
import { createRng as mk } from '../engine/util.js';
const createRng = (seed) => mk(seed).next;

export const W = 1600, H = 1000;
export const CRIMSON = '#ff2f4d';

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp01((t - a) / (b - a)); // 0..1 progress of t inside [a,b]

/** Set the transform so ref-space point (fx,fy) is centred at `zoom`. Call inside ctx.save(). Returns the scale. */
export function framePanel(ctx, view, fx, fy, zoom = 1) {
  const s = Math.max(view.w / W, view.h / H) * zoom;
  let tx = view.w / 2 - fx * s, ty = view.h / 2 - fy * s;
  tx = Math.min(0, Math.max(view.w - W * s, tx)); ty = Math.min(0, Math.max(view.h - H * s, ty));
  ctx.translate(tx, ty); ctx.scale(s, s);
  return s;
}

export function sky(ctx, top, mid, bot, y0 = -200, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top); g.addColorStop(0.6, mid); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(-400, y0, W + 800, y1 - y0 + 400);
}

/** Skyline band: deterministic blocks with lit windows. */
export function skyline(ctx, base, seed, o = {}) {
  const r = createRng(seed), col = o.color ?? '#0a0c12', win = o.win ?? 'rgba(255,190,90,0.7)', lit = o.lit ?? 0.12, minH = o.minH ?? 80, maxH = o.maxH ?? 260;
  let x = -60;
  while (x < W + 60) {
    const w = 50 + r() * 110, h = minH + r() * (maxH - minH);
    ctx.fillStyle = col; ctx.fillRect(x, base - h, w, h + 400);
    if (r() < 0.3) ctx.fillRect(x + w * 0.4, base - h - 30 - r() * 40, 5, 60); // antenna
    for (let wy = base - h + 14; wy < base - 10; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) {
      if (r() < lit) { ctx.fillStyle = win; ctx.fillRect(wx, wy, 7, 9); }
    }
    x += w + (r() < 0.25 ? 14 : 0);
  }
}

/** The factory tower, centre x, ground y. Returns the big window position. */
export function tower(ctx, cx, base, t, o = {}) {
  const glowCol = o.glow ?? '#ffc46b', pulse = o.pulse ?? 0, dim = o.dim ?? 1;
  const body = '#0d1017', edge = 'rgba(120,150,190,0.18)';
  ctx.save();
  // stepped tiers
  const tiers = [[300, 260], [230, 230], [170, 200], [120, 170]]; let y = base;
  for (const [w, h] of tiers) { ctx.fillStyle = body; ctx.fillRect(cx - w / 2, y - h, w, h + 6); ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2, y - h, w, h); y -= h; }
  // chimneys + pipes
  ctx.fillStyle = '#0a0c11';
  ctx.fillRect(cx - 40, y - 150, 26, 150); ctx.fillRect(cx + 16, y - 110, 22, 110);
  ctx.fillRect(cx - 90, base - 560, 14, 300);
  ctx.fillRect(cx + 150, base - 380, 12, 360);
  ctx.strokeStyle = '#161a22'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(cx + 150, base - 330); ctx.lineTo(cx + 150, base - 200); ctx.stroke();
  // beacon
  ctx.fillStyle = Math.sin(t * 3) > 0.2 ? '#ff3b4f' : '#40121a'; ctx.beginPath(); ctx.arc(cx - 27, y - 156, 5, 0, 7); ctx.fill();
  // small windows
  const r = createRng(77);
  for (let k = 0; k < 90; k++) {
    const wx = cx - 140 + r() * 280, wy = base - 40 - r() * 600;
    if (wx < cx - 60 || wx > cx + 60 || wy > base - 250) {
      if (r() < 0.45) { ctx.fillStyle = `rgba(255,170,80,${0.2 + r() * 0.35 * dim})`; ctx.fillRect(wx, wy, 9, 6); }
    }
  }
  // the big window
  const wx = cx, wy = base - 640 + 0, ww = 46, wh = 70;
  const g = ctx.createRadialGradient(wx, wy, 4, wx, wy, 120 + pulse * 40);
  g.addColorStop(0, glowCol); g.addColorStop(0.15, 'rgba(255,196,107,0.35)'); g.addColorStop(1, 'rgba(255,196,107,0)');
  ctx.fillStyle = g; ctx.fillRect(wx - 200, wy - 200, 400, 400);
  ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.moveTo(wx - ww / 2, wy + wh / 2); ctx.lineTo(wx - ww / 2, wy - 10); ctx.quadraticCurveTo(wx, wy - wh / 2 - 12, wx + ww / 2, wy - 10); ctx.lineTo(wx + ww / 2, wy + wh / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = glowCol; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(wx - ww / 2 + 5, wy + wh / 2 - 4); ctx.lineTo(wx - ww / 2 + 5, wy - 8); ctx.quadraticCurveTo(wx, wy - wh / 2 - 4, wx + ww / 2 - 5, wy - 8); ctx.lineTo(wx + ww / 2 - 5, wy + wh / 2 - 4); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = '#1a1208'; ctx.fillRect(wx - 2, wy - wh / 2 + 6, 4, wh);
  ctx.restore();
  return { x: wx, y: wy, ventX: cx - 150, ventY: base - 300 };
}

/** Prismatic glint: 4-point star with chromatic split. a = 0..1 strength. */
export function glint(ctx, x, y, size, a, t = 0) {
  if (a <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
  const cols = ['rgba(255,60,120,', 'rgba(80,255,180,', 'rgba(90,150,255,'];
  cols.forEach((c, i) => {
    ctx.save(); ctx.rotate(t * 0.4 + i * 0.35); ctx.translate((i - 1) * size * 0.05, 0);
    ctx.fillStyle = c + (0.55 * a) + ')';
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.08, -size * 0.08); ctx.lineTo(size, 0); ctx.lineTo(size * 0.08, size * 0.08);
    ctx.lineTo(0, size); ctx.lineTo(-size * 0.08, size * 0.08); ctx.lineTo(-size, 0); ctx.lineTo(-size * 0.08, -size * 0.08); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.restore();
}

/** Rain in screen space. drops are static; motion comes from t. */
const RAIN = (() => { const r = createRng(5), a = []; for (let i = 0; i < 160; i++) a.push({ x: r(), y: r(), s: 0.7 + r() * 0.8, l: 0.6 + r() * 0.8 }); return a; })();
export function rain(ctx, view, t, amt = 1, wind = 0.25) {
  ctx.save(); ctx.strokeStyle = 'rgba(170,200,230,0.28)'; ctx.lineWidth = 1.4;
  const n = Math.floor(RAIN.length * amt);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const d = RAIN[i], sp = 900 * d.s;
    const y = ((d.y * view.h + t * sp) % (view.h + 60)) - 30, x = (((d.x * view.w - t * sp * wind) % view.w) + view.w) % view.w;
    ctx.moveTo(x, y); ctx.lineTo(x - 7 * d.l * wind * 4, y + 20 * d.l);
  }
  ctx.stroke(); ctx.restore();
}

/** Side-view crow silhouette. (x,y) = centre of body. o: {flap: -1..1, tilt: head tilt rad, flip, perch, eye, lean} */
export function crow(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale((o.flip ? -1 : 1) * s, s); if (o.lean) ctx.rotate(o.lean);
  const ink = o.color ?? '#05060a';
  ctx.fillStyle = ink; ctx.strokeStyle = ink;
  if (o.perch) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-3, 18); ctx.lineTo(-5, 34); ctx.moveTo(6, 18); ctx.lineTo(8, 34); ctx.stroke(); }
  // tail
  ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(-58, 12 + (o.perch ? 6 : 0)); ctx.lineTo(-52, 2); ctx.lineTo(-60, -4); ctx.lineTo(-20, -10); ctx.closePath(); ctx.fill();
  // body
  ctx.beginPath(); ctx.ellipse(0, 4, 30, 17, -0.12, 0, 7); ctx.fill();
  // wing
  const f = o.flap ?? 0;
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(-30, -34 * f - 10, -66, -22 * f + 4); ctx.lineTo(-60, -8 * f + 10);
  ctx.quadraticCurveTo(-30, -2, 6, 12); ctx.closePath(); ctx.fill();
  // head (tiltable)
  ctx.save(); ctx.translate(22, -10); ctx.rotate(o.tilt ?? 0);
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(30, 2); ctx.lineTo(8, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = o.eye ?? '#9fe9ff'; ctx.shadowColor = o.eye ?? '#4ff3ff'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(5, -3, 2.1, 0, 7); ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** One sharp feather blade from (0,0) pointing along +x, length L. */
export function feather(ctx, L, wd, fill, edge) {
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(L * 0.25, -wd * 1.1, L * 0.7, -wd * 0.8, L, 0);
  ctx.bezierCurveTo(L * 0.65, wd * 0.45, L * 0.25, wd * 0.7, 0, 0); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(L * 0.04, 0); ctx.lineTo(L * 0.92, 0); ctx.strokeStyle = edge || 'rgba(255,47,77,0.5)'; ctx.lineWidth = 1; ctx.stroke();
}

let logoCache = null;
/** CORVID logo: crimson, sharp, with a feather-wing motif. Centre (cx,cy), word width `w` px. */
export function drawLogo(ctx, cx, cy, w, t = 0) {
  const size = w * 0.27, word = 'CORVID', track = size * 0.06;
  ctx.save(); ctx.translate(cx, cy);
  // wings of feathers behind the word
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1); ctx.translate(w * 0.26, -size * 0.1);
    for (let i = 0; i < 6; i++) {
      ctx.save(); const a = -0.5 + i * 0.17 + Math.sin(t * 1.2 + i) * 0.015; ctx.rotate(a);
      feather(ctx, w * (0.42 - i * 0.025), size * 0.1, i % 2 ? '#2a0a12' : '#3c0d18', 'rgba(255,47,77,0.55)');
      ctx.restore();
    }
    ctx.restore();
  }
  // the word, per letter, skewed
  ctx.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const ws = [...word].map((c) => ctx.measureText(c).width + track), total = ws.reduce((a, b) => a + b, 0) - track;
  ctx.transform(1, 0, -0.2, 1, 0, 0);
  let x = -total / 2;
  const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
  g.addColorStop(0, '#ff6b7c'); g.addColorStop(0.45, '#e01e3c'); g.addColorStop(1, '#6b0b1d');
  ctx.lineJoin = 'miter'; ctx.miterLimit = 6;
  ctx.shadowColor = 'rgba(255,30,70,0.7)'; ctx.shadowBlur = size * 0.35;
  [...word].forEach((c, i) => {
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = '#12020a'; ctx.strokeText(c, x, 0);
    ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.fillText(c, x, 0);
    ctx.shadowBlur = size * 0.35;
    x += ws[i];
  });
  ctx.shadowBlur = 0;
  // sharp cut + glint streak across the word
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
  const sx = ((t * 0.25) % 1.6 - 0.3) * total - total / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(-total / 2, -size * 0.5, total, size); ctx.clip();
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,210,0.16)';
  ctx.beginPath(); ctx.moveTo(sx, -size * 0.5); ctx.lineTo(sx + size * 0.12, -size * 0.5); ctx.lineTo(sx - size * 0.1, size * 0.5); ctx.lineTo(sx - size * 0.22, size * 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // underline blade
  ctx.translate(-total * 0.5, size * 0.52);
  ctx.fillStyle = CRIMSON; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(total * 1.04, -size * 0.04); ctx.lineTo(total * 0.96, size * 0.06); ctx.lineTo(size * 0.25, size * 0.06); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Dormant mech in its cradle, centre x, feet y, height h. lit 0..1 = cyan cradle power, blink = cockpit light. */
export function mech(ctx, x, y, h, lit = 0, t = 0) {
  const u = h / 100;
  ctx.save(); ctx.translate(x, y); ctx.scale(u, u);
  const cy = 'rgba(79,243,255,';
  // cradle frame
  ctx.strokeStyle = lit > 0.05 ? cy + (0.35 + 0.55 * lit) + ')' : '#1c222c'; ctx.lineWidth = 3;
  if (lit > 0.05) { ctx.shadowColor = '#4ff3ff'; ctx.shadowBlur = 14 * lit; }
  ctx.strokeRect(-48, -112, 96, 118); ctx.beginPath(); ctx.moveTo(-48, -112); ctx.lineTo(-62, -128); ctx.moveTo(48, -112); ctx.lineTo(62, -128); ctx.moveTo(-62, -128); ctx.lineTo(62, -128); ctx.stroke();
  ctx.shadowBlur = 0;
  for (let i = 0; i < 4; i++) { ctx.fillStyle = lit * (0.4 + 0.6 * Math.sin(t * 6 - i)) > 0.2 ? '#4ff3ff' : '#12161d'; ctx.fillRect(-40 + i * 24, 2, 14, 4); }
  // suit body (slumped)
  const body = '#222833', hi = '#363e4c';
  ctx.fillStyle = body;
  ctx.fillRect(-30, -40, 16, 40); ctx.fillRect(14, -40, 16, 40);              // legs
  ctx.fillStyle = hi; ctx.fillRect(-34, -4, 24, 8); ctx.fillRect(10, -4, 24, 8); // feet
  ctx.fillStyle = body; ctx.fillRect(-36, -98, 72, 62);                          // torso
  ctx.fillStyle = hi; ctx.fillRect(-36, -98, 72, 8); ctx.fillRect(-46, -96, 14, 34); ctx.fillRect(32, -96, 14, 34); // shoulders
  ctx.fillStyle = body; ctx.fillRect(-44, -62, 10, 40); ctx.fillRect(34, -62, 10, 40);  // arms hang
  ctx.fillStyle = '#12151b'; ctx.fillRect(-12, -92, 24, 18);                      // cockpit socket
  const blink = lit > 0.05 ? 1 : (Math.sin(t * 3) > 0.7 ? 0.9 : 0.12);
  ctx.fillStyle = lit > 0.05 ? cy + '1)' : `rgba(255,182,59,${blink})`; ctx.shadowColor = lit > 0.05 ? '#4ff3ff' : '#ffb63b'; ctx.shadowBlur = 12 * blink;
  ctx.fillRect(-6, -87, 12, 8); ctx.shadowBlur = 0;
  ctx.restore();
}

/** Captions (dry, small, bottom third). alpha 0..1 */
export function caption(ctx, view, str, alpha, o = {}) {
  if (alpha <= 0.01) return;
  const size = Math.max(26, Math.min(view.w, view.h) * 0.05);
  const maxW = view.w - 60 - view.safe.left - view.safe.right;
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${size}px Georgia, "Times New Roman", serif`;
  const words = str.split(' '), lines = []; let line = '';
  for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (line && ctx.measureText(tt).width > maxW) { lines.push(line); line = wd; } else line = tt; }
  lines.push(line);
  const y0 = o.y ?? view.h - view.safe.bottom - view.h * 0.16 - (lines.length - 1) * size * 0.6;
  lines.forEach((l, i) => {
    const y = y0 + i * size * 1.25;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(l, view.w / 2, y);
    ctx.fillStyle = o.color ?? '#f1e9dc'; ctx.fillText(l, view.w / 2, y);
  });
  ctx.restore();
}

export function vignette(ctx, view, a = 0.6) {
  const g = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.hypot(view.w, view.h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
}

export function letterbox(ctx, view, k = 0.09) {
  ctx.fillStyle = '#000'; const b = view.h * k;
  ctx.fillRect(0, 0, view.w, b); ctx.fillRect(0, view.h - b, view.w, b);
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
