# CORVID 3D rebuild: architecture contract

Read `HANDOVER.md` for the concept and the rules. This file is the contract between the modules, so code to it exactly. Each agent edits ONLY the files it owns. Plain ES modules with no build step. three.js 0.160.0 is vendored and loaded through an import map:
`import * as THREE from 'three'`, `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'` (the files are in `game/vendor/three/`, with addons under `addons/{loaders,postprocessing,shaders,utils,libs}`).
Node is NOT installed, so you can't run `node --check`. Re-read your code carefully for syntax errors. Opus integrates and tests in a browser.

## 0. Frame / layering
- `game/index.html` holds `<canvas id="gl">` (WebGL, behind) under the existing `<canvas id="game">` (2D, transparent overlay for the HUD, touch controls, subtitles and banners). Input listens on the 2D canvas.
- `main.js` keeps the existing loop/scenes/input/audio. Each frame: `game.r3.render(dt)` (3D) runs first, then the 2D overlay draws. `view.background = 'transparent'` means `view.begin` uses `clearRect`.
- Scenes keep the existing scene API (`enter/exit/update(dt)/render(ctx)/touch`). They put 3D content on screen with `game.r3.setView(scene3d, camera)`.

## 1. Coordinates
- Grid: `x` = east (+X in three), `z` = south (+Z in three), `h` = height level (0 floor, 1 raised block or crate top, 2 wall top). 1 tile = 1 three unit. The tile centre is `(x+0.5, h, z+0.5)`.
- Dirs: `N`=(0,-1) `E`=(1,0) `S`=(0,1) `W`=(-1,0) as `{dx,dz}`. Facing is stored as a dir string.
- Iso camera: `OrthographicCamera`, positioned at `target + (1,1,1)*20` and looking at the target (pitch 35.264°, yaw 45°). On screen, N points up-right, E down-right, S down-left and W up-left.
- Keys map directly: W/↑=N, D/→=E, S/↓=S, A/←=W. Joystick: screen vector `(sx, sy)` (with sy pointing down) → `ex=(sx+sy)`, `nz=(sy-sx)`; the axis with the larger |value| wins, and the move fires only when the stick length is >0.5.
- Tap-to-move: raycast the tap against the room's tile meshes, convert the hit to tile (x,z), then follow `logic.pathTo`.

## 2. Logic (`game/src/logic/`; pure JS, no DOM, no three; owner: LOGIC agent)
Files: `rooms.js` (data), `rules.js` (state + step), `solver.js` (BFS), `game/test-logic.html` (runs the solver for every room and prints PASS/FAIL to the page and the console).

### Room data (`rooms.js` exports `ROOMS` array)
```js
{ id:'r1', name:'PLATE & DOOR', music:'factory'|'dnb', banner:'1. PLATE & DOOR',
  map:[ '#########', ... ],           // rows = z, chars = x
  ents:[ {type, id, at:[x,z], ...props} ],
  zones:[ {at:[x0,z0,x1,z1], banner:'2. THE STICK', say:'vo_r2'} ],  // optional mid-room banners / narration
  exit:[x,z],                          // mech (piloted) steps here -> room complete
  start:{ mech:[x,z,'E'], crowInMech:true } , solution:'text' }
```
Map chars: `.` floor h0, `#` wall (h2, blocks everything), `-` raised block (h1), `o` pit (blocks the mech; the crow flies over), `v` vent (wall that only the crow can pass), `~` mossy floor (same as `.`, cosmetic), `g` grate floor (cosmetic), `T` tree trunk through the floor (blocks; cosmetic source of sticks), ` ` = void outside the room.

Entity types (props):
- `plate {id}`: pressed when the mech or a crate is on it. `on` bool.
- `door {id, inputs:[ids], mode:'any'|'all', dir:'x'|'z'}`: open while its inputs are on, OR while it is jammed by a cog (`lockedBy` set). A closed door blocks everything.
- `cog {id, door:'D1'}`: the crow ACTs while adjacent and carrying a stick → `jammed=true`, the stick is consumed, and the door is locked open forever. A cog occupies a tile, is solid, and has h1.
- `stick {id}`: lies on a tile. The crow ACTs on it from the same or an adjacent tile to pick it up, and can carry ≤1. ACT with a stick and no target nearby drops it on the crow's tile.
- `crate {id}`: h1 solid. The crow can fly over it. Only a mech with an arm can move it.
- `console {id, grants:'arm'|'legs'}`: solid. A piloted mech that is adjacent and facing it can ACT "Jack in" → the upgrade is granted permanently (`mech.upgrades[grants]=true`) and `used=true`.
- `laser {id, dir, phase?}`: the emitter tile is solid. The beam runs to the first solid/mech/crate tile. It kills the crow (crow respawns at room start / last checkpoint, carry dropped back at its origin). The mech blocks it. With `beat:[onBeats, period]` it is active only for those beats in the finale.
- `piston {id, beat:[onBeats, period]}`: a tile hazard. While slammed it is solid, and a body on it is pushed back to the room checkpoint.
- `checkpoint {id}`: the crow and mech respawn here.
- `shiny {id}`: the crow ACTs adjacent → `state.won=true`.
- `deco {model}`: cosmetic, ignored by the logic.

### Bodies / rules
- `state.mech = {x,z,h,dir,upgrades:{arm:false,legs:false}, grab:null|crateId}`, `state.crow={x,z,inMech,carry:null|stickId}`, `state.control = 'crow'|'mech'`. When the crow is in the mech, control is 'mech' and crow.x/z mirror the mech.
- The **mech** moves 1 tile onto a free tile of equal height, or 1 lower (it drops down). It moves UP 1 level only with `legs` (a "hop"). It can't enter walls, pits, vents, closed doors or solid entities. It stands on plates.
- **Arm:** while adjacent to and facing a crate, ACT = "Grab" (sets `grab`). While grabbing, the crate keeps its offset: moving forward pushes it and moving back pulls it, as long as both destination tiles are free. Sideways moves are blocked while grabbing. ACT again = "Release". With no arm, a crate is just solid.
- **Crow:** moves 1 tile into any tile with h≤1 that isn't a wall or a closed door (vents are OK, pits are OK). It can't press plates. Laser = death.
- **SWAP button:** crow in mech → "Hop out" (the crow pops to the mech's tile, control → crow, the mech stays put and keeps pressing plates). When the crow is on or adjacent to the mech → "Pilot" (enter).
- The room is complete when the mech, piloted, stands on `exit`.
- `step(state, action)` where `action` = `{type:'move',dir}` | `{type:'act'}` | `{type:'swap'}`. It mutates the state, returns true if anything changed, and pushes events to `state.events` (`{type:'move',who,from,to}`, `'plate_on'/'plate_off'(id)`, `'door_open'/'door_close'(id)`, `'jam'(id)`, `'pickup'/'drop'(id)`, `'graft'(part)`, `'grab'/'release'`, `'death'`, `'hop'`, `'swap'(to)`, `'zone'(index)`, `'complete'`, `'won'`, `'bump'`). The consumers clear `state.events` after reading them each frame.
- `tick(state, beatIndex)`: the finale only. It updates beat hazards and may push `death`/`pushed` events.
- `actions(state) -> {act:'Jam stick'|'Pick up'|'Drop'|'Jack in'|'Grab'|'Release'|'Take the Shiny'|null, swap:'Hop out'|'Pilot'|null}`: a button is shown only when it isn't null.
- `pathTo(state, x, z) -> [dirs]`: BFS for the controlled body using the move rules (no grab).
- `createState(roomIndex, carry={upgrades})` builds a fresh state and `clone(state)`. Reset room = `createState(sameIndex, carryAtRoomEntry)`.
- `solver.js`: `solve(roomIndex, carry) -> {ok, steps, actions}` is a BFS over the full state (positions, grab, carry, jammed, used, upgrades), with beat hazards ignored. It must PASS for every room. It also runs a soft-lock check: from every reachable state, is completion still reachable? If not, report the state. Reset always exists, but avoid soft-locks anyway.

### Rooms (small: ≤ 10×9 tiles each, ~1 min). Design them so that:
1. **r1+r2 combined map "Plate & Door" → zone "The Stick".** The mech starts beside plate P1. Door D1 (inputs P1) leads to zone 2, which holds a tree `T` under a roof hole and a stick. Cog C1 sits next to D1 on the zone-2 side. Solution: pilot the mech onto P1, hop out, fly through D1, take the stick, jam C1 (D1 locked open), fly back, pilot, walk through, exit.
2. **r3 "Magnet Arm".** Console K3 grants the arm. A crate starts against a wall, so it MUST be pulled, then pushed onto P3 → door D3 → exit.
3. **r4 "Hydraulic Legs".** Console K4 grants the legs. The exit is on a raised (`-`) ledge behind door D4. Cog C4 for D4 sits high among `-` blocks, reachable only by the crow, and the stick is behind a vent `v`. Solution: graft legs, hop out, crow through the vent, take the stick, jam C4, return, pilot, hop up onto the ledge, exit.
4. **r5 "The Great Shiny" (music 'dnb').** It uses everything: grab a crate onto plate P5 (opens shutter door D5), hop up steps between beat pistons, then park the mech in a beat laser so the crow can cross to the Shiny. Checkpoints sit between the sections.

## 3. Render (`game/src/render/`; owner: RENDER agent)
- `r3.js` exports `createR3(glCanvas, {isTouch}) -> r3`:
  - `r3.renderer` (antialias off when DPR>1.5; pixelRatio = min(devicePixelRatio, isTouch?1.5:2); sRGB output; ACES tone mapping, done in OutputPass).
  - `r3.setView(scene, camera)`, `r3.render(dt)` (composer: RenderPass → UnrealBloomPass at half res, threshold 0.85, strength 0.7, radius 0.4 → ShaderPass grade+vignette → OutputPass). `r3.quality` 'high'|'low': it auto-drops to low (no bloom, pixelRatio 1) if the average fps is <40 for 3 s.
  - `r3.makeIsoCamera(viewTiles=11)` → an ortho camera with frustum height = viewTiles (portrait: fit the room width instead). `r3.fitIso(camera, centerVec3, w, h)` frames a room so its full footprint is visible on both orientations. Resize is handled internally (listen to window resize).
  - `r3.pick(clientX, clientY, objects) -> intersection|null`.
- `assets.js`: `loadAssets() -> Promise` loads `assets/models/*.glb` (list in §5) if present. Missing files fall back to procedural low-poly placeholders built in code with the SAME names, sockets (as named Object3Ds) and approximate size, and coloured with the palette. `getModel(name) -> Object3D clone` (use SkeletonUtils.clone), `getClips(name) -> AnimationClip[]`. Materials: MeshStandardMaterial with flatShading, roughness ~0.8. Materials named `*_emit` get emissive intensity ≥2 so they bloom.
- Outline: inverted hull. For each mesh, add a child with the same geometry, a BackSide MeshBasicMaterial in dark `#1a1414`, and the vertices pushed along their normals by 0.025 (`onBeforeCompile`). Use a helper `addOutline(obj)`.
- `roomView.js`: `createRoomView(r3, state) -> view` builds a `THREE.Scene` for the room: instanced floor tiles per variant, walls (h2, visibly tall, with darker sides and a lighter top cap), raised blocks (h1), pits (dark hole with an edge), vents (wall with a crow-sized hole), plus entity models and deco. Walls on the 2 camera-facing edges (south and east rows) render as low stubs (h0.4) so the interior is never hidden. Lights: a hemisphere (cool teal sky, rust ground) + one warm directional with shadows (1024 map, frustum fitted to the room), a fog-like colour grade, and a background colour `#0f1416`.
  - `view.scene`, `view.camera`, `view.sync(state, dt)`: smoothly moves body/entity objects toward their logic positions (mech 0.25 s per tile, crow 0.16 s per tile; the crow bobs at h+0.9 while flying and sits on `pilot_seat` when inMech; the crow's facing slerps, with no flips). It plays the clips `walk`/`idle`/`fly`, shows upgrades on their sockets, animates doors, plates and cogs (a jammed cog stutters, with a red light→green), draws laser beams as emissive boxes, slams pistons, and spins the shiny. `view.busy()` is true while the controlled body is still tweening (the play scene waits for it before the next move). `view.handleEvents(events)` runs one-shot anims and particles (dust, sparks, graft flash). `view.tileMeshes` is used for picking. `view.dispose()`.
  - `view.worldToScreen(vec3) -> {x,y}` in CSS px, for the 2D overlay (prompt bubbles over targets).
- Palette: rust `#8a4b32`, dark rust `#4a2a20`, moss `#5d7a3a`, slate teal `#2f4c52`, concrete `#6b6e68`, warm lamp `#ffb35a`, cyan emissive `#3ff0ff`, gold `#ffcc44`.

## 4. Play glue, HUD, main (owner: GLUE agent)
- Edit `game/index.html` (add the import map + `#gl` canvas) and `game/src/main.js` (create `game.r3`, transparent 2D, call `game.r3.render` each frame, register scenes, `game.voice`). Edit `engine/view.js` only for the transparent clearRect.
- `game/src/scenes/play.js` (rewrite): it owns `state` + `roomView`. Input: keys/joystick → move (repeats while held, waiting for `!view.busy()`), tap/click on a tile → path queue, `act`, `swap`, `reset` (R / ↺ button). It reads `actions(state)` → context buttons via `input.setTouchButton('buttonA', {visible, hint})`. On desktop, draw a small prompt above the controlled body ("E: Jam stick", "Q: Hop out"). Events → `audio.play` (map below) and `game.voice.say` (narration triggers). Room complete → `game.state.carry` = upgrades, then a fade to the next room. After r5 is won → the 'ending' scene. Banner on room enter. Music: `audio.music(room.music)`. Beat: in the r5 finale, `beat = floor(audio.musicTime*174/60)` (if it's unavailable, use the scene clock) → `tick`.
- Audio map: move(mech)→`step`, move(crow)→`flap`, plate_on→`plate_on`, door_open→`door_open`, jam→`cog_jam`, pickup→`stick_pick`, graft→`graft` (fallback `jack_in`), grab→`magnet_on`, release→`magnet_drop`, death→`zap_death`, swap→`jack_in`/`jack_out`, won→`win`, bump→`ui_click`.
- `game/src/story/voice.js`: `createVoice(game)` → `say(id, {force})` plays audio id `id` on the music-ducked sfx bus (`audio.duck`), queues instead of overlapping, never repeats an id unless forced, and sets `subtitle = LINES[id]` for its duration (from the buffer length, or 3.5 s if the audio is missing). `drawSubtitles(ctx, view)` draws centred bottom text with a dark backdrop, above the touch controls. `LINES` comes from `src/story/lines.js` (owned by the GLUE agent, text in §6).
- `title.js` (rewrite): a 3D background (the slumped mech in a lamp-lit corner using roomView pieces or the assets directly, with the camera slowly orbiting) + the CORVID logo text + "Tap to play". It continues to 'intro' (first time) or 'play'.

## 5. Asset contract (GLB in `game/assets/models/`)
Y-up, 1 unit = 1 tile, origin at the feet centre, facing +Z, named actions. Names (procedural fallbacks are REQUIRED for all of them):
`crow` (0.35 tall; actions idle, fly, glide, carry, land, caw; bone/empty `beak_socket`), `mech` (1.1 tall; off, boot, idle, walk, push, jackin, hop; sockets `pilot_seat`, `arm_L_socket`, `arm_R_socket`, `leg_mod_socket`, `back_socket`; mesh `core_emit`), `upg_magnet_arm` (grab), `upg_hydraulic_legs`, `plate` (press), `door` (open, 1w×2h), `cog_door` (jam_stutter), `stick`, `crate`, `crane_console`, `laser_emitter`, `piston` (slam), `great_shiny` (spin), `kit_floor`, `kit_floor_grate`, `kit_floor_moss`, `kit_floor_hazard`, `kit_wall`, `kit_wall_vent`, `kit_block`, `kit_pillar`, `kit_pipe`, `deco_lamp`, `deco_barrel`, `deco_tree`, `deco_ivy`, `deco_moss`, `deco_mushrooms`, `deco_terminal`, `deco_robot_arm`.

## 6. Narration lines (`src/story/lines.js` exports `LINES`; audio id = key, file `assets/voice/<key>.mp3`)
- `vo_intro1`: "The crow. Corvus corone. Brain the size of a walnut. Ambitions the size of a factory."
- `vo_intro2`: "Somewhere in this tower lies the Great Shiny. The crow intends to own it."
- `vo_intro3`: "It cannot lift a crate. Fortunately, it has found something that can."
- `vo_r1`: "A partnership. One thinks. The other... stands on things."
- `vo_r2`: "Crows are among the few animals that use tools. This one prefers sticks. Jammed into machinery."
- `vo_arm`: "The machine grows an arm. The crow grows... smug."
- `vo_legs`: "Hydraulic legs. Evolution took millions of years. The crow took four seconds."
- `vo_r5`: "The final climb. The factory's heart beats at one hundred and seventy-four beats per minute."
- `vo_death`: "A setback. Crows are famously persistent."
- `vo_win1`: "Symbiosis: two organisms, each useless alone. Together, mildly criminal."
- `vo_win2`: "The Great Shiny. Worthless to the machine. Priceless to the crow. And that, it turns out, is enough."
Triggers: the intro scene plays intro1-3; r1 enter → vo_r1; zone 2 → vo_r2; graft arm → vo_arm; graft legs → vo_legs; r5 enter → vo_r5; first death → vo_death; ending → win1, win2.

## 7. Cutscenes (owner: STORY agent; `src/scenes/intro.js`, `src/scenes/ending.js`, `src/scenes/cutscene.js` helper)
- `cutscene.js`: a keyframe camera path helper (`track([{t, pos, look}], easing)`), a rain particle system (THREE.Points or instanced thin boxes, ≤1500), and a timeline runner (`at(t, fn)`).
- Intro (~25 s, tap/any key skips → 'play'): night exterior. The tower is built from kit pieces/boxes (rust/slate), with one glowing gold window, rain and distant city lights. The camera pushes in on the window, then shows the crow on an antenna (`crow` model, caw), the crow dives into a vent, cut to the interior (dark room, slumped `mech`), the crow lands on the seat, `core_emit` boots cyan with a light flash, and then → play. Narration: intro1 at 1 s, intro2 at ~9 s, intro3 at ~17 s. Subtitles via `game.voice`.
- Ending (~20 s): the crow lifts `great_shiny` out through the window, the lights pulse on the 174 BPM beat with the dnb music, then dawn: the crow + upgraded mech (arm+legs visible) on the rooftop looking over the city. win1, win2, then credits text (AI tools: Claude Code, ElevenLabs SFX/music/voice, Blender) → "Tap to play again" → title.
