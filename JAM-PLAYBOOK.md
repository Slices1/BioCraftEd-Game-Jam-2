# Jam #2 playbook

## Scoring (judges' Overall, /100) → what it means for us
| Criterion | Weight | Implication |
|---|---|---|
| Keyword | x5 | Keyword must BE the core mechanic, not decoration. Say it in the title/tagline. |
| Fun / gameplay | x5 | One tight loop, fun in the first 10 seconds, instant restart. |
| Works on phone + desktop | x3 | Test on a real phone early (by 15:00) and often. |
| Originality | x3 | Twist the obvious reading of the keyword. |
| Art / sound / polish | x2 | Juice, ElevenLabs SFX + music, title screen, consistent style. |
| Biology spark | x2 | Host is BioCraftEd: a biology setting/mechanic is worth 10 free points. |
Ties: keyword score, then fun.

## Hard rules checklist
- [ ] ZIP with `index.html` at top level, relative paths only, no server code, < 25 MB
- [ ] Google Form submitted **by 18:30** (aim for 18:10) with 1–2 sentences on keyword use
- [ ] At least one FULL section/level with a **drum & bass soundtrack**
- [ ] Touch + mouse/keyboard; no hover-only, no right-click
- [ ] Sound only after first tap/click
- [ ] Declare AI tools (Claude Code, ElevenLabs) and any third-party assets/licences
- [ ] 15:00: one-minute check-in → have something playable to show

## 30-minute ideation (keyword → idea)
1. (5 min) List ~10 readings of the keyword: literal object, verb/mechanic, setting, twist/inversion, wordplay, biology angle.
2. (10 min) For the top 4, write a one-line pitch + "what does the thumb do on a phone?"
3. (10 min) Score 1–5 on: keyword strength x5, fun-in-10s x5, originality x3, biology x2, buildable-in-3.5h, natural place for the DnB section. Pick the highest.
4. (5 min) Write `DESIGN.md`: core loop, controls (touch + keys), win/lose, 3 escalation beats, DnB moment, art style, audio list, ElevenLabs angle.

### Biology bank
cells / mitosis, immune system vs virus, evolution & mutation, DNA / CRISPR splicing, neurons & synapses, heart / blood flow, microbiome, enzymes & metabolism, photosynthesis, pollination, predator–prey, symbiosis, slime-mould pathfinding, bioluminescence, protein folding, ecosystems, ant colonies, migration.

### Natural DnB moments
heart-rate climbs to 174 BPM (tachycardia "panic" level) · adrenaline / fight-or-flight phase · cytokine storm / final wave · neurons firing in a "rave" · bonus "fever" mode · final boss. Ideally the DnB section is where the game peaks, not an add-on.

### ElevenLabs angles (safe → exceptional)
1. All SFX + music generated with ElevenLabs (incl. the DnB track and a calm menu track). Safe, baseline.
2. Character voices / narrator lines (pre-generated TTS): a generic nature-documentary narrator who reacts to play, creatures that speak. Strong, low risk.
3. Adaptive music: several ElevenLabs stems/intensity versions crossfaded by game state.
4. Live voice: an ElevenLabs Agent the player talks to via mic, with client tools that change game state. Most "exceptional", but needs network + mic permission on judges' phones → only as an optional mode on top of a game that fully works without it.

## Phone-first control schemes
one-thumb drag · tap timing · hold-to-charge · swipe directions · two-zone (left move / right action) · tilt (needs HTTPS + iOS permission prompt: risky).

## Timeline (build 12:30–18:30)
- T+0:00–0:30  ideate → DESIGN.md + task split with file ownership
- T+0:30–2:00  parallel agents: core gameplay · content/art · audio generation (ElevenLabs)
- 15:00        check-in: show the playable core
- T+2:00–4:00  integrate, real-phone playtests, polish agent (juice, menus, tutorial), bugfix
- 17:45        feature freeze
- 18:00        `build.sh` → zip → unzip + test on phone → submit form by 18:10
