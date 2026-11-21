// assets.js: GLB loading with procedural low-poly fallbacks for every model name in REBUILD.md section 5.
// Conventions: Y-up, 1 unit = 1 tile, origin at feet centre, model faces +Z.
// Upgrade models (upg_*) have their origin AT THE SOCKET they attach to.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addOutline, getHullMaterial, makeHullGeometry } from './outline.js';

export const PAL = {
  rust: 0x8a4b32, dark: 0x4a2a20, moss: 0x5d7a3a, slate: 0x2f4c52, concrete: 0x6b6e68,
  lamp: 0xffb35a, cyan: 0x3ff0ff, gold: 0xffcc44, steel: 0x3b4244, wood: 0x7a5a3a,
};

export const MODEL_NAMES = [
  'crow', 'mech', 'upg_magnet_arm', 'upg_hydraulic_legs', 'plate', 'door', 'cog_door', 'stick', 'crate',
  'crane_console', 'laser_emitter', 'piston', 'great_shiny',
  'kit_floor', 'kit_floor_grate', 'kit_floor_moss', 'kit_floor_hazard', 'kit_wall', 'kit_wall_vent',
  'kit_block', 'kit_pillar', 'kit_pipe',
  'deco_lamp', 'deco_barrel', 'deco_tree', 'deco_ivy', 'deco_moss', 'deco_mushrooms', 'deco_terminal', 'deco_robot_arm',
];

// ---------------------------------------------------------------- materials
const matCache = new Map();
function M(color, o = {}) {
  const key = 'M' + color + '|' + (o.rough ?? '') + '|' + (o.metal ?? '') + '|' + (o.em ?? '') + '|' + (o.ei ?? '') + '|' + (o.name ?? '');
  let m = matCache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0.05,
  });
  if (o.em !== undefined) { m.emissive = new THREE.Color(o.em); m.emissiveIntensity = o.ei ?? 0.4; }
  if (o.name) m.name = o.name;
  matCache.set(key, m);
  return m;
}
// emissive material; name always ends with _emit
function E(color, ei = 2.5, name = 'glow_emit') {
  if (!name.endsWith('_emit')) name += '_emit';
  const key = 'E' + color + '|' + ei + '|' + name;
  let m = matCache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.3), emissive: new THREE.Color(color),
    emissiveIntensity: ei, flatShading: true, roughness: 0.6,
  });
  m.name = name;
  matCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------- geometry helpers
function part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}
const bx = (p, w, h, d, mat, x, y, z, rx, ry, rz) => part(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
const cy = (p, rt, rb, h, seg, mat, x, y, z, rx, ry, rz) => part(p, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, ry, rz);
const cn = (p, r, h, seg, mat, x, y, z, rx, ry, rz) => part(p, new THREE.ConeGeometry(r, h, seg), mat, x, y, z, rx, ry, rz);
function sp(p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1, detail = 1) {
  const m = part(p, new THREE.IcosahedronGeometry(r, detail), mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
function grp(parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, name = '') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  if (name) g.name = name;
  parent.add(g);
  return g;
}
// animated pivot: its subtree is kept separate from the static merge
function pivot(parent, name, x = 0, y = 0, z = 0) {
  const g = grp(parent, x, y, z, 0, 0, 0, name);
  g.userData.dyn = true;
  return g;
}
function socket(parent, name, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------------------------------------------------------------- merge + outline for procedural models
const KEEP = ['position', 'normal', 'uv'];
function collectStatic(node, out) {
  for (const c of node.children) {
    if (c.userData.dyn) continue;
    if (c.isMesh && !c.userData.noMerge) out.push(c);
    else collectStatic(c, out);
  }
}
function findDyn(node, out) {
  for (const c of node.children) {
    if (c.userData.dyn) out.push(c);
    else findDyn(c, out);
  }
}
function mergeIn(node, thickness) {
  const dyns = [];
  findDyn(node, dyns);
  const meshes = [];
  collectStatic(node, meshes);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const byMat = new Map();
  const hullGeos = [];
  for (const m of meshes) {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    rel.multiplyMatrices(inv, m.matrixWorld);
    g.applyMatrix4(rel);
    let list = byMat.get(m.material);
    if (!list) byMat.set(m.material, (list = []));
    list.push(g);
    const isEmit = m.material.name && m.material.name.endsWith('_emit');
    if (!isEmit && !m.userData.noOutline && thickness > 0) hullGeos.push(g);
    if (m.parent) m.parent.remove(m);
  }
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list, false);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = mat.name && mat.name.endsWith('_emit') ? mat.name : 'static';
    mesh.castShadow = !(mat.name && mat.name.endsWith('_emit'));
    mesh.receiveShadow = true;
    node.add(mesh);
  }
  if (hullGeos.length) {
    const hg = makeHullGeometry(mergeGeometries(hullGeos, false));
    const hull = new THREE.Mesh(hg, getHullMaterial(thickness));
    hull.name = 'outline';
    hull.userData.isOutline = true;
    node.add(hull);
  }
  for (const d of dyns) mergeIn(d, thickness);
}
function finalize(root, thickness = 0.02) {
  root.updateMatrixWorld(true);
  mergeIn(root, thickness);
  return root;
}

// ---------------------------------------------------------------- builders
function buildCrow() {
  const g = new THREE.Group();
  const black = M(0x1f222c, { rough: 0.6 });
  const dk = M(0x101218);
  const beak = M(0x55555e, { rough: 0.5 });
  const eye = E(0xffe9a0, 1.2, 'eye_emit');
  sp(g, 0.1, black, 0, 0.2, 0, 0.9, 0.8, 1.3, 2);
  sp(g, 0.065, black, 0, 0.285, 0.13, 1, 1, 1, 2);
  cn(g, 0.03, 0.11, 4, beak, 0, 0.272, 0.24, Math.PI / 2, 0, 0);
  sp(g, 0.013, eye, 0.045, 0.3, 0.17, 1, 1, 1, 0);
  sp(g, 0.013, eye, -0.045, 0.3, 0.17, 1, 1, 1, 0);
  bx(g, 0.07, 0.015, 0.15, dk, 0, 0.2, -0.22, -0.3, 0, 0);
  for (const s of [1, -1]) {
    cy(g, 0.009, 0.009, 0.1, 4, dk, s * 0.03, 0.06, 0.02);
    bx(g, 0.04, 0.012, 0.07, dk, s * 0.03, 0.008, 0.04);
    const w = pivot(g, s > 0 ? 'wing_L' : 'wing_R', s * 0.08, 0.23, 0.0);
    bx(w, 0.2, 0.012, 0.16, black, s * 0.1, 0, -0.01);
    bx(w, 0.1, 0.01, 0.12, dk, s * 0.24, 0, -0.04);
  }
  socket(g, 'beak_socket', 0, 0.262, 0.3);
  return finalize(g, 0.011);
}

function buildMech() {
  const g = new THREE.Group();
  const rust = M(PAL.rust, { rough: 0.9 });
  const dark = M(PAL.dark);
  const steel = M(PAL.steel, { rough: 0.5, metal: 0.3 });
  const moss = M(PAL.moss);
  const slate = M(PAL.slate);
  const core = E(PAL.cyan, 3, 'core_emit');
  for (const s of [1, -1]) {
    const p = pivot(g, s > 0 ? 'leg_L' : 'leg_R', s * 0.2, 0.5, 0);
    bx(p, 0.16, 0.4, 0.16, rust, 0, -0.22, 0);
    bx(p, 0.1, 0.1, 0.1, steel, 0, -0.02, 0);
    bx(p, 0.22, 0.1, 0.3, dark, 0, -0.45, 0.04);
    // shoulders + arm stubs
    cy(g, 0.09, 0.09, 0.12, 6, dark, s * 0.37, 0.82, 0, 0, 0, Math.PI / 2);
    bx(g, 0.1, 0.3, 0.1, rust, s * 0.38, 0.64, 0.02);
    bx(g, 0.12, 0.08, 0.12, steel, s * 0.38, 0.47, 0.02);
    // cradle rails
    bx(g, 0.05, 0.14, 0.4, rust, s * 0.25, 1.05, 0);
  }
  bx(g, 0.5, 0.12, 0.3, dark, 0, 0.5, 0);
  bx(g, 0.62, 0.42, 0.46, rust, 0, 0.74, 0);
  bx(g, 0.5, 0.2, 0.04, dark, 0, 0.8, 0.23);
  bx(g, 0.16, 0.16, 0.05, core, 0, 0.72, 0.255);
  bx(g, 0.4, 0.03, 0.04, dark, 0, 0.6, 0.23);
  bx(g, 0.4, 0.03, 0.04, dark, 0, 0.55, 0.23);
  bx(g, 0.36, 0.34, 0.14, dark, 0, 0.76, -0.3);
  bx(g, 0.1, 0.1, 0.06, slate, 0, 0.8, -0.38);
  bx(g, 0.16, 0.05, 0.14, moss, 0.37, 0.9, -0.02);
  bx(g, 0.12, 0.04, 0.1, moss, -0.1, 0.96, -0.1);
  bx(g, 0.5, 0.06, 0.4, dark, 0, 0.98, 0);
  bx(g, 0.5, 0.14, 0.05, rust, 0, 1.05, -0.2);
  socket(g, 'pilot_seat', 0, 1.01, -0.02);
  socket(g, 'arm_L_socket', 0.37, 0.82, 0);
  socket(g, 'arm_R_socket', -0.37, 0.82, 0);
  socket(g, 'leg_mod_socket', 0, 0.5, 0);
  socket(g, 'back_socket', 0, 0.76, -0.37);
  return finalize(g, 0.022);
}

function buildMagnetArm() {
  const g = new THREE.Group();
  const dark = M(PAL.dark), steel = M(0x59615f, { rough: 0.4, metal: 0.3 }), red = M(0xb23a2e);
  const tip = E(PAL.cyan, 2.5, 'magnet_emit');
  cy(g, 0.09, 0.09, 0.14, 6, dark, 0, 0, 0, 0, 0, Math.PI / 2);
  bx(g, 0.1, 0.1, 0.18, steel, 0, -0.04, 0.09);
  const f = pivot(g, 'arm_fore', 0, -0.04, 0.18);
  bx(f, 0.09, 0.09, 0.16, steel, 0, 0, 0.08);
  bx(f, 0.22, 0.07, 0.05, red, 0, 0, 0.17);
  for (const s of [1, -1]) {
    bx(f, 0.06, 0.07, 0.08, red, s * 0.08, 0, 0.21);
    bx(f, 0.06, 0.075, 0.03, tip, s * 0.08, 0, 0.265);
  }
  return finalize(g, 0.015);
}

function buildHydraulicLegs() {
  const g = new THREE.Group();
  const gold = M(0xc89a2a, { rough: 0.5, metal: 0.2 }), dark = M(PAL.dark), steel = M(0x8a9290, { rough: 0.35, metal: 0.3 });
  const e = E(PAL.cyan, 2.5, 'hyd_emit');
  for (const s of [1, -1]) {
    cy(g, 0.055, 0.055, 0.3, 6, gold, s * 0.31, -0.22, 0);
    bx(g, 0.1, 0.05, 0.1, dark, s * 0.29, -0.07, 0);
    bx(g, 0.12, 0.04, 0.12, dark, s * 0.3, -0.4, 0);
    bx(g, 0.02, 0.14, 0.02, e, s * 0.31, -0.2, 0.06);
    const r = pivot(g, s > 0 ? 'hyd_rod_L' : 'hyd_rod_R', s * 0.31, -0.07, 0);
    cy(r, 0.025, 0.025, 0.2, 5, steel, 0, -0.02, 0);
  }
  return finalize(g, 0.015);
}

function buildPlate() {
  const g = new THREE.Group();
  const base = M(0x3a4244), rim = M(PAL.concrete);
  bx(g, 0.96, 0.05, 0.96, base, 0, 0.025, 0);
  bx(g, 0.96, 0.09, 0.06, rim, 0, 0.045, 0.45);
  bx(g, 0.96, 0.09, 0.06, rim, 0, 0.045, -0.45);
  bx(g, 0.06, 0.09, 0.84, rim, 0.45, 0.045, 0);
  bx(g, 0.06, 0.09, 0.84, rim, -0.45, 0.045, 0);
  const pad = pivot(g, 'pad', 0, 0, 0);
  bx(pad, 0.7, 0.08, 0.7, M(PAL.rust), 0, 0.09, 0);
  bx(pad, 0.5, 0.02, 0.5, E(PAL.lamp, 2, 'plate_emit'), 0, 0.135, 0);
  return finalize(g, 0.012);
}

function buildDoor() {
  const g = new THREE.Group();
  const frame = M(0x2d3335, { rough: 0.6, metal: 0.2 }), panelM = M(0x5a6264, { rough: 0.6, metal: 0.3 }), haz = M(0xd9a520);
  for (const s of [1, -1]) {
    bx(g, 0.14, 2, 0.3, frame, s * 0.43, 1, 0);
    const p = pivot(g, s > 0 ? 'panel_L' : 'panel_R', s * 0.19, 0, 0);
    bx(p, 0.38, 1.8, 0.1, panelM, 0, 0.9, 0);
    bx(p, 0.38, 0.1, 0.11, haz, 0, 0.3, 0);
    bx(p, 0.38, 0.1, 0.11, haz, 0, 1.2, 0);
  }
  bx(g, 1, 0.2, 0.3, frame, 0, 1.9, 0);
  bx(g, 0.2, 0.06, 0.06, E(0xff3a2a, 2.5, 'door_emit'), 0, 1.78, 0.16);
  bx(g, 1, 0.04, 0.3, M(PAL.dark), 0, 0.02, 0);
  return finalize(g, 0.018);
}

function buildCogDoor() {
  const g = new THREE.Group();
  const steel = M(PAL.steel, { rough: 0.5, metal: 0.3 }), dark = M(PAL.dark), rust = M(PAL.rust), slate = M(PAL.slate);
  bx(g, 0.9, 0.14, 0.6, dark, 0, 0.07, 0);
  bx(g, 0.9, 0.9, 0.1, slate, 0, 0.58, -0.22);
  for (const s of [1, -1]) bx(g, 0.12, 1.05, 0.2, steel, s * 0.4, 0.55, -0.06);
  const w = pivot(g, 'cog_wheel', 0, 0.58, 0.04);
  part(w, new THREE.CylinderGeometry(0.38, 0.38, 0.14, 12).rotateX(Math.PI / 2), rust);
  part(w, new THREE.CylinderGeometry(0.25, 0.25, 0.16, 10).rotateX(Math.PI / 2), dark);
  part(w, new THREE.CylinderGeometry(0.1, 0.1, 0.2, 6).rotateX(Math.PI / 2), steel);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    bx(w, 0.14, 0.14, 0.14, dark, Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0, 0, 0, a);
  }
  bx(g, 0.1, 0.1, 0.1, E(0xff3030, 2.5, 'cog_emit'), 0.4, 1.12, -0.06);
  socket(g, 'stick_slot', 0, 0.58, 0.15);
  return finalize(g, 0.02);
}

function buildStick() {
  const g = new THREE.Group();
  const wood = M(PAL.wood, { rough: 0.9 });
  cy(g, 0.035, 0.028, 0.52, 5, wood, 0, 0.04, 0, 0, 0, Math.PI / 2);
  cy(g, 0.018, 0.012, 0.18, 4, wood, 0.08, 0.1, 0.05, 0.5, 0, 0.8);
  return finalize(g, 0.01);
}

function buildCrate() {
  const g = new THREE.Group();
  const body = M(0x86683a), band = M(0x3b2f26), steel = M(PAL.steel, { rough: 0.5, metal: 0.3 });
  bx(g, 0.88, 0.88, 0.88, body, 0, 0.45, 0);
  for (const sx of [1, -1]) for (const sz of [1, -1]) bx(g, 0.1, 0.92, 0.1, band, sx * 0.42, 0.46, sz * 0.42);
  bx(g, 0.94, 0.08, 0.94, band, 0, 0.06, 0);
  bx(g, 0.94, 0.08, 0.94, band, 0, 0.86, 0);
  bx(g, 0.9, 0.07, 0.02, band, 0, 0.45, 0.45, 0, 0, 0.7);
  bx(g, 0.02, 0.07, 0.9, band, 0.45, 0.45, 0, 0.7, 0, 0);
  bx(g, 0.4, 0.03, 0.4, steel, 0, 0.92, 0);
  return finalize(g, 0.02);
}

function buildConsole() {
  const g = new THREE.Group();
  const slate = M(PAL.slate), dark = M(PAL.dark), steel = M(PAL.steel, { rough: 0.5, metal: 0.3 });
  bx(g, 0.74, 0.7, 0.5, slate, 0, 0.35, 0);
  bx(g, 0.72, 0.12, 0.42, dark, 0, 0.74, 0.0, 0.5, 0, 0);
  bx(g, 0.6, 0.04, 0.3, E(PAL.cyan, 2, 'console_emit'), 0, 0.78, 0.03, 0.5, 0, 0);
  cy(g, 0.07, 0.07, 0.06, 8, M(0x0c0e10), 0, 0.3, 0.26, Math.PI / 2, 0, 0);
  cy(g, 0.05, 0.05, 0.03, 8, M(0xb23a2e), -0.22, 0.2, 0.26, Math.PI / 2, 0, 0);
  cy(g, 0.05, 0.05, 1.4, 5, steel, -0.32, 0.7, -0.15);
  bx(g, 0.06, 0.06, 0.5, steel, -0.32, 1.38, 0.08);
  cy(g, 0.015, 0.015, 0.3, 4, dark, -0.32, 1.2, 0.3);
  bx(g, 0.06, 0.1, 0.06, M(0xc89a2a), -0.32, 1.02, 0.3);
  const ia = pivot(g, 'icon_arm', 0.12, 0.98, 0.04);
  bx(ia, 0.16, 0.05, 0.04, M(0xb23a2e), 0, 0, 0);
  bx(ia, 0.04, 0.05, 0.08, M(0xb23a2e), 0.06, 0, 0.05);
  bx(ia, 0.04, 0.05, 0.08, M(0xb23a2e), -0.06, 0, 0.05);
  const il = pivot(g, 'icon_legs', 0.12, 0.98, 0.04);
  cy(il, 0.025, 0.025, 0.14, 5, M(0xc89a2a), 0.04, 0.05, 0);
  cy(il, 0.025, 0.025, 0.14, 5, M(0xc89a2a), -0.04, 0.05, 0);
  return finalize(g, 0.02);
}

function buildLaser() {
  const g = new THREE.Group();
  const dark = M(PAL.dark), steel = M(PAL.steel, { rough: 0.5, metal: 0.3 });
  cy(g, 0.2, 0.26, 0.35, 6, dark, 0, 0.175, 0);
  cy(g, 0.14, 0.14, 0.5, 8, steel, 0, 0.55, 0, Math.PI / 2, 0, 0);
  cy(g, 0.09, 0.09, 0.04, 8, E(0xff3a2a, 3, 'laser_emit'), 0, 0.55, 0.26, Math.PI / 2, 0, 0);
  bx(g, 0.3, 0.04, 0.12, M(0xd9a520), 0, 0.37, 0.05);
  return finalize(g, 0.02);
}

function buildPiston() {
  const g = new THREE.Group();
  const dark = M(0x2d3335), gold = M(0xd9a520), steel = M(0x59615f, { rough: 0.4, metal: 0.3 });
  bx(g, 0.96, 0.05, 0.96, dark, 0, 0.025, 0);
  bx(g, 0.96, 0.06, 0.08, gold, 0, 0.03, 0.44);
  bx(g, 0.96, 0.06, 0.08, gold, 0, 0.03, -0.44);
  bx(g, 0.08, 0.06, 0.8, gold, 0.44, 0.03, 0);
  bx(g, 0.08, 0.06, 0.8, gold, -0.44, 0.03, 0);
  for (const sx of [1, -1]) for (const sz of [1, -1]) cy(g, 0.05, 0.05, 1.6, 5, steel, sx * 0.46, 0.8, sz * 0.46);
  const h = pivot(g, 'head', 0, 1.3, 0);
  bx(h, 0.8, 0.4, 0.8, M(PAL.rust), 0, 0.2, 0);
  bx(h, 0.82, 0.08, 0.82, gold, 0, 0.12, 0);
  cy(h, 0.08, 0.08, 1.4, 6, steel, 0, 1.1, 0);
  bx(h, 0.5, 0.03, 0.03, E(PAL.lamp, 2, 'piston_emit'), 0, 0.05, 0.41);
  return finalize(g, 0.02);
}

function buildShiny() {
  const g = new THREE.Group();
  const gold = M(PAL.gold, { rough: 0.35, metal: 0.25, em: PAL.gold, ei: 0.45 });
  cy(g, 0.3, 0.38, 0.2, 8, M(PAL.slate), 0, 0.1, 0);
  cy(g, 0.12, 0.12, 0.06, 8, M(PAL.dark), 0, 0.22, 0);
  const s = pivot(g, 'shiny_spin', 0, 0.75, 0);
  part(s, new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12).rotateX(Math.PI / 2), gold);
  part(s, new THREE.CylinderGeometry(0.13, 0.13, 0.14, 8).rotateX(Math.PI / 2), E(PAL.gold, 3, 'shiny_emit'));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    bx(s, 0.13, 0.13, 0.1, gold, Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0, 0, 0, a);
  }
  for (let i = 0; i < 3; i++) bx(s, 0.6, 0.05, 0.12, gold, 0, 0, 0, 0, 0, (i / 3) * Math.PI);
  const sm = pivot(s, 'gear_small', 0.52, 0.3, 0);
  part(sm, new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8).rotateX(Math.PI / 2), gold);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bx(sm, 0.09, 0.09, 0.1, gold, Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0, 0, 0, a);
  }
  return finalize(g, 0.015);
}

// ---- kit
const FLOOR = 0x5a5f5b;
function floorBase(g, color = FLOOR) {
  bx(g, 0.98, 0.3, 0.98, M(color), 0, -0.15, 0);
}
function buildKitFloor() {
  const g = new THREE.Group();
  floorBase(g);
  bx(g, 0.8, 0.012, 0.8, M(0x646a65), 0, 0.006, 0);
  return finalize(g, 0);
}
function buildKitFloorGrate() {
  const g = new THREE.Group();
  floorBase(g, 0x1f282b);
  const bar = M(0x4b5558, { metal: 0.2 });
  for (let i = 0; i < 5; i++) bx(g, 0.9, 0.03, 0.05, bar, 0, 0.005, -0.4 + i * 0.2);
  return finalize(g, 0);
}
function buildKitFloorMoss() {
  const g = new THREE.Group();
  floorBase(g);
  bx(g, 0.8, 0.012, 0.8, M(0x646a65), 0, 0.006, 0);
  const a = M(PAL.moss), b = M(0x6e8f45);
  bx(g, 0.42, 0.04, 0.3, a, -0.2, 0.02, 0.15, 0, 0.3, 0);
  bx(g, 0.26, 0.04, 0.26, b, 0.2, 0.02, -0.2, 0, -0.4, 0);
  bx(g, 0.16, 0.06, 0.12, b, 0.25, 0.03, 0.28, 0, 0.6, 0);
  bx(g, 0.12, 0.05, 0.14, a, -0.3, 0.025, -0.3, 0, 0.2, 0);
  return finalize(g, 0);
}
function buildKitFloorHazard() {
  const g = new THREE.Group();
  floorBase(g, 0x2a2f30);
  const y = M(0xd9a520);
  for (let i = 0; i < 4; i++) bx(g, 0.9, 0.02, 0.1, y, 0, 0.01, -0.36 + i * 0.24);
  return finalize(g, 0);
}
function buildKitWall() {
  const g = new THREE.Group();
  bx(g, 0.98, 1.88, 0.98, M(0x2c4046), 0, 0.94, 0);
  bx(g, 1.0, 0.2, 1.0, M(0x22333a), 0, 0.1, 0);
  bx(g, 0.99, 0.08, 0.99, M(0x5e3828), 0, 1.35, 0);
  bx(g, 1.0, 0.12, 1.0, M(0x8d9088), 0, 1.94, 0);
  return finalize(g, 0);
}
function buildKitWallVent() {
  const g = new THREE.Group();
  const body = M(0x2c4046);
  bx(g, 0.98, 0.3, 0.98, M(0x22333a), 0, 0.15, 0);
  bx(g, 0.98, 1.08, 0.98, body, 0, 1.34, 0);
  for (const sx of [1, -1]) for (const sz of [1, -1]) bx(g, 0.24, 0.5, 0.24, body, sx * 0.37, 0.55, sz * 0.37);
  bx(g, 0.99, 0.08, 0.99, M(0x5e3828), 0, 1.35, 0);
  bx(g, 1.0, 0.12, 1.0, M(0x8d9088), 0, 1.94, 0);
  return finalize(g, 0);
}
function buildKitBlock() {
  const g = new THREE.Group();
  bx(g, 0.98, 0.94, 0.98, M(0x666a63), 0, 0.47, 0);
  bx(g, 1.0, 0.14, 1.0, M(0x74503c), 0, 0.07, 0);
  bx(g, 1.0, 0.06, 1.0, M(0x9a9c92), 0, 0.97, 0);
  return finalize(g, 0);
}
function buildKitPillar() {
  const g = new THREE.Group();
  cy(g, 0.34, 0.38, 2, 8, M(PAL.slate), 0, 1, 0);
  cy(g, 0.41, 0.41, 0.12, 8, M(PAL.rust), 0, 0.3, 0);
  cy(g, 0.41, 0.41, 0.12, 8, M(PAL.rust), 0, 1.4, 0);
  cy(g, 0.44, 0.44, 0.1, 8, M(PAL.concrete), 0, 1.95, 0);
  return finalize(g, 0.02);
}
function buildKitPipe() {
  const g = new THREE.Group();
  const r = M(PAL.rust, { rough: 0.7, metal: 0.2 }), d = M(PAL.dark);
  cy(g, 0.08, 0.08, 1, 8, r, 0, 0.2, 0, 0, 0, Math.PI / 2);
  for (const x of [-0.4, 0.4]) cy(g, 0.11, 0.11, 0.06, 8, d, x, 0.2, 0, 0, 0, Math.PI / 2);
  bx(g, 0.06, 0.2, 0.1, d, 0, 0.1, 0);
  return finalize(g, 0.015);
}
// ---- deco
function buildLamp() {
  const g = new THREE.Group();
  const dark = M(PAL.dark), steel = M(PAL.steel, { metal: 0.3 });
  cy(g, 0.12, 0.14, 0.06, 6, dark, 0, 0.03, 0);
  cy(g, 0.025, 0.025, 1.1, 5, steel, 0, 0.55, 0);
  cy(g, 0.04, 0.16, 0.14, 6, dark, 0, 1.18, 0);
  sp(g, 0.07, E(PAL.lamp, 3, 'lamp_emit'), 0, 1.07, 0, 1, 1, 1, 1);
  socket(g, 'light_anchor', 0, 1.0, 0);
  return finalize(g, 0.012);
}
function buildBarrel() {
  const g = new THREE.Group();
  const dark = M(PAL.dark);
  cy(g, 0.27, 0.27, 0.7, 8, M(0x7a4a30), 0, 0.35, 0);
  cy(g, 0.29, 0.29, 0.06, 8, dark, 0, 0.15, 0);
  cy(g, 0.29, 0.29, 0.06, 8, dark, 0, 0.55, 0);
  cy(g, 0.24, 0.24, 0.03, 8, M(PAL.steel), 0, 0.71, 0);
  bx(g, 0.2, 0.08, 0.02, M(0xd9a520), 0, 0.35, 0.27);
  return finalize(g, 0.015);
}
function buildTree() {
  const g = new THREE.Group();
  const wood = M(0x5a4030, { rough: 0.95 }), leaf = M(PAL.moss), leaf2 = M(0x6e8f45);
  cy(g, 0.58, 0.64, 0.2, 7, wood, 0, 0.1, 0);
  cy(g, 0.3, 0.45, 2.2, 7, wood, 0, 1.1, 0);
  cy(g, 0.05, 0.08, 0.5, 5, M(PAL.wood), 0.32, 1.5, 0.2, 0, 0, -1.0);
  cy(g, 0.05, 0.08, 0.5, 5, M(PAL.wood), -0.3, 1.2, -0.15, 0, 0, 1.0);
  sp(g, 0.7, leaf, 0, 2.35, 0, 1, 0.65, 1, 1);
  sp(g, 0.5, leaf2, 0.4, 2.2, 0.25, 1, 0.7, 1, 1);
  sp(g, 0.5, leaf, -0.4, 2.1, -0.2, 1, 0.7, 1, 1);
  return finalize(g, 0.02);
}
function buildIvy() {
  const g = new THREE.Group();
  const r = rng(7);
  const a = M(PAL.moss), b = M(0x6e8f45);
  for (let i = 0; i < 6; i++) {
    const len = 0.9 + r() * 0.9;
    const x = -0.4 + i * 0.16;
    bx(g, 0.05, len, 0.04, a, x, 1.95 - len / 2, 0);
    for (let k = 0; k < 3; k++) bx(g, 0.14, 0.1, 0.04, k % 2 ? a : b, x + (r() - 0.5) * 0.1, 1.9 - r() * len, 0.02, 0, 0, r() - 0.5);
  }
  bx(g, 0.95, 0.08, 0.06, a, 0, 1.95, 0);
  return finalize(g, 0.008);
}
function buildMoss() {
  const g = new THREE.Group();
  const a = M(PAL.moss), b = M(0x6e8f45);
  bx(g, 0.5, 0.04, 0.36, a, -0.15, 0.02, 0.1, 0, 0.3, 0);
  bx(g, 0.3, 0.05, 0.3, b, 0.25, 0.025, -0.2, 0, -0.4, 0);
  bx(g, 0.2, 0.05, 0.16, b, 0.25, 0.025, 0.3, 0, 0.6, 0);
  return finalize(g, 0);
}
function buildMushrooms() {
  const g = new THREE.Group();
  const stem = M(0xcfd8cf), cap = E(0x2fd6c8, 2, 'mush_emit');
  const spec = [[-0.15, 0.1, 0.22, 0.1], [0.12, -0.05, 0.16, 0.08], [0.2, 0.2, 0.12, 0.06]];
  for (const [x, z, h, r] of spec) {
    cy(g, r * 0.35, r * 0.4, h, 5, stem, x, h / 2, z);
    sp(g, r, cap, x, h, z, 1, 0.6, 1, 1);
  }
  return finalize(g, 0.008);
}
function buildTerminal() {
  const g = new THREE.Group();
  bx(g, 0.5, 0.5, 0.4, M(PAL.slate), 0, 0.25, 0);
  bx(g, 0.46, 0.34, 0.1, M(PAL.dark), 0, 0.68, -0.05, -0.2, 0, 0);
  bx(g, 0.38, 0.26, 0.02, E(0x6dffb0, 2, 'term_emit'), 0, 0.68, 0.0, -0.2, 0, 0);
  bx(g, 0.4, 0.04, 0.14, M(PAL.steel), 0, 0.52, 0.22);
  return finalize(g, 0.015);
}
function buildRobotArm() {
  const g = new THREE.Group();
  const rust = M(PAL.rust), dark = M(PAL.dark), steel = M(PAL.steel, { metal: 0.3 });
  cy(g, 0.3, 0.35, 0.2, 8, dark, 0, 0.1, 0);
  sp(g, 0.14, steel, 0, 0.25, 0, 1, 1, 1, 1);
  const g1 = grp(g, 0, 0.25, 0, 0, 0, 0.45);
  bx(g1, 0.14, 0.6, 0.14, rust, 0, 0.3, 0);
  const g2 = grp(g1, 0, 0.6, 0, 0, 0, -1.5);
  sp(g2, 0.09, steel, 0, 0, 0, 1, 1, 1, 0);
  bx(g2, 0.12, 0.5, 0.12, dark, 0, 0.25, 0);
  bx(g2, 0.04, 0.16, 0.08, steel, 0.06, 0.58, 0, 0, 0, 0.3);
  bx(g2, 0.04, 0.16, 0.08, steel, -0.06, 0.58, 0, 0, 0, -0.3);
  return finalize(g, 0.015);
}

const BUILDERS = {
  crow: buildCrow, mech: buildMech, upg_magnet_arm: buildMagnetArm, upg_hydraulic_legs: buildHydraulicLegs,
  plate: buildPlate, door: buildDoor, cog_door: buildCogDoor, stick: buildStick, crate: buildCrate,
  crane_console: buildConsole, laser_emitter: buildLaser, piston: buildPiston, great_shiny: buildShiny,
  kit_floor: buildKitFloor, kit_floor_grate: buildKitFloorGrate, kit_floor_moss: buildKitFloorMoss,
  kit_floor_hazard: buildKitFloorHazard, kit_wall: buildKitWall, kit_wall_vent: buildKitWallVent,
  kit_block: buildKitBlock, kit_pillar: buildKitPillar, kit_pipe: buildKitPipe,
  deco_lamp: buildLamp, deco_barrel: buildBarrel, deco_tree: buildTree, deco_ivy: buildIvy,
  deco_moss: buildMoss, deco_mushrooms: buildMushrooms, deco_terminal: buildTerminal, deco_robot_arm: buildRobotArm,
};

// ---------------------------------------------------------------- registry / loading
const protos = new Map(); // name -> { root, clips, glb }

function prepGLB(root, name) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !/^kit_floor/.test(name);
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.name && m.name.endsWith('_emit')) {
        if (m.emissive && m.emissive.getHex() === 0) m.emissive.copy(m.color);
        m.emissiveIntensity = Math.max(2, m.emissiveIntensity || 0);
      }
    }
  });
  if (!/^kit_(floor|wall|block)/.test(name)) addOutline(root, name === 'crow' ? 0.012 : 0.022);
}

function getProto(name) {
  let p = protos.get(name);
  if (p) return p;
  const b = BUILDERS[name];
  let root;
  if (b) root = b();
  else {
    root = new THREE.Group();
    bx(root, 0.5, 0.5, 0.5, M(0xff00ff), 0, 0.25, 0); // unknown model marker
  }
  p = { root, clips: [], glb: false };
  protos.set(name, p);
  return p;
}

export function loadAssets() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const base = new URL('../../assets/models/', import.meta.url);
  const tasks = MODEL_NAMES.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(new URL(name + '.glb', base).href);
      prepGLB(gltf.scene, name);
      protos.set(name, { root: gltf.scene, clips: gltf.animations || [], glb: true });
    } catch (e) {
      // missing or invalid: procedural fallback is built lazily
    }
  });
  return Promise.all(tasks).then(() => {
    for (const n of MODEL_NAMES) getProto(n);
    return true;
  });
}

export function getModel(name) {
  const p = getProto(name);
  return SkeletonUtils.clone(p.root);
}
export function getClips(name) {
  return getProto(name).clips;
}
export function isGLB(name) {
  const p = protos.get(name);
  return !!(p && p.glb);
}
