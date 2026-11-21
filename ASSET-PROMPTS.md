# Asset prompts for Gemini (v3: isometric, hand-painted, abandoned + overgrown)

**Workflow:** use ONE Gemini chat for everything so the style stays consistent. Send the STYLE BLOCK as the first message, generate **crow_turn** first, then for every following prompt add: *"Match the exact art style, line weight, palette and lighting of the crow image above."*
Save as `game/assets/raw/<name>.png`.

## STYLE BLOCK
> I'm making sprites for a 2D isometric puzzle game set in an ABANDONED robotic factory slowly reclaimed by nature (moss, ivy, weeds, rust, puddles), with a mood like the game Stray. Art style: stylised HAND-PAINTED illustration, like painted indie-game concept art, with visible brush texture, soft painterly shading and confident dark linework. It should be stylised, not photorealistic and not cartoony or chibi. The palette is muted and slightly desaturated: rusty ochres, mossy greens and slate teal, with warm tungsten highlights and a few small glowing cyan or amber lights. Camera: classic isometric game view, looking DOWN at about 30 degrees. Every image must have a perfectly flat solid magenta (#FF00FF) background with no floor, no cast shadow and no gradient. No text. Keep lots of empty magenta space between items so that none of them touch.

## Characters

**crow_turn**
> A sprite TURNAROUND of one crow (a stylised but anatomically believable carrion crow: glossy black feathers with a subtle blue sheen, bright clever eye), seen from the isometric camera above, all at IDENTICAL size, in one row of 5. The WHOLE BODY rotates between the views, not just the head: (1) body pointing straight DOWN the image toward the viewer, (2) body pointing diagonally toward the BOTTOM-RIGHT corner of the image, (3) body pointing straight RIGHT in profile, (4) body pointing diagonally toward the TOP-RIGHT corner (back three-quarter view, mostly seeing its back), (5) body pointing straight UP the image, away from the viewer (seeing its back and tail). In every view, its tail points the opposite way to its beak. Standing pose.

**crow_fly_a**
> The same crow FLYING, same 5 body directions as before (down, down-right, right, up-right, up), wings UP (top of the wingbeat). One row of 5, identical size.

**crow_fly_b**
> The same crow FLYING, same 5 body directions, wings DOWN (bottom of the wingbeat). One row of 5, identical size.

**crow_stick**
> The same crow flying with a thin twig held crosswise in its beak, in 3 body directions: down-right, right, up-right. Identical size.

**suit_turn**
> A compact two-legged industrial walker mech, about 3× the crow's height, old, scratched and rusty with a few moss patches. It's a MACHINE: no face, no head, no eyes. A boxy torso with an open cradle on top for a crow to perch in, a round cyan glow core on the chest, hydraulic legs and two clamp arms, plus a thick power cable on its back ending in a plug. A TURNAROUND in one row of 5 at identical size, where the WHOLE MACHINE rotates: front facing down, front facing the bottom-right corner, profile facing right, front facing the top-right corner (back three-quarter), and front facing up (back view). Powered ON.

**suit_states**
> The same mech, front facing the bottom-right corner, identical size, 4 versions: (1) powered OFF, slumped, dark core, (2) walking with the left leg forward, (3) walking with the right leg forward, (4) its back cable plugged in, glowing.

## Machines and scene objects (all the same style; each fits about 1–2 floor tiles)

**press**
> An old hydraulic press machine with rust, moss at its base and a glowing jack-in socket. Two versions: DORMANT (ram raised, lights dim) and ACTIVE (ram slammed down, amber lights on).

**crane**
> A rusty overhead magnet crane: (1) ceiling rail segment running diagonally toward the top-right, (2) trolley, (3) hanging chain, (4) round electromagnet OFF, (5) the same magnet ON with glowing cyan coils and small sparks, (6) its floor control console with a jack-in socket.

**cog_gate**
> A HUGE brass cog wheel on a mossy wall next to a heavy sliding gate: (1) the cog with one clearly visible empty slot rimmed in amber paint, (2) the cog with a twig jammed in that slot, (3) the gate closed, (4) the gate open.

**puzzle_props**
> (1) Laser emitter pylon with a magenta lens, (2) laser receiver pylon unlit, (3) the receiver lit cyan, (4) floor pressure plate up with an amber rim, (5) the plate pressed with a cyan glow, (6) a scissor-lift platform lowered, (7) the lift raised, (8) a blast door closed with a red light, (9) the door open with a green light.

**objects**
> (1) A dented steel crate, (2) a pile of scrap, (3) a cracked concrete wall chunk, (4) that chunk as rubble, (5) a dry twig lying on the floor, (6) a wall vent grille, (7) an old computer console with a cracked, faintly glowing screen, (8) a rusty barrel with ivy, (9) a broken robot arm lying on the floor, (10) a potted plant gone wild, (11) a hanging work lamp, (12) a puddle reflecting light.

**overgrowth**
> Nature-reclaiming-factory decoration pieces: (1) a hanging ivy curtain, (2) a moss patch, (3) weeds growing through a floor crack, (4) a small tree growing up through broken floor plates with dry twigs at its base, (5) vines wrapped around a pipe, (6) a cluster of small mushrooms.

## Story / UI

**great_shiny**
> The "Great Shiny": a large multifaceted crystal in an antique brass housing on a small pedestal, shimmering with prismatic cyan, gold and magenta light.

**cutscene_rooftop** (a full background image, so no magenta)
> Same hand-painted style. Night, light rain: an abandoned factory tower overgrown with ivy, with one high window glowing with prismatic jewel light. In the foreground, a crow perched on a bent rooftop antenna faces the tower. Portrait 9:16 composition.

**title_logo**
> The game title "CORVID" hand-lettered in a sharp, slightly distressed crimson display font with a feather forming part of the V, on a flat magenta (#FF00FF) background.
