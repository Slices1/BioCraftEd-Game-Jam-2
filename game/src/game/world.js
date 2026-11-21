// World: one tile grid holding every room, the entity list, control state (who the crow is driving),
// context actions, laser deaths, room tracking + snapshot/reset.
import { ROOMS } from './rooms.js';
import { settle } from './physics.js';
import { Crow } from './entities/crow.js';
import { Suit } from './entities/suit.js';
import { Plate } from './entities/plate.js';
import { Door } from './entities/door.js';
import { CogGate } from './entities/cogGate.js';
import { Stick } from './entities/stick.js';
import { Press } from './entities/press.js';
import { CrackedWall } from './entities/crackedWall.js';
import { ScrapPile } from './entities/scrapPile.js';
import { Crate } from './entities/crate.js';
import { MagnetCrane } from './entities/magnetCrane.js';
import { Emitter, Receiver } from './entities/laser.js';
import { Lift } from './entities/lift.js';
import { Vent } from './entities/vent.js';
import { Bridge } from './entities/bridge.js';
import { Shiny } from './entities/shiny.js';
import { Deco } from './entities/deco.js';
import { Shutter, Piston, Checkpoint } from './entities/shutter.js';

const TYPES = { crow: Crow, suit: Suit, plate: Plate, door: Door, cog: CogGate, stick: Stick, press: Press, cracked: CrackedWall,
  scrap: ScrapPile, crate: Crate, crane: MagnetCrane, emitter: Emitter, receiver: Receiver, lift: Lift, vent: Vent, bridge: Bridge, shiny: Shiny,
  shutter: Shutter, piston: Piston, cp: Checkpoint, deco: Deco };
const K = (x, y) => x * 65536 + y + 32768;

export function createWorld(game) {
  const { audio, fx } = game;
  const w = {
    rooms: [], base: new Map(), ov: new Map(), entities: [], byId: new Map(), bodies: [], emitters: [],
    ctrl: { active: 'crow', jack: null }, time: 0, won: false, roomIdx: 0, snap: null, deaths: 0, onEnterRoom: null,
    bpm: 174, beatPos: 0, beat: 0, cp: null, // beat clock: beat = floor(t*174/60); beatPos is fractional (beatPos % 1 = phase in the beat)
  };

  function add(def) {
    const C = TYPES[def.type];
    if (!C) { console.warn('[world] unknown entity', def.type); return null; }
    const e = new C(def);
    w.entities.push(e); w.byId.set(e.id, e);
    if ('hw' in e) w.bodies.push(e);
    if (e.type === 'emitter' || e.isBeam) w.emitters.push(e); // anything with hits(x,y,r) + drawBeam (lasers, shutters, pistons)
    return e;
  }

  ROOMS.forEach((r, i) => {
    const room = { ...r, idx: i, w: r.map[0].length, h: r.map.length };
    w.rooms.push(room);
    r.map.forEach((row, ty) => [...row].forEach((ch, tx) => {
      const h = ch === '#' || ch === 'v' ? 2 : ch === '-' ? 1 : ch === 'o' ? -1 : 0;
      w.base.set(K(r.ox + tx, r.oy + ty), { h, vent: ch === 'v', room: i });
    }));
    for (const d of r.ents) {
      const def = { ...d, room: i, x: r.ox + d.at[0], y: r.oy + d.at[1] };
      if (d.console) def.console = [r.ox + d.console[0], r.oy + d.console[1]];
      if (d.zone) def.zone = d.zone.map(([a, b]) => [r.ox + a, r.oy + b]);
      if (d.x0 != null) { def.x0 = r.ox + d.x0; def.x1 = r.ox + d.x1; }
      add(def);
    }
  });
  // decorative scatter: floor tiles hugging a wall, away from puzzle entities (heavier in rooms 2 & 4)
  const OVERGROW = ['deco_ivy', 'deco_moss', 'deco_mushrooms', 'deco_plant', 'deco_log', 'deco_tree'], JUNK = ['deco_barrel', 'deco_lamp', 'deco_console', 'deco_arm', 'deco_rock', 'deco_slab'];
  const busy = new Set(w.entities.flatMap((e) => [K(Math.floor(e.x), Math.floor(e.y)), ...(e.console ? [K(e.console.x, e.console.y)] : []), ...(e.zone || []).map(([a, b]) => K(a, b))]));
  w.rooms.forEach((room, i) => {
    const heavy = i === 1 || i === 3, want = heavy ? 9 : 3, cand = [];
    for (let ty = 1; ty < room.h - 1; ty++) for (let tx = 1; tx < room.w - 1; tx++) {
      const X = room.ox + tx, Y = room.oy + ty, t = w.base.get(K(X, Y));
      if (!t || t.h !== 0 || t.vent || busy.has(K(X, Y))) continue;
      const bh = (a, b) => { const q = w.base.get(K(a, b)); return q ? q.h : 3; }, wl = bh(X - 1, Y) >= 2, wu = bh(X, Y - 1) >= 2;
      if (wl || wu) cand.push([X, Y, wl, wu]);
    }
    let seed = i * 7919 + 13; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < want && cand.length; n++) {
      const [X, Y, wl, wu] = cand.splice(Math.floor(rnd() * cand.length), 1)[0];
      const pool = heavy || rnd() < 0.5 ? OVERGROW : JUNK, spr = pool[Math.floor(rnd() * pool.length)];
      add({ type: 'deco', id: `deco${i}_${n}`, room: i, x: X, y: Y, spr, flip: rnd() < 0.5, ox: wl ? 0.3 : 0.5, oy: wu ? 0.3 : 0.5 });
    }
  });
  const r0 = w.rooms[0];
  const crow = add({ type: 'crow', id: 'crow', room: 0, x: r0.ox + r0.spawn[0] - 0.5, y: r0.oy + r0.spawn[1] - 0.5 });
  // draw order: entities that should always draw above others in their tile
  w.get = (id) => w.byId.get(id);
  w.crow = crow;

  // ---- grid ---------------------------------------------------------------------------
  w.baseHeight = (tx, ty) => { const t = w.base.get(K(tx, ty)); return t ? t.h : 3; };
  w.heightAt = (tx, ty) => { const k = K(tx, ty); const o = w.ov.get(k); return o != null ? o : w.baseHeight(tx, ty); };
  w.isVent = (tx, ty) => { const t = w.base.get(K(tx, ty)); return !!(t && t.vent); };
  w.tileRoom = (tx, ty) => { const t = w.base.get(K(tx, ty)); return t ? t.room : -1; };
  function rebuildOverrides() {
    w.ov.clear();
    for (const e of w.entities) { const ts = e.tiles(); if (ts) for (const [x, y, h] of ts) w.ov.set(K(x, y), h); }
  }
  w.powered = (inputs) => !inputs || inputs.length === 0 || inputs.some((id) => { const e = w.get(id); return e && e.on; });
  w.anyOnTile = (tx, ty, includeCrow, except) => w.bodies.some((b) => b !== except && !b.held && !b.hidden && (includeCrow || !b.flying) && b.onTile(tx, ty));

  // ---- juice / audio ------------------------------------------------------------------
  w.sfx = (name, o) => { try { audio.play(name, o); } catch (e) { /* missing sound */ } };
  w.juice = (kind, x, y, amt = 0.3) => {
    const s = isoPt(x, y, 0.2);
    if (kind === 'slam') { fx.shake.add(0.85); fx.hitstop(0.12); fx.flash('#ffe0b0', 0.15, 0.25); fx.burst('dust', s.x, s.y, { count: 40, color: ['#6a655c', '#8a7f6a', '#4a4640'], speed: [80, 260] }); fx.burst('sparks', s.x, s.y - 10, { count: 26 });
      fx.particles.emit(s.x, s.y - 10, { count: 14, speed: [180, 420], angle: -Math.PI / 2, spread: 1.6, life: [0.6, 1.1], size: [3, 6], shape: 'confetti', gravity: 900, drag: 0.6, spin: [-10, 10], color: ['#3a3530', '#5a4a3a', '#6b5a45'] }); }
    else if (kind === 'jack') { fx.shake.add(0.3); fx.hitstop(0.07); fx.flash('#bff8ff', 0.22, 0.25); fx.burst('sparks', s.x, s.y - 50, { count: 26, color: ['#4ff3ff', '#ffffff', '#ffd89a'] }); }
    else if (kind === 'land') { fx.shake.add(amt); fx.burst('dust', s.x, s.y, { count: 14, color: ['#6a655c', '#8a7f6a'] }); }
    else if (kind === 'steam') { fx.burst('dust', s.x, s.y - 20, { count: 22, color: ['#d8d4cc', '#b8b4ac', '#9a968e'], speed: [40, 140], alpha: 0.45 }); }
    else if (kind === 'spark') { fx.burst('sparks', s.x, s.y - 40, { count: 8, color: ['#ffb63b', '#ffffff'], speed: [60, 200] }); }
    else if (kind === 'click') { fx.burst('sparks', s.x, s.y, { count: 10, color: ['#9dffb8', '#ffffff'], speed: [80, 220] }); fx.shake.add(0.08); }
    else if (kind === 'death') { fx.shake.add(0.7); fx.hitstop(0.12); fx.flash('#ff3b5c', 0.3, 0.45); fx.burst('sparks', s.x, s.y - 38, { count: 30, color: ['#ff3b4f', '#ffffff', '#ffb63b'] });
      fx.particles.emit(s.x, s.y - 38, { count: 22, speed: [60, 260], spread: Math.PI * 2, life: [0.9, 1.6], size: [5, 9], shape: 'confetti', gravity: 160, drag: 2.2, spin: [-6, 6], color: ['#0c0d10', '#1a1c22', '#262a33'] }); }
  };
  w.popup = (str, x, y, o) => { const s = isoPt(x, y, 2.6); try { fx.popup(str, s.x, s.y, o); } catch (e) { /* ignore */ } };
  function isoPt(x, y, z) { return { x: (x - y) * 32, y: (x + y) * 16 - z * 32 }; }

  // ---- control ------------------------------------------------------------------------
  w.activeBody = () => w.get(w.ctrl.active);
  w.suitNear = (b, r = 1.1) => {
    let best = null, bd = r;
    for (const s of w.bodies) if (s.type === 'suit' && !s.held && !s.hidden) { const d = Math.hypot(s.x - b.x, s.y - b.y); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  w.machineNear = (s) => w.entities.find((e) => e.console && Math.hypot(e.console.x + 0.5 - s.x, e.console.y + 0.5 - s.y) < 1.25) || null;
  w.stickNear = (c) => w.entities.find((e) => e.type === 'stick' && !e.carried && !e.used && Math.hypot(e.x - c.x, e.y - c.y) < 0.75) || null;
  w.cogNear = (c) => w.entities.find((e) => e.type === 'cog' && !e.jammed && Math.hypot(e.slot.x - c.x, e.slot.y - c.y) < 0.95) || null;

  function enterSuit(s) {
    crow.inside = s.id; crow.hidden = true; w.ctrl.active = s.id;
    if (crow.carry) { const st = w.get(crow.carry); st.rest(s.x, s.y); crow.carry = null; }
    s.carried = true;
    w.sfx('jack_in'); w.juice('jack', s.x, s.y);
  }
  function exitSuit(s) {
    crow.inside = null; crow.hidden = false; crow.x = s.x; crow.y = s.y; crow.vx = 0; crow.vy = 0;
    w.ctrl.active = 'crow'; w.sfx('jack_out');
  }
  w.prompt = () => {
    const c = w.ctrl;
    if (c.jack) { const m = w.get(c.jack); const l = m.label(w); return l ? `${l} · B unjack` : 'B unjack'; }
    const a = w.activeBody();
    if (a.type === 'suit') return w.machineNear(a) ? 'Jack in' : 'B: exit suit';
    if (crow.carry && w.cogNear(crow)) return 'Jam stick';
    if (!crow.carry && w.stickNear(crow)) return 'Pick up stick';
    if (w.suitNear(crow)) return 'B: enter suit';
    if (crow.carry) return 'Drop stick';
    return '';
  };

  w.update = (dt, it) => {
    w.time += dt;
    w.beatPos = w.time * w.bpm / 60; w.beat = Math.floor(w.beatPos);
    rebuildOverrides();
    const c = w.ctrl;
    if (c.jack) {
      const m = w.get(c.jack);
      m.control(dt, it, w);
      if (it.swap) { c.jack = null; m.pilot = null; w.sfx('jack_out'); }
      else if (it.act) m.act(w);
    } else if (c.active !== 'crow') {
      const s = w.get(c.active);
      s.walk(dt, it.mx, it.my, w);
      if (it.act) { const m = w.machineNear(s); if (m) { c.jack = m.id; m.pilot = s.id; w.sfx('jack_in'); w.juice('jack', s.x, s.y); } }
      else if (it.swap) exitSuit(s);
    } else if (!crow.dead) {
      crow.fly(dt, it.mx, it.my, w);
      if (it.act) {
        const cog = crow.carry && w.cogNear(crow), st = !crow.carry && w.stickNear(crow);
        if (cog) { const s = w.get(crow.carry); s.used = true; s.carried = false; crow.carry = null; cog.jammed = true; w.sfx('cog_jam'); if (!cog._said) { cog._said = true; w.popup('Door jammed open — the mech is free', cog.x + 0.5, cog.y + 0.5, { color: '#ffb63b', size: 28, life: 2.6, rise: 40 }); } w.juice('land', cog.slot.x, cog.slot.y, 0.35); }
        else if (st) { st.carried = true; crow.carry = st.id; w.sfx('stick_pick'); }
        else if (crow.carry) { const s = w.get(crow.carry); s.rest(crow.x, crow.y); crow.carry = null; w.sfx('ui_click'); }
      } else if (it.swap) { const s = w.suitNear(crow); if (s) enterSuit(s); }
    }
    for (const e of w.entities) e.update(dt, w);
    rebuildOverrides();
    for (const b of w.bodies) if (!b.flying && !b.held && !b.hidden) settle(w, b);
    if (crow.carry) { const s = w.get(crow.carry); s.x = crow.x; s.y = crow.y; }
    crow.groundZ = Math.max(0, Math.min(1, w.heightAt(Math.floor(crow.x), Math.floor(crow.y))));
    // laser deaths
    if (crow.dead > 0) { crow.dead -= dt; if (crow.dead <= 0) respawnCrow(); }
    else if (!crow.inside && w.emitters.some((e) => e.hits(crow.x, crow.y, crow.hw))) killCrow();
    // shiny
    const sh = w.get('SHINY');
    if (sh && !w.won && !crow.inside && Math.hypot(sh.x + 0.5 - crow.x, sh.y + 0.5 - crow.y) < 0.7) { w.won = true; w.sfx('stick_pick'); fx.flash('#fff4b0', 0.6, 0.8); }
    // room tracking
    const a = c.jack ? w.get(w.get(c.jack).pilot) || w.activeBody() : w.activeBody();
    const ri = w.tileRoom(Math.floor(a.x), Math.floor(a.y));
    if (ri >= 0 && ri !== w.roomIdx) { w.roomIdx = ri; w.cp = null; w.snapshot(); if (w.onEnterRoom) w.onEnterRoom(w.rooms[ri]); }
  };

  function killCrow() {
    w.juice('death', crow.x, crow.y); w.sfx('zap_death'); w.deaths++;
    if (crow.carry) { w.get(crow.carry).returnToRest(); crow.carry = null; }
    crow.dead = 0.9; crow.hidden = true;
  }
  function respawnCrow() {
    const r = w.rooms[w.roomIdx];
    const cp = w.cp && w.cp.room === w.roomIdx ? w.cp : null;
    crow.dead = 0; crow.hidden = false; crow.x = cp ? cp.x : r.ox + r.spawn[0]; crow.y = cp ? cp.y : r.oy + r.spawn[1]; crow.vx = crow.vy = 0;
  }

  // ---- snapshot / reset / debug -------------------------------------------------------
  w.snapshot = () => { w.snap = { ents: w.entities.map((e) => e.save()), ctrl: { ...w.ctrl } }; };
  w.reset = () => {
    if (!w.snap) return;
    w.entities.forEach((e, i) => e.load(w.snap.ents[i]));
    w.ctrl = { ...w.snap.ctrl };
    rebuildOverrides();
  };
  // continue-game support: the snapshot taken on room entry is serialisable
  w.getSave = () => (w.snap ? { room: w.roomIdx, snap: w.snap, time: w.time, deaths: w.deaths } : null);
  w.loadSave = (sv) => {
    if (!sv || !sv.snap || sv.snap.ents.length !== w.entities.length) return false;
    w.entities.forEach((e, i) => e.load(sv.snap.ents[i]));
    w.ctrl = { ...sv.snap.ctrl }; w.roomIdx = sv.room; w.time = sv.time || 0; w.deaths = sv.deaths || 0; w.cp = null;
    rebuildOverrides(); w.snapshot(); return true;
  };
  w.teleportNext = () => {
    const ri = Math.min(w.rooms.length - 1, w.roomIdx + 1), r = w.rooms[ri];
    if (w.ctrl.active !== 'crow') exitSuit(w.get(w.ctrl.active));
    w.ctrl.jack = null;
    crow.x = r.ox + r.spawn[0]; crow.y = r.oy + r.spawn[1]; crow.dead = 0; crow.hidden = false;
  };

  rebuildOverrides();
  w.snapshot();
  return w;
}
