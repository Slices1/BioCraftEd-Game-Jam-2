// Isometric projection + vector placeholder helpers. World units = tiles; z in height levels.
export const HW = 32, HH = 16, ZP = 32;
export const P = (x, y, z = 0) => [(x - y) * HW, (x + y) * HH - z * ZP];
export function poly(ctx, pts, fill, stroke, lw = 1.2) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// Extruded box, footprint x..x+w, y..y+d, from z to z+h. Visible faces: +y (screen-left), +x (screen-right), top.
export function box(ctx, x, y, z, w, d, h, c = METAL) {
  poly(ctx, [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], c.left, c.edge);
  poly(ctx, [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], c.right, c.edge);
  poly(ctx, [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], c.top, c.edge);
}
export const METAL = { top: '#55534a', left: '#26251f', right: '#37352e', edge: 'rgba(0,0,0,0.55)' };
export const DARK = { top: '#2e2d29', left: '#151412', right: '#1e1d1a', edge: 'rgba(0,0,0,0.6)' };
export const C = { cyan: '#4ff3ff', amber: '#ffb63b', magenta: '#ff3bd4', red: '#ff3b4f', green: '#5dff8a' };
export function glow(ctx, x, y, z, r, color, blur = 3) {
  const [sx, sy] = P(x, y, z);
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = r * blur; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
export function shadow(ctx, x, y, z, rx, a = 0.35) {
  const [sx, sy] = P(x, y, z);
  ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx / 2, 0, 0, Math.PI * 2); ctx.fill();
}
export function tileTop(ctx, tx, ty, z, fill, stroke, s = 1) {
  poly(ctx, [P(tx, ty, z), P(tx + s, ty, z), P(tx + s, ty + s, z), P(tx, ty + s, z)], fill, stroke);
}
export function facing(vx, vy, prev) {
  if (Math.abs(vx) + Math.abs(vy) < 1e-3) return prev;
  const sx = vx - vy, sy = vx + vy;
  return (sy < 0 ? 'n' : 's') + (sx < 0 ? 'w' : 'e');
}
