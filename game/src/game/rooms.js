// Room chain as data. Map legend: '#' tall wall (z2)  '.' floor  '-' raised platform (z1)  'o' pit  'v' vent (crow only).
// Rooms sit side by side on one world grid at (ox, oy); neighbouring rooms SHARE their wall column (ox advances by w-1), doors sit in it. Entity `at` = tile coords inside the room; ids are global.
// Intended solutions (see also DESIGN.md):
//  1 Plate & Door: pilot suit A onto plate P1 -> door D1 opens -> B to exit, crow flies east through D1.
//  2 The Stick:    fly through the vent into the closet, take the stick, ACT at the cog slot -> D1 locked open;
//                  fly back, jack into suit A, walk it east. Suit B waits here.
//  3 Two Suits:    suit A parks on P3 (a bridge deck slides out across the chasm), crow swaps to suit B, crosses, jacks the
//                  press console, slams: cracked wall breaks + scrap becomes a crate; push the crate east.
//  4 Magnet:       push the crate into row 5, suit jacks the crane console, grab crate, drop it on plate P4
//                  (raised) -> elevator E4 cycles; unjack, ride E4 up, walk east on the platform.
//  5 Laser:        suit B parks on plate P5 (closet door D5c opens); crow exits, enters dormant suit C, parks C in
//                  the beam row (blocks it); crow (outside, east of C) fetches stick S5, flies through vent V5 and
//                  jams COG5 (exit door D5 locked open). Back to C, walk it west along the beam row and north onto
//                  lift L5: leaving the row lights receiver RX5, lift rises; walk C north through D5.
//                  (Crow cannot return south afterwards: the beam is live. The suit is the choice: one climbs.)
//  6 Finale 174BPM: park the suit on plate P6 (door DG6 opens), crow takes stick S6 north between the two beat lasers
//                  (SH7 on beats 0-2, SH5 on beats 4-6 of 8), jams COG6 (door DS6 open), then crosses piston PS6
//                  (extended beats 0-2) and grabs the Shiny. Checkpoints CP6a/b respawn the crow.
export const ROOMS = [
  {
    id: 'r1', name: 'PLATE & DOOR', ox: 0, oy: 0, spawn: [2.5, 2.5],
    hint: 'B: climb into the suit. Park it on the plate.',
    map: [
      '############',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#...........',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
    ents: [
      { type: 'suit', id: 'suitA', at: [3, 4] },
      { type: 'plate', id: 'P1', at: [5, 7] },
      { type: 'door', id: 'D1', at: [11, 5], inputs: ['P1', 'COG'] },
    ],
  },
  {
    id: 'r2', name: 'THE STICK', ox: 11, oy: 0, spawn: [1.5, 5.5],
    hint: 'Crows fit through vents. Sticks jam cogs.',
    map: [
      '############',
      '#...#......#',
      '#...v......#',
      '#####......#',
      '#..........#',
      '............',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
    ents: [
      { type: 'vent', id: 'V2', at: [4, 2] },
      { type: 'stick', id: 'S1', at: [2, 2] },
      { type: 'cog', id: 'COG', at: [0, 4], axis: 'y' },
      { type: 'suit', id: 'suitB', at: [8, 8] },
    ],
  },
  {
    id: 'r3', name: 'TWO SUITS', ox: 22, oy: 0, spawn: [1.5, 5.5],
    hint: 'Parked suits keep working.',
    map: [
      '############',
      '#.....o....#',
      '#.....o....#',
      '#.....o....#',
      '#.....o....#',
      '......o.....',
      '#.....o....#',
      '#.....o....#',
      '#.....o....#',
      '#.....o....#',
      '############',
    ],
    ents: [
      { type: 'plate', id: 'P3', at: [3, 7] },
      { type: 'bridge', id: 'BR3', at: [6, 5], inputs: ['P3'] },
      { type: 'cracked', id: 'CW3', at: [11, 5] },
      { type: 'crate', id: 'CR3', at: [10, 5], hidden: true },
      { type: 'scrap', id: 'SC3', at: [10, 5], crate: 'CR3' },
      { type: 'press', id: 'PR3', at: [10, 5], zone: [[10, 5], [11, 5]], console: [9, 7] },
    ],
  },
  {
    id: 'r4', name: 'MAGNET', ox: 33, oy: 0, spawn: [1.5, 6.5],
    hint: 'The crane can lift anything metal — except the suit driving it.',
    map: [
      '############',
      '#......----#',
      '#......----#',
      '#......----#',
      '#......----#',
      '.......-----',
      '#......----#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
    ents: [
      { type: 'plate', id: 'P4', at: [9, 5] },
      { type: 'lift', id: 'E4', at: [7, 7], off: 0, on: 1, mode: 'cycle', inputs: ['P4'] },
      { type: 'crane', id: 'CN4', at: [4, 5], x0: 1, x1: 10, console: [3, 8] },
    ],
  },
  {
    id: 'r5', name: 'LASER', ox: 44, oy: 0, spawn: [2.5, 6.5],
    hint: 'Beams stop at metal. Crows do not.',
    map: [
      '#####.######',
      '#----------#',
      '#----------#',
      '###.####v###',
      '#..........#',
      '-..........#',
      '#..........#',
      '##.##......#',
      '#...#......#',
      '#...#......#',
      '############',
    ],
    ents: [
      { type: 'emitter', id: 'EM5', at: [0, 4], dir: [1, 0], target: 'RX5' },
      { type: 'receiver', id: 'RX5', at: [11, 4] },
      { type: 'lift', id: 'L5', at: [3, 3], off: 0, on: 1, mode: 'hold', inputs: ['RX5'] },
      { type: 'vent', id: 'V5', at: [8, 3] },
      { type: 'plate', id: 'P5', at: [6, 6] },
      { type: 'door', id: 'D5c', at: [2, 7], inputs: ['P5'] },
      { type: 'stick', id: 'S5', at: [2, 9] },
      { type: 'suit', id: 'suitC', at: [9, 8] },
      { type: 'cog', id: 'COG5', at: [2, 0] },
      { type: 'door', id: 'D5', at: [5, 0], inputs: ['COG5'] },
    ],
  },
  {
    id: 'r6', name: 'THE GREAT SHINY', ox: 44, oy: -14, spawn: [5.5, 12.5],
    hint: 'Everything here moves to the beat.',
    map: [
      '############',
      '#----------#',
      '#####.######',
      '#####.######',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#####.######',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
    ],
    ents: [
      { type: 'plate', id: 'P6', at: [9, 11] },
      { type: 'door', id: 'DG6', at: [5, 8], inputs: ['P6'] },
      { type: 'stick', id: 'S6', at: [2, 12] },
      { type: 'shutter', id: 'SH7', at: [0, 7], dir: [1, 0], from: 0, len: 3 },
      { type: 'shutter', id: 'SH5', at: [0, 5], dir: [1, 0], from: 4, len: 3 },
      { type: 'cp', id: 'CP6a', at: [5, 6] },
      { type: 'cp', id: 'CP6b', at: [5, 4] },
      { type: 'cog', id: 'COG6', at: [2, 3] },
      { type: 'door', id: 'DS6', at: [5, 3], inputs: ['COG6'] },
      { type: 'piston', id: 'PS6', at: [5, 2], from: 0, len: 3 },
      { type: 'shiny', id: 'SHINY', at: [5, 1] },
    ],
  },
];
