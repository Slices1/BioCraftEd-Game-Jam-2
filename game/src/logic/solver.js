// CORVID solver: BFS over the full logic state, plus a soft-lock check.
// Beat hazards are ignored (inactive) by default. opts.strict makes every laser always
// active (beat pistons stay inactive), so a path that kills the crow is discarded.
import { createState, clone, step, mechFacing } from './rules.js';

const ACTIONS = [
  { type: 'move', dir: 'N' },
  { type: 'move', dir: 'E' },
  { type: 'move', dir: 'S' },
  { type: 'move', dir: 'W' },
  { type: 'act' },
  { type: 'swap' },
];
export const ACTION_NAMES = ['N', 'E', 'S', 'W', 'act', 'swap'];

// Parse an action name back into an action object (for replaying solutions).
export function parseAction(name) {
  const i = ACTION_NAMES.indexOf(name);
  return ACTIONS[i];
}

export function stateKey(s) {
  const m = s.mech;
  const c = s.crow;
  // the facing only matters when there is something to act on
  let dk = '-';
  if (m.grab) dk = m.dir;
  else {
    const f = mechFacing(s);
    if (f.crate || f.console) dk = m.dir;
  }
  const parts = [
    m.x, m.z, dk,
    (m.upgrades.arm ? 1 : 0) + '' + (m.upgrades.legs ? 1 : 0),
    m.grab || '-',
    c.inMech ? 'M' : (c.x + ':' + c.z),
    c.carry || '-',
    s.checkpoint[0] + ':' + s.checkpoint[1],
    s.won ? 'W' : '-',
  ];
  for (const e of s.ents) {
    if (e.type === 'crate') parts.push(e.x + ':' + e.z);
    else if (e.type === 'stick') parts.push(e.gone ? 'g' : (e.carried ? 'c' : e.x + ':' + e.z));
    else if (e.type === 'cog') parts.push(e.jammed ? 1 : 0);
    else if (e.type === 'console') parts.push(e.used ? 1 : 0);
  }
  return parts.join(',');
}

function pathOf(parent, pact, i) {
  const out = [];
  while (parent[i] >= 0) {
    out.push(ACTION_NAMES[pact[i]]);
    i = parent[i];
  }
  out.reverse();
  return out;
}

function hasDeath(s) {
  for (const e of s.events) if (e.type === 'death') return true;
  return false;
}

// solve(roomIndex, carry, opts) -> { ok, steps, actions, explored, softlocks, softlockChecked,
//                                     softlockExamples, capped, ms }
export function solve(roomIndex, carry, opts) {
  opts = opts || {};
  const maxStates = opts.maxStates || 500000;
  const doSoft = opts.softlock !== false;
  const t0 = Date.now();
  const s0 = createState(roomIndex, carry);
  if (opts.strict) s0.beat = 'lasers';

  const nodes = [s0];
  const keyIdx = new Map();
  keyIdx.set(stateKey(s0), 0);
  const parent = [-1];
  const pact = [-1];
  const succ = [];
  const goal = [];
  let goalIdx = -1;
  let capped = false;

  for (let i = 0; i < nodes.length; i++) {
    const s = nodes[i];
    nodes[i] = null;
    const isGoal = !!(s.complete || s.won);
    goal[i] = isGoal;
    succ[i] = [];
    if (isGoal) {
      if (goalIdx < 0) goalIdx = i;
      if (!doSoft) break;
      continue;
    }
    for (let a = 0; a < ACTIONS.length; a++) {
      const c = clone(s);
      const changed = step(c, ACTIONS[a]);
      if (!changed) continue;
      if (hasDeath(c)) continue;
      const k = stateKey(c);
      let j = keyIdx.get(k);
      if (j === undefined) {
        if (nodes.length >= maxStates) { capped = true; continue; }
        j = nodes.length;
        nodes.push(c);
        keyIdx.set(k, j);
        parent.push(i);
        pact.push(a);
      }
      succ[i].push(j);
    }
  }

  const n = nodes.length;
  const result = {
    ok: goalIdx >= 0,
    steps: 0,
    actions: [],
    explored: n,
    softlocks: 0,
    softlockChecked: false,
    softlockExamples: [],
    capped: capped,
    ms: 0,
  };
  if (goalIdx >= 0) {
    result.actions = pathOf(parent, pact, goalIdx);
    result.steps = result.actions.length;
  }

  if (doSoft && !capped && goalIdx >= 0) {
    const preds = new Array(n);
    for (let i = 0; i < n; i++) preds[i] = [];
    for (let i = 0; i < n; i++) {
      const sl = succ[i];
      for (let k = 0; k < sl.length; k++) preds[sl[k]].push(i);
    }
    const can = new Uint8Array(n);
    const q = [];
    for (let i = 0; i < n; i++) if (goal[i]) { can[i] = 1; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) {
      const pl = preds[q[qi]];
      for (let k = 0; k < pl.length; k++) {
        const p = pl[k];
        if (!can[p]) { can[p] = 1; q.push(p); }
      }
    }
    let bad = 0;
    for (let i = 0; i < n; i++) {
      if (!can[i]) {
        bad++;
        if (result.softlockExamples.length < 3) result.softlockExamples.push(pathOf(parent, pact, i));
      }
    }
    result.softlocks = bad;
    result.softlockChecked = true;
  }
  result.ms = Date.now() - t0;
  return result;
}
