// Cutscene helpers (STORY agent): easing, keyframe camera tracks, timeline runner, rain, sky dome, the night tower
// world shared by intro + ending, a crow rig, a mech builder, and a few 2D helpers.
import * as THREE from 'three';
import { getModel, getClips } from '../render/assets.js';

// ---------- math / easing ----------
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = {
  linear: (t) => t,
  smooth,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- keyframe camera track ----------
// keys: [{t, pos:[x,y,z], look:[x,y,z], ease?}]. `ease` on a key shapes the segment that ENDS at that key.
// Two keys a hair apart make a hard cut.
export function track(keys, defaultEase = 'linear') {
  const ks = keys.slice().sort((a, b) => a.t - b.t).map((k) => ({
    t: k.t, pos: new THREE.Vector3().fromArray(k.pos), look: new THREE.Vector3().fromArray(k.look), ease: k.ease,
  }));
  return {
    duration: ks.length ? ks[ks.length - 1].t : 0,
    sample(t, outPos, outLook) {
      if (t <= ks[0].t) { outPos.copy(ks[0].pos); outLook.copy(ks[0].look); return; }
      const last = ks[ks.length - 1];
      if (t >= last.t) { outPos.copy(last.pos); outLook.copy(last.look); return; }
      let i = 0;
      while (i < ks.length - 2 && t >= ks[i + 1].t) i++;
      const a = ks[i], b = ks[i + 1];
      const f = ease[b.ease] || (typeof b.ease === 'function' ? b.ease : null) || ease[defaultEase] || ease.linear;
      const e = f(clamp01((t - a.t) / Math.max(1e-6, b.t - a.t)));
      outPos.lerpVectors(a.pos, b.pos, e);
      outLook.lerpVectors(a.look, b.look, e);
    },
  };
}

// ---------- timeline runner ----------
export function timeline() {
  const ev = [];
  return {
    at(t, fn) { ev.push({ t, fn, done: false }); ev.sort((a, b) => a.t - b.t); },
    update(t) { for (const e of ev) if (!e.done && t >= e.t) { e.done = true; try { e.fn(t); } catch (err) { console.warn('[cutscene]', err); } } },
  };
}

// ---------- disposal registry ----------
export function disposer() {
  const list = [];
  return {
    track(o) { list.push(o); return o; },
    dispose() { for (const o of list) { try { if (o && o.dispose) o.dispose(); } catch (e) { /* ignore */ } } list.length = 0; },
  };
}

function meshBox(D, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(D.track(new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- textures ----------
export function glowTexture(D, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return D.track(tex);
}

function glowSprite(D, tex, color, scale, opacity = 1) {
  const mat = D.track(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

// ---------- rain (LineSegments, recycled) ----------
export function createRain(D, o = {}) {
  const count = Math.min(1500, o.count || 1000);
  const ax = o.x || [-28, 28], ay = o.y || [0, 42], az = o.z || [-14, 34];
  const len = o.len || 0.9, wind = o.wind == null ? 2.2 : o.wind;
  const pos = new Float32Array(count * 6);
  const hx = new Float32Array(count), hy = new Float32Array(count), hz = new Float32Array(count), sp = new Float32Array(count);
  const rnd = mulberry32(1234);
  for (let i = 0; i < count; i++) {
    hx[i] = lerp(ax[0], ax[1], rnd()); hy[i] = lerp(ay[0], ay[1], rnd()); hz[i] = lerp(az[0], az[1], rnd());
    sp[i] = lerp(22, 31, rnd());
  }
  const geo = D.track(new THREE.BufferGeometry());
  const attr = new THREE.BufferAttribute(pos, 3);
  geo.setAttribute('position', attr);
  const mat = D.track(new THREE.LineBasicMaterial({ color: 0x9db6c8, transparent: true, opacity: o.opacity || 0.32, fog: false, depthWrite: false }));
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  function write() {
    for (let i = 0; i < count; i++) {
      const k = i * 6;
      pos[k] = hx[i] - (wind * len) / sp[i]; pos[k + 1] = hy[i] + len; pos[k + 2] = hz[i];
      pos[k + 3] = hx[i]; pos[k + 4] = hy[i]; pos[k + 5] = hz[i];
    }
    attr.needsUpdate = true;
  }
  write();
  return {
    object: lines,
    update(dt) {
      for (let i = 0; i < count; i++) {
        hy[i] -= sp[i] * dt; hx[i] += wind * dt;
        if (hy[i] < ay[0]) { hy[i] += ay[1] - ay[0]; hx[i] = lerp(ax[0], ax[1], Math.random()); hz[i] = lerp(az[0], az[1], Math.random()); }
      }
      write();
    },
    setOpacity(v) { mat.opacity = v; },
  };
}

// ---------- sky dome (vertical gradient) ----------
export function createSky(D) {
  const top = new THREE.Color(0x04070d), bottom = new THREE.Color(0x15222e);
  const mat = D.track(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { topC: { value: top }, botC: { value: bottom } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 topC; uniform vec3 botC; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.8 + 0.06, 0.0, 1.0); gl_FragColor = vec4(mix(botC, topC, pow(h, 0.7)), 1.0); }',
  }));
  const mesh = new THREE.Mesh(D.track(new THREE.SphereGeometry(300, 20, 12)), mat);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, top, bottom, follow(cam) { mesh.position.copy(cam.position); } };
}

// ---------- tower world ----------
export const TOWER = {
  gold: new THREE.Vector3(-1.2, 13.5, 3.8),   // the big glowing window (centre, just in front of the wall)
  vent: new THREE.Vector3(-1.5, 19.5, 3.05),  // vent the crow dives into
  perch: new THREE.Vector3(2, 29.45, -0.5),   // top of the antenna mast
  roofY: 23.3,
};

const NIGHT_TOP = new THREE.Color(0x04070d), NIGHT_BOT = new THREE.Color(0x15222e);
const DAWN_TOP = new THREE.Color(0x35608a), DAWN_BOT = new THREE.Color(0xffa468);
const NIGHT_FOG = new THREE.Color(0x0b1218), DAWN_FOG = new THREE.Color(0xd89a7c);
const NIGHT_HEMI_SKY = new THREE.Color(0x28455a), DAWN_HEMI_SKY = new THREE.Color(0xffc9a0);

function addWindows(list, s, face, excl) {
  const span = face === 'z+' ? s.w : s.d;
  const stepX = 1.2, stepY = 1.45;
  const nc = Math.max(1, Math.floor((span - 1.0) / stepX));
  const nr = Math.max(1, Math.floor((s.h - 1.0) / stepY));
  for (let r = 0; r < nr; r++) {
    for (let c = 0; c < nc; c++) {
      const u = (c - (nc - 1) / 2) * stepX;
      const y = s.cy - s.h / 2 + 0.9 + r * stepY;
      let x, z, ry;
      if (face === 'z+') { x = s.cx + u; z = s.cz + s.d / 2 + 0.03; ry = 0; }
      else if (face === 'x-') { x = s.cx - s.w / 2 - 0.03; z = s.cz + u; ry = -Math.PI / 2; }
      else { x = s.cx + s.w / 2 + 0.03; z = s.cz + u; ry = Math.PI / 2; }
      let skip = false;
      if (excl && face === 'z+') for (const e of excl) if (Math.abs(x - e.x) < e.rx && Math.abs(y - e.y) < e.ry) skip = true;
      if (!skip) list.push({ x, y, z, ry });
    }
  }
}

// Builds the night exterior. Returns { scene, update(dt,t), pulse(p), dawn(k), setGold(k) }.
export function buildTowerWorld(D, opts = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(NIGHT_FOG.getHex(), 0.016);
  const rnd = mulberry32(777);
  const glowTex = glowTexture(D);

  const sky = createSky(D);
  scene.add(sky.mesh);

  // lights
  const hemi = new THREE.HemisphereLight(0x28455a, 0x1a1210, 0.8);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0x8fb0d0, 0.75);
  moonLight.position.set(-20, 30, 24);
  scene.add(moonLight);
  const sunLight = new THREE.DirectionalLight(0xffb070, 0);
  sunLight.position.set(-20, 18, -60);
  scene.add(sunLight);
  const goldLight = new THREE.PointLight(0xffc860, 25, 28, 2);
  goldLight.position.set(TOWER.gold.x, TOWER.gold.y, TOWER.gold.z + 2.2);
  scene.add(goldLight);

  // materials
  const mk = (c, r = 0.85) => D.track(new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: r, metalness: 0.05 }));
  const mRust = mk(0x8a4b32), mDark = mk(0x4a2a20), mSlate = mk(0x2f4c52), mConc = mk(0x6b6e68), mGround = mk(0x0a0e12, 1);

  // ground
  const ground = new THREE.Mesh(D.track(new THREE.CircleGeometry(220, 24)), mGround);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  scene.add(ground);

  // tower body: three stacked segments
  const S = [
    { cx: 0, cy: 4.5, cz: 0, w: 10, h: 9, d: 9, m: mDark },
    { cx: 0, cy: 13, cz: 0, w: 8, h: 8, d: 7.5, m: mSlate },
    { cx: 0, cy: 20, cz: 0, w: 6, h: 6, d: 6, m: mConc },
  ];
  for (const s of S) {
    scene.add(meshBox(D, s.w, s.h, s.d, s.m, s.cx, s.cy, s.cz));
    scene.add(meshBox(D, s.w + 0.5, 0.3, s.d + 0.5, mRust, s.cx, s.cy + s.h / 2, s.cz)); // ledge band
  }
  scene.add(meshBox(D, 10.4, 0.25, 9.4, mRust, 0, 0.12, 0)); // foot band
  // pipes on the front of the base
  const pipeGeo = D.track(new THREE.CylinderGeometry(0.13, 0.13, 9, 6));
  for (const px of [-4.2, 4.2, -2.6]) { const p = new THREE.Mesh(pipeGeo, mRust); p.position.set(px, 4.5, 4.65); scene.add(p); }
  // roof slab + parapet
  scene.add(meshBox(D, 6.6, 0.3, 6.6, mConc, 0, 23.15, 0));
  scene.add(meshBox(D, 6.6, 0.5, 0.25, mDark, 0, 23.55, 3.2));
  scene.add(meshBox(D, 6.6, 0.5, 0.25, mDark, 0, 23.55, -3.2));
  scene.add(meshBox(D, 0.25, 0.5, 6.6, mDark, -3.2, 23.55, 0));
  scene.add(meshBox(D, 0.25, 0.5, 6.6, mDark, 3.2, 23.55, 0));

  // antenna mast
  const mx = TOWER.perch.x, mz = TOWER.perch.z;
  scene.add(meshBox(D, 0.18, 6.1, 0.18, mDark, mx, 26.35, mz));
  scene.add(meshBox(D, 1.8, 0.1, 0.1, mDark, mx, 27.4, mz));
  scene.add(meshBox(D, 1.2, 0.1, 0.1, mDark, mx, 28.3, mz));
  scene.add(meshBox(D, 0.7, 0.08, 0.08, mDark, mx, 29.3, mz));
  const redMat = D.track(new THREE.MeshBasicMaterial({ color: 0xff3b4f, fog: false }));
  const red = new THREE.Mesh(D.track(new THREE.SphereGeometry(0.12, 8, 6)), redMat);
  red.position.set(mx - 0.85, 27.5, mz);
  scene.add(red);

  // window grid (instanced)
  const excl1 = [{ x: TOWER.gold.x, y: TOWER.gold.y, rx: 1.5, ry: 1.9 }];
  const excl2 = [{ x: TOWER.vent.x, y: TOWER.vent.y, rx: 1.1, ry: 1.0 }];
  const wl = [];
  addWindows(wl, S[0], 'z+'); addWindows(wl, S[0], 'x-'); addWindows(wl, S[0], 'x+');
  addWindows(wl, S[1], 'z+', excl1); addWindows(wl, S[1], 'x-'); addWindows(wl, S[1], 'x+');
  addWindows(wl, S[2], 'z+', excl2); addWindows(wl, S[2], 'x-'); addWindows(wl, S[2], 'x+');
  const winMat = D.track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const winIM = new THREE.InstancedMesh(D.track(new THREE.PlaneGeometry(0.62, 0.82)), winMat, wl.length);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < wl.length; i++) {
    const w = wl[i];
    dummy.position.set(w.x, w.y, w.z); dummy.rotation.set(0, w.ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    winIM.setMatrixAt(i, dummy.matrix);
    const r = rnd();
    if (r < 0.1) col.setRGB(1.7, 1.0, 0.35);
    else if (r < 0.135) col.setRGB(0.25, 1.0, 1.15);
    else { const v = 0.35 + rnd() * 0.5; col.setRGB(0.02 * v, 0.045 * v, 0.06 * v); }
    winIM.setColorAt(i, col);
  }
  winIM.instanceMatrix.needsUpdate = true;
  if (winIM.instanceColor) winIM.instanceColor.needsUpdate = true;
  D.track(winIM);
  scene.add(winIM);

  // the big gold window + glow
  const goldMat = D.track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const frame = meshBox(D, 2.1, 2.8, 0.2, mDark, TOWER.gold.x, TOWER.gold.y, 3.78);
  scene.add(frame);
  const goldPlane = new THREE.Mesh(D.track(new THREE.PlaneGeometry(1.7, 2.3)), goldMat);
  goldPlane.position.copy(TOWER.gold); goldPlane.position.z = 3.9;
  scene.add(goldPlane);
  const goldGlow = glowSprite(D, glowTex, 0xffc860, 9, 0.85);
  goldGlow.position.set(TOWER.gold.x, TOWER.gold.y, 4.4);
  scene.add(goldGlow);

  // vent
  scene.add(meshBox(D, 1.5, 1.0, 0.2, D.track(new THREE.MeshBasicMaterial({ color: 0x020304 })), TOWER.vent.x, TOWER.vent.y, 3.02));
  for (let i = -1; i <= 1; i++) scene.add(meshBox(D, 1.5, 0.06, 0.1, mRust, TOWER.vent.x, TOWER.vent.y + i * 0.3, 3.16));

  // distant skyline silhouettes (instanced)
  const NB = 36;
  const bIM = new THREE.InstancedMesh(D.track(new THREE.BoxGeometry(1, 1, 1)), D.track(new THREE.MeshBasicMaterial({ color: 0x0c141b })), NB);
  for (let i = 0; i < NB; i++) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 70, h = 6 + rnd() * 18;
    dummy.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    dummy.rotation.set(0, rnd() * 3, 0); dummy.scale.set(5 + rnd() * 8, h, 5 + rnd() * 8); dummy.updateMatrix();
    bIM.setMatrixAt(i, dummy.matrix);
  }
  bIM.instanceMatrix.needsUpdate = true;
  D.track(bIM);
  scene.add(bIM);

  // distant city lights (instanced emissive quads facing the tower)
  const NL = 300;
  const cityMat = D.track(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true }));
  const cIM = new THREE.InstancedMesh(D.track(new THREE.PlaneGeometry(1, 1)), cityMat, NL);
  for (let i = 0; i < NL; i++) {
    const a = rnd() * Math.PI * 2, r = 50 + rnd() * 100, y = 0.5 + rnd() * rnd() * 11;
    dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    dummy.scale.setScalar(0.35 + r * 0.011);
    dummy.rotation.set(0, 0, 0);
    dummy.lookAt(0, y, 0);
    dummy.updateMatrix();
    cIM.setMatrixAt(i, dummy.matrix);
    const q = rnd();
    if (q < 0.6) col.setRGB(1.5, 0.95, 0.4); else if (q < 0.85) col.setRGB(1.1, 1.2, 1.3); else col.setRGB(0.3, 1.1, 1.2);
    cIM.setColorAt(i, col);
  }
  dummy.scale.set(1, 1, 1);
  cIM.instanceMatrix.needsUpdate = true;
  if (cIM.instanceColor) cIM.instanceColor.needsUpdate = true;
  cIM.frustumCulled = false;
  D.track(cIM);
  scene.add(cIM);

  // moon + sun (discs with glow)
  const moonMat = D.track(new THREE.MeshBasicMaterial({ color: 0xdfe8f0, fog: false, transparent: true }));
  const moon = new THREE.Mesh(D.track(new THREE.CircleGeometry(9, 24)), moonMat);
  moon.position.set(-90, 120, -215); moon.lookAt(0, 0, 0);
  scene.add(moon);
  const moonGlow = glowSprite(D, glowTex, 0x9fc0e0, 70, 0.5);
  moonGlow.position.copy(moon.position);
  scene.add(moonGlow);
  const sunMat = D.track(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  sunMat.color.setRGB(2.0, 1.4, 0.7);
  const sun = new THREE.Mesh(D.track(new THREE.CircleGeometry(14, 28)), sunMat);
  sun.position.set(-50, -10, -230); sun.lookAt(0, 0, 0);
  scene.add(sun);
  const sunGlow = glowSprite(D, glowTex, 0xffa860, 130, 0.0);
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);

  // rain
  let rain = null;
  if (opts.rain !== false) { rain = createRain(D, { count: opts.rainCount || 1000 }); scene.add(rain.object); }

  // state
  let pulseP = 0, goldK = 1, dawnK = 0, blink = 0;
  const tmp = new THREE.Color();
  function applyGold() {
    const k = goldK * (1 + 0.35 * pulseP);
    goldMat.color.setRGB(2.2 * k + 0.12, 1.6 * k + 0.1, 0.5 * k + 0.04);
    goldLight.intensity = 25 * k * (1 + pulseP * 0.6);
    goldGlow.material.opacity = Math.min(1, 0.85 * goldK + 0.15 * pulseP);
    const gs = 9 * (0.6 + 0.4 * goldK) + 2.5 * pulseP;
    goldGlow.scale.set(gs, gs, 1);
  }
  applyGold();

  return {
    scene, sky, rain, sunLight, hemi,
    update(dt, t) {
      if (rain) rain.update(dt);
      blink = Math.sin(t * 3) > 0 ? 1 : 0.12;
      redMat.color.setRGB(blink, 0.2 * blink, 0.25 * blink);
    },
    pulse(p) {
      pulseP = p;
      winMat.color.setScalar(1 + 0.7 * p);
      cityMat.color.setScalar((1 + 0.5 * p));
      hemi.intensity = lerp(0.8, 1.0, dawnK) + 0.15 * p;
      applyGold();
    },
    setGold(k) { goldK = k; applyGold(); },
    dawn(k) {
      dawnK = k;
      sky.top.copy(NIGHT_TOP).lerp(DAWN_TOP, k);
      sky.bottom.copy(NIGHT_BOT).lerp(DAWN_BOT, k);
      scene.fog.color.copy(NIGHT_FOG).lerp(DAWN_FOG, k);
      scene.fog.density = lerp(0.016, 0.009, k);
      hemi.color.copy(NIGHT_HEMI_SKY).lerp(DAWN_HEMI_SKY, k);
      moonLight.intensity = lerp(0.75, 0.25, k);
      sunLight.intensity = 1.5 * k;
      tmp.setRGB(1, 1, 1);
      moonMat.opacity = 1 - k; moonGlow.material.opacity = 0.5 * (1 - k);
      moon.visible = moonGlow.visible = k < 0.99;
      sun.position.y = lerp(-10, 26, smooth(k)); sunGlow.position.copy(sun.position);
      sunGlow.material.opacity = 0.9 * k;
      cityMat.opacity = 1 - 0.75 * k;
    },
  };
}

// ---------- animation helper ----------
export function createAnimator(model, clips) {
  const has = !!(clips && clips.length);
  const mixer = has ? new THREE.AnimationMixer(model) : null;
  const actions = {};
  if (has) for (const c of clips) actions[String(c.name).toLowerCase()] = mixer.clipAction(c);
  let cur = null, curName = null;
  function pick(name) {
    if (actions[name]) return actions[name];
    const k = Object.keys(actions).find((n) => n.includes(name));
    return k ? actions[k] : null;
  }
  return {
    has,
    hasClip: (n) => !!pick(n),
    play(name, strict = false) {
      if (!mixer || name === curName) return;
      curName = name;
      const next = pick(name) || (strict ? null : pick('idle'));
      if (next === cur) return;
      if (next) next.reset().fadeIn(0.2).play();
      if (cur) cur.fadeOut(0.2);
      cur = next;
    },
    update(dt) { if (mixer) mixer.update(dt); },
  };
}

// ---------- crow rig ----------
// root (position / yaw / pitch, scale) > body (procedural bob) > model
export function createCrowRig(scale = 1) {
  const model = getModel('crow');
  const root = new THREE.Group(), body = new THREE.Group();
  body.add(model); root.add(body);
  root.rotation.order = 'YXZ';
  root.scale.setScalar(scale);
  const anim = createAnimator(model, getClips('crow'));
  const wings = [];
  model.traverse((o) => {
    const n = o.name || '';
    if (!/wing/i.test(n)) return;
    if (o.parent && /wing/i.test(o.parent.name || '')) return;
    const left = /wing[_. ]?l/i.test(n);
    const right = /wing[_. ]?r/i.test(n);
    if (left || right) wings.push({ o, base: o.rotation.z, sign: left ? 1 : -1 });
  });
  return {
    root, body, model,
    update(dt, mode, t) {
      anim.play(mode);
      anim.update(dt);
      const flying = mode === 'fly';
      if (!anim.has) {
        const f = flying ? Math.sin(t * 20) : mode === 'caw' ? Math.sin(t * 30) * 0.15 : 0;
        for (const w of wings) w.o.rotation.z = w.base + w.sign * f * 0.9;
        body.position.y = flying ? Math.sin(t * 10) * 0.03 : 0;
        body.rotation.x = mode === 'caw' ? -0.35 * (0.5 + 0.5 * Math.sin(t * 16)) : mode === 'idle' ? Math.sin(t * 1.7) * 0.04 : 0;
        body.rotation.z = flying && !wings.length ? Math.sin(t * 20) * 0.15 : mode === 'idle' ? Math.sin(t * 0.9) * 0.08 : 0;
      }
    },
  };
}

// ---------- mech builder ----------
export function createMech(D, o = {}) {
  const root = getModel('mech');
  const cores = [];
  const core = root.getObjectByName('core_emit');
  if (core) {
    core.traverse((m) => {
      if (m.isMesh && m.material && !Array.isArray(m.material)) { m.material = m.material.clone(); D.track(m.material); cores.push(m.material); }
    });
  }
  if (o.arm) { const s = root.getObjectByName('arm_R_socket'); if (s) s.add(getModel('upg_magnet_arm')); }
  if (o.legs) { const s = root.getObjectByName('leg_mod_socket'); if (s) s.add(getModel('upg_hydraulic_legs')); }
  const seat = root.getObjectByName('pilot_seat') || root;
  const anim = createAnimator(root, getClips('mech'));
  return {
    root, seat, anim,
    setCore(k) {
      for (const m of cores) {
        if (m.emissive) { m.emissive.setHex(0x3ff0ff); m.emissiveIntensity = 0.05 + k * 3.5; }
        else if (m.color) m.color.setHex(0x3ff0ff).multiplyScalar(0.06 + k * 2.2);
      }
    },
  };
}

// ---------- 2D / input / camera helpers ----------
const _v2 = new THREE.Vector2();
export function fitPerspective(cam, r3, baseFov) {
  let w = window.innerWidth, h = window.innerHeight;
  try { if (r3 && r3.renderer) { r3.renderer.getSize(_v2); w = _v2.x; h = _v2.y; } } catch (e) { /* ignore */ }
  const a = w / Math.max(1, h);
  if (Math.abs(a - cam.aspect) > 1e-3 || cam.userData.baseFov !== baseFov) {
    cam.userData.baseFov = baseFov;
    cam.aspect = a;
    cam.fov = a >= 1.2 ? baseFov : Math.min(85, (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) * 1.2 / a) * 180) / Math.PI);
    cam.updateProjectionMatrix();
  }
}

export function letterbox(ctx, view, frac = 0.09) {
  const h = Math.round(view.h * frac);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, view.w, h);
  ctx.fillRect(0, view.h - h, view.w, h);
  return h;
}

export function anyTap(game) {
  const i = game.input;
  try {
    if (i.tap) return true;
    if (i.downs && i.downs.length) return true;
    for (const n of ['act', 'action', 'confirm']) if (i.pressed(n)) return true;
  } catch (e) { /* ignore */ }
  return false;
}

export function onKeys(cb) {
  const h = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Escape' || /^F\d+$/.test(e.key)) return;
    cb();
  };
  window.addEventListener('keydown', h);
  return () => window.removeEventListener('keydown', h);
}

export function dip(t, c, w) { return clamp01(1 - Math.abs(t - c) / w); }
