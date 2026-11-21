// Room chain as data. Map legend: '#' tall wall (z2)  '.' floor  '-' raised platform (z1)  'o' pit  'v' vent (crow-sized hole in a tall wall).
// Rooms sit on one world grid at (ox, oy); neighbouring rooms SHARE a wall column/row (chars must agree there), doors sit in it. Entity `at` = tile coords inside the room; ids are global.
// Intended solutions (compact rooms, ~1 min each):
//  1 Plate & Door: pilot suit A onto plate P1 -> door D1 opens; crow flies east through D1.
//  2 The Stick:    fly through the vent hole into the closet, take the stick, jam the cog by D1 -> D1 locked open;
//                  fly back, jack into suit A, walk it east. Suit B waits here.
//  3 Two Suits:    suit A parks on P3 (bridge slides out across the chasm), crow swaps to suit B, crosses, jacks the
//                  press console, slams: the cracked wall (only exit) breaks + scrap becomes a crate; push the crate east.
//  4 Magnet:       suit jacks the crane console, grabs the crate (row 3), drops it on plate P4 (raised) -> lift E4 cycles;
//                  unjack, ride E4 up, walk north on the platform through the gap into the finale.
//  5 Finale 174BPM: park the suit on plate P6 (door DG6 opens), crow takes stick S6 north between the two beat lasers,
//                  jams COG6 (door DS6 open), then crosses piston PS6 and grabs the Shiny. Checkpoints respawn the crow.
export const ROOMS = [
  {
    id: 'r1', name: 'PLATE & DOOR', ox: 0, oy: 0, spawn: [1.5, 1.5],
    hint: 'B: climb into the suit. Park it on the plate.',
    map: [
      '########',
      '#......#',
      '#......#',
      '#......#',
      '#......#',
      '#.......',
      '########',
    ],
    ents: [
      { type: 'suit', id: 'suitA', at: [2, 4] },
      { type: 'plate', id: 'P1', at: [4, 2] },
      { type: 'door', id: 'D1', at: [7, 5], inputs: ['P1', 'COG'] },
    ],
  },
  {
    id: 'r2', name: 'THE STICK', ox: 7, oy: 0, spawn: [1.5, 5.5],
    hint: 'Crows fit through the hole in the wall. Sticks jam cogs.',
    map: [
      '#########',
      '#..#....#',
      '#..v....#',
      '####....#',
      '#.......#',
      '.........',
      '#########',
    ],
    ents: [
      { type: 'vent', id: 'V2', at: [3, 2] },
      { type: 'stick', id: 'S1', at: [1, 1] },
      { type: 'cog', id: 'COG', at: [0, 4], axis: 'y' },
      { type: 'suit', id: 'suitB', at: [6, 4] },
    ],
  },
  {
    id: 'r3', name: 'TWO SUITS', ox: 15, oy: 0, spawn: [1.5, 5.5],
    hint: 'Parked suits keep working. The cracked wall needs the PRESS.',
    map: [
      '#########',
      '#...o...#',
      '#...o...#',
      '#...o....',
      '#...o...#',
      '....o...#',
      '#########',
    ],
    ents: [
      { type: 'plate', id: 'P3', at: [2, 3] },
      { type: 'bridge', id: 'BR3', at: [4, 5], inputs: ['P3'] },
      { type: 'cracked', id: 'CW3', at: [8, 3] },
      { type: 'crate', id: 'CR3', at: [7, 3], hidden: true },
      { type: 'scrap', id: 'SC3', at: [7, 3], crate: 'CR3' },
      { type: 'press', id: 'PR3', at: [7, 3], zone: [[7, 3], [8, 3]], console: [6, 1] },
    ],
  },
  {
    id: 'r4', name: 'MAGNET', ox: 23, oy: 0, spawn: [1.5, 3.5],
    hint: 'The crane can lift anything metal — except the suit driving it.',
    map: [
      '######-##',
      '#....---#',
      '#....---#',
      '.....---#',
      '#.......#',
      '#.......#',
      '#########',
    ],
    ents: [
      { type: 'plate', id: 'P4', at: [6, 3] },
      { type: 'lift', id: 'E4', at: [5, 4], off: 0, on: 1, mode: 'cycle', inputs: ['P4'] },
      { type: 'crane', id: 'CN4', at: [2, 3], x0: 1, x1: 7, console: [2, 5] },
    ],
  },
  {
    id: 'r5', name: 'THE GREAT SHINY', ox: 25, oy: -11, spawn: [4.5, 10.5],
    hint: 'Everything here moves to the beat.',
    map: [
      '#########',
      '#-------#',
      '####.####',
      '####.####',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '####.####',
      '#.......#',
      '#.......#',
      '####-####',
    ],
    ents: [
      { type: 'plate', id: 'P6', at: [6, 10] },
      { type: 'door', id: 'DG6', at: [4, 8], inputs: ['P6'] },
      { type: 'stick', id: 'S6', at: [2, 9] },
      { type: 'shutter', id: 'SH7', at: [0, 7], dir: [1, 0], from: 0, len: 3 },
      { type: 'shutter', id: 'SH5', at: [0, 5], dir: [1, 0], from: 4, len: 3 },
      { type: 'cp', id: 'CP6a', at: [4, 6] },
      { type: 'cp', id: 'CP6b', at: [4, 4] },
      { type: 'cog', id: 'COG6', at: [2, 3] },
      { type: 'door', id: 'DS6', at: [4, 3], inputs: ['COG6'] },
      { type: 'piston', id: 'PS6', at: [4, 2], from: 0, len: 3 },
      { type: 'shiny', id: 'SHINY', at: [4, 1] },
    ],
  },
];
