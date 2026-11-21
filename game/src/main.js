// Boot: view, input, audio, loop, fx, scenes, pause menu, HTML overlay/HUD wiring.
// URL flags (handy for testing): ?scene=play  ?autostart (skip the start overlay)  ?touch (force
// on-screen controls)  ?debug (fps / pointer overlay). `window.game` is exposed for the console.

import { createView } from './engine/view.js';
import { createInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createLoop } from './engine/loop.js';
import { createScenes } from './engine/scenes.js';
import { createJuice } from './engine/juice.js';
import { createPause } from './engine/pause.js';
import { storage, highscore } from './engine/storage.js';
import { text } from './engine/ui.js';
import { titleScene } from './scenes/title.js';
import { playScene } from './scenes/play.js';
import { introScene } from './scenes/intro.js';
import { endingScene } from './scenes/ending.js';
import { registerSynthSfx } from './audio/sfxr.js';
import { initSoundtrack } from './game/soundtrack.js';
import { createR3 } from './render/r3.js';
import { loadAssets } from './render/assets.js';
import { createVoice } from './story/voice.js';

export const CONFIG = {
  id: 'corvid',                 // localStorage namespace: change per game
  title: 'CORVID',
  design: { width: 720, height: 1280, mode: 'expand', autoRotate: true }, // landscape screens get 1280x720
  background: '#16161d',
  firstScene: 'title',
  menuScene: 'title',
};

// File-based sounds (missing files only warn). Values may be arrays for random variations.
// Procedural sounds from src/audio/* should be registered in setupAudio() below.
const SOUND_FILES = {
  // music: 'assets/music.mp3',
  // hit: ['assets/hit1.ogg', 'assets/hit2.ogg'],
};

function setupAudio(audio) {
  try { registerSynthSfx(audio); } catch (e) { console.warn('[audio] synth sfx failed', e); } // fallback, real files override
  audio.config('pickup', { pitchVar: 0.1 });
  audio.config('step', { cooldown: 0.12 });
  audio.config('flap', { cooldown: 0.1 });
  let p = Promise.resolve();
  try {
    p = fetch('assets/audio-index.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((idx) => {
        const map = {};
        for (const [id, v] of Object.entries(idx.ids || {})) {
          const f = (x) => (idx.base || 'assets/') + x;
          map[id] = Array.isArray(v) ? v.map(f) : f(v);
        }
        return audio.load(map);
      }).catch((e) => { console.warn('[audio] index load failed', e); });
  } catch (e) { /* ignore */ }
  initSoundtrack(audio, p);
  return p;
}

function bindDefaults(input) {
  input.bind('action', { keys: ['Space', 'KeyJ', 'KeyZ', 'KeyX'], touch: 'buttonA', mouse: 0, pad: [0, 2] });
  // CORVID gameplay actions
  input.bind('act', { keys: ['KeyE', 'Enter', 'NumpadEnter', 'KeyJ'], touch: 'buttonA', pad: [0] }); // no mouse: clicks move
  input.bind('swap', { keys: ['KeyQ', 'ShiftLeft', 'ShiftRight', 'KeyK'], touch: 'buttonB', pad: [1] });
  input.bind('reset', { keys: ['KeyR'], touch: 'buttonR', pad: [3] });
  input.bind('debugNext', { keys: ['BracketRight'] });
  input.bind('confirm', { keys: ['Enter', 'NumpadEnter', 'Space'], pad: [0] });
  input.bind('back', { keys: ['Backspace'], pad: [1] });
  input.bind('pause', { keys: ['Escape', 'KeyP'], pad: [9] });
  input.bind('ui_up', { keys: ['ArrowUp', 'KeyW'], pad: [12] });
  input.bind('ui_down', { keys: ['ArrowDown', 'KeyS'], pad: [13] });
  input.bind('ui_left', { keys: ['ArrowLeft', 'KeyA'], pad: [14] });
  input.bind('ui_right', { keys: ['ArrowRight', 'KeyD'], pad: [15] });
}

// ---------------------------------------------------------------------------------------
const params = new URLSearchParams(location.search);
storage.setPrefix(CONFIG.id + ':');

const canvas = document.getElementById('game');
const glCanvas = document.getElementById('gl');
const ctx = canvas.getContext('2d', { alpha: true }) || canvas.getContext('2d');
const view = createView(canvas, { ...CONFIG.design, background: 'transparent' });
if (params.has('touch')) view.isTouch = true;
const input = createInput(canvas, view);
const audio = createAudio();
bindDefaults(input);
input.enabled = false; // until the start overlay is dismissed

const game = {
  config: CONFIG, params, canvas, ctx, view, input, audio, storage,
  best: highscore('best'),
  started: false,
  debug: params.has('debug'),
  state: {}, // free-form shared state for game modules
};
game.glCanvas = glCanvas;
game.r3 = null;
let hasView = false; // true once the current scene called r3.setView(scene, camera)
try {
  const r3 = createR3(glCanvas, { isTouch: !!view.isTouch });
  const rawSetView = r3.setView.bind(r3);
  r3.setView = (s, c) => { hasView = !!(s && c); glCanvas.style.visibility = hasView ? 'visible' : 'hidden'; return rawSetView(s, c); };
  game.r3 = r3;
} catch (e) { console.error('[main] WebGL init failed', e); }
glCanvas.style.visibility = 'hidden';
game.voice = createVoice(game);
game.loop = createLoop({ update, render });
game.fx = createJuice({ view, loop: game.loop });
game.scenes = createScenes(game, {
  onSwitch(scene) {
    hasView = false; glCanvas.style.visibility = 'hidden'; // a scene that wants 3D calls r3.setView in enter()
    game.fx.reset(); input.setTouchControls(scene.touch || null);
  },
});
game.pause = createPause(game, { menuScene: CONFIG.menuScene });
game.loop.onAutoPause = () => game.pause.open();
window.game = game;

function update(dt) {
  input.update();
  if (input.pressed('pause')) game.pause.toggle();
  if (game.pause.active) { game.pause.update(game.loop.step); return; }
  game.scenes.update(dt, game.loop.step);
  game.voice.update(dt);
  game.fx.update(dt);
}

let lastFrame = 0, glWarned = false;
function render() {
  view.check();
  const now = performance.now();
  const frameDt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 1 / 60;
  lastFrame = now;
  if (game.r3 && hasView) {
    try { game.r3.render(frameDt); } catch (e) { if (!glWarned) { glWarned = true; console.error('[main] r3.render failed', e); } }
  }
  view.begin(ctx);
  ctx.save();
  game.scenes.render(ctx);
  ctx.restore();
  ctx.save(); // subtitles must not inherit a scene's leftover alpha / transform
  game.voice.drawSubtitles(ctx, view);
  ctx.restore();
  game.fx.drawScreen(ctx);
  if (!game.pause.active) input.renderTouch(ctx);
  game.pause.render(ctx);
  game.scenes.renderTransition(ctx, view);
  if (game.debug) drawDebug(ctx);
  view.end(ctx);
  syncHud();
}

function drawDebug(c) {
  const l = game.loop;
  const lines = [
    `${l.fps.toFixed(0)} fps  ${view.w.toFixed(0)}x${view.h.toFixed(0)} @${view.scale.toFixed(2)} dpr${view.dpr}`,
    `scene ${game.scenes.name}  device ${input.lastDevice}  touch ${view.isTouch}`,
    `pointers ${input.pointers.length}  particles ${game.fx.particles.count}  audio ${audio.state}`,
  ];
  if (l.errors) lines.push(`ERRORS ${l.errors}: ${l.lastError && l.lastError.message}`);
  lines.forEach((s, i) => text(c, s, view.safe.left + 12, view.safe.top + 70 + i * 26,
    { size: 20, align: 'left', outline: 3, color: i === 3 ? '#ff6b6b' : '#9f9' }));
}

// ---- HTML overlay + HUD buttons ------------------------------------------------------------
const startEl = document.getElementById('start');
const pauseBtn = document.getElementById('btn-pause');
const muteBtn = document.getElementById('btn-mute');
const fsBtn = document.getElementById('btn-fs');

function showStart() {
  document.getElementById('start-title').textContent = CONFIG.title;
  document.getElementById('start-hint').textContent = view.isTouch ? 'Tap to start' : 'Click or press any key to start';
  startEl.hidden = false;
}

function startGame(e) {
  if (game.started) return;
  if (e && e.type === 'keydown') {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || e.key === 'Tab') return;
    e.preventDefault();
    e.stopImmediatePropagation(); // this key must not also reach the game
  }
  if (e) audio.unlock(); // inside the user gesture: required by iOS / autoplay policies
  game.started = true;
  startEl.hidden = true;
  input.clear();
  input.enabled = true;
  try { window.focus(); } catch (err) { /* ignore */ }
}
startEl.addEventListener('pointerup', startGame);
startEl.addEventListener('click', startGame);
window.addEventListener('keydown', (e) => { if (!game.started && !startEl.hidden) startGame(e); }, true);

pauseBtn.addEventListener('click', () => { game.pause.open(); pauseBtn.blur(); });
let pauseVisible = null;
function syncHud() {
  const vis = game.pause.canPause && !game.pause.active;
  if (vis !== pauseVisible) { pauseVisible = vis; pauseBtn.hidden = !vis; }
}

const syncMute = () => {
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
};
muteBtn.addEventListener('click', () => { audio.unlock(); audio.toggleMute(); muteBtn.blur(); });
audio.onMute(syncMute);
syncMute();

const de = document.documentElement;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsSupported = !!(de.requestFullscreen || de.webkitRequestFullscreen) &&
  !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); // false on iPhone / iframes without allow
if (fsSupported) {
  fsBtn.hidden = false;
  const syncFs = () => fsBtn.setAttribute('aria-pressed', String(!!fsElement()));
  fsBtn.addEventListener('click', () => {
    try {
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const r = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' });
        if (r && r.catch) r.catch(() => {});
      }
    } catch (err) { /* ignore */ }
    fsBtn.blur();
  });
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);
}

// Page-level guards: no context menu, no pinch / double-tap zoom, no rubber-band scrolling.
const prevent = (e) => { if (e.cancelable) e.preventDefault(); };
document.addEventListener('contextmenu', prevent);
document.addEventListener('dblclick', prevent);
document.addEventListener('touchmove', prevent, { passive: false });
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, prevent, { passive: false });

// ---- Boot ----------------------------------------------------------------------------------
async function boot() {
  game.scenes.add('title', titleScene).add('play', playScene).add('intro', introScene).add('ending', endingScene);
  let audioReady = Promise.resolve();
  try { audioReady = setupAudio(audio) || audioReady; } catch (e) { console.error('[main] setupAudio failed', e); }
  audioReady.then(() => game.voice.preload()).catch(() => {});
  // 3D assets (GLB with procedural fallbacks) before the first scene; never fail or block boot for long.
  try {
    await Promise.race([Promise.resolve().then(() => loadAssets()).catch((e) => console.warn('[main] loadAssets failed', e)),
      new Promise((r) => setTimeout(r, 5000))]);
  } catch (e) { console.warn('[main] loadAssets failed', e); }
  const want = params.get('scene');
  game.scenes.go(want && game.scenes.has(want) ? want : CONFIG.firstScene, {}, { fade: params.has('autostart') ? 0 : 0.6 });
  game.loop.start();
  // Wait for optional sound files, but never block the start screen for long.
  await Promise.race([audio.load(SOUND_FILES), new Promise((r) => setTimeout(r, 5000))]);
  window.__gameBooted = true;
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  if (params.has('autostart')) startGame();
  else showStart();
}

boot().catch((e) => {
  console.error('[main] boot failed', e);
  if (window.__bootFail) window.__bootFail('Error: ' + e.message);
});
