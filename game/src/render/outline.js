// Inverted-hull outline helpers.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const OUTLINE_COLOR = 0x1a1414;

const hullMats = new Map();

/** Shared back-face material whose vertices are pushed along their normals by `thickness`. */
export function getHullMaterial(thickness = 0.025) {
  const key = thickness.toFixed(4);
  let m = hullMats.get(key);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
  m.name = 'outline_hull';
  const lit = key;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  transformed += normalize(normal) * ' + lit + ';'
    );
  };
  m.customProgramCacheKey = () => 'hull_' + lit;
  hullMats.set(key, m);
  return m;
}

const hullGeoCache = new WeakMap();

/** Position-only copy of `geo` with welded vertices and smooth normals (no gaps at hard edges). */
export function makeHullGeometry(geo) {
  let h = hullGeoCache.get(geo);
  if (h) return h;
  h = new THREE.BufferGeometry();
  h.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) h.setIndex(geo.index.clone());
  h = mergeVertices(h, 1e-3);
  h.computeVertexNormals();
  hullGeoCache.set(geo, h);
  return h;
}

/**
 * Adds an outline hull as a child of every mesh under obj. Skips existing hulls,
 * meshes flagged userData.noOutline, transparent materials and instanced meshes.
 */
export function addOutline(obj, thickness = 0.025) {
  const meshes = [];
  obj.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline && !o.isInstancedMesh) meshes.push(o);
  });
  const mat = getHullMaterial(thickness);
  for (const m of meshes) {
    if (m.material && m.material.transparent) continue;
    let hull;
    if (m.isSkinnedMesh) {
      hull = new THREE.SkinnedMesh(m.geometry, mat);
      hull.bind(m.skeleton, m.bindMatrix);
      hull.frustumCulled = false;
    } else {
      hull = new THREE.Mesh(makeHullGeometry(m.geometry), mat);
    }
    hull.name = 'outline';
    hull.userData.isOutline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    m.add(hull);
  }
  return obj;
}

/** Removes every outline hull under obj. */
export function removeOutline(obj) {
  const hulls = [];
  obj.traverse((o) => { if (o.userData && o.userData.isOutline) hulls.push(o); });
  for (const h of hulls) if (h.parent) h.parent.remove(h);
}
