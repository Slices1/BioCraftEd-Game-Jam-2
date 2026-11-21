// CORVID rules: state + step. Pure JS, no DOM, no three.
import { ROOMS } from './rooms.js';

export const DIRS = {
  N: { dx: 0, dz: -1 },
  E: { dx: 1, dz: 0 },
  S: { dx: 0, dz: 1 },
  W: { dx: -1, dz: 0 },
};
export const DIR_NAMES = ['N', 'E', 'S', 'W'];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

// ---------- tile helpers ----------
function tileCh(s, x, z) {
  if (z < 0 || z >= s.tiles.length) return ' ';
  const row = s.tiles[z];
  if (x < 0 || x >= row.length) return ' ';
  return row[x];
}
function tileH(ch) { return ch === '#' ? 2 : (ch === '-' ? 1 : 0); }
function hereH(s, x, z) { return tileH(tileCh(s, x, z)); }
// blocks beams, crates, mech and crow
function isWallish(ch) { return ch === '#' || ch === ' ' || ch === 'T' || ch === 'v'; }
function mechBlockedChar(ch) { return ch === '#' || ch === ' ' || ch === 'T' || ch === 'v' || ch === 'o'; }
function crowBlockedChar(ch) { return ch === '#' || ch === ' ' || ch === 'T'; }
function manhattan(ax, az, bx, bz) { return Math.abs(ax - bx) + Math.abs(az - bz); }

// ---------- hazards ----------
function isActive(s, e) {
  if (e.type === 'laser' && !e.beat) return true;
  if (s.beat === null || s.beat === undefined) return false;
  if (s.beat === 'lasers') return e.type === 'laser';
  if (!e.beat) return false;
  const on = e.beat[0];
  const per = e.beat[1];
  const ph = e.phase || 0;
  const b = (((s.beat + ph) % per) + per) % per;
  return b < on;
}

// ---------- entity lookups ----------
function crateAt(s, x, z) {
  for (const e of s.ents) if (e.type === 'crate' && e.x === x && e.z === z) return e;
  return null;
}
// solid entity on a tile (not crates)
function blockerAt(s, x, z, forCrow) {
  for (const e of s.ents) {
    if (e.x !== x || e.z !== z) continue;
    if (e.type === 'cog' || e.type === 'console' || e.type === 'laser' || e.type === 'shiny') return e;
    if (e.type === 'door' && !e.open) return e;
    if (e.type === 'piston' && !forCrow && isActive(s, e)) return e;
  }
  return null;
}
function getEnt(s, id) {
  for (const e of s.ents) if (e.id === id) return e;
  return null;
}

// ---------- state ----------
export function createState(roomIndex, carry) {
  const room = ROOMS[roomIndex];
  const up = (carry && carry.upgrades) || {};
  const mx = room.start.mech[0];
  const mz = room.start.mech[1];
  const md = room.start.mech[2] || 'E';
  const inMech = !!room.start.crowInMech;
  const s = {
    room: roomIndex,
    roomId: room.id,
    tiles: room.map,
    map: room.map,
    deco: room.ents.filter((e) => e.type === 'deco').map((e, i) => Object.assign({ id: 'deco' + i }, e, { x: e.at[0], z: e.at[1], model: /^(deco_|kit_)/.test(e.model) ? e.model : 'deco_' + e.model })),
    exit: room.exit || null,
    mech: { x: mx, z: mz, h: 0, dir: md, upgrades: { arm: !!up.arm, legs: !!up.legs }, grab: null },
    crow: { x: mx, z: mz, dir: md, inMech: inMech, carry: null },
    control: inMech ? 'mech' : 'crow',
    won: false,
    complete: false,
    ents: [],
    checkpoint: [mx, mz],
    beat: null,
    zonesSeen: [],
    events: [],
  };
  s.mech.h = hereH(s, mx, mz);
  for (const e of room.ents) {
    if (e.type === 'deco') continue;
    const r = Object.assign({}, e);
    r.x = e.at[0];
    r.z = e.at[1];
    delete r.at;
    if (r.type === 'plate') r.on = false;
    else if (r.type === 'door') { r.open = false; r.lockedBy = null; if (!r.inputs) r.inputs = []; if (!r.mode) r.mode = 'any'; }
    else if (r.type === 'cog') r.jammed = false;
    else if (r.type === 'stick') { r.ox = r.x; r.oz = r.z; r.carried = false; r.gone = false; }
    else if (r.type === 'console') r.used = false;
    s.ents.push(r);
  }
  refresh(s);
  updateCheckpoint(s);
  s.events = [];
  return s;
}

export function clone(s) {
  return {
    room: s.room,
    roomId: s.roomId,
    tiles: s.tiles,
    exit: s.exit,
    mech: {
      x: s.mech.x, z: s.mech.z, h: s.mech.h, dir: s.mech.dir,
      upgrades: { arm: s.mech.upgrades.arm, legs: s.mech.upgrades.legs },
      grab: s.mech.grab,
    },
    crow: { x: s.crow.x, z: s.crow.z, dir: s.crow.dir, inMech: s.crow.inMech, carry: s.crow.carry },
    control: s.control,
    won: s.won,
    complete: s.complete,
    ents: s.ents.map((e) => Object.assign({}, e)),
    checkpoint: s.checkpoint.slice(),
    beat: s.beat,
    zonesSeen: s.zonesSeen.slice(),
    events: [],
  };
}

// ---------- plates / doors ----------
function plateOn(s, id) {
  const e = getEnt(s, id);
  return !!(e && e.on);
}
function occupied(s, x, z) {
  if (s.mech.x === x && s.mech.z === z) return true;
  if (s.crow.x === x && s.crow.z === z) return true;
  return !!crateAt(s, x, z);
}
function refresh(s) {
  for (const e of s.ents) {
    if (e.type !== 'plate') continue;
    const on = (s.mech.x === e.x && s.mech.z === e.z) || !!crateAt(s, e.x, e.z);
    if (on !== e.on) {
      e.on = on;
      s.events.push({ type: on ? 'plate_on' : 'plate_off', id: e.id });
    }
  }
  for (const e of s.ents) {
    if (e.type !== 'door') continue;
    let open = !!e.lockedBy;
    if (!open && e.inputs.length > 0) {
      let any = false;
      let all = true;
      for (const id of e.inputs) {
        if (plateOn(s, id)) any = true; else all = false;
      }
      open = e.mode === 'all' ? all : any;
    }
    // a door never closes on a body or crate standing in it
    if (!open && occupied(s, e.x, e.z)) open = true;
    if (open !== e.open) {
      e.open = open;
      s.events.push({ type: open ? 'door_open' : 'door_close', id: e.id });
    }
  }
}

function updateCheckpoint(s) {
  for (const e of s.ents) {
    if (e.type !== 'checkpoint') continue;
    const hit = (s.mech.x === e.x && s.mech.z === e.z) || (s.crow.x === e.x && s.crow.z === e.z);
    if (hit) s.checkpoint = [e.x, e.z];
  }
}

function checkZones(s) {
  const zones = ROOMS[s.room].zones || [];
  const b = s.control === 'mech' ? s.mech : s.crow;
  for (let i = 0; i < zones.length; i++) {
    if (s.zonesSeen.indexOf(i) >= 0) continue;
    const a = zones[i].at;
    if (b.x >= a[0] && b.z >= a[1] && b.x <= a[2] && b.z <= a[3]) {
      s.zonesSeen.push(i);
      s.events.push({ type: 'zone', index: i });
    }
  }
}

// ---------- movement rules ----------
function canMechEnter(s, x, z, fromH, ignoreCrate) {
  const ch = tileCh(s, x, z);
  if (mechBlockedChar(ch)) return false;
  if (blockerAt(s, x, z, false)) return false;
  if (!ignoreCrate && crateAt(s, x, z)) return false;
  const dh = tileH(ch) - fromH;
  if (dh > 0 && !(dh === 1 && s.mech.upgrades.legs)) return false;
  return true;
}
function canCrowEnter(s, x, z) {
  const ch = tileCh(s, x, z);
  if (crowBlockedChar(ch)) return false;
  if (blockerAt(s, x, z, true)) return false;
  return true;
}
function canCrateEnter(s, x, z, h) {
  const ch = tileCh(s, x, z);
  if (isWallish(ch) || ch === 'o') return false;
  if (tileH(ch) !== h) return false;
  if (blockerAt(s, x, z, false)) return false;
  if (crateAt(s, x, z)) return false;
  return true;
}

function setMechPos(s, x, z) {
  const m = s.mech;
  const from = [m.x, m.z];
  const oldH = m.h;
  m.x = x;
  m.z = z;
  m.h = hereH(s, x, z);
  if (s.crow.inMech) { s.crow.x = x; s.crow.z = z; }
  s.events.push({ type: 'move', who: 'mech', from: from, to: [x, z] });
  if (m.h > oldH) s.events.push({ type: 'hop' });
}

function moveMech(s, dir) {
  const d = DIRS[dir];
  if (!d) return false;
  const m = s.mech;
  if (m.grab) return moveGrab(s, dir);
  const turned = m.dir !== dir;
  m.dir = dir;
  if (s.crow.inMech) s.crow.dir = dir;
  const nx = m.x + d.dx;
  const nz = m.z + d.dz;
  if (!canMechEnter(s, nx, nz, m.h, false)) {
    s.events.push({ type: 'bump' });
    return turned;
  }
  setMechPos(s, nx, nz);
  return true;
}

function moveGrab(s, dir) {
  const m = s.mech;
  const cr = getEnt(s, m.grab);
  if (!cr) { m.grab = null; return false; }
  const gd = DIRS[m.dir];
  if (dir === m.dir) {
    // push: crate goes one further, mech takes the crate's tile
    const cx = cr.x + gd.dx;
    const cz = cr.z + gd.dz;
    if (hereH(s, cr.x, cr.z) === m.h && canCrateEnter(s, cx, cz, m.h)) {
      const ox = cr.x;
      const oz = cr.z;
      cr.x = cx;
      cr.z = cz;
      setMechPos(s, ox, oz);
      return true;
    }
  } else if (dir === OPP[m.dir]) {
    // pull: mech steps back, crate takes the mech's old tile
    const nx = m.x - gd.dx;
    const nz = m.z - gd.dz;
    if (hereH(s, nx, nz) === m.h && canMechEnter(s, nx, nz, m.h, false)) {
      const ox = m.x;
      const oz = m.z;
      cr.x = ox;
      cr.z = oz;
      setMechPos(s, nx, nz);
      return true;
    }
  }
  s.events.push({ type: 'bump' });
  return false;
}

function moveCrow(s, dir) {
  const d = DIRS[dir];
  if (!d) return false;
  const c = s.crow;
  const turned = c.dir !== dir;
  c.dir = dir;
  const nx = c.x + d.dx;
  const nz = c.z + d.dz;
  if (!canCrowEnter(s, nx, nz)) {
    s.events.push({ type: 'bump' });
    return turned;
  }
  const from = [c.x, c.z];
  c.x = nx;
  c.z = nz;
  if (c.carry) {
    const st = getEnt(s, c.carry);
    if (st) { st.x = nx; st.z = nz; }
  }
  s.events.push({ type: 'move', who: 'crow', from: from, to: [nx, nz] });
  return true;
}

// ---------- actions ----------
export function mechFacing(s) {
  const m = s.mech;
  const d = DIRS[m.dir];
  const x = m.x + d.dx;
  const z = m.z + d.dz;
  let crate = crateAt(s, x, z);
  if (crate && hereH(s, x, z) !== m.h) crate = null;
  let con = null;
  for (const e of s.ents) {
    if (e.type === 'console' && !e.used && e.x === x && e.z === z) con = e;
  }
  return { x: x, z: z, crate: crate, console: con };
}

function adjacentCog(s) {
  const c = s.crow;
  for (const e of s.ents) {
    if (e.type === 'cog' && !e.jammed && manhattan(c.x, c.z, e.x, e.z) === 1) return e;
  }
  return null;
}
function nearStick(s) {
  const c = s.crow;
  let best = null;
  let bd = 9;
  for (const e of s.ents) {
    if (e.type !== 'stick' || e.gone || e.carried) continue;
    const dd = manhattan(c.x, c.z, e.x, e.z);
    if (dd <= 1 && dd < bd) { best = e; bd = dd; }
  }
  return best;
}
function adjacentShiny(s) {
  const c = s.crow;
  for (const e of s.ents) {
    if (e.type === 'shiny' && manhattan(c.x, c.z, e.x, e.z) === 1) return e;
  }
  return null;
}

function actMech(s) {
  const m = s.mech;
  if (m.grab) {
    m.grab = null;
    s.events.push({ type: 'release' });
    return true;
  }
  const f = mechFacing(s);
  if (f.crate && m.upgrades.arm) {
    m.grab = f.crate.id;
    s.events.push({ type: 'grab', id: f.crate.id });
    return true;
  }
  if (f.console) {
    f.console.used = true;
    m.upgrades[f.console.grants] = true;
    s.events.push({ type: 'graft', part: f.console.grants });
    return true;
  }
  return false;
}

function actCrow(s) {
  const c = s.crow;
  if (c.carry) {
    const st = getEnt(s, c.carry);
    const cog = adjacentCog(s);
    if (cog && st) {
      cog.jammed = true;
      const door = getEnt(s, cog.door);
      if (door) door.lockedBy = cog.id;
      st.gone = true;
      st.carried = false;
      c.carry = null;
      s.events.push({ type: 'jam', id: cog.id });
      return true;
    }
    if (st) {
      st.x = c.x;
      st.z = c.z;
      st.carried = false;
      s.events.push({ type: 'drop', id: st.id });
    }
    c.carry = null;
    return true;
  }
  const stick = nearStick(s);
  if (stick) {
    stick.carried = true;
    c.carry = stick.id;
    s.events.push({ type: 'pickup', id: stick.id });
    return true;
  }
  if (adjacentShiny(s)) {
    s.won = true;
    s.events.push({ type: 'won' });
    return true;
  }
  return false;
}

function doSwap(s) {
  const c = s.crow;
  const m = s.mech;
  if (c.inMech) {
    c.inMech = false;
    s.control = 'crow';
    m.grab = null;
    s.events.push({ type: 'swap', to: 'crow' });
    return true;
  }
  if (manhattan(c.x, c.z, m.x, m.z) <= 1) {
    c.inMech = true;
    c.x = m.x;
    c.z = m.z;
    s.control = 'mech';
    s.events.push({ type: 'swap', to: 'mech' });
    return true;
  }
  return false;
}

// ---------- hazards ----------
function laserTiles(s, e) {
  const d = DIRS[e.dir];
  const out = [];
  let x = e.x + d.dx;
  let z = e.z + d.dz;
  for (let i = 0; i < 40; i++) {
    if (isWallish(tileCh(s, x, z))) break;
    if (blockerAt(s, x, z, true)) break;
    if (s.mech.x === x && s.mech.z === z) break;
    if (crateAt(s, x, z)) break;
    out.push([x, z]);
    x += d.dx;
    z += d.dz;
  }
  return out;
}

function killCrow(s) {
  const c = s.crow;
  c.x = s.checkpoint[0];
  c.z = s.checkpoint[1];
  if (c.carry) {
    const st = getEnt(s, c.carry);
    if (st) { st.x = st.ox; st.z = st.oz; st.carried = false; }
    c.carry = null;
  }
  s.events.push({ type: 'death' });
}

function pushMech(s) {
  const m = s.mech;
  m.x = s.checkpoint[0];
  m.z = s.checkpoint[1];
  m.h = hereH(s, m.x, m.z);
  m.grab = null;
  if (s.crow.inMech) { s.crow.x = m.x; s.crow.z = m.z; }
  s.events.push({ type: 'pushed' });
}

function hazards(s, withPistons) {
  let changed = false;
  if (!s.crow.inMech) {
    for (const e of s.ents) {
      if (e.type !== 'laser' || !isActive(s, e)) continue;
      const tiles = laserTiles(s, e);
      let hit = false;
      for (const t of tiles) if (t[0] === s.crow.x && t[1] === s.crow.z) hit = true;
      if (hit) { killCrow(s); changed = true; break; }
    }
  }
  if (withPistons) {
    for (const e of s.ents) {
      if (e.type !== 'piston' || !isActive(s, e)) continue;
      if (s.mech.x === e.x && s.mech.z === e.z) { pushMech(s); changed = true; }
      else if (!s.crow.inMech && s.crow.x === e.x && s.crow.z === e.z) { killCrow(s); changed = true; }
    }
  }
  return changed;
}

function postStep(s) {
  refresh(s);
  updateCheckpoint(s);
  checkZones(s);
  if (hazards(s, false)) refresh(s);
  if (!s.complete && s.control === 'mech' && s.exit && s.mech.x === s.exit[0] && s.mech.z === s.exit[1]) {
    s.complete = true;
    s.events.push({ type: 'complete' });
  }
}

// ---------- public API ----------
export function step(s, action) {
  if (s.won || s.complete) return false;
  let changed = false;
  if (action.type === 'move') changed = s.control === 'mech' ? moveMech(s, action.dir) : moveCrow(s, action.dir);
  else if (action.type === 'act') changed = s.control === 'mech' ? actMech(s) : actCrow(s);
  else if (action.type === 'swap') changed = doSwap(s);
  postStep(s);
  return changed;
}

// Finale only: beatIndex is an integer (or the string 'lasers' for solver strict mode).
export function tick(s, beatIndex) {
  s.beat = beatIndex;
  const changed = hazards(s, true);
  refresh(s);
  return changed;
}

export function actions(s) {
  let act = null;
  let swap = null;
  if (s.control === 'mech') {
    const m = s.mech;
    if (m.grab) act = 'Release';
    else {
      const f = mechFacing(s);
      if (f.crate && m.upgrades.arm) act = 'Grab';
      else if (f.console) act = 'Jack in';
    }
    swap = 'Hop out';
  } else {
    const c = s.crow;
    if (c.carry) act = adjacentCog(s) ? 'Jam stick' : 'Drop';
    else if (nearStick(s)) act = 'Pick up';
    else if (adjacentShiny(s)) act = 'Take the Shiny';
    if (manhattan(c.x, c.z, s.mech.x, s.mech.z) <= 1) swap = 'Pilot';
  }
  return { act: act, swap: swap };
}

export function pathTo(s, x, z) {
  const crowCtl = s.control === 'crow';
  const b = crowCtl ? s.crow : s.mech;
  if (b.x === x && b.z === z) return [];
  let w = 0;
  for (const r of s.tiles) if (r.length > w) w = r.length;
  const hgt = s.tiles.length;
  if (x < 0 || z < 0 || x >= w || z >= hgt) return [];
  const prev = new Map();
  prev.set(b.z * w + b.x, null);
  const q = [[b.x, b.z]];
  for (let qi = 0; qi < q.length; qi++) {
    const cx = q[qi][0];
    const cz = q[qi][1];
    for (const dn of DIR_NAMES) {
      const d = DIRS[dn];
      const nx = cx + d.dx;
      const nz = cz + d.dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= hgt) continue;
      const k = nz * w + nx;
      if (prev.has(k)) continue;
      const ok = crowCtl ? canCrowEnter(s, nx, nz) : canMechEnter(s, nx, nz, hereH(s, cx, cz), false);
      if (!ok) continue;
      prev.set(k, [cx, cz, dn]);
      if (nx === x && nz === z) {
        const path = [];
        let kk = k;
        while (prev.get(kk)) {
          const p = prev.get(kk);
          path.push(p[2]);
          kk = p[1] * w + p[0];
        }
        path.reverse();
        return path;
      }
      q.push([nx, nz]);
    }
  }
  return [];
}
