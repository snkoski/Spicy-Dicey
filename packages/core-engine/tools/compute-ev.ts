/**
 * One-off generator for the EV-optimal built-in strategy (plan §6 decision 1).
 *
 * Computes, for the DEFAULT ruleset only and within the v1 strategy action
 * space (complete combos always taken; only lone 1s/5s discretionary):
 *
 *   W(d, s) = expected banked outcome of optimal play holding turn score s
 *             with d dice to roll, choosing bank vs roll optimally.
 *   R(d, s) = EV of rolling d dice at turn score s.
 *
 * Emits:
 *   - bank thresholds T[d] = min s where banking beats rolling d dice
 *   - keep/decline analysis for a discretionary lone 5 / lone 1
 *
 * Run: pnpm --filter @spicy-dicey/core-engine exec tsx tools/compute-ev.ts
 * Output is hand-carried into src/strategy/builtins.ts with a pointer here.
 * On-the-board gating is ignored (thresholds far below 500 only affect the
 * first bank; the game runner enforces the gate regardless).
 */
import { DEFAULT_RULESET } from '../src/ruleset/defaults.js';
import { scoreSelection } from '../src/scoring/score-selection.js';
import type { DieValue } from '../src/dice/types.js';

const STEP = 50;
const CAP = 10_000;
const LEVELS = CAP / STEP;

type Counts = number[]; // index 1..6

interface RollOutcome {
  probability: number;
  /** v1-legal selections: [score, diceKept] pairs (deduped). */
  selections: Array<{ score: number; kept: number }>;
}

function* multisets(d: number): Generator<Counts> {
  const counts: Counts = [0, 0, 0, 0, 0, 0, 0];
  function* place(face: number, left: number): Generator<Counts> {
    if (face === 6) {
      counts[6] = left;
      yield [...counts];
      counts[6] = 0;
      return;
    }
    for (let take = 0; take <= left; take += 1) {
      counts[face] = take;
      yield* place(face + 1, left - take);
      counts[face] = 0;
    }
  }
  yield* place(1, d);
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i += 1) {
    f *= i;
  }
  return f;
}

function toDice(counts: Counts): DieValue[] {
  const dice: DieValue[] = [];
  for (let face = 1; face <= 6; face += 1) {
    for (let i = 0; i < (counts[face] ?? 0); i += 1) {
      dice.push(face as DieValue);
    }
  }
  return dice;
}

/** v1 selections for a roll: whole-set combo, or mandatory 3+ faces plus any number of lone 1s/5s. */
function v1Selections(counts: Counts, d: number): Array<{ score: number; kept: number }> {
  const pattern = counts
    .slice(1)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const isWholeSet =
    d === 6 &&
    (pattern.length === 6 ||
      (pattern.length === 3 && pattern.every((n) => n === 2)) ||
      (pattern.length === 2 && pattern.every((n) => n === 3)));
  if (isWholeSet) {
    const score = scoreSelection(toDice(counts), DEFAULT_RULESET);
    return score === null ? [] : [{ score, kept: d }];
  }

  const mandatory: DieValue[] = [];
  for (let face = 1; face <= 6; face += 1) {
    if ((counts[face] ?? 0) >= 3) {
      for (let i = 0; i < (counts[face] ?? 0); i += 1) {
        mandatory.push(face as DieValue);
      }
    }
  }
  const loneOnes = (counts[1] ?? 0) < 3 ? (counts[1] ?? 0) : 0;
  const loneFives = (counts[5] ?? 0) < 3 ? (counts[5] ?? 0) : 0;

  const out: Array<{ score: number; kept: number }> = [];
  for (let k1 = 0; k1 <= loneOnes; k1 += 1) {
    for (let k5 = 0; k5 <= loneFives; k5 += 1) {
      const dice = [...mandatory];
      for (let i = 0; i < k1; i += 1) {
        dice.push(1);
      }
      for (let i = 0; i < k5; i += 1) {
        dice.push(5);
      }
      if (dice.length === 0) {
        continue;
      }
      const score = scoreSelection(dice, DEFAULT_RULESET);
      if (score !== null) {
        out.push({ score, kept: dice.length });
      }
    }
  }
  return out;
}

function outcomes(d: number): RollOutcome[] {
  const result: RollOutcome[] = [];
  for (const counts of multisets(d)) {
    let permutations = factorial(d);
    for (let face = 1; face <= 6; face += 1) {
      permutations /= factorial(counts[face] ?? 0);
    }
    result.push({
      probability: permutations / 6 ** d,
      selections: v1Selections(counts, d),
    });
  }
  return result;
}

const outcomesByDice = new Map<number, RollOutcome[]>();
for (let d = 1; d <= 6; d += 1) {
  outcomesByDice.set(d, outcomes(d));
}

// W[d][level] — level = s / STEP; grid rows LEVELS..0 computed descending.
const W: number[][] = Array.from({ length: 7 }, () => new Array<number>(LEVELS + 1).fill(0));
const R: number[][] = Array.from({ length: 7 }, () => new Array<number>(LEVELS + 1).fill(0));

function wOf(d: number, s: number): number {
  if (s >= CAP) {
    return s; // deep enough that banking is always right
  }
  return W[d]![s / STEP]!;
}

for (let level = LEVELS; level >= 0; level -= 1) {
  const s = level * STEP;
  for (let d = 1; d <= 6; d += 1) {
    let ev = 0;
    for (const outcome of outcomesByDice.get(d)!) {
      let best = 0; // farkle: turn is worth 0
      for (const { score, kept } of outcome.selections) {
        const remaining = d - kept;
        const nextDice = remaining === 0 ? 6 : remaining;
        const sNext = s + score;
        best = Math.max(best, sNext >= CAP ? sNext : wOf(nextDice, sNext));
      }
      ev += outcome.probability * best;
    }
    R[d]![level] = ev;
    W[d]![level] = Math.max(s, ev);
  }
}

console.log('Bank thresholds T[d] (min turn score where banking beats rolling d dice):');
for (let d = 1; d <= 6; d += 1) {
  let threshold = CAP;
  for (let level = 0; level <= LEVELS; level += 1) {
    if (level * STEP >= R[d]![level]!) {
      threshold = level * STEP;
      break;
    }
  }
  console.log(`  d=${d}: T=${threshold}  (R(d,0)=${R[d]![0]!.toFixed(1)})`);
}

console.log('\nLone-5 keep vs decline (r = dice remaining if declined):');
for (let r = 2; r <= 5; r += 1) {
  const flips: string[] = [];
  let prev: boolean | null = null;
  for (let level = 0; level <= 40; level += 1) {
    const s = level * STEP;
    const evDecline = Math.max(s, R[r]![level]!);
    const sKept = s + 50;
    const rKept = r - 1 === 0 ? 6 : r - 1;
    const evKeep = Math.max(sKept, sKept >= CAP ? 0 : R[rKept]![sKept / STEP]!);
    const decline = evDecline > evKeep;
    if (prev === null || decline !== prev) {
      flips.push(`s=${s}: ${decline ? 'DECLINE' : 'keep'}`);
      prev = decline;
    }
  }
  console.log(`  r=${r}: ${flips.join(' | ')}`);
}

console.log('\nLone-1 keep vs decline (r = dice remaining if declined):');
for (let r = 2; r <= 5; r += 1) {
  const flips: string[] = [];
  let prev: boolean | null = null;
  for (let level = 0; level <= 40; level += 1) {
    const s = level * STEP;
    const evDecline = Math.max(s, R[r]![level]!);
    const sKept = s + 100;
    const rKept = r - 1 === 0 ? 6 : r - 1;
    const evKeep = Math.max(sKept, sKept >= CAP ? 0 : R[rKept]![sKept / STEP]!);
    const decline = evDecline > evKeep;
    if (prev === null || decline !== prev) {
      flips.push(`s=${s}: ${decline ? 'DECLINE' : 'keep'}`);
      prev = decline;
    }
  }
  console.log(`  r=${r}: ${flips.join(' | ')}`);
}
