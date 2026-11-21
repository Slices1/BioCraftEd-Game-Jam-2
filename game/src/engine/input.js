// Unified input: keyboard, mouse, multi-touch (Pointer Events), gamepad, on-screen controls.
//
// ACTIONS  input.bind('jump', {keys:['Space','KeyW'], touch:'buttonA', mouse:0, pad:[0]})
//          input.down('jump') / input.pressed('jump') / input.released('jump')
//   touch: id of a virtual button, or 'screen' (= any touch not used by joystick/buttons/UI).
//   mouse: button index (0 left, 1 middle, 2 right). pad: standard-mapping button indices.
// AXES     input.axis('x'|'y') in [-1, 1]: keys + gamepad stick/dpad + virtual joystick.
//          input.stick() -> {x, y, len} (diagonals normalized).
// POINTERS input.pointers (active, logical view coords), input.downs / ups / taps / swipes /
//          holds (events of THIS step), input.tap, input.swipe, input.mouse, input.wheel.
//
// Edge detection is latched per fixed step: anything that happens between two update() calls
// (even a press+release inside one rAF frame) is reported on the next step, exactly once.
// main.js calls input.update() at the start of every fixed step.

import { text } from './ui.js';

const MOUSE_BITS = [1, 4, 2, 8, 16]; // MouseEvent.button index -> MouseEvent.buttons bit
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace',
  'PageUp', 'PageDown', 'Home', 'End']);
const DEFAULT_OFFSETS = [[0, 0], [-2.45, -0.55], [-0.3, -2.45], [-2.6, -2.9]];
const DEFAULT_ZONE = { x0: 0, y0: 0, x1: 0.5, y1: 1 };
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createInput(canvas, view, opts = {}) {
  const o = Object.assign({
    tapMs: 300, tapSlop: 14, holdMs: 450, swipeMin: 50, swipeMs: 600, // slop/min in CSS px
    deadzone: 0.2, joystickDeadzone: 0.12,
  }, opts);

  const keys = new Set();
  const actions = new Map();
  const axes = new Map();
  const boundKeys = new Set();
  const pmap = new Map();
  const warned = new Set();
  let pDowns = [], pUps = [], pTaps = [], pSwipes = [], pWheel = 0, anyLatch = false;
  let padSeen = false, touchSuspended = false, vbuttons = [];
  const tmp = { x: 0, y: 0 };

  const pad = { connected: false, id: '', buttons: [], axes: [] };
  const mouse = { x: 0, y: 0, cx: 0, cy: 0, inside: false, buttons: 0 };
  const joystick = {
    enabled: false, active: false, id: null, ghost: true, follow: true,
    bx: 0, by: 0, kx: 0, ky: 0, x: 0, y: 0, mag: 0,
    radiusPx: 56, radius: 100, zone: { ...DEFAULT_ZONE },
  };

  const input = {
    enabled: true,
    lastDevice: view.isTouch ? 'touch' : 'keyboard', // 'keyboard' | 'mouse' | 'touch' | 'gamepad'
    pointers: [],
    downs: [], ups: [], taps: [], swipes: [], holds: [], wheel: 0,
    mouse, pad, joystick,
    get vbuttons() { return vbuttons; },
    get tap() { return input.taps[0] || null; },
    get swipe() { return input.swipes[0] || null; },
    get primary() { return input.pointers[0] || null; },
    get touchVisible() { return view.isTouch && touchActive(); },
    _any: false,

    bind(name, cfg = {}) {
      let a = actions.get(name);
      if (!a) {
        a = { name, keys: new Set(), mouse: new Set(), touch: new Set(), pad: new Set(),
          raw: false, latchP: false, latchR: false, isDown: false, isPressed: false, isReleased: false };
        actions.set(name, a);
      }
      for (const k of arr(cfg.keys)) { a.keys.add(k); boundKeys.add(k); }
      for (const b of arr(cfg.mouse)) a.mouse.add(b);
      for (const t of arr(cfg.touch)) a.touch.add(t);
      for (const b of arr(cfg.pad ?? cfg.gamepad)) a.pad.add(b);
      a.raw = computeRaw(a);
      return input;
    },
    unbind(name) {
      actions.delete(name);
      boundKeys.clear();
      for (const a of actions.values()) for (const k of a.keys) boundKeys.add(k);
      return input;
    },
    /** bindAxis('x', {neg:['KeyA'], pos:['KeyD'], padAxis:0, padNeg:[14], padPos:[15], stick:'x'}) */
    bindAxis(name, cfg = {}) {
      const ax = { neg: arr(cfg.neg), pos: arr(cfg.pos), padAxis: cfg.padAxis ?? null,
        padNeg: arr(cfg.padNeg), padPos: arr(cfg.padPos), stick: cfg.stick ?? null };
      axes.set(name, ax);
      for (const k of [...ax.neg, ...ax.pos]) boundKeys.add(k);
      return input;
    },
    down: (name) => act(name).isDown,
    pressed: (name) => act(name).isPressed,
    released: (name) => act(name).isReleased,
    /** Raw keyboard state by KeyboardEvent.code. */
    key: (code) => keys.has(code),
    /** Any key / pointer / gamepad button pressed this step. */
    anyPressed: () => input._any,
    pointer: (id) => pmap.get(id) || null,
    axis,
    stick(out = { x: 0, y: 0, len: 0 }) {
      let x = axis('x'), y = axis('y');
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      out.x = x; out.y = y; out.len = Math.min(1, l);
      return out;
    },
    update,
    clear,
    /** {joystick: true | {zone:{x0,y0,x1,y1}, radius, follow, ghost}, buttons:[{id, label, size, offset}]} or null */
    setTouchControls,
    /** Temporarily disable on-screen controls (e.g. while a pause menu is open). */
    suspendTouch(v = true) {
      touchSuspended = !!v;
      if (touchSuspended) for (const p of pmap.values()) releaseTouchControl(p);
      refresh();
    },
    renderTouch,
  };

  function act(name) {
    const a = actions.get(name);
    if (a) return a;
    if (!warned.has(name)) { warned.add(name); console.warn(`[input] unknown action "${name}" (bind it first)`); }
    return { isDown: false, isPressed: false, isReleased: false };
  }

  function axis(name) {
    const ax = axes.get(name);
    if (!ax) return 0;
    let best = 0;
    if (ax.neg.some((c) => keys.has(c))) best -= 1;
    if (ax.pos.some((c) => keys.has(c))) best += 1;
    if (pad.connected && input.enabled) {
      let g = 0;
      if (ax.padAxis != null) {
        const raw = pad.axes[ax.padAxis] || 0, m = Math.abs(raw), dz = o.deadzone;
        g = m <= dz ? 0 : Math.sign(raw) * Math.min(1, (m - dz) / (1 - dz));
      }
      if (ax.padNeg.some((b) => pad.buttons[b])) g = -1;
      if (ax.padPos.some((b) => pad.buttons[b])) g = 1;
      if (Math.abs(g) > Math.abs(best)) best = g;
    }
    if (ax.stick && joystick.active && !touchSuspended) {
      const j = joystick[ax.stick] || 0;
      if (Math.abs(j) > Math.abs(best)) best = j;
    }
    return best;
  }

  // ---- Raw state + latching ----------------------------------------------------------
  function touchActive() { return !touchSuspended && (joystick.enabled || vbuttons.length > 0); }

  function computeRaw(a) {
    for (const k of a.keys) if (keys.has(k)) return true;
    if (mouse.buttons) for (const b of a.mouse) if (mouse.buttons & (MOUSE_BITS[b] || 0)) return true;
    for (const t of a.touch) {
      if (t === 'screen') { for (const p of pmap.values()) if (p.type !== 'mouse' && !p.claimed) return true; }
      else if (!touchSuspended) { for (const b of vbuttons) if (b.id === t && b.down) return true; }
    }
    if (pad.connected && input.enabled) for (const b of a.pad) if (pad.buttons[b]) return true;
    return false;
  }

  function refresh() {
    for (const a of actions.values()) {
      const r = computeRaw(a);
      if (r && !a.raw) a.latchP = true;
      else if (!r && a.raw) a.latchR = true;
      a.raw = r;
    }
  }

  function update() {
    if (padSeen) pollPad();
    const now = performance.now();
    const holds = [];
    for (const p of input.pointers) {
      p.time = (now - p.t0) / 1000;
      if (!p.held && !p.dragging && now - p.t0 >= o.holdMs) { p.held = true; if (!p.claimed) holds.push(p); }
    }
    input.downs = pDowns; pDowns = [];
    input.ups = pUps; pUps = [];
    input.taps = pTaps; pTaps = [];
    input.swipes = pSwipes; pSwipes = [];
    input.holds = holds;
    input.wheel = pWheel; pWheel = 0;
    input._any = anyLatch; anyLatch = false;
    refresh();
    for (const a of actions.values()) {
      a.isPressed = a.latchP; a.latchP = false;
      if (a.latchR) {
        if (!a.isPressed) { a.isReleased = true; a.latchR = false; }
        else { a.isReleased = false; if (a.raw) a.latchR = false; } // press+release in one frame: release next step
      } else a.isReleased = false;
      a.isDown = a.raw || a.isPressed; // a tap shorter than a frame still reads as down for one step
    }
  }

  function clear() {
    keys.clear();
    mouse.buttons = 0;
    for (const p of [...pmap.values()]) endPointer(p, true, null);
    joystick.active = false; joystick.id = null; joystick.x = joystick.y = joystick.mag = 0;
    for (const b of vbuttons) { b.down = false; b.pid = null; }
    refresh();
  }

  function setDevice(d) {
    input.lastDevice = d;
    view.isTouch = d === 'touch';
  }

  // ---- Keyboard ----------------------------------------------------------------------
  function onKeyDown(e) {
    const code = e.code || e.key || '';
    if (e.ctrlKey || e.metaKey) return; // leave browser shortcuts alone
    if (!e.altKey && (boundKeys.has(code) || NAV_KEYS.has(code))) e.preventDefault();
    if (e.repeat) return;
    setDevice('keyboard');
    if (!input.enabled || keys.has(code)) return;
    keys.add(code);
    anyLatch = true;
    refresh();
  }
  function onKeyUp(e) {
    const code = e.code || e.key || '';
    if (code === 'MetaLeft' || code === 'MetaRight' || code === 'OSLeft' || code === 'OSRight') {
      keys.clear(); refresh(); return; // macOS swallows keyups while Cmd is held
    }
    if (boundKeys.has(code) || NAV_KEYS.has(code)) e.preventDefault();
    if (keys.delete(code)) refresh();
  }

  // ---- Pointers ----------------------------------------------------------------------
  function updateMouse(e) {
    view.toLogical(e.clientX, e.clientY, tmp);
    mouse.x = tmp.x; mouse.y = tmp.y; mouse.cx = e.clientX; mouse.cy = e.clientY;
  }

  function onPointerDown(e) {
    const isMouse = e.pointerType === 'mouse';
    setDevice(isMouse ? 'mouse' : 'touch');
    if (isMouse) {
      updateMouse(e); mouse.inside = true;
      try { window.focus(); } catch (err) { /* iframe focus for keyboard (itch.io) */ }
    }
    if (!input.enabled) return;
    if (pmap.has(e.pointerId)) { if (isMouse) { mouse.buttons = e.buttons; refresh(); } return; }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    view.toLogical(e.clientX, e.clientY, tmp);
    const p = {
      id: e.pointerId, type: e.pointerType || 'mouse', button: e.button,
      x: tmp.x, y: tmp.y, sx: tmp.x, sy: tmp.y, dx: 0, dy: 0,
      cx: e.clientX, cy: e.clientY, scx: e.clientX, scy: e.clientY,
      t0: performance.now(), time: 0,
      down: true, dragging: false, held: false, cancelled: false, claimed: null,
    };
    pmap.set(p.id, p);
    input.pointers = [...pmap.values()];
    if (isMouse) mouse.buttons = e.buttons || MOUSE_BITS[e.button] || 1;
    else claimTouchControl(p);
    pDowns.push(p);
    anyLatch = true;
    refresh();
  }

  function movePointer(p, e) {
    view.toLogical(e.clientX, e.clientY, tmp);
    p.x = tmp.x; p.y = tmp.y; p.cx = e.clientX; p.cy = e.clientY;
    p.dx = p.x - p.sx; p.dy = p.y - p.sy;
    if (!p.dragging && Math.hypot(p.cx - p.scx, p.cy - p.scy) > o.tapSlop) p.dragging = true;
    if (p.claimed === 'joystick') moveJoystick(p);
  }

  function onPointerMove(e) {
    const p = pmap.get(e.pointerId);
    if (e.pointerType === 'mouse') {
      updateMouse(e); mouse.inside = true;
      setDevice('mouse');
      if (p && e.buttons !== mouse.buttons) { mouse.buttons = e.buttons; refresh(); }
    }
    if (p) movePointer(p, e);
  }

  function onPointerUp(e) {
    const isMouse = e.pointerType === 'mouse';
    const p = pmap.get(e.pointerId);
    if (isMouse) updateMouse(e);
    if (!p) return;
    if (isMouse) {
      mouse.buttons = e.type === 'pointercancel' ? 0 : e.buttons || 0;
      if (mouse.buttons) { movePointer(p, e); refresh(); return; } // other mouse buttons still held
    }
    endPointer(p, e.type === 'pointercancel', e);
  }

  function endPointer(p, cancelled, e) {
    if (e) movePointer(p, e);
    p.down = false; p.cancelled = cancelled;
    pmap.delete(p.id);
    input.pointers = [...pmap.values()];
    if (!cancelled && !p.claimed) {
      const d = Math.hypot(p.cx - p.scx, p.cy - p.scy), dt = performance.now() - p.t0;
      if (d <= o.tapSlop && dt <= o.tapMs) {
        pTaps.push({ id: p.id, type: p.type, button: p.button, x: p.x, y: p.y });
      } else if (d >= o.swipeMin && dt <= o.swipeMs) {
        const ax = p.cx - p.scx, ay = p.cy - p.scy;
        const dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
        pSwipes.push({ id: p.id, type: p.type, dir, x: p.sx, y: p.sy, ex: p.x, ey: p.y, dx: p.dx, dy: p.dy,
          speed: (d / Math.max(1, dt)) * 1000 });
      }
    }
    releaseTouchControl(p);
    if (p.type === 'mouse' && cancelled) mouse.buttons = 0;
    pUps.push(p);
    refresh();
  }

  // ---- Virtual joystick + buttons ----------------------------------------------------------
  function layoutTouch() {
    const s = view.scale || 1, sf = view.safe, m = 22 / s;
    joystick.radius = joystick.radiusPx / s;
    if (!vbuttons.length) return;
    const R = vbuttons[0].size / s;
    vbuttons.forEach((b, i) => {
      b.r = b.size / s;
      const off = b.offset || DEFAULT_OFFSETS[i] || [-2.5 * i, 0];
      b.x = view.w - sf.right - m - R + off[0] * R;
      b.y = view.h - sf.bottom - m - R + off[1] * R;
    });
  }

  function claimTouchControl(p) {
    if (!touchActive()) return;
    layoutTouch();
    for (const b of vbuttons) {
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r * 1.3) {
        if (b.pid == null) { b.pid = p.id; b.down = true; }
        p.claimed = 'vbutton:' + b.id;
        return;
      }
    }
    if (joystick.enabled && !joystick.active) {
      const z = joystick.zone, fx = p.x / view.w, fy = p.y / view.h;
      if (fx >= z.x0 && fx <= z.x1 && fy >= z.y0 && fy <= z.y1) {
        const R = joystick.radius, sf = view.safe;
        joystick.active = true; joystick.id = p.id;
        joystick.bx = clamp(p.x, sf.left + R * 0.7, view.w - sf.right - R * 0.7);
        joystick.by = clamp(p.y, sf.top + R * 0.7, view.h - sf.bottom - R * 0.7);
        p.claimed = 'joystick';
        moveJoystick(p);
      }
    }
  }

  function moveJoystick(p) {
    const R = joystick.radius;
    let dx = p.x - joystick.bx, dy = p.y - joystick.by, d = Math.hypot(dx, dy);
    if (d > R && joystick.follow) { // base trails the thumb
      const k = (d - R) / d;
      joystick.bx += dx * k; joystick.by += dy * k;
      dx = p.x - joystick.bx; dy = p.y - joystick.by; d = R;
    }
    const m = Math.min(d, R), nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
    joystick.kx = joystick.bx + nx * m; joystick.ky = joystick.by + ny * m;
    const mag = m / R, dz = o.joystickDeadzone, v = mag <= dz ? 0 : (mag - dz) / (1 - dz);
    joystick.x = nx * v; joystick.y = ny * v; joystick.mag = v;
  }

  function releaseTouchControl(p) {
    if (joystick.id === p.id) { joystick.active = false; joystick.id = null; joystick.x = joystick.y = joystick.mag = 0; }
    for (const b of vbuttons) if (b.pid === p.id) { b.pid = null; b.down = false; }
  }

  function setTouchControls(cfg) {
    for (const p of pmap.values()) releaseTouchControl(p);
    const j = cfg && cfg.joystick;
    joystick.enabled = !!j;
    joystick.zone = { ...DEFAULT_ZONE, ...(j && j.zone) };
    joystick.radiusPx = (j && j.radius) || 56;
    joystick.follow = !(j && j.follow === false);
    joystick.ghost = !(j && j.ghost === false);
    vbuttons = arr(cfg && cfg.buttons).map((b, i) => ({
      id: b.id, label: b.label ?? '', size: b.size ?? (i === 0 ? 46 : 40), offset: b.offset || null,
      color: b.color || null, down: false, pid: null, x: 0, y: 0, r: 0,
    }));
    refresh();
    return input;
  }

  function renderTouch(ctx) {
    if (!view.isTouch || !touchActive()) return;
    layoutTouch();
    const s = view.scale || 1, lw = 2.5 / s;
    ctx.save();
    if (joystick.enabled && (joystick.active || joystick.ghost)) {
      const R = joystick.radius;
      let bx = joystick.bx, by = joystick.by, kx = joystick.kx, ky = joystick.ky;
      if (!joystick.active) {
        bx = kx = view.safe.left + 36 / s + R;
        by = ky = view.h - view.safe.bottom - 36 / s - R;
        ctx.globalAlpha = 0.35;
      }
      ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(kx, ky, R * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const b of vbuttons) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.down ? 'rgba(255,255,255,0.45)' : b.color || 'rgba(255,255,255,0.15)';
      ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
      if (b.label) text(ctx, b.label, b.x, b.y + 1, { size: b.r * (b.label.length > 2 ? 0.38 : 0.6), color: '#fff', maxWidth: b.r * 1.7 });
    }
    ctx.restore();
  }

  // ---- Gamepad -------------------------------------------------------------------------
  function pollPad() {
    let gp = null;
    try {
      const list = navigator.getGamepads ? navigator.getGamepads() : null;
      if (list) for (const g of list) if (g && g.connected) { gp = g; break; }
    } catch (e) { gp = null; }
    if (!gp) {
      if (pad.connected) { pad.connected = false; pad.buttons.length = 0; pad.axes.length = 0; refresh(); }
      return;
    }
    pad.connected = true; pad.id = gp.id;
    let any = false;
    for (let i = 0; i < gp.buttons.length; i++) {
      const b = gp.buttons[i], v = !!(b && (b.pressed || b.value > 0.5));
      if (v && !pad.buttons[i]) any = true;
      pad.buttons[i] = v;
    }
    for (let i = 0; i < gp.axes.length; i++) pad.axes[i] = gp.axes[i] || 0;
    if (any || Math.abs(pad.axes[0] || 0) > 0.5 || Math.abs(pad.axes[1] || 0) > 0.5) setDevice('gamepad');
    if (any && input.enabled) anyLatch = true;
  }

  // ---- Listeners -----------------------------------------------------------------------
  const prevent = (e) => { if (e.cancelable) e.preventDefault(); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') mouse.inside = false; });
  canvas.addEventListener('contextmenu', prevent);
  canvas.addEventListener('dblclick', prevent);
  // Block iOS callout/magnifier, double-tap zoom, pinch and scrolling on the canvas.
  for (const t of ['touchstart', 'touchmove', 'touchend']) canvas.addEventListener(t, prevent, { passive: false });
  canvas.addEventListener('wheel', (e) => { prevent(e); pWheel += Math.sign(e.deltaY); }, { passive: false });
  window.addEventListener('gamepadconnected', () => { padSeen = true; });
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });

  // Default movement axes (WASD / arrows / left stick / d-pad / virtual joystick).
  input.bindAxis('x', { neg: ['KeyA', 'ArrowLeft'], pos: ['KeyD', 'ArrowRight'], padAxis: 0, padNeg: [14], padPos: [15], stick: 'x' });
  input.bindAxis('y', { neg: ['KeyW', 'ArrowUp'], pos: ['KeyS', 'ArrowDown'], padAxis: 1, padNeg: [12], padPos: [13], stick: 'y' });

  return input;
}
