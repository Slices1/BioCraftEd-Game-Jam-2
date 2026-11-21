# CORVID — design (Jam #2, keyword: symbiosis)

A clever crow + a dumb, strong mech suit climb a factory tower to steal the **Great Shiny**.
Symbiosis: the crow is the brain (flies, fits vents, carries sticks, can't press anything heavy);
the suit is the body (heavy, holds plates, blocks lasers, jacks into machines, but only moves when the crow pilots it).
Suit is a MACHINE — no face, no voice, no name on screen. Tone: grounded, realistic, adult (18+), puzzles like Portal.

## View / platform
- ISOMETRIC 2:1 (pivoted from side-on), grid world with height levels, Canvas 2D, plain JS ES modules on top of the kit in `game/src/engine` (read `game/CONVENTIONS.md`).
- Portrait phone is the primary target; desktop landscape must also work. Rooms are stacked VERTICALLY up a tower:
  each room ≈ 22 tiles wide × 30 tall (tile = 32 world px). Camera fits room WIDTH to the screen, follows the
  active body vertically, clamped to room bounds. Leaving a room through its top/side door scrolls to the next.
- Bloom post-process + detailed industrial backdrop (`src/game/env.js`, `src/game/bloom.js`).

## Controls
| | Touch (portrait) | Keyboard / mouse |
|---|---|---|
| Move / fly / walk | virtual joystick (left) | WASD / arrows |
| Crow: flap up | joystick up (crow hovers with light gravity) | W / ↑ / Space |
| Suit: jump (low) | joystick up | W / ↑ / Space |
| ACT (context) | button A | E / Enter / click on target |
| EXIT/ENTER suit | button B | Q / Shift |
| Reset room | pause menu + small ↺ button | R |
ACT is context-sensitive with an on-screen prompt bubble: pick up / drop stick, jam stick in cog, jack in/out of machine, machine action (press slam, magnet grab/release).

## Rules (entities)
- **Crow**: free flight with gentle gravity + flapping, small hitbox (fits 1-tile vents), carries ≤1 STICK, too light for plates, dies on laser → respawn at room checkpoint (stick returns to last rest spot).
- **Suit** (several can exist): heavy physics body. Empty suit = inert, stays put. Crow enters when overlapping + B. Walks, low jump (≈1.5 tiles), can't fit vents. Holds plates, blocks laser beams. JACK: cable plugs into adjacent machine → controls switch to that machine until B.
- **Plate**: pressed by suit / crate. Linked to doors/lifts by id.
- **Door / gate**: open while its inputs are on. **Cog gate**: a huge visible cog driving a gate; a stick jammed in the glowing slot locks it OPEN permanently (stick consumed).
- **Press** (machine): jack in → ACT slams: breaks cracked walls, crushes scrap pile into a CRATE.
- **Crate**: heavy, pushable by suit, presses plates, blocks lasers, magnetic.
- **Magnet crane**: jack in → joystick moves trolley along rail + lowers/raises; ACT grabs/drops metal (suits, crates — not the crow, not the suit it's jacked from? → it CAN'T lift the suit it is being piloted from).
- **Laser emitter → receiver**: beam stops at first solid/suit/crate; crow dies in beam; lit receiver powers its targets.
- **Lift platform**: moves between two points while powered.
- **Vent**: 1-tile gap only the crow fits.

## Room chain (each room needs what you bring from earlier ones)
1. **Plate & Door** — door held by plate. Park suit A on plate, crow flies through. Teaches: separate.
2. **The Stick** — beyond the door: sticks lying around + a cog gate driving Room-1 door mechanism. Jam stick → door locked open → fetch suit A. Suit B lies dormant here. Teaches: tools persist.
3. **Two Suits** — one suit must hold a plate (bridge/lift) while the other crosses and jacks into a PRESS to break the wall / make a crate. Crow swaps between suits. Teaches: parked things keep working.
4. **Magnet** — crane lifts a suit / crate to a high ledge; order matters (who lifts whom, how the lifter follows — e.g. crate on plate raises a lift for the jacked suit).
5. **Laser** — beam guards the exit; park a suit / crate in the beam so the crow passes, while the receiver needs the beam to run the lift → choose what to block when.
6. **Tower finale (DnB 174 BPM)** — timed climb, shutters cycle on the beat, combine suits + crane; Great Shiny at top → ending cutscene.

Difficulty: every rule gets a safe intro; carried-forward objects glow faintly; reset room = 1 tap; no lives.

## Story beats
- Intro cutscene (skippable, ~20 s, text + visuals): rooftop at night, crow spots the Great Shiny glinting in the tower window → dives in through a vent → lands on a dormant mech suit, its cockpit socket blinks awake.
- Ending: crow grabs the Shiny; the factory lights pulse with the DnB; crow flies out over the city.

## Assets
- Sprites optional: if `assets/img/<name>.png` exists it is drawn, else vector placeholder (see ASSET-PROMPTS.md).
- Audio via `assets/audio-index.json` (ElevenLabs) with `src/audio/sfxr.js` / `music.js` fallbacks. DnB on the finale.

## File ownership (agents)
- `src/game/world.js, physics.js, entities/*.js, rooms.js, play.js scene` — core agent
- `src/game/env.js, bloom.js` — environment/rendering agent
- `src/scenes/intro.js, ending.js, title.js` — story/UI agent (later)
- `assets/*`, audio wiring — audio agent (later)
