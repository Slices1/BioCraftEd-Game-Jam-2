// env.js - isometric (2:1) robotic-factory art. Canvas 2D, no deps, tiles cached in offscreen canvases.
// (sx,sy) = screen position of a tile's TOP diamond vertex at z=0 (after the camera transform). TILE_W=64, TILE_H=32, level=32px.
//   drawBackdrop(ctx, view, t)               screen space (before camera). view = {w,h}
//   drawFloor(ctx, sx, sy, kind, t, seed)    'floor' | 'grate' | 'hazard' | 'pit' | 'plateBase'
//   drawWall(ctx, sx, sy, h, face, t, seed)  face 'n' (along x, back-right edge, faces front-left) | 'w' (along y, back-left edge,
//                                            faces front-right) | 'stub' (low cutaway kerb on the FRONT-LEFT edge) | 'stubR' (front-right edge)
//   drawRaised(ctx, sx, sy, h, t, seed)      raised steel block, top at z=h levels (draw after tiles behind it)
//   drawProp(ctx, sx, sy, kind, t, seed)     'barrel'|'toolcart'|'cables'|'scrap'|'lamp'|'pipe_stack'|'crate_small'|'monitor'
// Painter order is the caller's job (back to front). Everything deterministic by seed.

const TAU = Math.PI * 2, SC = 2, LV = 32;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }
const sm = s => (Math.imul((s >>> 0) ^ ((s >>> 0) >>> 15), 2246822519) >>> 13);
function rng(s) { s >>>= 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hc = {};
function hx(h) { return hc[h] || (hc[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]); }
function mix(a, b, t) { const A = hx(a), B = hx(b); return `rgb(${A[0] + (B[0] - A[0]) * t | 0},${A[1] + (B[1] - A[1]) * t | 0},${A[2] + (B[2] - A[2]) * t | 0})`; }
function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function lg(c, x0, y0, x1, y1, st) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const s of st) g.addColorStop(s[0], s[1]); return g; }
function rg(c, x, y, r0, r1, st) { const g = c.createRadialGradient(x, y, r0, x, y, r1); for (const s of st) g.addColorStop(s[0], s[1]); return g; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h)); return c; }
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }

/* ---------- glow sprites ---------- */
const SP = {};
[['w', '255,255,255'], ['c', '61,242,255'], ['a', '255,170,70'], ['r', '255,59,59'], ['g', '77,255,154'], ['s', '191,232,238'], ['t', '30,120,130']].forEach(([n, A]) => {
  const k = mkCanvas(96, 96), c = k.getContext('2d');
  c.fillStyle = rg(c, 48, 48, 0, 48, [[0, `rgba(${A},1)`], [.18, `rgba(${A},.55)`], [.45, `rgba(${A},.16)`], [1, `rgba(${A},0)`]]);
  c.fillRect(0, 0, 96, 96); SP[n] = k;
});
function glow(c, n, x, y, r, a, sy) { if (a <= .004) return; c.globalAlpha = a > 1 ? 1 : a; c.drawImage(SP[n], x - r, y - r * (sy || 1), r * 2, r * 2 * (sy || 1)); c.globalAlpha = 1; }

/* ---------- sprite cache ---------- */
const cache = new Map();
function sprite(key, w, h, ox, oy, fn) {
  let s = cache.get(key); if (s) return s;
  const cv = mkCanvas(w * SC, h * SC), g = cv.getContext('2d'); g.scale(SC, SC); g.translate(ox, oy); fn(g);
  s = { cv, w, h, ox, oy }; cache.set(key, s);
  if (cache.size > 700) cache.delete(cache.keys().next().value);
  return s;
}
function put(ctx, s, sx, sy) { ctx.drawImage(s.cv, Math.round(sx) - s.ox, Math.round(sy) - s.oy, s.w, s.h); }

/* ---------- material helpers (flat space) ---------- */
function rivet(c, x, y, r) {
  c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.arc(x + .3, y + .4, r + .5, 0, TAU); c.fill();
  c.fillStyle = '#7d8f98'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .4, 0, TAU); c.fill();
}
function hazard(c, x, y, w, h, a, col) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#17120a'; c.fillRect(x, y, w, h); c.fillStyle = col || `rgba(232,170,30,${a})`;
  for (let i = -h; i < w + h; i += h * 1.2) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + h * .6, y + h); c.lineTo(x + i + h * 1.6, y); c.lineTo(x + i + h, y); c.fill(); }
  c.restore();
}
function hpipe(c, x, y, len, th, base) {
  c.fillStyle = lg(c, 0, y, 0, y + th, [[0, mix(base, '#000000', .35)], [.25, mix(base, '#ffffff', .3)], [.55, base], [1, mix(base, '#000000', .6)]]); c.fillRect(x, y, len, th);
  c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x, y + th * .2, len, 1);
}
function flange(c, x, y, th, base) { c.fillStyle = mix(base, '#ffffff', .15); c.fillRect(x - 2, y - 2, 4, th + 4); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = .8; c.strokeRect(x - 2, y - 2, 4, th + 4); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x - 1.6, y - 1.6, 1, th + 3); }
function cableCurve(c, x0, y0, x1, y1, sag, th, col) {
  c.lineCap = 'round'; const mx = (x0 + x1) / 2, my = Math.max(y0, y1) + sag;
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.strokeStyle = '#04080c'; c.lineWidth = th + 1.6; c.stroke(); c.strokeStyle = col; c.lineWidth = th; c.stroke();
  c.beginPath(); c.moveTo(x0, y0 - .5); c.quadraticCurveTo(mx, my - th * .3, x1, y1 - .5); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = Math.max(.6, th * .25); c.stroke();
}
const gaugeCache = new Map();
function gaugeFace(r) {
  let s = gaugeCache.get(r); if (s) return s;
  const sc = 3, cv = mkCanvas(r * 2 * sc + 6, r * 2 * sc + 6), c = cv.getContext('2d'); c.scale(sc, sc); c.translate(r + 1, r + 1);
  c.fillStyle = rg(c, -r * .3, -r * .3, 1, r * 1.1, [[0, '#8ba0aa'], [.7, '#44606c'], [1, '#1a2b35']]); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = '#050a0e'; c.lineWidth = .8; c.stroke();
  c.fillStyle = '#0a1319'; c.beginPath(); c.arc(0, 0, r * .78, 0, TAU); c.fill();
  c.lineWidth = r * .13; c.strokeStyle = '#2cc4d4'; c.beginPath(); c.arc(0, 0, r * .6, Math.PI * .75, Math.PI * 1.65); c.stroke();
  c.strokeStyle = '#e0a63a'; c.beginPath(); c.arc(0, 0, r * .6, Math.PI * 1.65, Math.PI * 2); c.stroke();
  c.strokeStyle = '#d04040'; c.beginPath(); c.arc(0, 0, r * .6, Math.PI * 2, Math.PI * 2.25); c.stroke();
  s = { cv, pad: 1 }; gaugeCache.set(r, s); return s;
}
function gaugeStatic(c, x, y, r) { const s = gaugeFace(r); c.drawImage(s.cv, x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2); }
function needle(c, x, y, r, v) {
  const a = Math.PI * .75 + clamp(v, 0, 1) * Math.PI * 1.5;
  c.strokeStyle = '#ff5a3c'; c.lineWidth = Math.max(.9, r * .1); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * .68, y + Math.sin(a) * r * .68); c.stroke();
  c.fillStyle = '#dde'; c.beginPath(); c.arc(x, y, Math.max(1.1, r * .12), 0, TAU); c.fill();
}
function valveWheel(c, x, y, rad) {
  c.fillStyle = '#1a2a33'; c.beginPath(); c.arc(x, y, rad + 2, 0, TAU); c.fill(); c.strokeStyle = '#050a0e'; c.lineWidth = .8; c.stroke();
  c.strokeStyle = '#b8352c'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,190,170,.5)'; c.lineWidth = .7; c.beginPath(); c.arc(x - .4, y - .4, rad - .5, 3.4, 5); c.stroke();
  c.strokeStyle = '#8a2a24'; c.lineWidth = 1.3; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(k * TAU / 6) * rad, y + Math.sin(k * TAU / 6) * rad); c.stroke(); }
  c.fillStyle = '#c8ccd0'; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill();
}
// iso helpers (screen space)
function isoBox(g, x, y, a, hh, top, left, right, line) {
  const b = a / 2;
  poly(g, [x - a, y - hh, x, y - hh + b, x, y + b, x - a, y]); g.fillStyle = left; g.fill();
  poly(g, [x, y - hh + b, x + a, y - hh, x + a, y, x, y + b]); g.fillStyle = right; g.fill();
  poly(g, [x, y - hh - b, x + a, y - hh, x, y - hh + b, x - a, y - hh]); g.fillStyle = top; g.fill();
  g.strokeStyle = line || 'rgba(0,0,0,.55)'; g.lineWidth = .9; g.lineJoin = 'round';
  poly(g, [x, y - hh - b, x + a, y - hh, x + a, y, x, y + b, x - a, y, x - a, y - hh]); g.stroke();
  g.beginPath(); g.moveTo(x - a, y - hh); g.lineTo(x, y - hh + b); g.lineTo(x + a, y - hh); g.moveTo(x, y - hh + b); g.lineTo(x, y + b); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x - a, y - hh); g.lineTo(x, y - hh - b); g.lineTo(x + a, y - hh); g.stroke();
}
function shadowEl(g, x, y, rx, a) { g.save(); g.translate(x, y); g.scale(1, .5); g.fillStyle = rg(g, 0, 0, 0, rx, [[0, `rgba(0,6,10,${a})`], [1, 'rgba(0,6,10,0)']]); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); }
function cylinder(g, x, y, r, hh, col, bands) {
  g.fillStyle = lg(g, x - r, 0, x + r, 0, [[0, mix(col, '#000000', .5)], [.3, mix(col, '#ffffff', .22)], [.55, col], [1, mix(col, '#000000', .65)]]);
  g.beginPath(); g.moveTo(x - r, y - hh); g.lineTo(x - r, y); g.ellipse(x, y, r, r / 2, 0, Math.PI, 0, true); g.lineTo(x + r, y - hh); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = .9; g.stroke();
  for (const b of bands || []) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y - hh * b, r, r / 2, 0, 0, Math.PI); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = .8; g.beginPath(); g.ellipse(x, y - hh * b - 1.4, r, r / 2, 0, .1, Math.PI - .1); g.stroke(); }
  g.beginPath(); g.ellipse(x, y - hh, r, r / 2, 0, 0, TAU); g.fillStyle = mix(col, '#ffffff', .15); g.fill(); g.stroke();
}

/* ---------- uv (tile-flat) space ---------- */
const diamondPath = (g, x, y) => poly(g, [x, y, x + 32, y + 16, x, y + 32, x - 32, y + 16]);
function uvOn(g, fn) { g.save(); g.transform(.5, .25, -.5, .25, 0, 0); fn(); g.restore(); }
function faceT(g, face, sx, sy) {
  if (face === 'n' || face === 'stub') g.transform(1, .5, 0, 1, face === 'n' ? sx : sx - 32, face === 'n' ? sy : sy + 16);
  else if (face === 'w') g.transform(1, -.5, 0, 1, sx - 32, sy + 16);
  else g.transform(1, -.5, 0, 1, sx, sy + 32);
}

/* ---------- floor tiles ---------- */
const FLOOR_BASE = ['#46565d', '#4c5b60', '#42535c', '#51504a', '#485959', '#3e4e56'];
function plates(g, R, S, base) {
  g.fillStyle = lg(g, 0, 0, 64, 64, [[0, mix(base, '#ffffff', .12)], [1, mix(base, '#000000', .22)]]); g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = i * 32, y = j * 32, v = (R() - .5) * .12;
    g.fillStyle = v > 0 ? `rgba(255,240,210,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(x, y, 32, 32);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.strokeRect(x + .6, y + .6, 31, 31);
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1.6, y + 31); g.lineTo(x + 1.6, y + 1.6); g.lineTo(x + 31, y + 1.6); g.stroke();
    for (const [rx, ry] of [[4, 4], [28, 4], [4, 28], [28, 28]]) rivet(g, x + rx, y + ry, 1.5);
  }
  // wear / scuffs
  for (let k = 0; k < 7; k++) { g.strokeStyle = R() < .5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.14)'; g.lineWidth = .7 + R(); const x = R() * 56, y = R() * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + R() * 14, y + (R() - .5) * 3); g.stroke(); }
  if (S % 3 === 0) { const x = 14 + R() * 36, y = 14 + R() * 36; g.fillStyle = rg(g, x, y, 0, 15, [[0, 'rgba(10,14,12,.5)'], [.6, 'rgba(25,20,10,.25)'], [1, 'rgba(25,20,10,0)']]); g.beginPath(); g.ellipse(x, y, 16 + R() * 6, 11 + R() * 6, R() * 3, 0, TAU); g.fill(); }
  if (S % 5 === 1) { g.fillStyle = 'rgba(224,170,40,.5)'; for (let d = 6; d < 60; d += 12) g.fillRect(d, 2.6, 7, 3.6); }
  if (S % 7 === 2) { g.fillStyle = 'rgba(40,200,220,.28)'; g.fillRect(2, 30, 60, 2.4); }
}
function floorTop(g, S, base) { // g in screen space, tile top vertex at (0,0)
  g.save(); diamondPath(g, 0, 0); g.clip();
  uvOn(g, () => plates(g, rng(S * 977 + 5), S, base));
  if (S % 3 === 1) { const gg = rg(g, 0, 14, 2, 34, [[0, 'rgba(255,170,70,.12)'], [1, 'rgba(255,170,70,0)']]); g.fillStyle = gg; g.fillRect(-32, 0, 64, 32); }
  g.restore();
  diamondPath(g, 0, 0); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .9; g.stroke();
}
function buildFloor(g, kind, S) {
  const R = rng(S * 31 + 7);
  if (kind === 'floor' || kind === 'plateBase') {
    floorTop(g, S, FLOOR_BASE[S % FLOOR_BASE.length]);
    if (kind === 'plateBase') {
      g.save(); diamondPath(g, 0, 0); g.clip();
      uvOn(g, () => { rr(g, 10, 10, 44, 44, 5); g.fillStyle = '#2a3a42'; g.fill(); rr(g, 13, 13, 38, 38, 4); g.fillStyle = lg(g, 0, 13, 0, 51, [[0, '#8da0a8'], [1, '#4c6068']]); g.fill(); hazard(g, 16, 16, 32, 5, .9); hazard(g, 16, 43, 32, 5, .9); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.2; g.strokeRect(13, 13, 38, 38); });
      g.restore();
    }
  } else if (kind === 'grate') {
    g.save(); diamondPath(g, 0, 0); g.clip(); g.fillStyle = '#05090d'; g.fillRect(-32, 0, 64, 32);
    const warm = S % 2 === 1, A = warm ? '255,150,50' : '40,220,240';
    g.fillStyle = rg(g, 0, 16, 0, 30, [[0, `rgba(${A},.5)`], [.6, `rgba(${A},.14)`], [1, `rgba(${A},0)`]]); g.fillRect(-32, 0, 64, 32);
    uvOn(g, () => {
      g.fillStyle = 'rgba(2,4,6,.55)'; g.fillRect(0, 0, 64, 64);
      for (let i = 4; i < 62; i += 6) { g.fillStyle = '#6c7e86'; g.fillRect(i, 2, 2.6, 60); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(i, 2, 1, 60); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(i + 2.6, 2, .8, 60); }
      g.fillStyle = '#3b4c54'; for (let j = 12; j < 62; j += 16) g.fillRect(2, j, 60, 2);
      g.strokeStyle = '#7a8d95'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 61, 61); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.strokeRect(0, 0, 64, 64);
    });
    g.restore(); diamondPath(g, 0, 0); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.stroke();
  } else if (kind === 'hazard') {
    g.save(); diamondPath(g, 0, 0); g.clip();
    uvOn(g, () => {
      g.fillStyle = '#1a150b'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d7a02a';
      for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 + 64, 64); g.lineTo(i + 64, 64); g.fill(); }
      for (let k = 0; k < 40; k++) { g.fillStyle = R() < .5 ? 'rgba(0,0,0,.25)' : 'rgba(255,230,160,.15)'; g.fillRect(R() * 64, R() * 64, 1 + R() * 3, 1); }
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.strokeRect(3, 3, 58, 58);
    });
    g.fillStyle = rg(g, 0, 16, 2, 36, [[0, 'rgba(255,255,255,.1)'], [1, 'rgba(0,0,0,.2)']]); g.fillRect(-32, 0, 64, 32);
    g.restore(); diamondPath(g, 0, 0); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .9; g.stroke();
  } else if (kind === 'pit') {
    g.save(); diamondPath(g, 0, 0); g.clip();
    g.fillStyle = rg(g, 0, 18, 0, 34, [[0, '#010305'], [.7, '#050b10'], [1, '#0d1a22']]); g.fillRect(-32, 0, 64, 32);
    poly(g, [-32, 16, 0, 0, 0, 22, -32, 38]); g.fillStyle = lg(g, 0, 4, 0, 36, [[0, '#17303b'], [1, '#02060a']]); g.fill();
    poly(g, [0, 0, 32, 16, 32, 38, 0, 22]); g.fillStyle = lg(g, 0, 4, 0, 36, [[0, '#0e2029'], [1, '#02060a']]); g.fill();
    for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(${R() < .5 ? '255,160,60' : '60,220,240'},${.15 + R() * .2})`; g.fillRect(-14 + R() * 28, 16 + (R() - .5) * 10, 1.5, 1.5); }
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-32, 16); g.lineTo(0, 0); g.lineTo(32, 16); g.stroke();
    g.restore();
    g.strokeStyle = '#8fa3ab'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-32, 16); g.lineTo(0, 32); g.lineTo(32, 16); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-32, 17.5); g.lineTo(0, 33.5); g.lineTo(32, 17.5); g.stroke();
    g.strokeStyle = 'rgba(224,170,40,.55)'; g.lineWidth = 1.2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(-30, 17.5); g.lineTo(0, 31); g.lineTo(30, 17.5); g.stroke(); g.setLineDash([]);
  }
}
export function drawFloor(ctx, sx, sy, kind, t, seed) {
  const S = sm(seed) % 8, k = kind === 'plateBase' || kind === 'grate' || kind === 'hazard' || kind === 'pit' ? kind : 'floor';
  put(ctx, sprite('F|' + k + '|' + S, 68, 40, 34, 2, g => buildFloor(g, k, S)), sx, sy);
  if (k === 'grate') {
    const warm = S % 2 === 1, p = .5 + .5 * Math.sin(t * 2.2 + S);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, warm ? 'a' : 'c', sx, sy + 16, 24, .22 + .16 * p, .5); ctx.globalCompositeOperation = 'source-over';
  } else if (k === 'plateBase') {
    const p = .5 + .5 * Math.sin(t * 3 + S);
    ctx.save(); ctx.translate(sx, sy); ctx.transform(.5, .25, -.5, .25, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(61,242,255,${.35 + .45 * p})`; ctx.lineWidth = 2; ctx.strokeRect(10, 10, 44, 44);
    ctx.fillStyle = `rgba(61,242,255,${.05 + .08 * p})`; ctx.fillRect(13, 13, 38, 38); ctx.restore();
    glow(ctx, 'c', sx, sy + 16, 20, .12 + .15 * p, .5); ctx.globalCompositeOperation = 'source-over';
  }
}

/* ---------- raised block ---------- */
function panelFace(g, H, S, col1, col2, rim) { // flat panel space: u 0..32, v up (y = -v)
  g.fillStyle = lg(g, 0, -H, 0, 0, [[0, col1], [1, col2]]); g.fillRect(0, -H, 32, H);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; for (let v = 32; v < H; v += 32) { g.beginPath(); g.moveTo(0, -v); g.lineTo(32, -v); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.12)'; for (let v = 32; v < H; v += 32) { g.beginPath(); g.moveTo(0, -v + 1.2); g.lineTo(32, -v + 1.2); g.stroke(); }
  for (let v = 4; v < H; v += 32) { rivet(g, 4, -v - 1, 1.2); rivet(g, 28, -v - 1, 1.2); }
  if (S % 2 === 0) hazard(g, 3, -9, 26, 6, .85);
  g.fillStyle = rim; g.fillRect(0, -H, 32, 1.6); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, -3, 32, 3);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(31, -H, 1, H);
}
export function drawRaised(ctx, sx, sy, h, t, seed) {
  const H = Math.round(h * LV), S = sm(seed) % 6;
  const s = sprite('R|' + H + '|' + S, 68, H + 40, 34, H + 2, g => {
    g.save(); g.translate(-32, 16); g.transform(1, .5, 0, 1, 0, 0); panelFace(g, H, S, '#6b8794', '#33505e', 'rgba(220,245,255,.35)'); g.restore();
    g.save(); g.translate(0, 32); g.transform(1, -.5, 0, 1, 0, 0); panelFace(g, H, S + 1, '#445f6d', '#1d3441', 'rgba(180,220,235,.2)'); g.restore();
    g.save(); g.translate(0, -H); floorTop(g, S + 2, '#6f8189'); g.restore();
    g.save(); g.translate(0, -H); diamondPath(g, 0, 0); g.clip(); uvOn(g, () => { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.strokeRect(4, 4, 56, 56); }); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-32, 16 - H); g.lineTo(-32, 16); g.lineTo(0, 32); g.lineTo(32, 16); g.lineTo(32, 16 - H); g.stroke(); g.beginPath(); g.moveTo(0, 32 - H); g.lineTo(0, 32); g.stroke();
  });
  put(ctx, s, sx, sy);
  const on = Math.sin(t * 2.4 + S * 2) > 0;
  if (S % 3 !== 1) { const lx = sx + 24, ly = sy + 18 - H * .5; ctx.fillStyle = on ? '#7ff6ff' : '#1d5058'; ctx.fillRect(lx - 1, ly - 1, 3, 3); if (on) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 'c', lx + .5, ly + .5, 8, .5); ctx.globalCompositeOperation = 'source-over'; } }
}

/* ---------- walls ---------- */
const WALL_VAR = 12;
function decorFor(face, S) {
  const R = rng(hash(face + S) ^ 0x9E37), out = [], slots = [8, 24];
  const types = ['valve', 'gauge', 'cables', 'poster', 'warn', 'lights', 'vent', 'box', 'poster', 'cables', 'warn', 'lights'];
  if (R() < .42) out.push({ type: 'lamp', u: slots[R() < .5 ? 0 : 1], v: .72 });
  const n = 1 + (R() * 2 | 0);
  for (let i = 0; i < n; i++) { const u = slots[(i + (R() < .5 ? 0 : 1)) % 2]; if (out.some(o => Math.abs(o.u - u) < 10 && o.type !== 'cables' && o.type !== 'valve')) continue; out.push({ type: types[R() * types.length | 0], u: u + (R() * 4 - 2), p: R(), ph: R() * 6, col: R() }); }
  return out;
}
function buildWall(g, face, H, S) {
  const lit = face === 'n' || face === 'stub', R = rng(hash(face + S + H));
  const c1 = lit ? '#50727f' : '#3a5663', c2 = lit ? '#2b4452' : '#1c313e';
  const decor = decorFor(face, S);
  g.save(); faceT(g, face, 0, 0);
  g.fillStyle = lg(g, 0, -H, 0, 0, [[0, c1], [1, c2]]); g.fillRect(0, -H, 32, H);
  // painted panel seams + rivets
  g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 1; for (let v = 32; v < H; v += 32) { g.beginPath(); g.moveTo(0, -v); g.lineTo(32, -v); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.1)'; for (let v = 32; v < H; v += 32) { g.beginPath(); g.moveTo(0, -v + 1.2); g.lineTo(32, -v + 1.2); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, -H, 1, H); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(1, -H, 1, H);
  for (let v = 5; v < H; v += 32) { rivet(g, 4, -v - 1, 1.1); rivet(g, 28, -v - 1, 1.1); }
  // weathering streaks
  for (let k = 0; k < 3; k++) { const x = R() * 30, hh = 14 + R() * H * .5; g.fillStyle = lg(g, 0, -H * .8, 0, -H * .8 + hh, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(15,10,5,.18)']]); g.fillRect(x, -H * .8, 1.6 + R() * 2, hh); }
  // pipes (continuous across segments)
  if (H >= 48) { hpipe(g, 0, -(H - 17), 32, 7, '#7a5a34'); hpipe(g, 0, -(H - 27), 32, 3.5, '#2f6a68'); if (S % 2) flange(g, 6 + (S % 3) * 8, -(H - 17), 7, '#7a5a34'); }
  if (H >= 96) { hpipe(g, 0, -34, 32, 5, '#37606a'); if (S % 3 === 0) flange(g, 22, -34, 5, '#37606a'); }
  // kick plate with hazard
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, -9, 32, 9); if (S % 3 === 0) hazard(g, 0, -8, 32, 5, .8);
  g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(0, -9, 32, .9);
  // decor
  g.save(); g.beginPath(); g.rect(0, -H, 32, H); g.clip();
  for (const d of decor) drawDecor(g, d, H, face);
  g.restore();
  // lamp light pool (additive) after decor
  for (const d of decor) if (d.type === 'lamp') {
    const ly = -H * d.v; g.globalCompositeOperation = 'lighter';
    g.fillStyle = rg(g, d.u, ly + 4, 1, 30, [[0, 'rgba(255,170,70,.48)'], [.5, 'rgba(255,150,60,.15)'], [1, 'rgba(255,140,50,0)']]); g.fillRect(0, -H, 32, H);
    g.globalCompositeOperation = 'source-over';
  }
  // ambient occlusion top/bottom
  g.fillStyle = lg(g, 0, -H, 0, -H + 14, [[0, 'rgba(0,10,16,.35)'], [1, 'rgba(0,10,16,0)']]); g.fillRect(0, -H, 32, 14);
  g.fillStyle = lg(g, 0, -16, 0, 0, [[0, 'rgba(0,8,14,0)'], [1, 'rgba(0,8,14,.4)']]); g.fillRect(0, -16, 32, 16);
  g.restore();
  // top cap (screen space)
  const cap = face === 'n' ? [0, -H, 32, 16 - H, 38, 13 - H, 6, -3 - H] : face === 'w' ? [-32, 16 - H, 0, -H, -6, -3 - H, -38, 13 - H] : null;
  if (cap) { poly(g, cap); g.fillStyle = lit ? '#7f98a4' : '#62798a'; g.fill(); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = .9; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(cap[0], cap[1]); g.lineTo(cap[2], cap[3]); g.stroke(); }
  return decor;
}
function drawDecor(g, d, H, face) {
  const u = d.u, vTop = H - 17.5; // pipe line
  switch (d.type) {
    case 'valve': { const y = -(H - 13.5); g.fillStyle = '#2d4452'; g.fillRect(u - 5, y - 6, 10, 12); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .8; g.strokeRect(u - 5, y - 6, 10, 12); g.fillStyle = '#566e7a'; g.fillRect(u - 1, y - 14, 2, 8); valveWheel(g, u, y - 12, 5.2); break; }
    case 'gauge': { const y = -Math.max(26, H * .45 + d.p * 6); g.fillStyle = '#243842'; g.fillRect(u - 1.5, y, 3, 8); g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(u + 1, y - 1, 10.5, 0, TAU); g.fill(); gaugeStatic(g, u, y - 2, 9.5); d.gy = y - 2; break; }
    case 'cables': { cableCurve(g, 1, -H + 2, 31, -H + 3, 14 + d.p * 10, 2.6, '#0a141b'); cableCurve(g, u - 4, -H + 2, u + 1, -H + 30 + d.p * 14, 4, 3.2, '#0d1b24'); cableCurve(g, u + 3, -H + 2, u + 5, -H + 22 + d.p * 10, 3, 2, d.col < .5 ? '#6a2a48' : '#7a5a1e'); g.fillStyle = '#2b3d49'; g.fillRect(u - 2.5, -H + 29 + d.p * 14, 5, 4); break; }
    case 'poster': { const w = 14, h = 18, y = -Math.max(30, H * .5); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(u - w / 2 + 1, y - h / 2 + 1.5, w, h); const pal = [['#b9a97e', '#a43b32'], ['#9fb7b0', '#2d5b6e'], ['#c7b680', '#2a2a2a']][d.col * 3 | 0]; g.fillStyle = pal[0]; g.fillRect(u - w / 2, y - h / 2, w, h); g.fillStyle = pal[1]; g.beginPath(); g.arc(u, y - 2, 4, 0, TAU); g.fill(); g.fillRect(u - 5, y + 4, 10, 1.6); g.fillRect(u - 5, y + 7, 7, 1.2); g.fillStyle = 'rgba(30,20,10,.25)'; g.beginPath(); g.moveTo(u + w / 2, y + h / 2 - 5); g.lineTo(u + w / 2, y + h / 2); g.lineTo(u + w / 2 - 5, y + h / 2); g.fill(); g.fillStyle = 'rgba(230,220,180,.7)'; g.fillRect(u - 3, y - h / 2 - 1.5, 6, 3); break; }
    case 'warn': { const y = -Math.max(30, H * .5); g.fillStyle = '#e0a528'; poly(g, [u, y - 8, u + 8, y + 6, u - 8, y + 6]); g.fill(); g.strokeStyle = '#161006'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke(); g.fillStyle = '#161006'; g.fillRect(u - .9, y - 3.5, 1.8, 5.5); g.beginPath(); g.arc(u, y + 3.5, 1, 0, TAU); g.fill(); break; }
    case 'lights': { const y = -Math.max(30, H * .5); g.fillStyle = '#16252e'; rr(g, u - 9, y - 4, 18, 8, 2); g.fill(); g.strokeStyle = '#050a0e'; g.lineWidth = .8; g.stroke(); break; }
    case 'vent': { const y = -Math.max(30, H * .5); g.fillStyle = '#10202a'; g.fillRect(u - 8, y - 6, 16, 12); g.strokeStyle = '#6a828d'; g.lineWidth = 1.4; g.strokeRect(u - 8, y - 6, 16, 12); g.fillStyle = '#3d5360'; for (let k = 0; k < 4; k++) g.fillRect(u - 7, y - 5 + k * 3, 14, 1.6); break; }
    case 'box': { const y = -Math.max(30, H * .5); g.fillStyle = '#35505c'; rr(g, u - 7, y - 9, 14, 18, 1.5); g.fill(); g.strokeStyle = '#050a0e'; g.lineWidth = .9; g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(u - 6, y - 8, 12, 1); g.fillStyle = '#9ab0b8'; g.fillRect(u + 3, y - 2, 2, 5); g.strokeStyle = '#1c2c35'; g.lineWidth = 2; g.beginPath(); g.moveTo(u, y - 9); g.lineTo(u, -H + 8); g.stroke(); break; }
    case 'lamp': { const y = -H * d.v; g.fillStyle = '#16252e'; g.fillRect(u - 3, y - 4, 6, 8); g.strokeStyle = '#2c4250'; g.lineWidth = 2; g.beginPath(); g.moveTo(u, y); g.lineTo(u, y - 7); g.stroke(); g.fillStyle = '#3a4a55'; g.beginPath(); g.moveTo(u - 7, y + 2); g.quadraticCurveTo(u, y - 9, u + 7, y + 2); g.closePath(); g.fill(); g.strokeStyle = '#050a0e'; g.lineWidth = .8; g.stroke(); g.fillStyle = '#ffe2a8'; g.fillRect(u - 5, y + 1.5, 10, 2); break; }
  }
}
export function drawWall(ctx, sx, sy, h, face, t, seed) {
  const S = sm(seed) % WALL_VAR;
  if (face === 'stub' || face === 'stubR') {
    const s = sprite('W|' + face + '|' + (S % 4), 80, 40, 40, 14, g => {
      g.save(); faceT(g, face, 0, 0); g.fillStyle = lg(g, 0, -14, 0, 0, [[0, face === 'stub' ? '#5f7f8c' : '#46616d'], [1, '#24394a']]); g.fillRect(0, -14, 32, 14);
      hazard(g, 0, -8, 32, 5, .85); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, -2, 32, 2); rivet(g, 5, -11, 1.1); rivet(g, 27, -11, 1.1);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, -14, 32, 1.4); g.restore();
      const o = face === 'stub' ? [-32, 16] : [0, 32], d = face === 'stub' ? 1 : -1;
      poly(g, [o[0], o[1] - 14, o[0] + 32, o[1] + 16 * d - 14, o[0] + 32 - 6, o[1] + 16 * d - 14 - 3, o[0] - 6, o[1] - 14 - 3]); g.fillStyle = '#9db6c0'; g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = .8; g.stroke();
    });
    put(ctx, s, sx, sy); return;
  }
  const f = face === 'w' ? 'w' : 'n', H = Math.max(16, Math.round(h * LV)), key = 'W|' + f + '|' + H + '|' + S;
  let decor; const s = sprite(key, 88, H + 26, 44, H + 6, g => { decor = buildWall(g, f, H, S); });
  put(ctx, s, sx, sy);
  decor = decor || decorFor(f, S);
  // live: needles, LEDs, lamp flicker
  const X = Math.round(sx), Y = Math.round(sy);
  ctx.save(); faceT(ctx, f, X, Y);
  for (const d of decor) {
    if (d.type === 'gauge') { const v = .3 + .35 * Math.max(0, Math.sin(t * (.4 + d.p) + d.ph)) + Math.sin(t * 9 + d.ph) * .012; needle(ctx, d.u, -Math.max(26, H * .45 + d.p * 6) - 2, 9.5, v); }
    else if (d.type === 'lights') { const y = -Math.max(30, H * .5); for (let k = 0; k < 3; k++) { const on = Math.sin(t * (1 + k * .7) + d.ph + k * 2) > (k === 1 ? -.3 : .1); const col = ['#ff4a3c', '#46e08c', '#3df2ff'][(k + (d.col * 3 | 0)) % 3]; ctx.fillStyle = on ? col : 'rgba(30,50,58,.9)'; ctx.beginPath(); ctx.arc(d.u - 5 + k * 5, y, 1.6, 0, TAU); ctx.fill(); } }
    else if (d.type === 'box') { const y = -Math.max(30, H * .5), on = Math.sin(t * 2 + d.ph) > 0; ctx.fillStyle = on ? '#3df2ff' : '#164048'; ctx.fillRect(d.u - 4, y - 5, 2, 2); }
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  for (const d of decor) {
    const sx2 = f === 'n' ? X + d.u : X - 32 + d.u, sy2 = f === 'n' ? Y + d.u / 2 : Y + 16 - d.u / 2;
    if (d.type === 'lamp') glow(ctx, 'a', sx2, sy2 - H * d.v + 3, 13, .24 + .06 * Math.sin(t * 17 + d.ph) * (Math.sin(t * .5 + d.ph) > .7 ? 2 : .3));
    else if (d.type === 'lights') { const y = -Math.max(30, H * .5); for (let k = 0; k < 3; k++) if (Math.sin(t * (1 + k * .7) + d.ph + k * 2) > (k === 1 ? -.3 : .1)) glow(ctx, ['r', 'g', 'c'][(k + (d.col * 3 | 0)) % 3], f === 'n' ? sx2 - 5 + k * 5 : sx2 - 5 + k * 5, (f === 'n' ? sy2 - 5 + k * 2.5 : sy2 + 5 - k * 2.5) + y, 6, .55); }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------- props ---------- */
const PW = 96, PH = 116, POX = 48, POY = 74; // tile top vertex at canvas (48,74); tile centre = (48,90)
const BARREL = ['#7a4e2c', '#2f6272', '#8a7a2c', '#4a3d5c', '#55626a'];
function buildProp(g, kind, S) {
  const R = rng(S * 131 + hash(kind)), cx = 0, cy = 16;
  if (kind === 'barrel') {
    shadowEl(g, cx, cy + 2, 18, .55); const col = BARREL[S % BARREL.length];
    cylinder(g, cx - (S % 2 ? 6 : 0), cy + 2, 11, 26, col, [.22, .78]);
    if (S % 2) cylinder(g, cx + 12, cy + 7, 9, 20, BARREL[(S + 2) % BARREL.length], [.25, .75]);
    g.save(); g.translate(cx - (S % 2 ? 6 : 0), cy - 10); hazard(g, -6, -5, 12, 8, .9); g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeRect(-6, -5, 12, 8); g.restore();
    g.fillStyle = 'rgba(30,10,0,.25)'; g.fillRect(cx - (S % 2 ? 6 : 0) - 8, cy - 18, 2, 12);
  } else if (kind === 'toolcart') {
    shadowEl(g, cx, cy + 4, 24, .55);
    for (const [wx, wy] of [[-14, 4], [14, 4], [0, 12], [0, -4]]) { g.fillStyle = '#0b1218'; g.beginPath(); g.ellipse(cx + wx, cy + wy + 3, 3.2, 3.8, 0, 0, TAU); g.fill(); }
    isoBox(g, cx, cy + 2, 16, 4, '#8b9ca4', '#4a5f6b', '#33485a');
    isoBox(g, cx, cy - 5, 14, 3, '#6a7e88', '#3e5360', '#2b3f4d');
    isoBox(g, cx, cy - 12, 16, 8, '#a87634', '#8a5e28', '#5e3f1a');
    g.strokeStyle = '#2a3a44'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx - 14, cy - 12); g.lineTo(cx - 20, cy - 34); g.lineTo(cx - 12, cy - 38); g.stroke();
    g.strokeStyle = '#c9a65a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 6, cy - 22); g.lineTo(cx + 8, cy - 28); g.stroke(); g.fillStyle = '#b02a24'; g.fillRect(cx + 3, cy - 29, 5, 3);
    g.fillStyle = 'rgba(255,170,70,.9)'; g.fillRect(cx + 9, cy - 20, 2, 2);
  } else if (kind === 'cables') {
    uvOn2(g, () => {
      const cols = ['#0b151c', '#1c2a34', '#5a2442', '#6a4a1a'];
      for (let i = 0; i < 4; i++) { const y = 14 + i * 10 + R() * 4; cableCurve(g, 4 + R() * 6, y, 60 - R() * 8, y + (R() - .5) * 30, 18 + R() * 12, 3.4 - i * .3, cols[(i + S) % 4]); }
      g.fillStyle = '#2b3d49'; g.fillRect(52, 22, 8, 10); g.strokeStyle = '#050a0e'; g.lineWidth = .8; g.strokeRect(52, 22, 8, 10); g.fillStyle = '#e8a030'; g.fillRect(55, 25, 2, 2);
    }, cx, cy - 16);
  } else if (kind === 'scrap') {
    shadowEl(g, cx, cy + 2, 26, .5);
    for (let i = 0; i < 6; i++) { const x = cx + (R() - .5) * 30, y = cy + (R() - .3) * 12, w = 7 + R() * 9, hh = 2 + R() * 4; isoBox(g, x, y, w, hh, mix('#6a5a48', '#8a99a0', R()), '#3d4a52', '#2a353d'); }
    g.save(); g.translate(cx + 6, cy - 6); g.scale(1, .55); g.fillStyle = '#6b4a2a'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * TAU / 16, r = k % 2 ? 9 : 12; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.strokeStyle = '#050a0e'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#16100a'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = '#a0623a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - 14, cy - 2); g.lineTo(cx - 4, cy - 12); g.stroke(); g.strokeStyle = '#7aa0ac'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + 2, cy - 4); g.lineTo(cx + 16, cy - 14); g.stroke();
    g.fillStyle = 'rgba(255,170,70,.9)'; g.fillRect(cx - 4, cy - 12, 1.6, 1.6);
  } else if (kind === 'lamp') {
    g.globalCompositeOperation = 'lighter'; g.save(); g.translate(cx, cy + 2); g.scale(1, .5); g.fillStyle = rg(g, 0, 0, 2, 44, [[0, 'rgba(255,170,70,.5)'], [.55, 'rgba(255,140,50,.16)'], [1, 'rgba(255,140,50,0)']]); g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.fill(); g.restore(); g.globalCompositeOperation = 'source-over';
    shadowEl(g, cx, cy + 2, 10, .6); cylinder(g, cx, cy + 2, 7, 4, '#2c3a44');
    g.fillStyle = lg(g, cx - 2, 0, cx + 2, 0, [[0, '#18242c'], [.4, '#6a808c'], [1, '#18242c']]); g.fillRect(cx - 1.6, cy - 40, 3.2, 40);
    g.fillStyle = '#3a4a55'; g.beginPath(); g.moveTo(cx - 12, cy - 30); g.quadraticCurveTo(cx, cy - 50, cx + 12, cy - 30); g.closePath(); g.fill(); g.strokeStyle = '#050a0e'; g.lineWidth = .9; g.stroke();
    g.fillStyle = '#ffe9b8'; g.beginPath(); g.ellipse(cx, cy - 30, 10, 3, 0, 0, TAU); g.fill();
  } else if (kind === 'pipe_stack') {
    shadowEl(g, cx, cy + 3, 26, .5); const cols = ['#6a5a3a', '#37606a', '#7a5a34', '#4a5f6b'];
    const r = 5.2, dx = 14, dy = 7;
    for (let k = 0; k < 3; k++) { const cnt = 3 - k; for (let j = 0; j < cnt; j++) {
      const ox = cx + (-(cnt - 1) / 2 + j) * (-1) * r * 2 * .9 * 1, oy = cy + 2 - k * r * 1.75 + (-(cnt - 1) / 2 + j) * r * 2 * .45;
      const x0 = ox - dx, y0 = oy - dy, x1 = ox + dx, y1 = oy + dy, col = cols[(j + k + S) % 4];
      g.lineCap = 'round'; g.strokeStyle = '#050a0e'; g.lineWidth = r * 2 + 1.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = col; g.lineWidth = r * 2; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0 - 2.6); g.lineTo(x1, y1 - 2.6); g.stroke();
      g.fillStyle = '#0a1217'; g.beginPath(); g.ellipse(x0, y0, r * .55, r * .95, 0, 0, TAU); g.fill();
    } }
  } else if (kind === 'crate_small') {
    shadowEl(g, cx, cy + 3, 22, .55); const col = S % 2 ? ['#9a7440', '#765429', '#563c1b'] : ['#5d7684', '#415664', '#2c3e4a'];
    isoBox(g, cx, cy + 2, 15, 17, col[0], col[1], col[2]);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 12, cy - 12); g.lineTo(cx - 3, cy + 3); g.moveTo(cx - 12, cy - 1); g.lineTo(cx - 3, cy - 10); g.moveTo(cx + 12, cy - 12); g.lineTo(cx + 3, cy + 3); g.moveTo(cx + 12, cy - 1); g.lineTo(cx + 3, cy - 10); g.stroke();
    g.fillStyle = 'rgba(232,170,30,.9)'; poly(g, [cx - 14, cy - 6, cx - 8, cy - 3, cx - 8, cy, cx - 14, cy - 3]); g.fill();
    g.fillStyle = 'rgba(255,240,200,.5)'; g.fillRect(cx + 6, cy - 6, 3, 2);
    if (S % 3 === 0) isoBox(g, cx + 1, cy - 14, 9, 8, '#7a8c94', '#4a5c66', '#33444e');
  } else if (kind === 'monitor') {
    shadowEl(g, cx, cy + 3, 22, .55);
    isoBox(g, cx, cy + 3, 15, 12, '#6d8590', '#3e5663', '#2a3e4b');
    isoBox(g, cx + 2, cy - 9, 8, 6, '#4f6572', '#30424f', '#222f3a');
    g.save(); g.translate(cx - 15, cy - 14); g.transform(1, .5, 0, 1, 0, 0); g.fillStyle = '#10202a'; rr(g, 0, -20, 26, 20, 2); g.fill(); g.strokeStyle = '#7d939e'; g.lineWidth = 1.4; g.stroke(); g.fillStyle = '#02080c'; g.fillRect(2.4, -17.6, 21.2, 15.2); g.restore();
    g.fillStyle = '#243a46'; for (let k = 0; k < 4; k++) g.fillRect(cx - 12 + k * 4, cy - 2 + k * 2, 2.6, 1.8);
    g.fillStyle = 'rgba(255,170,70,.9)'; g.fillRect(cx + 8, cy - 6, 2, 2);
  }
}
function uvOn2(g, fn, ox, oy) { g.save(); g.translate(ox, oy); g.transform(.5, .25, -.5, .25, 0, 0); fn(); g.restore(); }
export function drawProp(ctx, sx, sy, kind, t, seed) {
  const S = sm(seed) % 4, kinds = ['barrel', 'toolcart', 'cables', 'scrap', 'lamp', 'pipe_stack', 'crate_small', 'monitor'], k = kinds.includes(kind) ? kind : 'crate_small';
  put(ctx, sprite('P|' + k + '|' + S, PW, PH, POX, POY, g => buildProp(g, k, S)), sx, sy);
  const cx = Math.round(sx), cy = Math.round(sy) + 16;
  if (k === 'lamp') { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 'a', cx, cy - 30, 22, .5 + .06 * Math.sin(t * 15 + S) * (Math.sin(t * .6 + S) > .6 ? 2 : .3)); ctx.globalCompositeOperation = 'source-over'; }
  else if (k === 'monitor') {
    ctx.save(); ctx.translate(cx - 15, cy - 14); ctx.transform(1, .5, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(2.4, -17.6, 21.2, 15.2); ctx.clip();
    const A = S % 2 ? '255,170,70' : '61,242,255'; ctx.fillStyle = `rgba(${A},.15)`; ctx.fillRect(2, -18, 22, 16);
    ctx.fillStyle = `rgba(${A},.85)`; for (let i = 0; i < 5; i++) { const w = 4 + 14 * Math.abs(Math.sin(t * (.7 + i * .3) + i * 2 + S)); ctx.fillRect(4, -16 + i * 3, w, 1.4); }
    ctx.fillStyle = `rgba(${A},.35)`; ctx.fillRect(2, -18 + (t * 10 % 16), 22, 1.2); ctx.restore();
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, S % 2 ? 'a' : 'c', cx - 3, cy - 14, 17, .22 + .05 * Math.sin(t * 20)); glow(ctx, 'a', cx + 8, cy - 5, 4, Math.sin(t * 3 + S) > 0 ? .5 : .1); ctx.globalCompositeOperation = 'source-over';
  } else if (k === 'cables') { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 'a', cx + 14, cy - 3, 6, .3 + .3 * (Math.sin(t * 4) > .3 ? 1 : 0)); ctx.globalCompositeOperation = 'source-over'; }
  else if (k === 'scrap') { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 'a', cx - 4, cy - 12, 5, Math.sin(t * 5 + S * 3) > .4 ? .5 : .05); ctx.globalCompositeOperation = 'source-over'; }
}

/* ---------- backdrop ---------- */
let vigCv = null;
function vignette() {
  if (vigCv) return vigCv;
  vigCv = mkCanvas(256, 256); const g = vigCv.getContext('2d');
  g.fillStyle = rg(g, 128, 128, 40, 190, [[0, 'rgba(0,0,0,0)'], [.55, 'rgba(1,3,6,.35)'], [1, 'rgba(0,1,3,.9)']]); g.fillRect(0, 0, 256, 256);
  return vigCv;
}
export function drawBackdrop(ctx, view, t) {
  const W = view.w || view.viewW || view.width, H = view.h || view.viewH || view.height;
  ctx.fillStyle = lg(ctx, 0, 0, 0, H, [[0, '#03060a'], [.5, '#071118'], [1, '#050b11']]); ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 't', W * (.3 + .08 * Math.sin(t * .07)), H * .35, Math.max(W, H) * .55, .22);
  glow(ctx, 'a', W * (.75 + .06 * Math.sin(t * .05 + 2)), H * .7, Math.max(W, H) * .5, .06);
  glow(ctx, 't', W * (.6 + .1 * Math.sin(t * .04 + 4)), H * .85, Math.max(W, H) * .4, .12);
  // faint far machinery silhouettes: slow-pulsing amber/cyan specks
  for (let i = 0; i < 14; i++) { const R = rng(i * 7919 + 3), x = R() * W, y = R() * H, on = .3 + .7 * Math.max(0, Math.sin(t * (.5 + R()) + R() * 6)); glow(ctx, R() < .5 ? 'a' : 'c', x, y, 6 + R() * 6, .08 * on); }
  // floating dust
  for (let i = 0; i < 34; i++) {
    const R = rng(i * 104729 + 11), sp = 3 + R() * 9, ph = R() * 6, r = 1 + R() * 2.4;
    const x = ((R() * W + t * sp * .7 + Math.sin(t * .35 + ph) * 22) % W + W) % W, y = ((R() * H - t * sp * .5 + Math.cos(t * .27 + ph) * 14) % H + H) % H;
    glow(ctx, R() < .6 ? 's' : 'a', x, y, r * 2.2, (.1 + R() * .22) * (.6 + .4 * Math.sin(t * 1.4 + ph)));
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(vignette(), 0, 0, W, H);
}
