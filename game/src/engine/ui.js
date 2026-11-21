// Canvas UI helpers: outlined/shadowed text, rounded rects, buttons (tap + mouse + keyboard focus),
// a Menu that handles focus navigation, and a title/menu layout that adapts to portrait vs landscape.
// All coordinates are logical screen units (draw UI outside camera.begin/end).

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const font = (size, weight = 700, family = FONT) => `${weight} ${Math.max(1, Math.round(size))}px ${family}`;

/**
 * text(ctx, str, x, y, {size, color, align, baseline, weight, family, outline, outlineColor,
 *                       shadow, shadowColor, alpha, maxWidth})
 * outline = outline width in logical px (0 = none); shadow = drop offset in px (0 = none).
 */
export function text(ctx, str, x, y, o = {}) {
  const size = o.size ?? 32;
  str = String(str);
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.font = font(size, o.weight ?? 700, o.family ?? FONT);
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  const mw = o.maxWidth;
  const fill = (dx, dy) => (mw ? ctx.fillText(str, x + dx, y + dy, mw) : ctx.fillText(str, x + dx, y + dy));
  if (o.shadow) { ctx.fillStyle = o.shadowColor ?? 'rgba(0,0,0,0.45)'; fill(0, o.shadow); }
  if (o.outline) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    ctx.lineWidth = o.outline * 2;
    ctx.strokeStyle = o.outlineColor ?? 'rgba(0,0,0,0.85)';
    if (mw) ctx.strokeText(str, x, y, mw); else ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color ?? '#fff';
  fill(0, 0);
  ctx.restore();
}

export function measure(ctx, str, size = 32, weight = 700) {
  ctx.save(); ctx.font = font(size, weight); const w = ctx.measureText(String(str)).width; ctx.restore();
  return w;
}

/** Split str into lines that fit maxWidth at the given size. */
export function wrapText(ctx, str, maxWidth, size = 32, weight = 700) {
  ctx.save(); ctx.font = font(size, weight);
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  ctx.restore();
  return lines;
}

/** Rounded-rect path (ctx.roundRect is missing on older Safari). Call fill()/stroke() after. */
export function roundRect(ctx, x, y, w, h, r = 12) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, { fill = 'rgba(10,10,20,0.78)', stroke = 'rgba(255,255,255,0.15)', radius = 20, lineWidth = 3 } = {}) {
  roundRect(ctx, x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/**
 * new Button({label, x, y, w, h, onClick, color, textColor, size, enabled, visible, id})
 * x, y are the CENTER. Call btn.update(input, dt) every fixed step, btn.draw(ctx) when rendering.
 * Clicks on release inside (tap or left mouse). Keyboard activation goes through Menu.
 */
export class Button {
  constructor(o = {}) {
    this.id = o.id ?? o.label;
    this.label = o.label ?? '';
    this.x = o.x ?? 0; this.y = o.y ?? 0; this.w = o.w ?? 300; this.h = o.h ?? 88;
    this.color = o.color ?? '#4f7cff';
    this.textColor = o.textColor ?? '#fff';
    this.size = o.size ?? 0; // 0 = auto from height
    this.radius = o.radius ?? 18;
    this.onClick = o.onClick ?? null;
    this.enabled = o.enabled ?? true;
    this.visible = o.visible ?? true;
    this.slop = o.slop ?? 16;
    this.hover = false; this.pressed = false; this.focused = false; this.showFocus = false; this.clicked = false;
    this.scale = 1; this._ptr = null; this._flash = 0;
  }
  contains(px, py, pad = 0) {
    return px >= this.x - this.w / 2 - pad && px <= this.x + this.w / 2 + pad &&
           py >= this.y - this.h / 2 - pad && py <= this.y + this.h / 2 + pad;
  }
  activate() {
    this.clicked = true; this._flash = 1;
    if (this.onClick) this.onClick(this);
  }
  update(input, dt = 1 / 60) {
    this.clicked = false;
    if (!this.visible || !this.enabled) { this.pressed = this.hover = false; this._ptr = null; this._anim(dt); return false; }
    const m = input.mouse;
    this.hover = !!(m && m.inside && input.lastDevice === 'mouse' && this.contains(m.x, m.y));
    for (const p of input.downs) {
      if (p.claimed || (p.type === 'mouse' && p.button !== 0)) continue;
      if (this.contains(p.x, p.y)) { p.claimed = 'ui'; this._ptr = p; }
    }
    let click = false;
    if (this._ptr) {
      const p = this._ptr;
      if (p.down) this.pressed = this.contains(p.x, p.y, this.slop);
      else { click = !p.cancelled && this.contains(p.x, p.y, this.slop); this._ptr = null; this.pressed = false; }
    }
    this._anim(dt);
    if (click) this.activate();
    return this.clicked;
  }
  _anim(dt) {
    const target = this.pressed ? 0.94 : this.hover || (this.focused && this.showFocus) ? 1.04 : 1;
    this.scale += (target - this.scale) * (1 - Math.exp(-25 * dt));
    this._flash = Math.max(0, this._flash - dt * 4);
  }
  draw(ctx) {
    if (!this.visible) return;
    const w = this.w, h = this.h, r = Math.min(this.radius, h / 2), dy = this.pressed ? 4 : 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha *= this.enabled ? 1 : 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, -w / 2, -h / 2 + 6, w, h, r); ctx.fill();
    ctx.fillStyle = this.color;
    roundRect(ctx, -w / 2, -h / 2 + dy, w, h, r); ctx.fill();
    const overlay = this.pressed ? 'rgba(0,0,0,0.18)' : this.hover ? 'rgba(255,255,255,0.14)' : null;
    if (overlay) { ctx.fillStyle = overlay; ctx.fill(); }
    if (this._flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this._flash * 0.5})`; ctx.fill(); }
    if (this.focused && this.showFocus) {
      ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
      roundRect(ctx, -w / 2 - 7, -h / 2 - 7 + dy, w + 14, h + 14, r + 7); ctx.stroke();
    }
    text(ctx, this.label, 0, dy + 1, { size: this.size || h * 0.4, color: this.textColor, maxWidth: w - 20 });
    ctx.restore();
  }
}

/**
 * new Menu([buttons], {focus, wrap}) - keyboard/gamepad focus navigation over buttons.
 * Uses actions 'ui_up'/'ui_down'/'ui_left'/'ui_right' to move and 'confirm' to activate
 * (bound in main.js). menu.update(input, dt) returns the clicked Button or null.
 */
export class Menu {
  constructor(buttons = [], { focus = 0, wrap = true } = {}) {
    this.buttons = buttons; this.focus = focus; this.wrap = wrap; this.lastLayout = null;
  }
  add(btn) { this.buttons.push(btn); return btn; }
  get focusedButton() { return this.buttons[this.focus] || null; }
  _usable(i) { const b = this.buttons[i]; return b && b.visible && b.enabled; }
  move(dir) {
    const n = this.buttons.length;
    if (!n) return;
    let i = this.focus;
    for (let k = 0; k < n; k++) {
      i += dir;
      if (i < 0 || i >= n) { if (!this.wrap) return; i = (i + n) % n; }
      if (this._usable(i)) { this.focus = i; return; }
    }
  }
  update(input, dt = 1 / 60) {
    if (!this._usable(this.focus)) this.move(1);
    const kb = input.lastDevice === 'keyboard' || input.lastDevice === 'gamepad';
    if (input.pressed('ui_up') || input.pressed('ui_left')) this.move(-1);
    if (input.pressed('ui_down') || input.pressed('ui_right')) this.move(1);
    let clicked = null;
    this.buttons.forEach((b, i) => {
      b.focused = i === this.focus; b.showFocus = kb;
      if (b.update(input, dt)) { clicked = b; this.focus = i; }
    });
    if (!clicked && input.pressed('confirm') && this._usable(this.focus)) {
      clicked = this.buttons[this.focus];
      clicked.activate();
    }
    return clicked;
  }
  /** Position buttons with menuLayout(view, count, opts); returns the layout (title/subtitle positions). */
  layout(view, opts = {}) {
    const L = menuLayout(view, this.buttons.length, opts);
    L.buttons.forEach((r, i) => Object.assign(this.buttons[i], r));
    this.lastLayout = L;
    return L;
  }
  draw(ctx) { for (const b of this.buttons) b.draw(ctx); }
}

/**
 * Centered title + button layout that adapts to orientation and safe areas.
 * Returns {portrait, title:{x,y,size}, subtitle:{x,y,size}, buttons:[{x,y,w,h}], footerY}.
 * Landscape with 2-3 buttons lays them out in a row; otherwise a vertical stack.
 */
export function menuLayout(view, count = 1, { bw, bh = 92, gap = 22, row, top: topFrac } = {}) {
  const { w, h, safe } = view;
  const portrait = h >= w;
  const top = safe.top + 10, bottom = h - safe.bottom - 10, avail = bottom - top;
  const titleSize = portrait ? Math.min(w * 0.13, 120) : Math.min(avail * 0.16, 130);
  const titleY = top + avail * (topFrac ?? (portrait ? 0.25 : 0.22));
  const horizontal = row ?? (!portrait && count > 1 && count <= 3);
  const buttons = [];
  if (horizontal) {
    bw = bw ?? Math.min(340, (w * 0.8 - gap * (count - 1)) / count);
    const total = count * bw + (count - 1) * gap;
    const y = top + avail * 0.66;
    for (let i = 0; i < count; i++) buttons.push({ x: w / 2 - total / 2 + bw / 2 + i * (bw + gap), y, w: bw, h: bh });
  } else {
    bw = bw ?? Math.min(w * 0.72, 440);
    const total = count * bh + (count - 1) * gap;
    let y0 = top + avail * (portrait ? 0.62 : 0.6) - total / 2 + bh / 2;
    y0 = Math.min(y0, bottom - total + bh / 2 - 20);
    for (let i = 0; i < count; i++) buttons.push({ x: w / 2, y: y0 + i * (bh + gap), w: bw, h: bh });
  }
  return {
    portrait,
    title: { x: w / 2, y: titleY, size: titleSize },
    subtitle: { x: w / 2, y: titleY + titleSize * 0.95, size: Math.max(22, titleSize * 0.3) },
    buttons,
    footerY: bottom - 30,
  };
}
