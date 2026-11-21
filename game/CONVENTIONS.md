# Game kit conventions (read before editing)

Plain ES modules, Canvas 2D, no build step, no npm. Serve the folder statically (`./serve.sh`, port 8123).
Judges play on phones (iOS Safari, Android Chrome) AND laptops: every feature must work with touch AND keyboard/mouse.

## Layout & ownership
- `index.html` canvas, loading/start overlay, HTML HUD (pause / mute / fullscreen, top-right). `src/main.js` boot, CONFIG, default bindings.
- `src/engine/*` shared engine: loop, view, input, audio, scenes, juice, ui, storage, util, pause. Edit only for engine bugs, keep APIs stable.
- `src/scenes/*` scenes (title/play/gameover are a DEMO, replace freely). `src/audio/*` + `tools/*` belong to the audio agent.
- **Each game feature lives in its own file under `src/game/`** (e.g. `src/game/enemies.js`, `src/game/level.js`). One owner per file;
  integrate through small exported functions/classes, never by editing someone else's file. Shared state: `game.state`.
- Relative paths only (no leading `/`). Assets go in `assets/`. `./build.sh` makes `../dist/game.zip` (fails on absolute paths / >25 MB).

## The `game` object (passed to scene factories; also `window.game` for the console)
`view, input, audio, loop, fx, scenes, pause, storage, best (highscore), config, params, state, started`.

## Coordinates
Draw in logical units after `view.begin` (main does it). Design is 720x1280, auto-rotated to 1280x720 on landscape screens, mode
`expand`: the short axis is always >= 720 units, the long axis grows. **Never hardcode the screen size: use `view.w`/`view.h`**,
`view.isPortrait`, `view.safe.{top,right,bottom,left}` (notch insets). Keep HUD text out of the top-right ~170x60 CSS px (HTML buttons).
World space: `fx.camera.begin(ctx)` ... `fx.camera.end(ctx)`; `fx.camera.screenToWorld(x, y)` for pointers.

## Add a scene
```js
// src/scenes/shop.js
export function shopScene(game) {                 // factory: fresh state every visit
  return {
    pausable: true,                               // Esc / P / pause button allowed
    touch: { joystick: true, buttons: [{ id: 'buttonA', label: 'JUMP' }, { id: 'buttonB', label: 'B' }] }, // or omit = none
    enter(params) {}, exit() {},
    update(dt) {},                                // fixed 60 Hz, dt already * timeScale
    render(ctx) {},                               // logical units
  };
}
// main.js boot(): game.scenes.add('shop', shopScene);   switch: game.scenes.go('shop', {level: 2}, {fade: 0.4})
```
`scenes.restart()` re-enters the current scene. Touch controls/fx are reset on every switch.

## Input
```js
input.bind('jump', { keys: ['Space', 'KeyW', 'ArrowUp'], touch: 'buttonA', mouse: 0, pad: [0] }); // touch: 'screen' = any free touch
input.pressed('jump'); input.down('jump'); input.released('jump');   // edges are per fixed step, never lost
input.axis('x'); input.stick();       // WASD/arrows + gamepad + virtual joystick, stick() is length-normalized
input.tap; input.swipe?.dir; input.holds; input.pointers; input.downs; input.ups; input.mouse; input.lastDevice
```
Defaults (main.js): `action` (Space/J/Z/X, buttonA, left click), `confirm` (Enter/Space), `back`, `pause` (Esc/P), `ui_up/down/left/right`.
Rules: no hover-only or right-click-only actions; on-screen buttons only show on touch devices (`view.isTouch`).

## Audio (silent until the first tap/click/key; missing sounds only warn once)
```js
audio.play('hit', { volume: 0.8, pitchVar: 0.1, pan: 0, rate: 1 });   // 'hit_1', 'hit_2' auto-variations; arrays allowed
audio.register('blip', audioBuffer, { cooldown: 0.05, maxVoices: 4 }); audio.load({ boom: 'assets/boom.mp3' });
audio.music('theme', { fade: 1 }); audio.music(null); audio.duck(0.6, 500);
audio.ctx / audio.musicBus / audio.sfxBus                            // schedule your own nodes
```
Wire procedural sounds in `setupAudio()` in main.js. Demo names: pickup dash hit lose win powerup ui_click ui_confirm music.

## Juice (`game.fx`)
```js
fx.burst('sparks' | 'dust' | 'confetti', x, y, { count, color, speed: [a, b] });  fx.particles.emit(x, y, opts)
fx.popup('+10', x, y, { color, size });  fx.shake.add(0.3);  fx.hitstop(0.08);  fx.flash('#fff', 0.15)
fx.tween(obj, { x: 100 }, 0.4, { ease: 'backOut', yoyo, repeat, delay, onDone });  fx.camera.follow(obj, 8).setBounds(0, 0, W, H)
```
Draw particles/popups with `fx.drawWorld(ctx)` (inside the camera for world space). UI: `text()`, `Button`, `Menu`, `menuLayout()` in
`engine/ui.js`; Menu handles tap, mouse and keyboard/gamepad focus. Storage: `storage.get/set` (namespaced, never throws), `game.best.submit(score)`.
Helpers: `engine/util.js` (clamp, lerp, damp, createRng(seed), pick, aabb, circleCircle, circleRect, angleDiff, ...).

## Testing (required before handing off)
```sh
for f in src/main.js src/engine/*.js src/scenes/*.js src/game/*.js; do [ -f "$f" ] && node --check "$f"; done
python3 -m http.server 8123 --bind 127.0.0.1 &   # or ./serve.sh ; kill it afterwards
chromium --headless=new --disable-gpu --enable-logging=stderr --v=0 --virtual-time-budget=4000 --window-size=390,844 \
  --screenshot=/tmp/claude-1000/kit-portrait.png "http://localhost:8123/?autostart&scene=play&touch" 2>&1 | grep -iE "uncaught|error|CONSOLE"
#   ...and again with --window-size=1280,720. Then look at the PNGs.
```
URL flags: `?scene=<name>` start scene, `?autostart` skip start overlay, `?touch` force touch UI, `?debug` fps/pointer/error overlay.
Headless note: with `--virtual-time-budget` rAF barely ticks, so use the flags to reach a state; check `game.loop.errors === 0`.
