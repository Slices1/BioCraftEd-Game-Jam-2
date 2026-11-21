// roomView.js: builds + animates the 3D scene for one room from a logic state.
// createRoomView(r3, state) -> { scene, camera, sync, busy, handleEvents, tileMeshes, worldToScreen, dispose }
// State reading is tolerant: map = state.map | state.room.map, exit = state.exit | state.room.exit,
// entity position = ent.x/ent.z | ent.at.
import * as THREE from 'three';
import { getModel, getClips } from './assets.js';

const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const dirVec = (d) => {
  if (!d) return [0, 1];
  if (typeof d === 'string') return DIRS[d] || [0, 1];
  if (Array.isArray(d)) return d;
  return [d.dx || 0, d.dz || 0];
};
const yawOf = (dx, dz) => Math.atan2(dx, dz);
const wrapPI = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const wallish = (c) => c === '#' || c === 'v' || c === 'T';
const xzOf = (e) => {
  if (typeof e.x === 'number' && typeof e.z === 'number') return [e.x, e.z];
  if (e.at) return [e.at[0], e.at[1]];
  return null;
};
const posArr = (p) => (Array.isArray(p) ? p : p && typeof p.x === 'number' ? [p.x, p.z] : null);

const C = {
  red: new THREE.Color(0xff3a2a), green: new THREE.Color(0x4dff7a), lamp: new THREE.Color(0xffb35a),
  cyan: new THREE.Color(0x3ff0ff), dim: new THREE.Color(0x401818), tmp: new THREE.Color(), tmp2: new THREE.Color(),
};

function ownEmit(obj) {
  const map = {};
  obj.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && o.material && o.material.name && o.material.name.endsWith('_emit')) {
      o.material = o.material.clone();
      (map[o.material.name] || (map[o.material.name] = [])).push(o.material);
    }
  });
  return map;
}
function setEmit(arr, color, intensity) {
  if (!arr) return;
  for (const m of arr) {
    m.emissive.copy(color);
    m.color.copy(color).multiplyScalar(0.3);
    if (intensity !== undefined) m.emissiveIntensity = intensity;
  }
}
function setEmitI(arr, intensity) {
  if (!arr) return;
  for (const m of arr) m.emissiveIntensity = intensity;
}

// ---- animation (clip) helpers
function mkAnim(obj, name) {
  const clips = getClips(name);
  if (!clips || !clips.length) return null;
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const c of clips) actions[c.name.toLowerCase().split('|').pop()] = mixer.clipAction(c);
  return { mixer, actions, cur: null };
}
function playAnim(mx, name, fade = 0.15) {
  const a = mx.actions[name];
  if (!a || mx.cur === a) return;
  a.reset().fadeIn(fade).play();
  if (mx.cur) mx.cur.fadeOut(fade);
  mx.cur = a;
}
function scrub(mx, name, t01) {
  const a = mx && mx.actions[name];
  if (!a) return false;
  if (!a.isRunning()) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.paused = true; }
  a.time = clamp01(t01) * a.getClip().duration;
  mx.mixer.update(0);
  return true;
}

// ---- smooth mover
class Mover {
  constructor() {
    this.pos = new THREE.Vector3();
    this.tx = 0; this.ty = 0; this.tz = 0; this.fy = 0; this.len = 1; this.progress = 1; this.init = false;
  }
  set(x, y, z, snap = 2.3) {
    if (!this.init) {
      this.pos.set(x, y, z); this.tx = x; this.ty = y; this.tz = z; this.fy = y; this.progress = 1; this.init = true;
      return;
    }
    if (Math.abs(x - this.tx) > 1e-4 || Math.abs(z - this.tz) > 1e-4 || Math.abs(y - this.ty) > 1e-4) {
      const d = Math.hypot(x - this.pos.x, z - this.pos.z);
      if (d > snap) {
        this.pos.set(x, y, z); this.fy = y; this.len = 1; this.progress = 1;
      } else {
        this.fy = this.pos.y; this.len = Math.max(d, 0.001); this.progress = 0;
      }
      this.tx = x; this.ty = y; this.tz = z;
    }
  }
  get moving() { return Math.hypot(this.tx - this.pos.x, this.tz - this.pos.z) > 0.01; }
  update(dt, speed) {
    const dx = this.tx - this.pos.x, dz = this.tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    if (d <= step) {
      this.pos.x = this.tx; this.pos.z = this.tz; this.progress = 1;
    } else {
      this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
      this.progress = clamp01(1 - (d - step) / this.len);
    }
    if (this.len < 0.05 || d < 1e-4) this.pos.y += (this.ty - this.pos.y) * Math.min(1, 12 * dt);
    else {
      const p = this.progress;
      this.pos.y = this.fy + (this.ty - this.fy) * (p * p * (3 - 2 * p));
    }
    if (this.progress >= 1 && d <= step) this.pos.y = this.ty;
  }
}

// ---------------------------------------------------------------- createRoomView
export function createRoomView(r3, state) {
  const mapRows = (() => {
    const room = state.room || state.roomData || {};
    const m = state.map || room.map || state.grid;
    if (!m) throw new Error('roomView: state has no map (state.map or state.room.map)');
    return m.map((r) => (typeof r === 'string' ? r : r.join('')));
  })();
  const GH = mapRows.length;
  let GW = 0;
  for (const r of mapRows) GW = Math.max(GW, r.length);
  const ch = (x, z) => (z < 0 || z >= GH || x < 0 || x >= mapRows[z].length ? ' ' : mapRows[z][x]);
  const tileH = (x, z) => (ch(x, z) === '-' ? 1 : 0);
  const walkable = (x, z) => { const c = ch(x, z); return c !== ' ' && c !== 'o' && !wallish(c); };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1416);
  const tileMeshes = [];

  // ---- camera
  const camera = r3.makeIsoCamera(11);
  const center = new THREE.Vector3(GW / 2, 0, GH / 2);
  r3.fitIso(camera, center, GW, GH, 2);

  // ---- lights
  const hemi = new THREE.HemisphereLight(0x8fc3cf, 0x7a4430, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.6);
  const R = Math.sqrt(GW * GW + GH * GH) / 2 + 2.5;
  sun.position.set(center.x + 7, 12, center.z - 4);
  sun.position.sub(center).normalize().multiplyScalar(26).add(center);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const flash = new THREE.PointLight(0x3ff0ff, 0, 6, 2);
  scene.add(flash);

  // ---- ground under the room
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GW + 8, GH + 8).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x070a0c })
  );
  ground.position.set(center.x, -0.31, center.z);
  scene.add(ground);

  // ---- instanced tiles
  function flatten(name) {
    const root = getModel(name);
    root.updateMatrixWorld(true);
    const out = [];
    root.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline && !o.isSkinnedMesh && !Array.isArray(o.material)) {
        out.push({ geo: o.geometry, mat: o.material, m: o.matrixWorld.clone() });
      }
    });
    return out;
  }
  function addInstancedParts(parts, tiles, { cast = true, tint = true } = {}) {
    if (!tiles.length) return;
    const tmp = new THREE.Matrix4();
    const col = new THREE.Color();
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geo, p.mat, tiles.length);
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        tmp.makeTranslation(t.x + 0.5, 0, t.z + 0.5).multiply(p.m);
        im.setMatrixAt(i, tmp);
        if (tint) {
          const v = 0.92 + hash(t.x, t.z) * 0.14;
          col.setRGB(v, v, v);
          im.setColorAt(i, col);
        }
      }
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = cast;
      im.receiveShadow = true;
      im.userData.tiles = tiles.map((t) => [t.x, t.z]);
      scene.add(im);
      tileMeshes.push(im);
    }
  }
  const std = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05 });
  const box = (w, h, d, mat, x, y, z) => ({ geo: new THREE.BoxGeometry(w, h, d), mat, m: new THREE.Matrix4().makeTranslation(x, y, z) });

  const stubParts = [
    box(0.98, 0.34, 0.98, std(0x2c4046), 0, 0.17, 0),
    box(1.0, 0.06, 1.0, std(0x8d9088), 0, 0.37, 0),
  ];
  const pitMat = std(0x121c1e), pitBottom = new THREE.MeshBasicMaterial({ color: 0x030506 }), pitLip = std(0x3c4646);
  const pitParts = [
    box(0.98, 0.1, 0.98, pitBottom, 0, -1.05, 0),
    box(0.98, 1.0, 0.03, pitMat, 0, -0.5, -0.475),
    box(0.03, 1.0, 0.98, pitMat, -0.475, -0.5, 0),
    box(0.98, 1.0, 0.03, pitMat, 0, -0.5, 0.475),
    box(0.03, 1.0, 0.98, pitMat, 0.475, -0.5, 0),
    box(0.98, 0.04, 0.07, pitLip, 0, -0.02, -0.455),
    box(0.98, 0.04, 0.07, pitLip, 0, -0.02, 0.455),
    box(0.07, 0.04, 0.84, pitLip, -0.455, -0.02, 0),
    box(0.07, 0.04, 0.84, pitLip, 0.455, -0.02, 0),
  ];

  const tl = { floor: [], moss: [], grate: [], wall: [], vent: [], block: [], stub: [], pit: [], trees: [] };
  for (let z = 0; z < GH; z++) {
    for (let x = 0; x < mapRows[z].length; x++) {
      const c = mapRows[z][x];
      const t = { x, z };
      if (c === ' ') continue;
      if (c === '#' || c === 'v') {
        const edge = ch(x + 1, z) === ' ' || ch(x, z + 1) === ' ';
        if (edge) tl.stub.push(t);
        else (c === '#' ? tl.wall : tl.vent).push(t);
        if (c === 'v') tl.floor.push(t);
      } else if (c === '-') tl.block.push(t);
      else if (c === 'o') tl.pit.push(t);
      else if (c === '~') tl.moss.push(t);
      else if (c === 'g') tl.grate.push(t);
      else {
        tl.floor.push(t);
        if (c === 'T') tl.trees.push(t);
      }
    }
  }
  addInstancedParts(flatten('kit_floor'), tl.floor, { cast: false });
  addInstancedParts(flatten('kit_floor_moss'), tl.moss, { cast: false });
  addInstancedParts(flatten('kit_floor_grate'), tl.grate, { cast: false });
  addInstancedParts(flatten('kit_wall'), tl.wall);
  addInstancedParts(flatten('kit_wall_vent'), tl.vent);
  addInstancedParts(flatten('kit_block'), tl.block);
  addInstancedParts(stubParts, tl.stub);
  addInstancedParts(pitParts, tl.pit, { cast: false, tint: false });
  for (const t of tl.trees) {
    const tr = getModel('deco_tree');
    tr.position.set(t.x + 0.5, 0, t.z + 0.5);
    tr.rotation.y = hash(t.x, t.z) * 6.28;
    scene.add(tr);
  }

  // ---- exit marker
  const exit = state.exit || (state.room && state.room.exit) || null;
  let exitObj = null;
  if (exit) {
    exitObj = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.3, 2.0, 2.2) });
    for (const [w, d, x, z] of [[0.9, 0.06, 0, 0.42], [0.9, 0.06, 0, -0.42], [0.06, 0.9, 0.42, 0], [0.06, 0.9, -0.42, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), m);
      b.position.set(x, 0.03, z);
      exitObj.add(b);
    }
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.4, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.2, 1.2, 1.4), transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide })
    );
    col.position.y = 0.7;
    exitObj.add(col);
    exitObj.userData.col = col;
    exitObj.position.set(exit[0] + 0.5, tileH(exit[0], exit[1]), exit[1] + 0.5);
    scene.add(exitObj);
  }

  // ---- particles
  const PN = 220;
  const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), PN);
  pMesh.frustumCulled = false;
  pMesh.castShadow = false;
  const P = { x: new Float32Array(PN), y: new Float32Array(PN), z: new Float32Array(PN), vx: new Float32Array(PN), vy: new Float32Array(PN), vz: new Float32Array(PN), life: new Float32Array(PN), max: new Float32Array(PN), size: new Float32Array(PN), grav: new Float32Array(PN) };
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  const whiteC = new THREE.Color(1, 1, 1);
  for (let i = 0; i < PN; i++) { pMesh.setMatrixAt(i, zeroM); pMesh.setColorAt(i, whiteC); }
  scene.add(pMesh);
  let pPtr = 0;
  let pAlive = 0;
  function spawn(x, y, z, n, o = {}) {
    const col = o.color instanceof THREE.Color ? o.color : C.tmp.set(o.color !== undefined ? o.color : 0xcccccc);
    for (let k = 0; k < n; k++) {
      const i = pPtr; pPtr = (pPtr + 1) % PN;
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 1.2) * (0.4 + Math.random() * 0.8);
      P.x[i] = x + (Math.random() - 0.5) * (o.spread ?? 0.1); P.y[i] = y; P.z[i] = z + (Math.random() - 0.5) * (o.spread ?? 0.1);
      P.vx[i] = Math.cos(a) * sp; P.vz[i] = Math.sin(a) * sp; P.vy[i] = (o.up ?? 1.2) * (0.5 + Math.random() * 0.8);
      P.max[i] = P.life[i] = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      P.size[i] = (o.size ?? 0.07) * (0.7 + Math.random() * 0.6);
      P.grav[i] = o.grav ?? 4;
      pMesh.setColorAt(i, col);
    }
    if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    pAlive = PN;
  }
  const pTmp = new THREE.Matrix4(), pq = new THREE.Quaternion(), pp = new THREE.Vector3(), ps = new THREE.Vector3();
  function updateParticles(dt) {
    if (!pAlive) return;
    let any = false;
    for (let i = 0; i < PN; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      if (P.life[i] <= 0) { pMesh.setMatrixAt(i, zeroM); continue; }
      any = true;
      P.vy[i] -= P.grav[i] * dt;
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
      const s = P.size[i] * (P.life[i] / P.max[i]);
      pp.set(P.x[i], P.y[i], P.z[i]);
      ps.set(s, s, s);
      pTmp.compose(pp, pq, ps);
      pMesh.setMatrixAt(i, pTmp);
    }
    pMesh.instanceMatrix.needsUpdate = true;
    if (!any) pAlive = 0;
  }

  // ---- entity records
  const recs = new Map();
  const autoIds = new WeakMap();
  let autoN = 0;
  const idOf = (e) => {
    if (e.id !== undefined) return e.id;
    let v = autoIds.get(e);
    if (!v) { v = 'auto' + autoN++; autoIds.set(e, v); }
    return v;
  };
  let time = 0;
  let cur = null;
  let first = true;
  let byId = new Map();
  let stamp = 0;
  let lamps = 0;

  const freeFacing = (x, z) => {
    for (const d of ['S', 'E', 'N', 'W']) { const v = DIRS[d]; if (walkable(x + v[0], z + v[1])) return yawOf(v[0], v[1]); }
    return 0;
  };

  function doorOpen(e) {
    if (typeof e.open === 'boolean') return e.open;
    if (e.lockedBy || e.jammed) return true;
    const ins = e.inputs || [];
    if (!ins.length) return false;
    const f = (id) => { const p = byId.get(id); return !!(p && p.on); };
    return e.mode === 'all' ? ins.every(f) : ins.some(f);
  }
  const pistonSlam = (e) => !!(e.slammed ?? e.active ?? e.down ?? e.on ?? false);
  const laserActive = (e) => (e.active !== undefined ? !!e.active : e.on !== undefined ? !!e.on : e.firing !== undefined ? !!e.firing : true);

  // X-ray silhouettes: bodies stay visible (tinted) when hidden behind walls.
  const xray = (obj, color) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, depthFunc: THREE.GreaterDepth });
    const list = [];
    obj.traverse((o) => { if (o.isMesh && !o.userData.xray && !(o.material && o.material.side === THREE.BackSide)) list.push(o); });
    for (const o of list) { const x = new THREE.Mesh(o.geometry, m); x.userData.xray = true; x.visible = false; x.renderOrder = 10; x.castShadow = false; o.add(x); }
  };
  const xrDir = new THREE.Vector3(), xrP = new THREE.Vector3(), xrO = new THREE.Vector3(), xrRay = new THREE.Raycaster();

  // body records (created now so busy() etc work from the start)
  const mech = (() => {
    const root = new THREE.Group();
    const obj = getModel('mech');
    xray(obj, 0x3ff0ff);
    root.add(obj);
    scene.add(root);
    return {
      root, obj, mover: new Mover(), yaw: 0, init: false, phase: 0, em: ownEmit(obj), anim: mkAnim(obj, 'mech'),
      legL: obj.getObjectByName('leg_L'), legR: obj.getObjectByName('leg_R'), seat: obj.getObjectByName('pilot_seat'),
      up: {}, hop: 0, lastMoving: false,
    };
  })();
  const crow = (() => {
    const root = new THREE.Group();
    const obj = getModel('crow');
    xray(obj, 0xffcc44);
    root.add(obj);
    scene.add(root);
    return {
      root, obj, pos: new THREE.Vector3(), init: false, seated: false, yaw: 0, pitch: 0, moving: false, em: ownEmit(obj),
      wingL: obj.getObjectByName('wing_L'), wingR: obj.getObjectByName('wing_R'), beak: obj.getObjectByName('beak_socket'),
      anim: mkAnim(obj, 'crow'), phase: 0,
    };
  })();

  function createRec(e) {
    const id = idOf(e);
    const p = xzOf(e);
    if (!p) return null;
    const rec = { id, type: e.type, e, stamp: 0 };
    const place = (obj) => { obj.position.set(p[0] + 0.5, tileH(p[0], p[1]), p[1] + 0.5); scene.add(obj); };
    switch (e.type) {
      case 'plate': {
        rec.obj = getModel('plate'); place(rec.obj);
        rec.pad = rec.obj.getObjectByName('pad'); rec.em = ownEmit(rec.obj); rec.anim = mkAnim(rec.obj, 'plate'); rec.p = e.on ? 1 : 0;
        rec.upd = (dt, en) => {
          rec.p += ((en.on ? 1 : 0) - rec.p) * Math.min(1, dt * 14);
          if (!(rec.anim && scrub(rec.anim, 'press', rec.p))) rec.pad.position.y = -0.07 * rec.p;
          C.tmp2.copy(C.lamp).lerp(C.cyan, rec.p);
          setEmit(rec.em.plate_emit, C.tmp2, 1.8 + rec.p * 1.4);
        };
        break;
      }
      case 'door': {
        rec.obj = getModel('door'); place(rec.obj);
        const alongZ = wallish(ch(p[0], p[1] - 1)) && wallish(ch(p[0], p[1] + 1)) && !(wallish(ch(p[0] - 1, p[1])) && wallish(ch(p[0] + 1, p[1])))
          ? true
          : wallish(ch(p[0] - 1, p[1])) && wallish(ch(p[0] + 1, p[1])) ? false : e.dir === 'z';
        rec.obj.rotation.y = alongZ ? Math.PI / 2 : 0;
        rec.pl = rec.obj.getObjectByName('panel_L'); rec.pr = rec.obj.getObjectByName('panel_R');
        rec.em = ownEmit(rec.obj); rec.anim = mkAnim(rec.obj, 'door'); rec.o = doorOpen(e) ? 1 : 0;
        rec.upd = (dt, en) => {
          const open = doorOpen(en);
          const diff = (open ? 1 : 0) - rec.o;
          rec.o += Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.5);
          const o = rec.o;
          if (!(rec.anim && scrub(rec.anim, 'open', o)) && rec.pl && rec.pr) {
            rec.pl.position.x = 0.19 + 0.23 * o; rec.pl.scale.x = 1 - 0.8 * o;
            rec.pr.position.x = -(0.19 + 0.23 * o); rec.pr.scale.x = 1 - 0.8 * o;
          }
          setEmit(rec.em.door_emit, open ? C.green : C.red, 2.5);
        };
        break;
      }
      case 'cog': {
        rec.obj = getModel('cog_door'); place(rec.obj);
        rec.obj.rotation.y = freeFacing(p[0], p[1]);
        rec.wheel = rec.obj.getObjectByName('cog_wheel'); rec.em = ownEmit(rec.obj);
        rec.slot = rec.obj.getObjectByName('stick_slot');
        rec.jam = !!e.jammed; rec.stutter = 0;
        if (rec.jam) addCogStick(rec);
        rec.upd = (dt, en) => {
          if (en.jammed && !rec.jam) { rec.jam = true; rec.stutter = 1.3; addCogStick(rec); }
          if (!en.jammed && rec.jam) { rec.jam = false; if (rec.stick) { rec.slot.remove(rec.stick); rec.stick = null; } }
          if (!rec.jam) {
            if (rec.wheel) rec.wheel.rotation.z += dt * 0.45;
            setEmit(rec.em.cog_emit, C.red, 1.8 + Math.sin(time * 4) * 0.8);
          } else {
            if (rec.stutter > 0 && rec.wheel) {
              rec.stutter -= dt;
              rec.wheel.rotation.z += Math.sin(time * 55) * 0.05 * Math.max(0, rec.stutter);
              rec.obj.position.x = p[0] + 0.5 + Math.sin(time * 70) * 0.012 * Math.max(0, rec.stutter);
            }
            setEmit(rec.em.cog_emit, C.green, 2.6);
          }
        };
        break;
      }
      case 'stick': {
        rec.obj = getModel('stick'); place(rec.obj);
        rec.obj.rotation.y = hash(p[0], p[1]) * 3.14;
        rec.carried = false; rec.baseRot = rec.obj.rotation.y;
        rec.upd = (dt, en) => {
          const carried = state.crow && state.crow.carry === id;
          const gone = en.consumed || en.used || en.gone || en.removed || en.jammed;
          if (carried !== rec.carried) {
            rec.carried = carried;
            if (carried && crow.beak) {
              crow.beak.add(rec.obj); rec.obj.position.set(0, -0.01, 0); rec.obj.rotation.set(0, Math.PI / 2, 0); rec.obj.scale.setScalar(0.55);
            } else {
              scene.add(rec.obj); rec.obj.scale.setScalar(1); rec.obj.rotation.set(0, rec.baseRot, 0);
            }
          }
          if (!carried) {
            const q = xzOf(en) || p;
            rec.obj.position.set(q[0] + 0.5, tileH(q[0], q[1]), q[1] + 0.5);
            rec.obj.visible = !gone;
          } else rec.obj.visible = true;
        };
        break;
      }
      case 'crate': {
        rec.obj = getModel('crate'); scene.add(rec.obj);
        rec.mover = new Mover();
        rec.upd = (dt, en) => {
          const q = xzOf(en) || p;
          rec.mover.set(q[0] + 0.5, tileH(q[0], q[1]), q[1] + 0.5);
          rec.mover.update(dt, 4);
          rec.obj.position.copy(rec.mover.pos);
        };
        break;
      }
      case 'console': {
        rec.obj = getModel('crane_console'); place(rec.obj);
        rec.obj.rotation.y = freeFacing(p[0], p[1]);
        const ia = rec.obj.getObjectByName('icon_arm'), il = rec.obj.getObjectByName('icon_legs');
        if (ia) ia.visible = e.grants === 'arm';
        if (il) il.visible = e.grants === 'legs';
        rec.em = ownEmit(rec.obj);
        rec.upd = (dt, en) => {
          if (en.used) setEmit(rec.em.console_emit, C.dim, 0.5);
          else setEmit(rec.em.console_emit, C.cyan, 1.8 + Math.sin(time * 3) * 0.6);
        };
        break;
      }
      case 'laser': {
        rec.obj = getModel('laser_emitter'); place(rec.obj);
        const d = dirVec(e.dir);
        rec.dx = d[0]; rec.dz = d[1];
        rec.obj.rotation.y = yawOf(d[0], d[1]);
        rec.em = ownEmit(rec.obj);
        rec.outer = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.6, 0.25, 0.2), transparent: true, opacity: 0.5, depthWrite: false }));
        rec.inner = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4, 2.2, 1.8) }));
        rec.hit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(4, 1.5, 1) }));
        rec.outer.castShadow = rec.inner.castShadow = rec.hit.castShadow = false;
        scene.add(rec.outer, rec.inner, rec.hit);
        rec.spark = 0;
        rec.upd = () => {};
        break;
      }
      case 'piston': {
        rec.obj = getModel('piston'); place(rec.obj);
        rec.head = rec.obj.getObjectByName('head'); rec.em = ownEmit(rec.obj); rec.anim = mkAnim(rec.obj, 'piston');
        rec.y = pistonSlam(e) ? 0.05 : 1.3; rec.was = pistonSlam(e);
        rec.upd = (dt, en) => {
          const s = pistonSlam(en);
          const ty = s ? 0.05 : 1.3;
          rec.y += (ty - rec.y) * Math.min(1, dt * (s ? 32 : 5));
          if (s && !rec.was) spawn(p[0] + 0.5, tileH(p[0], p[1]) + 0.1, p[1] + 0.5, 10, { color: 0xb5a58a, speed: 1.6, up: 0.8, life: 0.5, size: 0.09 });
          rec.was = s;
          if (!(rec.anim && scrub(rec.anim, 'slam', 1 - (rec.y - 0.05) / 1.25))) rec.head.position.y = rec.y;
          setEmitI(rec.em.piston_emit, s ? 3.5 : 1.2 + Math.sin(time * 6) * 0.5);
        };
        break;
      }
      case 'checkpoint': {
        rec.obj = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.3, 1.8, 1.6) }));
        place(rec.obj); rec.obj.position.y += 0.03;
        rec.upd = () => { const s = 1 + Math.sin(time * 3) * 0.08; rec.obj.scale.set(s, 1, s); };
        break;
      }
      case 'shiny': {
        rec.obj = getModel('great_shiny'); place(rec.obj);
        rec.spin = rec.obj.getObjectByName('shiny_spin'); rec.small = rec.obj.getObjectByName('gear_small');
        rec.anim = mkAnim(rec.obj, 'great_shiny');
        if (rec.anim && rec.anim.actions.spin) { rec.anim.actions.spin.play(); }
        const L = new THREE.PointLight(0xffcc44, 5, 6, 2);
        L.position.set(0, 1.2, 0.2); rec.obj.add(L);
        rec.t = 0;
        rec.upd = (dt) => {
          if (rec.anim) rec.anim.mixer.update(dt);
          else if (rec.spin) { rec.spin.rotation.y += dt * 1.1; if (rec.small) rec.small.rotation.z -= dt * 2.2; }
          if (state.won) { rec.t += dt; rec.obj.position.y = tileH(p[0], p[1]) + rec.t * 1.5; rec.obj.scale.setScalar(Math.max(0.01, 1 - rec.t * 0.5)); }
          else rec.obj.position.y = tileH(p[0], p[1]) + Math.sin(time * 1.6) * 0.05;
        };
        break;
      }
      case 'deco': {
        rec.obj = getModel(e.model || 'deco_barrel'); place(rec.obj);
        rec.obj.rotation.y = e.rot !== undefined ? e.rot : e.dir ? yawOf(...dirVec(e.dir)) : 0;
        if (e.scale) rec.obj.scale.setScalar(e.scale);
        if ((e.model === 'deco_lamp') && lamps < 3) {
          lamps++;
          const L = new THREE.PointLight(0xffb35a, 6, 5.5, 2);
          const a = rec.obj.getObjectByName('light_anchor');
          L.position.copy(a ? a.position : new THREE.Vector3(0, 1, 0));
          rec.obj.add(L);
        }
        rec.upd = () => {};
        break;
      }
      default:
        return null;
    }
    recs.set(id, rec);
    return rec;
  }
  function addCogStick(rec) {
    if (rec.stick || !rec.slot) return;
    rec.stick = getModel('stick');
    rec.stick.position.set(0, -0.04, 0.02);
    rec.stick.rotation.set(0, 0, 0.9);
    rec.stick.scale.setScalar(1.15);
    rec.slot.add(rec.stick);
  }

  function clearEnts() {
    for (const r of recs.values()) if (r.obj && r.obj.parent) r.obj.parent.remove(r.obj);
    for (const r of recs.values()) for (const k of ['outer', 'inner', 'hit']) if (r[k]) scene.remove(r[k]);
    recs.clear();
    lamps = 0;
  }

  // ---- bodies
  const vTmp = new THREE.Vector3();
  function updateMech(dt, st) {
    const m = st.mech;
    if (!m) return;
    const h = typeof m.h === 'number' ? m.h : tileH(m.x, m.z);
    mech.mover.set(m.x + 0.5, h, m.z + 0.5);
    mech.mover.update(dt, 4);
    const mv = mech.mover.moving;
    const d = dirVec(m.dir);
    const targetYaw = yawOf(d[0], d[1]);
    if (!mech.init) { mech.yaw = targetYaw; mech.init = true; }
    mech.yaw += wrapPI(targetYaw - mech.yaw) * (1 - Math.exp(-14 * dt));
    mech.root.position.copy(mech.mover.pos);
    mech.obj.rotation.y = mech.yaw;

    const rising = mech.mover.ty - mech.mover.fy > 0.3;
    const arc = mv ? Math.sin(Math.PI * mech.mover.progress) * (rising ? 0.35 : 0.04) : 0;
    mech.hop += ((mv && rising ? 1 : 0) - mech.hop) * Math.min(1, dt * 10);
    let bob = arc;
    if (mech.anim) {
      playAnim(mech.anim, mv ? (rising && mech.anim.actions.hop ? 'hop' : 'walk') : 'idle');
      mech.anim.mixer.update(dt);
    } else {
      if (mv) mech.phase += dt * 11;
      const sw = mv ? Math.sin(mech.phase) * 0.55 : 0;
      if (mech.legL) mech.legL.rotation.x += (sw - mech.legL.rotation.x) * Math.min(1, dt * 18);
      if (mech.legR) mech.legR.rotation.x += (-sw - mech.legR.rotation.x) * Math.min(1, dt * 18);
      bob += mv ? Math.abs(Math.sin(mech.phase)) * 0.035 : 0;
      const br = 1 + Math.sin(time * 2) * 0.008;
      mech.obj.scale.set(1, br, 1);
    }
    mech.obj.position.y = bob;

    const occupied = !!(st.crow && st.crow.inMech);
    setEmit(mech.em.core_emit, C.cyan, occupied ? 3 + Math.sin(time * 4) * 0.6 : 0.7);

    // upgrades
    const ups = m.upgrades || {};
    const defs = [['arm', 'upg_magnet_arm', 'arm_R_socket'], ['legs', 'upg_hydraulic_legs', 'leg_mod_socket']];
    for (const [key, name, sockName] of defs) {
      const have = mech.up[key];
      if (ups[key] && !have) {
        const sock = mech.obj.getObjectByName(sockName);
        if (sock) {
          const o = getModel(name);
          sock.add(o);
          mech.up[key] = { obj: o, t: first ? 1 : 0, em: ownEmit(o), fore: o.getObjectByName('arm_fore'), rods: [o.getObjectByName('hyd_rod_L'), o.getObjectByName('hyd_rod_R')], fk: 0.6 };
          if (!first) { mech.root.updateMatrixWorld(true); sock.getWorldPosition(vTmp); spawn(vTmp.x, vTmp.y, vTmp.z, 28, { color: C.cyan, speed: 2.2, up: 1.5, life: 0.7, size: 0.07, grav: 1 }); flash.userData.t = 0.5; flash.position.copy(vTmp); }
        }
      } else if (!ups[key] && have) {
        if (have.obj.parent) have.obj.parent.remove(have.obj);
        mech.up[key] = null;
      }
      const u = mech.up[key];
      if (u) {
        if (u.t < 1) {
          u.t = Math.min(1, u.t + dt / 0.45);
          const x = u.t - 1;
          const s = 1 + 2.7 * x * x * x + 1.7 * x * x;
          u.obj.scale.setScalar(Math.max(0.001, s));
        } else u.obj.scale.setScalar(1);
        if (u.fore) { const tgt = m.grab ? 0 : 0.55; u.fk += (tgt - u.fk) * Math.min(1, dt * 8); u.fore.rotation.x = u.fk; setEmitI(u.em.magnet_emit, m.grab ? 5 : 2.2); }
        if (u.rods[0]) for (const r of u.rods) if (r) r.position.y = -0.07 + 0.09 * mech.hop;
      }
    }
    mech.root.updateMatrixWorld(true);
  }

  function updateCrow(dt, st) {
    const c = st.crow;
    if (!c) return;
    const h = typeof c.h === 'number' ? c.h : tileH(c.x, c.z);
    const tx = c.x + 0.5, tz = c.z + 0.5;
    if (!crow.init) { crow.pos.set(tx, h + 0.9, tz); crow.init = true; crow.yaw = mech.yaw; }
    let moving = false;
    let wantYaw = null;
    if (c.inMech && mech.seat) {
      mech.seat.getWorldPosition(vTmp);
      if (crow.seated) crow.pos.copy(vTmp);
      else {
        const dx = vTmp.x - crow.pos.x, dy = vTmp.y - crow.pos.y, dz = vTmp.z - crow.pos.z;
        const dist = Math.hypot(dx, dy, dz);
        const step = 7 * dt;
        if (dist <= Math.max(step, 0.04)) { crow.pos.copy(vTmp); crow.seated = true; }
        else { crow.pos.x += (dx / dist) * step; crow.pos.y += (dy / dist) * step; crow.pos.z += (dz / dist) * step; moving = true; wantYaw = yawOf(dx, dz); }
      }
      if (crow.seated) wantYaw = mech.yaw;
    } else {
      crow.seated = false;
      const dx = tx - crow.pos.x, dz = tz - crow.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.3) { crow.pos.x = tx; crow.pos.z = tz; }
      else if (d > 1e-4) {
        const step = 6.25 * dt;
        if (d <= step) { crow.pos.x = tx; crow.pos.z = tz; }
        else { crow.pos.x += (dx / d) * step; crow.pos.z += (dz / d) * step; }
        if (d > 0.01) { moving = true; wantYaw = yawOf(dx, dz); }
      }
      const ty = h + 0.9 + Math.sin(time * 5.5) * 0.04;
      crow.pos.y += (ty - crow.pos.y) * Math.min(1, dt * 8);
      if (c.dir && !moving) { const d2 = dirVec(c.dir); wantYaw = yawOf(d2[0], d2[1]); }
    }
    crow.moving = moving;
    if (wantYaw !== null) crow.yaw += wrapPI(wantYaw - crow.yaw) * (1 - Math.exp(-14 * dt));
    crow.root.position.copy(crow.pos);
    crow.obj.rotation.y = crow.yaw;
    const pitchT = moving && !crow.seated ? 0.25 : 0;
    crow.pitch += (pitchT - crow.pitch) * Math.min(1, dt * 8);
    crow.obj.rotation.x = crow.pitch;
    const perched = crow.seated;
    if (crow.anim) {
      const carry = crow.anim.actions.carry && c.carry;
      playAnim(crow.anim, perched ? 'idle' : carry ? 'carry' : crow.anim.actions.fly ? 'fly' : 'idle');
      crow.anim.mixer.update(dt);
    } else if (crow.wingL && crow.wingR) {
      let a;
      if (perched) a = -1.35;
      else { crow.phase += dt * (moving ? 24 : 15); a = Math.sin(crow.phase) * (moving ? 0.85 : 0.6) + 0.1; }
      crow.wingL.rotation.z += (a - crow.wingL.rotation.z) * Math.min(1, dt * 40);
      crow.wingR.rotation.z += (-a - crow.wingR.rotation.z) * Math.min(1, dt * 40);
    }
  }

  function updateLasers(st) {
    const solid = new Set();
    for (const r of recs.values()) {
      const e = r.e;
      const q = xzOf(e);
      if (!q) continue;
      if (e.type === 'cog' || e.type === 'console' || e.type === 'laser') solid.add(q[0] + ',' + q[1]);
      else if (e.type === 'crate') solid.add(Math.round(r.mover.pos.x - 0.5) + ',' + Math.round(r.mover.pos.z - 0.5));
      else if (e.type === 'door' && !doorOpen(e)) solid.add(q[0] + ',' + q[1]);
      else if (e.type === 'piston' && pistonSlam(e)) solid.add(q[0] + ',' + q[1]);
    }
    const mechKey = st.mech ? st.mech.x + ',' + st.mech.z : '';
    for (const r of recs.values()) {
      if (r.type !== 'laser') continue;
      const q = xzOf(r.e);
      const act = laserActive(r.e);
      setEmitI(r.em.laser_emit, act ? 3.5 : 0.3);
      r.outer.visible = r.inner.visible = r.hit.visible = act;
      if (!act) continue;
      let dist = 0.5;
      for (let k = 1; k < 24; k++) {
        const x = q[0] + r.dx * k, z = q[1] + r.dz * k;
        const c = ch(x, z);
        if (c === ' ' || wallish(c)) { dist = k - 0.5; break; }
        const key = x + ',' + z;
        if (key === mechKey) { dist = k - 0.25; break; }
        if (solid.has(key)) { dist = k - 0.3; break; }
        dist = k + 0.5;
      }
      const start = 0.3;
      const len = Math.max(0.05, dist - start);
      const y = tileH(q[0], q[1]) + 0.55;
      const w = 0.1 + Math.sin(time * 60) * 0.015;
      const cx = q[0] + 0.5 + r.dx * (start + len / 2), cz = q[1] + 0.5 + r.dz * (start + len / 2);
      const yaw = yawOf(r.dx, r.dz);
      r.outer.position.set(cx, y, cz); r.outer.rotation.y = yaw; r.outer.scale.set(w, w, len);
      r.inner.position.set(cx, y, cz); r.inner.rotation.y = yaw; r.inner.scale.set(w * 0.35, w * 0.35, len);
      const ex = q[0] + 0.5 + r.dx * (start + len), ez = q[1] + 0.5 + r.dz * (start + len);
      r.hit.position.set(ex, y, ez);
      r.hit.scale.setScalar(0.8 + Math.sin(time * 40) * 0.25);
      r.spark -= 1 / 60;
      if (r.spark <= 0) { r.spark = 0.07; spawn(ex, y, ez, 1, { color: 0xffa080, speed: 1.2, up: 0.8, life: 0.35, size: 0.05 }); }
    }
  }

  function entPos(id) {
    const r = recs.get(id);
    if (!r || !r.obj) return null;
    return r.obj.position;
  }

  // ---- API
  const view = {
    scene,
    camera,
    tileMeshes,
    sync(st, dt = 1 / 60) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      time += dt;
      if (st !== cur) {
        cur = st;
        clearEnts();
        mech.mover.init = false; crow.init = false; crow.seated = false;
        first = true;
      }
      byId = new Map();
      const all = (st.deco && st.deco.length) ? (st.ents || []).concat(st.deco) : (st.ents || []);
      for (const e of all) byId.set(idOf(e), e);
      updateMech(dt, st);
      stamp++;
      for (const e of all) {
        const id = idOf(e);
        let r = recs.get(id);
        if (!r) r = createRec(e);
        if (!r) continue;
        r.e = e;
        r.stamp = stamp;
        r.upd(dt, e);
      }
      if (recs.size > byId.size || recs.size > 0) {
        for (const [id, r] of recs) {
          if (r.stamp !== stamp) {
            if (r.obj && r.obj.parent) r.obj.parent.remove(r.obj);
            for (const k of ['outer', 'inner', 'hit']) if (r[k]) scene.remove(r[k]);
            recs.delete(id);
          }
        }
      }
      updateLasers(st);
      updateCrow(dt, st);
      // X-ray only while a body is hidden behind level geometry (ray from the camera side to the body).
      {
        const dir = xrDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
        for (const b of [mech, crow]) {
          let occluded = false;
          for (const hy of (b === mech ? [0.35, 0.7, 1.0] : [0.12])) {
            b.obj.getWorldPosition(xrP); xrP.y += hy;
            xrRay.set(xrO.copy(xrP).addScaledVector(dir, -40), dir);
            xrRay.far = 39.85;
            if (xrRay.intersectObjects(tileMeshes, false).length) { occluded = true; break; }
          }
          if (b.xr !== occluded) { b.xr = occluded; b.obj.traverse((o) => { if (o.userData.xray) o.visible = occluded; }); }
        }
      }
      if (flash.userData.t > 0) { flash.userData.t -= dt; flash.intensity = Math.max(0, flash.userData.t) * 40; } else flash.intensity = 0;
      if (exitObj) {
        const s = 1 + Math.sin(time * 3) * 0.05;
        exitObj.scale.set(s, 1, s);
        exitObj.userData.col.material.opacity = 0.1 + Math.sin(time * 2.5) * 0.05;
      }
      updateParticles(dt);
      first = false;
    },

    busy() {
      const st = cur;
      if (!st) return false;
      if (st.control === 'mech' || (st.crow && st.crow.inMech)) {
        const m = st.mech;
        if (m && Math.hypot(mech.mover.pos.x - (m.x + 0.5), mech.mover.pos.z - (m.z + 0.5)) > 0.02) return true;
        for (const r of recs.values()) {
          if (r.type === 'crate') {
            const q = xzOf(r.e);
            if (q && Math.hypot(r.mover.pos.x - (q[0] + 0.5), r.mover.pos.z - (q[1] + 0.5)) > 0.02) return true;
          }
        }
        return false;
      }
      const c = st.crow;
      if (!c) return false;
      return Math.hypot(crow.pos.x - (c.x + 0.5), crow.pos.z - (c.z + 0.5)) > 0.02;
    },

    handleEvents(events) {
      if (!events) return;
      for (const ev of events) {
        const id = ev.id;
        switch (ev.type) {
          case 'move': {
            const f = posArr(ev.from);
            if (ev.who === 'mech' && f) spawn(f[0] + 0.5, tileH(f[0], f[1]) + 0.05, f[1] + 0.5, 5, { color: 0xa89c86, speed: 0.9, up: 0.5, life: 0.45, size: 0.07, grav: 1 });
            break;
          }
          case 'plate_on': case 'plate_off': {
            const p = entPos(id);
            if (p) spawn(p.x, p.y + 0.12, p.z, ev.type === 'plate_on' ? 10 : 4, { color: ev.type === 'plate_on' ? C.cyan : C.lamp, speed: 1.2, up: 1.2, life: 0.4, size: 0.05 });
            break;
          }
          case 'door_open': case 'door_close': {
            const p = entPos(id);
            if (p) spawn(p.x, p.y + 0.1, p.z, 8, { color: 0x9a9080, speed: 1.0, up: 0.5, life: 0.5, size: 0.08, grav: 1 });
            break;
          }
          case 'jam': {
            const r = recs.get(id);
            if (r) { r.stutter = 1.3; spawn(r.obj.position.x, r.obj.position.y + 0.6, r.obj.position.z + 0.2, 26, { color: new THREE.Color(3, 1.6, 0.5), speed: 2.4, up: 2, life: 0.6, size: 0.05 }); }
            break;
          }
          case 'graft': {
            mech.root.updateMatrixWorld(true);
            spawn(mech.root.position.x, mech.root.position.y + 0.8, mech.root.position.z, 30, { color: C.cyan, speed: 2.4, up: 1.6, life: 0.7, size: 0.07, grav: 1 });
            flash.position.set(mech.root.position.x, mech.root.position.y + 1, mech.root.position.z); flash.userData.t = 0.5;
            break;
          }
          case 'hop':
            spawn(mech.root.position.x, mech.root.position.y + 0.05, mech.root.position.z, 12, { color: 0xa89c86, speed: 1.6, up: 0.6, life: 0.5, size: 0.08, grav: 1 });
            break;
          case 'swap':
            spawn(mech.root.position.x, mech.root.position.y + 1.1, mech.root.position.z, 14, { color: C.cyan, speed: 1.6, up: 1.4, life: 0.5, size: 0.05, grav: 1 });
            break;
          case 'death':
            spawn(crow.pos.x, crow.pos.y, crow.pos.z, 28, { color: 0x15161c, speed: 2.0, up: 1.8, life: 0.9, size: 0.06, grav: 2 });
            spawn(crow.pos.x, crow.pos.y, crow.pos.z, 10, { color: new THREE.Color(3, 0.4, 0.3), speed: 2.4, up: 1.4, life: 0.5, size: 0.05 });
            break;
          case 'pickup': case 'drop':
            spawn(crow.pos.x, crow.pos.y - 0.1, crow.pos.z, 5, { color: 0xc2a070, speed: 0.8, up: 0.8, life: 0.4, size: 0.04 });
            break;
          case 'grab': case 'release':
            spawn(mech.root.position.x, mech.root.position.y + 0.6, mech.root.position.z, 8, { color: C.cyan, speed: 1.4, up: 1, life: 0.4, size: 0.05 });
            break;
          case 'won': case 'complete': {
            const t = ev.type === 'won' ? null : exitObj;
            const q = t ? t.position : (() => { for (const r of recs.values()) if (r.type === 'shiny') return r.obj.position; return mech.root.position; })();
            spawn(q.x, q.y + 0.8, q.z, 40, { color: new THREE.Color(3, 2.4, 0.6), speed: 2.8, up: 2.4, life: 1.0, size: 0.07, grav: 2 });
            break;
          }
          default: break;
        }
      }
    },

    worldToScreen(v) {
      const rect = r3.renderer.domElement.getBoundingClientRect();
      camera.updateMatrixWorld();
      vTmp.copy(v).project(camera);
      return { x: (vTmp.x * 0.5 + 0.5) * rect.width, y: (-vTmp.y * 0.5 + 0.5) * rect.height };
    },

    /** Display position of a body ('mech'|'crow') for HUD bubbles. */
    bodyPos(who) { return (who === 'mech' ? mech.root.position : crow.pos).clone(); },
    entPos(id) { const p = entPos(id); return p ? p.clone() : null; },

    dispose() {
      clearEnts();
      scene.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
      });
      if (scene.parent) scene.parent.remove(scene);
      while (scene.children.length) scene.remove(scene.children[0]);
    },
  };
  return view;
}
