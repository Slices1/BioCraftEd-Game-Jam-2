// CORVID intro (~25 s, skippable): rainy night exterior -> push in on the gold window -> crow on the antenna (caw)
// -> dive into the vent -> cut to the dark interior: the crow lands on the slumped mech's seat, the core boots cyan -> play.
import * as THREE from 'three';
import { getModel } from '../render/assets.js';
import { text } from '../engine/ui.js';
import {
  track, timeline, disposer, buildTowerWorld, TOWER, createCrowRig, createMech, fitPerspective,
  letterbox, anyTap, onKeys, dip, seg, smooth, lerp, ease,
} from './cutscene.js';

const DUR = 25;
const CUT = 18; // exterior -> interior
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _look = new THREE.Vector3(), _seat = new THREE.Vector3();

function safeModel(name) { try { return getModel(name); } catch (e) { return null; } }

export function introScene(game) {
  const { view, audio, scenes } = game;
  const D = disposer();
  const tl = timeline();
  let t = 0, done = false, stopKeys = null;
  let world = null, extCam = null, extTrack = null, extCrow = null, divePath = null;
  let inScene = null, inCam = null, inTrack = null, inCrow = null, mech = null, coreLight = null;
  let curView = '';

  function say(id) { try { if (game.voice) game.voice.say(id); } catch (e) { /* ignore */ } }
  function go() { if (done) return; done = true; scenes.go('play', {}, { fade: 0.7 }); }
  function skip() { if (t >= 0.45) go(); }

  function buildInterior() {
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x05080b);
    sc.fog = new THREE.Fog(0x05080b, 6, 20);
    const mk = (c) => D.track(new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 }));
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(D.track(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); sc.add(b); return b; };
    const wall = mk(0x232d33), floor = mk(0x1b2227), rust = mk(0x4a2a20);
    box(16, 0.2, 16, floor, 0, -0.1, 0);
    box(16, 7, 0.4, wall, 0, 3.5, -5);
    box(0.4, 7, 16, wall, -6, 3.5, 0);
    box(0.4, 7, 16, wall, 6, 3.5, 0);
    for (const px of [-4.6, 4.2]) box(0.6, 7, 0.6, rust, px, 3.5, -4.6);
    const pipe = new THREE.Mesh(D.track(new THREE.CylinderGeometry(0.12, 0.12, 14, 6)), rust);
    pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 5.2, -4.7); sc.add(pipe);
    box(2.6, 0.15, 2.6, mk(0x2a3238), 0, 0.075, 0.1); // cradle
    // vent the crow comes through (cool light)
    const ventMat = D.track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ventMat.color.setRGB(0.7, 1.1, 1.4);
    const vent = new THREE.Mesh(D.track(new THREE.PlaneGeometry(1.6, 1.0)), ventMat);
    vent.position.set(-3, 3.2, -4.78); sc.add(vent);
    for (let i = -1; i <= 1; i++) box(1.6, 0.07, 0.08, mk(0x10161a), -3, 3.2 + i * 0.28, -4.72);
    // lights
    sc.add(new THREE.HemisphereLight(0x3a5568, 0x120c0a, 0.6));
    const spot = new THREE.SpotLight(0x8fb4d0, 60, 14, 0.6, 0.8, 2);
    spot.position.set(-3, 3.2, -4.6); spot.target.position.set(0, 0.8, 0.2);
    sc.add(spot); sc.add(spot.target);
    const lamp = new THREE.PointLight(0xffb35a, 8, 9, 2); lamp.position.set(-3.4, 2.2, -1.8); sc.add(lamp);
    coreLight = new THREE.PointLight(0x3ff0ff, 0, 6, 2); coreLight.position.set(0, 0.95, 0.6); sc.add(coreLight);
    // props (optional models)
    const barrel = safeModel('deco_barrel'); if (barrel) { barrel.position.set(3.4, 0.15, -3.2); sc.add(barrel); }
    const lampM = safeModel('deco_lamp'); if (lampM) { lampM.position.set(-3.6, 0, -2.2); sc.add(lampM); }
    // mech (dormant)
    mech = createMech(D, {});
    mech.root.position.set(0, 0.15, 0);
    sc.add(mech.root);
    mech.setCore(0);
    // crow
    inCrow = createCrowRig(1.35);
    inCrow.root.visible = false;
    sc.add(inCrow.root);
    inCam = new THREE.PerspectiveCamera(50, 1.6, 0.1, 100);
    inTrack = track([
      { t: CUT, pos: [3.3, 2.3, 4.4], look: [0, 0.9, 0] },
      { t: DUR, pos: [1.7, 1.55, 3.1], look: [0, 0.95, 0] },
    ], 'smooth');
    return sc;
  }

  function setView(which) {
    if (curView === which) return;
    curView = which;
    if (game.r3) game.r3.setView(which === 'ext' ? world.scene : inScene, which === 'ext' ? extCam : inCam);
  }

  function updateExterior(dt) {
    fitPerspective(extCam, game.r3, 52);
    world.update(dt, t);
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.4);
    world.pulse(breathe * (0.4 + 0.6 * seg(t, 4, 9)));
    extTrack.sample(t, _p, _look);
    // crow
    let mode = 'idle', vis = true;
    const r = extCrow.root;
    if (t < 13.6) {
      r.position.copy(TOWER.perch);
      r.rotation.set(0, 0.9, 0, 'YXZ');
      if (t >= 12.2 && t < 13.4) mode = 'caw';
    } else {
      const u = ease.in(seg(t, 13.6, 17.5));
      divePath.getPoint(Math.min(u, 0.999), _q);
      const q2 = divePath.getPoint(Math.min(u + 0.012, 1));
      const dx = q2.x - _q.x, dy = q2.y - _q.y, dz = q2.z - _q.z;
      r.position.copy(_q);
      r.rotation.set(Math.atan2(-dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
      mode = 'fly';
      vis = u < 0.985;
      if (vis) _look.lerp(_q, 0.8 * seg(t, 13.6, 14.4));
    }
    r.visible = vis;
    extCrow.update(dt, mode, t);
    extCam.position.copy(_p);
    extCam.lookAt(_look);
    world.sky.follow(extCam);
  }

  function updateInterior(dt) {
    fitPerspective(inCam, game.r3, 52);
    // mech boot
    const boot = smooth(seg(t, 22.3, 23.6));
    mech.setCore(boot);
    const nm = t < 22.3 ? 'off' : t < 23.8 ? 'boot' : 'idle';
    mech.anim.play(nm, nm !== 'idle');
    mech.anim.update(dt);
    const slump = mech.anim.hasClip('off') ? 0 : 1 - boot;
    mech.root.rotation.set(0.12 * slump, 0, 0.1 * slump);
    mech.root.position.y = 0.15 + Math.sin(t * 2) * 0.01 * boot;
    const flash = Math.max(0, 1 - Math.abs(t - 23.0) / 0.4);
    coreLight.intensity = boot * 7 + flash * 14;
    mech.root.updateMatrixWorld(true);
    mech.seat.getWorldPosition(_seat);
    // crow flight: vent -> seat (quadratic bezier)
    const e = smooth(seg(t, 18.4, 21.8));
    inCrow.root.visible = t >= 18.4;
    let mode = 'fly';
    if (e >= 1) {
      inCrow.root.position.copy(_seat);
      inCrow.root.rotation.set(0, 0.25 + 0.12 * Math.sin(t * 2.5), 0, 'YXZ');
      mode = t > 22.4 && t < 23.2 ? 'caw' : 'idle';
    } else {
      const bez = (k, out) => {
        const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
        out.set(a * -3 + b * -1.2 + c * _seat.x, a * 3 + b * 3.3 + c * _seat.y, a * -4.6 + b * 1.8 + c * _seat.z);
      };
      bez(e, _p); bez(Math.min(1, e + 0.02), _q);
      const dx = _q.x - _p.x, dy = _q.y - _p.y, dz = _q.z - _p.z;
      const fin = seg(e, 0.85, 1);
      inCrow.root.position.copy(_p);
      inCrow.root.rotation.set(lerp(Math.atan2(-dy, Math.hypot(dx, dz)), 0, fin), lerp(Math.atan2(dx, dz), 0.25, fin), 0, 'YXZ');
    }
    inCrow.update(dt, mode, t);
    inTrack.sample(t, _p, _look);
    inCam.position.copy(_p);
    inCam.lookAt(_look);
  }

  return {
    pausable: false,
    enter() {
      world = buildTowerWorld(D, { rain: true, rainCount: 1000 });
      extCam = new THREE.PerspectiveCamera(52, 1.6, 0.1, 700);
      extTrack = track([
        { t: 0, pos: [-16, 5, 28], look: [0, 11, 0] },
        { t: 4.5, pos: [-9, 9, 19], look: [-1, 12.5, 2] },
        { t: 9.5, pos: [-1.4, 13.6, 9], look: [-1.2, 13.5, 3.8], ease: 'out' },
        { t: 11, pos: [-1.4, 13.65, 7.4], look: [-1.2, 13.5, 3.8] },
        { t: 11.01, pos: [4.8, 30.2, 6.2], look: [2, 29.6, -0.5] },
        { t: 13.4, pos: [4.4, 30.3, 5.4], look: [2, 29.5, -0.5] },
        { t: 15.5, pos: [2.5, 26, 9], look: [0, 22, 2] },
        { t: 17.7, pos: [-2.8, 20.5, 8.2], look: [-1.5, 19.5, 3.05] },
        { t: 25, pos: [-2.8, 20.5, 8.2], look: [-1.5, 19.5, 3.05] },
      ], 'linear');
      divePath = new THREE.CatmullRomCurve3([
        TOWER.perch.clone(), new THREE.Vector3(3.2, 28.5, 2.5), new THREE.Vector3(1.0, 25.5, 6.5),
        new THREE.Vector3(-1.8, 21.5, 5.8), TOWER.vent.clone(),
      ]);
      extCrow = createCrowRig(1.7);
      world.scene.add(extCrow.root);
      inScene = buildInterior();

      tl.at(1, () => say('vo_intro1'));
      tl.at(9, () => say('vo_intro2'));
      tl.at(17, () => say('vo_intro3'));
      tl.at(22.3, () => { try { audio.play('jack_in'); } catch (e) { /* ignore */ } });
      tl.at(23.5, () => { try { audio.music(null, { fade: 1.5 }); } catch (e) { /* ignore */ } });

      try { audio.music('menu', { fade: 1 }); } catch (e) { /* ignore */ }
      stopKeys = onKeys(skip);
      world.dawn(0);
      setView('ext');
    },
    exit() {
      if (stopKeys) stopKeys(); stopKeys = null;
      D.dispose();
      world = inScene = null;
    },
    update(dt) {
      if (!world) return;
      t += dt;
      if (anyTap(game)) skip();
      tl.update(t);
      if (t < CUT) { setView('ext'); updateExterior(dt); } else { setView('int'); updateInterior(dt); }
      if (t >= DUR) go();
    },
    render(ctx) {
      // 3D is drawn on the GL canvas below; this is the 2D overlay only.
      let black = 1 - seg(t, 0, 0.8);
      black = Math.max(black, dip(t, 11, 0.3), dip(t, CUT, 0.35), seg(t, DUR - 0.7, DUR));
      if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, view.w, view.h); }
      const flash = Math.max(0, 1 - Math.abs(t - 23.0) / 0.4) * 0.5;
      if (flash > 0) { ctx.fillStyle = `rgba(190,255,255,${flash})`; ctx.fillRect(0, 0, view.w, view.h); }
      const bar = letterbox(ctx, view, 0.09);
      const a = 0.55 + 0.25 * Math.sin(t * 4);
      const sf = view.safe || {};
      text(ctx, view.isTouch ? 'Tap to skip' : 'Tap / any key to skip', (sf.left || 0) + 24, bar + 30, { size: 22, align: 'left', color: '#fff', alpha: a, outline: 4 });
    },
  };
}
