# HANDOVER: CORVID (BioCraftEd Game Jam #2, keyword "symbiosis")

## STATUS (home PC session, 21 Nov, read first)
- The 2D entry WAS submitted. Now: the 3D rebuild per `REBUILD.md` (the contract; read it).
- Done: three@0.160.0 vendored (`game/vendor/three`); narration `assets/voice/vo_*.mp3` (ElevenLabs "George") + sfx graft/servo/hop generated and indexed.
- The glue agent FINISHED: index.html (import map, #gl canvas), main.js, engine/view.js (transparent), scenes/play.js, scenes/title.js, story/voice.js, story/lines.js. These are untested.
- The cutscene agent also FINISHED: `scenes/{cutscene,intro,ending}.js` (untested).
- INTERRUPTED (check and finish): logic (`src/logic/{rooms,rules,solver}.js`, `test-logic.html`) and render (`src/render/{r3,assets,roomView}.js`, `test-render.html`).
- Next priority: build GLBs with the Blender MCP to the §5 asset contract in REBUILD.md and save them in `game/assets/models/`. Then integrate and test in the browser pane, and commit.
- Tooling: there's no node or bash. git is at `C:\Users\Jonah\AppData\Local\GitHubDesktop\app-3.6.11\resources\app\git\cmd\git.exe` and python at `C:\Program Files\Python310\python.exe`.

You are Claude Code on the user's home PC, which has Blender plus a Blender MCP connector. You are taking over from a laptop session that ran out of usage. Read this whole file first, then `DESIGN.md` and `JAM-PLAYBOOK.md`. The repo is public at https://github.com/Slices1/BioCraftEd-Game-Jam-2. GitHub Pages serves it at https://slices1.github.io/BioCraftEd-Game-Jam-2/, and `./deploy.sh` commits and pushes everything.

**User preferences:**
- Never add a `Co-Authored-By: Claude` trailer to commits. The user doesn't want Claude to appear as a contributor.
- `game/tools/.env` holds `API_KEY = sk_...` (ElevenLabs Creator). It is gitignored. Never print it.
- Be efficient with usage. Opus plans and architects, and Sonnet agents (low or medium effort) write the code. Each agent gets clear file ownership.
- Don't take screenshots unless they're needed.

## 0. Deadline status (read first)
- The official submission was due at **18:30 on 21 Nov 2026** through the organiser's Google Form: a zip with `index.html` at its root, under 25 MB. The laptop session built `dist/game.zip` (7.3 MB) from the current 2D build as a safety-net entry. Ask the user whether it was submitted.
- The plan below is the **rebuild** the user wants: 3D-rendered isometric, cohesive art, one mech that gets upgraded, and narrated cutscenes. It may go in as a late or updated entry. BioCraftEd also offers community hosting at games.biocrafted.xyz, so the polished version still counts.

## 1. Hard rules (from the jam terms)
- Web only, with no install. It must work on a touch phone (portrait) AND on a desktop with keyboard and mouse. No hover-only actions and nothing needing right-click.
- Sound may only start after the first tap or click.
- The zip must be under 25 MB (hard cap 30), with relative paths only and no server code.
- **There must be at least one full level with a drum & bass soundtrack.** We already have an ElevenLabs DnB track at `game/assets/music/dnb.mp3`.
- Declare the AI tools used: Claude Code, ElevenLabs (SFX, music, voice), Gemini (2D art, now being replaced), and Blender via Claude if used.
- **Judging weights:** keyword ×5, fun ×5, works on phone and desktop ×3, originality ×3, art/sound/polish ×2, biology spark ×2. Ties are broken by keyword score. There's also a "Best use of ElevenLabs" prize, so lean into it.

## 2. The game (keep the concept, rebuild the execution)
A clever **crow** + ONE dumb, strong **mech suit** (a machine: no face, no voice) climb an abandoned, overgrown robotic factory tower (Stray vibes) to steal the **Great Shiny**, a glowing **gold gear mechanism**.

**Symbiosis:** the crow is the brain. It flies, fits through vents and carries sticks (real crows use tools, which is our biology spark). The mech is the body. It's heavy, holds plates down and blocks lasers. **NEW:** the crow upgrades the SAME mech by jacking it into machines. Each machine permanently grafts a part onto the mech, so the mech visibly grows and the pair needs each other more. Drop the "swap between spare mechs" idea.

**Proposed upgrade chain** (each room teaches one thing; all rooms small, ~1 min each):
1. **Plate & Door.** The mech holds a plate so the crow can fly through the door. Teaches: the two can separate.
2. **The Stick.** A tree grows through the roof, and that's where the sticks come from. The crow jams a stick into a big cog right next to the door, locking the door open, so the mech can follow. Give clear "JAMMED" feedback: a stutter, grinding and a light.
3. **Arm upgrade (magnet arm).** Jack into a crane console. The mech gains a magnet arm and can now pull and push crates. Use it to drag a crate onto a plate.
4. **Leg upgrade (hydraulic jump legs or a lift).** The mech can now hop up one height level. Puzzle: raised platforms, plus the crow flying a stick to a high cog.
5. **Finale (DnB, 174 BPM).** A timed climb: hazards (laser shutters, pistons) cycle on the beat. The upgraded mech uses all its parts, then the crow grabs the Shiny. Then the ending.

Cut the old press room and the laser room: the user found the press confusing.

## 3. Problems found in playtesting (avoid repeating them)
- The art was inconsistent (realistic Gemini sprites mixed with flash-like vector shapes), and walkable versus blocked tiles were unreadable. Tall walls must look tall, and low things must look low.
- Bad depth sorting: mech in front of ledges, lasers in front of doors, a door drawn over room walls. This goes away in real 3D.
- The crow animation was snappy, the mech's facing flipped constantly, and the held stick changed size and style with facing. 3D models with rigs fix this.
- The door showed open/closed backwards, and reset duplicated mechs.
- **Room 3 bridge soft-lock:** the crate had to be against the left wall to cross the bridge, and then it couldn't be pushed onto the button. Make every puzzle verifiable with a headless solver and rule out soft-locks (always offer a one-tap room reset).
- 20 fps on a laptop: 2D canvas bloom plus redrawing every frame.
- Playthrough was 12 minutes: too much walking. Make rooms smaller.
- The synthesised DnB was weak. Use the ElevenLabs `dnb.mp3`.

## 4. New tech plan
- **Three.js** (vendor a pinned build, e.g. three@0.160.0, into `game/vendor/`; no build step, ES modules), with an **orthographic isometric camera** (35.264° pitch, 45° yaw). Optionally allow 90° camera rotation with Q/E or a two-finger swipe; only do this if cheap.
- **Logic stays on a tile grid** (x, y, height level), reusing ideas from `game/src/game/world.js`, `rooms.js` and `physics.js`. Rendering is fully 3D.
- **Look:** cohesive stylised low-poly with hand-painted or flat-gradient materials. Post-process: an outline pass (edge-detect on depth and normals, or inverted-hull outlines), soft bloom on emissives only (`UnrealBloomPass` at half resolution), plus a subtle colour grade and vignette.
  - Palette: muted rust, moss green and slate teal, with warm lamp light against cyan emissives.
  - The level should be **built from modular Blender pieces**: floor tile, wall, wall-with-door, wall-with-vent, pillar, raised block, pipes, lamp, overgrowth pieces.
- **Performance budget:** 60 fps on a mid phone. Cap the pixel ratio at 1.5 on mobile, cast shadows from one directional light only with a small shadow map, use instancing for floor and wall tiles, and keep the build under 15 MB. Use GLB with Draco or meshopt compression and KTX2 or small PNG textures.
- **Reuse from the current repo:**
  - `game/src/engine/input.js`: action mapping, virtual joystick and context buttons. Buttons only appear when usable, with labels like "Jam stick" or "Enter mech".
  - `game/src/engine/audio.js`: WebAudio, iOS unlock and buses.
  - `game/assets/sfx/*`, `game/assets/music/{menu,factory,dnb}.mp3` and `tools/eleven.py`, which generates from `assets/audio-manifest.json`.

## 5. What to ask the user to make in Blender (or drive it yourself via the Blender MCP)
Export each model as **GLB**: Y-up, 1 unit = 1 tile (1 m), origin at the feet centre, facing +Z, under 5k tris each (mech under 8k), with baked or simple stylised materials and emissive parts on separate materials named `*_emit`. Rig and animate with named actions.
1. **crow.glb**: stylised crow, about 0.35 tiles tall. Actions: `idle` (perched, head tilts), `fly` (gentle wingbeat loop), `glide`, `carry` (fly holding a stick socket bone `beak_socket`), `land`, `caw`, `death` (puff).
2. **mech.glb**: compact bipedal walker, about 1.1 tiles tall, rusty, with a cradle on top with bone `pilot_seat` for the crow and a cyan core `core_emit`. Actions: `off` (slumped), `boot`, `idle`, `walk`, `push`, `jackin` (back cable plugs into a port), `hop`. Upgrade attachment bones: `arm_L_socket`, `arm_R_socket`, `leg_mod_socket`, `back_socket`.
3. **mech_upgrades.glb**: `upg_magnet_arm` (animated `grab`), `upg_hydraulic_legs` (adds a `hop` boost), and optionally `upg_lamp_head`.
4. **Puzzle props**: `plate` (with an animated `press` action), `door` (2 tiles tall, 1 wide, animated `open`), `cog_door` (big cog beside the door, a visible stick slot, animated `jam_stutter`), `stick`, `crate`, `crane_console` with a jack port, `lift`, `laser_emitter`, `laser_receiver`, `piston` (animated `slam`), `vent` (crow-sized hole in a wall), `great_shiny` (gold gear mechanism, slowly turning gears action).
5. **Modular kit**: floor tile variants (plain, grate, hazard, mossy), wall (1×1×2), wall_corner, wall_door, wall_vent, wall_window_broken, raised_block (1×1×1), pit_edge, pillar, pipe runs, hanging lamp, barrels, crates, a broken robot arm, a terminal, ivy curtain, moss patch, weeds, mushrooms, and a small tree growing through broken floor (room 2).
6. **Cutscene sets** (optional; they can reuse the kit): the exterior tower at night with rain, one glowing window (the Shiny), and a rooftop antenna for the crow.

## 6. Cutscenes and ElevenLabs (aim for the ElevenLabs prize)
- **Intro (~25 s, skippable):** an in-engine 3D camera flythrough of the exterior at night with rain. The camera pushes in on the glowing window, the crow sits on an antenna, dives through a vent and lands on the dormant mech, and the core boots up.
- **Ending (~20 s):** the crow lifts the gold gear Shiny out of the window. The factory lights pulse to the DnB. The crow and the upgraded mech look out over the city at dawn.
- **Narration:** ElevenLabs TTS from a dry, wry nature-documentary-style narrator (pick a generic voice from the voice library; do NOT imitate a real person). Generate lines with `tools/eleven.py` (manifest "voice" entries) into `assets/voice/`, and show them as subtitles. Example lines:
  - "The crow. Corvus corone. Brain the size of a walnut. Ambitions the size of a factory."
  - "It cannot lift a crate. Fortunately, it has found something that can."
  - "A partnership. One thinks. The other... lifts."
  - "Symbiosis: two organisms, each useless alone. Together, mildly criminal."
  - Plus 1–2 short narrator quips per room when an upgrade is grafted, e.g. "The machine grows an arm. The crow grows... smug."
- Add new SFX per upgrade (graft, weld, servo whine), and keep the existing SFX.

## 7. Suggested agent workflow
1. Opus (you) writes `REBUILD.md`: module list with file ownership, the grid and room data format, the camera, the post-FX, the asset contract (GLB names, action names, sockets) and the room solutions.
2. In parallel, Sonnet agents (low or medium effort), one per area: (a) three.js renderer + iso camera + post-FX + instanced kit; (b) grid world + rules + rooms + a headless solver test; (c) input/HUD/context buttons (reuse `engine/input.js`); (d) cutscenes + narration + subtitles; (e) audio manifest + generation.
3. Blender: build the models through the MCP connector. Start with the modular kit and the mech, because they affect readability most.
4. Test with headless Chromium at 390x844 and 1280x720 with no console errors; verify rooms with the solver; `./deploy.sh`; the user playtests on their phone.
5. Ship: `game/build.sh` → `dist/game.zip` (it excludes `tools/` and `assets/raw/`; keep it under 25 MB).
