// CORVID title: a slumped mech in a lamp-lit corner (3D, slow orbit) under the logo text.
// Start -> 'intro' cutscene (skippable) -> 'play'.
import * as THREE from 'three';
import { getModel, getClips } from '../render/assets.js';
import { text } from '../engine/ui.js';
import { playMenu } from '../game/soundtrack.js';

export function titleScene(game) {
  const { view, input, audio, scenes, storage } = game;
  const r3 = game.r3;
  let t = 0, started = false;
  let scene3d = null, camera = null, lampLight = null;
  const mixers = [];
  const target = new THREE.Vector3(0, 0.85, 0);
  let aspectW = -1, aspectH = -1;

  function place(name, x, y, z, rotY = 0, scale = 1) {
    let m = null;
    try { m = getModel(name); } catch (e) { m = null; }
    if (!m) return null;
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.scale.setScalar(scale);
    scene3d.add(m);
    return m;
  }

  function play(model, name, clipNames) {
    if (!model) return;
    try {
      const clips = getClips(name) || [];
      const clip = clips.find((c) => clipNames.includes(c.name)) || null;
      if (!clip) return;
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(clip).play();
      mixers.push(mixer);
    } catch (e) { /* animations are optional */ }
  }

  function build() {
    scene3d = new THREE.Scene();
    scene3d.background = new THREE.Color(0x0f1416);
    scene3d.fog = new THREE.Fog(0x0f1416, 9, 22);
    scene3d.add(new THREE.HemisphereLight(0x6fa6a8, 0x4a2a20, 0.9));
    const moon = new THREE.DirectionalLight(0x8fb6c8, 0.5);
    moon.position.set(5, 8, 6);
    scene3d.add(moon);
    lampLight = new THREE.PointLight(0xffb35a, 55, 16, 2);
    lampLight.position.set(-1.4, 2.2, -2.2);
    scene3d.add(lampLight);
    const fill = new THREE.PointLight(0x3ff0ff, 4, 6, 2); // faint cyan from the dormant core
    fill.position.set(0, 1.2, 0.6);
    scene3d.add(fill);

    // floor + two back walls (west and north), so the corner is lit and readable
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      const kind = (x * 7 + z * 3) % 5 === 0 ? 'kit_floor_moss' : (x + z) % 4 === 0 ? 'kit_floor_grate' : 'kit_floor';
      place(kind, x, 0, z);
    }
    for (let i = -3; i <= 3; i++) {
      place('kit_wall', -4, 0, i, Math.PI / 2);
      place('kit_wall', i, 0, -4, 0);
    }
    place('kit_pillar', -3.6, 0, -3.6);
    place('deco_lamp', -1.4, 0, -2.8);
    place('deco_tree', -3, 0, 0.8, 0.6);
    place('deco_barrel', 2.4, 0, -2.6, 0.4);
    place('deco_barrel', 3, 0, -1.6, 1.1);
    place('deco_terminal', -2.9, 0, -1.6, Math.PI / 2);
    place('deco_mushrooms', 1.6, 0, -3, 0.3);
    place('deco_moss', 2.6, 0, 2.2, 0.8);

    const mech = place('mech', 0, 0, 0, Math.PI / 4);
    if (mech) { mech.rotation.x = 0.12; play(mech, 'mech', ['off', 'idle']); } // slumped, dormant
    const crow = place('crow', 2.4, 0.78, -2.6, -Math.PI / 4);
    play(crow, 'crow', ['idle']);

    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    updateCamera(0);
    r3.setView(scene3d, camera);
  }

  function updateCamera() {
    if (!camera) return;
    if (view.cssW !== aspectW || view.cssH !== aspectH) {
      aspectW = view.cssW; aspectH = view.cssH;
      camera.aspect = view.cssW / Math.max(1, view.cssH);
      camera.updateProjectionMatrix();
    }
    const ang = Math.PI / 4 + Math.sin(t * 0.13) * 0.5;
    const dist = view.isPortrait ? 14.5 : 10.5;
    camera.position.set(target.x + Math.sin(ang) * dist, 4.2 + Math.sin(t * 0.21) * 0.3, target.z + Math.cos(ang) * dist);
    camera.lookAt(target.x, target.y + (view.isPortrait ? 0.2 : 0), target.z);
  }

  function go() {
    if (started) return;
    started = true;
    try { audio.play('ui_confirm'); } catch (e) { /* ignore */ }
    // Always play the intro (it is skippable with a tap / any key).
    game.state.carry = null;
    scenes.go('intro', {}, { fade: 0.6 });
  }

  return {
    enter() {
      try { playMenu(); } catch (e) { /* audio optional */ }
      if (r3) { try { build(); } catch (e) { console.error('[title] 3D build failed', e); } }
    },
    exit() { mixers.length = 0; scene3d = null; },
    update(dt) {
      t += dt;
      for (const m of mixers) m.update(dt);
      if (lampLight) lampLight.intensity = 55 + Math.sin(t * 7.3) * 4 + Math.sin(t * 17.1) * 3;
      updateCamera();
      if (started || t < 0.35) return;
      if (input.taps.length || input.downs.length || input.pressed('confirm') || input.pressed('action') || input.pressed('act')) go();
    },
    render(ctx) {
      if (!scene3d) { ctx.fillStyle = '#0f1416'; ctx.fillRect(0, 0, view.w, view.h); }
      // soft top / bottom shading so the text reads over the 3D scene
      const g = ctx.createLinearGradient(0, 0, 0, view.h);
      g.addColorStop(0, 'rgba(8,10,12,0.65)'); g.addColorStop(0.35, 'rgba(8,10,12,0)');
      g.addColorStop(0.75, 'rgba(8,10,12,0)'); g.addColorStop(1, 'rgba(8,10,12,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);

      const cx = view.w / 2;
      const size = Math.min(view.w * 0.2, view.h * 0.2, 190);
      const y = view.safe.top + (view.isPortrait ? view.h * 0.17 : view.h * 0.2);
      text(ctx, 'CORVID', cx, y, { size, color: '#ffcc44', outline: size * 0.07, outlineColor: '#2a1710', weight: 900, shadow: size * 0.05, maxWidth: view.w - 40 });
      text(ctx, 'A crow. A machine. Symbiosis.', cx, y + size * 0.72, { size: Math.max(22, size * 0.17), color: '#e9dcc4', outline: 4, weight: 500, maxWidth: view.w - 40 });
      const pulse = 0.55 + 0.45 * Math.sin(t * 3);
      text(ctx, view.isTouch ? 'Tap to play' : 'Click or press any key to play', cx, view.h - view.safe.bottom - Math.max(90, view.h * 0.12),
        { size: 34, color: '#fff3dc', outline: 5, alpha: pulse, maxWidth: view.w - 40 });
    },
  };
}
