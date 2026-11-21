# Asset prompts for Gemini (ISOMETRIC version)

**How to use:** paste the STYLE BLOCK, then one asset prompt, and ask for one image per prompt.
Save each image as `game/assets/raw/<name>.png` using the name in **bold**. I'll remove the magenta background, trim, scale and wire it in.
- The game only needs two facings: **SE** (facing down-right, toward the viewer) and **NE** (facing up-right, away from the viewer). The code mirrors them for SW and NW.
- Floors and walls are drawn in code to fit the grid, so these prompts are for characters, machines and props only.

---

## STYLE BLOCK (paste before every prompt)
> Game sprite for a 2D ISOMETRIC puzzle game (true 2:1 isometric projection, camera looking down at ~30°, like classic iso RPGs). Hand-painted illustrated style with visible confident linework and soft painterly shading, like a moody indie graphic-novel game (warm tungsten lamp light, cool teal shadows), set in a gritty ROBOTIC FACTORY. Weathered steel, chipped paint, rust, grime, cables, small glowing cyan (#3FE0FF) and amber (#FFB040) lights. Grounded, slightly stylised but NOT cute or chibi: realistic proportions, an adult tone. Background must be perfectly flat solid magenta #FF00FF with no floor, no shadows and no gradient on it (I will add shadows). No text, no watermark. Leave generous magenta space around each item; items must not touch.

---

## Characters

**crow_fly**
> A realistic black crow (Corvus), glossy black feathers with subtle blue-violet sheen and a sharp intelligent eye, seen in isometric view. A sprite sheet in 2 rows × 3 columns, all at identical scale: top row = flying facing SOUTH-EAST (toward the viewer, down-right) with wings UP / LEVEL / DOWN; bottom row = flying facing NORTH-EAST (away from the viewer, up-right) with wings UP / LEVEL / DOWN.

**crow_extra**
> The same crow, identical scale, 4 poses in a row: (1) perched facing SE, (2) perched facing NE, (3) flying facing SE holding a thin wooden stick crosswise in its beak, (4) flying facing NE holding the stick.

**suit**
> A compact two-legged industrial exo-frame mech, about 3× the crow's height. It's a machine, NOT a character: no face, no eyes, no head. A boxy torso with a small open glass cockpit cradle on top where a crow perches, a round cyan power core on the chest, hydraulic pistons, two chunky arms with clamp hands, hazard-striped plates, and a thick cable on its back ending in a glowing plug. Isometric sprite sheet, 2 rows × 3 columns, identical scale: top row facing SE = (1) powered OFF slumped with dark core, (2) idle ON with core glowing, (3) mid-step walking; bottom row = the same three states facing NE.

## Machines (isometric, one image each)

**press**
> A heavy industrial hydraulic press machine, isometric, occupying a 2×2 floor tile footprint: a steel frame, a big piston ram, gauges, warning stripes, and a glowing jack-in socket on its front. Two versions side by side at identical scale: left = DORMANT (ram raised, lights dim), right = ACTIVE (ram slammed down, amber lights lit, a little steam).

**magnet_crane**
> An isometric overhead magnet crane parts sheet at identical scale: (1) a steel ceiling-rail segment running diagonally (along the iso x-axis) that can tile end to end, (2) the trolley carriage that rides on it, (3) a heavy chain hanging straight down (tileable vertically), (4) a large circular electromagnet OFF (dark), (5) the same magnet ON (glowing cyan coils, crackling arcs), (6) a floor control console with a jack-in socket.

**cog_gate**
> An isometric wall-mounted mechanism: a HUGE, very obvious brass-and-steel cog wheel (about 2 tiles tall) mounted on the wall beside a heavy sliding gate. Sprite sheet at identical scale: (1) the cog alone with one clearly visible empty slot between two teeth, rimmed with amber paint, (2) the same cog with a wooden stick jammed into that slot, (3) the gate panel CLOSED, (4) the gate panel OPEN (raised up into its frame).

**laser**
> Isometric industrial laser security props at identical scale: (1) floor-standing laser emitter pylon with a magenta lens, facing SE, (2) the same facing NE, (3) a receiver pylon UNLIT, (4) the receiver LIT (glowing cyan).

**door_plate_lift**
> Isometric industrial puzzle props at identical scale: (1) a heavy sliding blast door in its frame, CLOSED, red light, set in a wall that runs along the iso x-axis, (2) the same door OPEN, green light, (3) a square floor pressure plate UP with an amber rim (fits one floor tile), (4) the same plate PRESSED with a cyan glowing rim, (5) a square scissor-lift platform LOWERED, (6) the same lift RAISED.

**props**
> Isometric factory props at identical scale, each fitting about one floor tile: (1) a heavy dented steel crate with stencil markings (no legible text), (2) a pile of scrap metal, (3) a cracked concrete-and-rebar wall chunk, (4) the same chunk SHATTERED into rubble, (5) a thin dry wooden twig/stick lying on the floor, (6) a wall vent grille (small and square, on a wall running along the iso y-axis).

## Story / UI

**great_shiny**
> A breathtaking glowing jewel artifact, the "Great Shiny": a large multifaceted crystal in an antique brass housing on a small pedestal, shimmering with prismatic cyan-gold-magenta light. Isometric view.

**cutscene_rooftop** (a full background image, so ignore the magenta rule)
> Hand-painted illustrated establishing shot, night, rain, industrial city. A massive dark robotic factory tower in the centre; one high window glows with prismatic jewel light. In the foreground, a lone crow perched on a rooftop antenna faces the tower. Warm tungsten vs teal palette, moody, graphic-novel linework. 9:16 portrait composition with the subject in the centre third.

**title_logo**
> Game logo text "CORVID" in a bold, sharp, hand-lettered display font like a horror-comedy game logo, deep crimson-red with a slight brushed-metal edge, one crow feather forming part of the V. Flat magenta #FF00FF background.
