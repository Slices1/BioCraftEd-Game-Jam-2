// Room chain as data. Map legend: '#' tall wall (z2)  '.' floor  '-' raised platform (z1)  'o' pit  'v' vent (crow only).
// Rooms sit side by side on one world grid at (ox, oy). Entity `at` = tile coords inside the room; ids are global.
// Intended solutions (see also DESIGN.md):
//  1 Plate & Door: pilot suit A onto plate P1 -> door D1 opens -> B to exit, crow flies east through D1.
//  2 The Stick:    fly through the vent into the closet, take the stick, ACT at the cog slot -> D1 locked open;
//                  fly back, jack into suit A, walk it east. Suit B waits here.
//  3 Two Suits:    suit A parks on P3 (bridge rises over the pit), crow swaps to suit B, crosses, jacks the
//                  press console, slams: cracked wall breaks + scrap becomes a crate; push the crate east.
//  4 Magnet:       push the crate into row 5, suit jacks the crane console, grab crate, drop it on plate P4
//                  (raised) -> elevator E4 cycles; unjack, ride E4 up, walk east on the platform.
//  5 Laser:        beam lit -> D5 open; walk the suit through D5 and into the beam row (west of the vent):
//                  beam blocked (D5 closes behind), B to exit, crow flies north through the vent.
//  6 Finale:       (placeholder) grab the Great Shiny.
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
    id: 'r2', name: 'THE STICK', ox: 12, oy: 0, spawn: [1.5, 5.5],
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
      { type: 'cog', id: 'COG', at: [7, 0] },
      { type: 'suit', id: 'suitB', at: [8, 8] },
    ],
  },
  {
    id: 'r3', name: 'TWO SUITS', ox: 24, oy: 0, spawn: [1.5, 5.5],
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
      { type: 'lift', id: 'BR3', at: [6, 5], off: -1, on: 0, mode: 'hold', inputs: ['P3'] },
      { type: 'cracked', id: 'CW3', at: [11, 5] },
      { type: 'crate', id: 'CR3', at: [10, 5], hidden: true },
      { type: 'scrap', id: 'SC3', at: [10, 5], crate: 'CR3' },
      { type: 'press', id: 'PR3', at: [10, 5], zone: [[10, 5], [11, 5]], console: [9, 7] },
    ],
  },
  {
    id: 'r4', name: 'MAGNET', ox: 36, oy: 0, spawn: [1.5, 6.5],
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
    id: 'r5', name: 'LASER', ox: 48, oy: 0, spawn: [2.5, 6.5],
    hint: 'Beams stop at metal. Crows do not.',
    map: [
      '######v#####',
      '#..........#',
      '#..........#',
      '#####.######',
      '#..........#',
      '-..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
    ents: [
      { type: 'lift', id: 'E5', at: [1, 5], off: 0, on: 1, mode: 'cycle', period: 2.2 },
      { type: 'vent', id: 'V5', at: [6, 0] },
      { type: 'emitter', id: 'EM5', at: [1, 1], dir: [1, 0], target: 'RX5' },
      { type: 'receiver', id: 'RX5', at: [10, 1] },
      { type: 'door', id: 'D5', at: [5, 3], inputs: ['RX5'] },
    ],
  },
  {
    id: 'r6', name: 'THE GREAT SHINY', ox: 48, oy: -8, spawn: [6.5, 6.5],
    hint: 'Take it.',
    map: [
      '############',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '######.#####',
    ],
    ents: [{ type: 'shiny', id: 'SHINY', at: [6, 3] }],
  },
];
