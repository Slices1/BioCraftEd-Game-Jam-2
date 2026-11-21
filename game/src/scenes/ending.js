// CORVID ending (~20 s + credits): the crow carries the Great Shiny out of the gold window while the tower lights pulse
// on the 174 BPM drum & bass, cut to dawn on the roof: crow on the upgraded mech's seat, shiny hovering. Credits, then tap -> title.
import * as THREE from 'three';
import { getModel } from '../render/assets.js';
import { text } from '../engine/ui.js';
import {
  track, timeline, disposer, buildTowerWorld, TOWER, createCrowRig, createMech, fitPerspective,
  letterbox, anyTap, onKeys, dip, seg, smooth, lerp, ease,
} from './cutscene.js';

const CUT = 9;          // night exterior -> dawn roof
const CREDITS = 15.5;   // credits fade in
const AGAIN = 18.5;     // "tap to play again" allowed
const BPM = 174;
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _look = new THREE.Vector3(), _seat = new THREE.Vector3(), _c = new THREE.Vector3();

export function endingScene(game) {
  const { view, audio, scenes } = game;
  const D = disposer();
  const tl = timeline();
  let t = 0, done = false, stopKeys = null;
  let world = null, cam = null, camTrack = null, crow = null, mech = null, shiny = null;
  let curveA = null, curveB = null;

  function say(id) { try { if (game.voice) game.voice.say(id); } catch (e) { /* ignore */ } }
  function again() { if (done) return; done = true; scenes.go('title', {}, { fade: 0.6 }); }
  function press() {
    if (t < 0.45) return;
    if (t >= AGAIN) again();
    else if (t < CREDITS - 0.5) t = CREDITS - 0.5; // skip ahead to the credits
  }

  function beatPulse() {
    let ct = t;
    try {
      const mt = typeof audio.musicTime === 'function' ? audio.musicTime() : audio.musicTime;
      if (typeof mt === 'number' && mt > 0) ct = mt;
    } catch (e) { /* ignore */ }
    const ph = (ct * BPM / 60) % 1;
    return Math.exp(-ph * 4);
  }

  function update3D(dt) {
    fitPerspective(cam, game.r3, 52);
    const night = t < CUT;
    const p = beatPulse();
    world.dawn(smooth(seg(t, CUT, 13)));
    world.setGold(night ? 1 - 0.55 * seg(t, 2.2, 4) : 0.2);
    world.pulse(night ? p : p * 0.35);
    world.update(dt, t);

    // mech on the roof
    mech.setCore(0.9 + 0.5 * (night ? 0 : p));
    mech.anim.play('idle');
    mech.anim.update(dt);
    mech.root.updateMatrixWorld(true);
    mech.seat.getWorldPosition(_seat);

    // crow + shiny
    const r = crow.root;
    let mode = 'fly', vis = true, sc = 1.6, shSc = 1.2;
    const off = _c;
    if (t < 1.8) {
      vis = false;
      r.position.copy(curveA.getPoint(0));
    } else if (t < CUT) {
      const u = ease.inOut(seg(t, 1.8, 8.8));
      curveA.getPoint(Math.min(u, 0.999), _p);
      curveA.getPoint(Math.min(u + 0.01, 1), _q);
      const dx = _q.x - _p.x, dy = _q.y - _p.y, dz = _q.z - _p.z;
      r.position.copy(_p);
      r.rotation.set(Math.atan2(-dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
      off.set(0, -0.6, 0.1);
    } else {
      sc = 1.15; shSc = 0.8;
      const u = ease.inOut(seg(t, CUT + 0.1, 11.6));
      if (u < 1) {
        curveB.getPoint(Math.min(u, 0.999), _p);
        curveB.getPoint(Math.min(u + 0.01, 1), _q);
        const dx = _q.x - _p.x, dy = _q.y - _p.y, dz = _q.z - _p.z;
        const fin = seg(u, 0.9, 1);
        _p.lerp(_seat, smooth(fin));
        r.position.copy(_p);
        r.rotation.set(lerp(Math.atan2(-dy, Math.hypot(dx, dz)), 0, fin), lerp(Math.atan2(dx, dz), mech.root.rotation.y, fin), 0, 'YXZ');
      } else {
        mode = 'idle';
        r.position.copy(_seat);
        r.rotation.set(0, mech.root.rotation.y + 0.1 * Math.sin(t * 1.3), 0, 'YXZ');
      }
      const hv = smooth(seg(t, 11.4, 12.8));
      off.set(lerp(0, 0.62, hv), lerp(-0.5, 0.5, hv), lerp(0, 0.38, hv));
    }
    r.visible = vis;
    r.scale.setScalar(sc);
    crow.update(dt, mode, t);
    shiny.visible = vis;
    shiny.scale.setScalar(shSc);
    shiny.position.copy(r.position).add(off);
    shiny.rotation.y = t * (t < CUT ? 2.4 : 1.2);

    // camera
    camTrack.sample(t, _p, _look);
    if (!night) _p.x += 0.35 * Math.sin(t * 0.3);
    cam.position.copy(_p);
    cam.lookAt(_look);
    world.sky.follow(cam);
  }

  return {
    pausable: false,
    enter() {
      if (game.r3) { game.r3._exp = game.r3.renderer.toneMappingExposure; game.r3.renderer.toneMappingExposure = 0.7; }
      world = buildTowerWorld(D, { rain: false });
      cam = new THREE.PerspectiveCamera(52, 1.6, 0.1, 700);
      camTrack = track([
        { t: 0, pos: [-3.5, 13.8, 12], look: [-1.2, 13.5, 3.8] },
        { t: 4, pos: [-5, 14.5, 15], look: [-1.2, 14.5, 6] },
        { t: 8.8, pos: [-4, 20, 14], look: [0, 22, 6] },
        { t: 9.0, pos: [5.6, 24.5, 4.2], look: [-0.3, 24.0, 0] },
        { t: 22, pos: [4.4, 24.7, 3.4], look: [-0.3, 24.1, 0.1] },
      ], 'linear');
      // roof: upgraded mech looking out over the city, crow on its seat
      mech = createMech(D, { arm: true, legs: true });
      mech.root.position.set(-0.5, TOWER.roofY, 0.3);
      mech.root.rotation.y = Math.PI - 0.6;
      world.scene.add(mech.root);
      mech.root.updateMatrixWorld(true);
      mech.seat.getWorldPosition(_seat);
      crow = createCrowRig(1.6);
      world.scene.add(crow.root);
      shiny = getModel('great_shiny');
      world.scene.add(shiny);
      curveA = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.2, 13.6, 3.5), new THREE.Vector3(-1.2, 14.0, 6.0), new THREE.Vector3(-2.0, 15.5, 9.5),
        new THREE.Vector3(0.5, 19.5, 9.0), new THREE.Vector3(3.5, 24.0, 6.5), new THREE.Vector3(5.2, 26.5, 5.0),
      ]);
      curveB = new THREE.CatmullRomCurve3([
        new THREE.Vector3(10, 28, 10), new THREE.Vector3(6, 26.4, 6.5), new THREE.Vector3(2.6, 25.4, 3.2),
        _seat.clone().add(new THREE.Vector3(0, 0.15, 0)),
      ]);

      tl.at(1.5, () => say('vo_win1'));
      tl.at(9.2, () => say('vo_win2'));
      tl.at(CUT + 0.5, () => { try { audio.play('win'); } catch (e) { /* ignore */ } });
      try { audio.music('dnb', { fade: 0.5 }); } catch (e) { /* ignore */ }
      stopKeys = onKeys(press);
      if (game.r3) game.r3.setView(world.scene, cam);
    },
    exit() {
      if (game.r3 && game.r3._exp) game.r3.renderer.toneMappingExposure = game.r3._exp;
      if (stopKeys) stopKeys(); stopKeys = null;
      D.dispose();
      world = null;
    },
    update(dt) {
      if (!world) return;
      t += dt;
      if (anyTap(game)) press();
      tl.update(t);
      update3D(dt);
    },
    render(ctx) {
      let black = Math.max(1 - seg(t, 0, 0.8), dip(t, CUT - 0.1, 0.35));
      if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, view.w, view.h); }
      const bar = letterbox(ctx, view, 0.09);
      const ca = smooth(seg(t, CREDITS, CREDITS + 1.2));
      if (ca > 0) {
        ctx.fillStyle = `rgba(0,0,0,${0.5 * ca})`;
        ctx.fillRect(0, bar, view.w, view.h - bar * 2);
        const k = view.isPortrait ? 0.8 : 1;
        const mw = view.w - 80;
        const cx = view.w / 2;
        const lines = [
          { s: 'CORVID', size: 92, color: '#ffcc44', gap: 70 },
          { s: 'made for BioCraftEd Game Jam #2', size: 34, color: '#ffffff', gap: 44 },
          { s: 'keyword: symbiosis', size: 30, color: '#3ff0ff', gap: 70 },
          { s: 'AI tools used', size: 26, color: '#b9c4c8', gap: 42 },
          { s: 'Claude Code', size: 32, color: '#ffffff', gap: 40 },
          { s: 'ElevenLabs (sound effects, music, narration)', size: 32, color: '#ffffff', gap: 40 },
          { s: 'Blender (models built via Claude)', size: 32, color: '#ffffff', gap: 0 },
        ];
        let total = 0;
        for (const l of lines) total += l.gap * k;
        let y = view.h / 2 - total / 2 - 20 * k;
        for (const l of lines) {
          text(ctx, l.s, cx, y, { size: l.size * k, color: l.color, alpha: ca, outline: 5, maxWidth: mw });
          y += l.gap * k;
        }
        if (t >= AGAIN) {
          const a = 0.55 + 0.45 * Math.sin(t * 4);
          text(ctx, view.isTouch ? 'Tap to play again' : 'Tap / any key to play again', cx, view.h - bar - 60 * k, { size: 34 * k, color: '#ffcc44', alpha: a * ca, outline: 5, maxWidth: mw });
        }
      } else if (t > 1) {
        const sf = view.safe || {};
        text(ctx, view.isTouch ? 'Tap to skip' : 'Tap / any key to skip', (sf.left || 0) + 24, bar + 30, { size: 22, align: 'left', color: '#fff', alpha: 0.45, outline: 4 });
      }
    },
  };
}
