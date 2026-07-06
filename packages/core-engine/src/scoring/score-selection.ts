import type { DieValue } from '../dice/types.js';
import type { RulesetConfig } from '../ruleset/types.js';
import { toCounts } from './counts.js';

/**
 * Score a kept selection at its maximum interpretation (plan §6 decision 2),
 * or return null if the selection is illegal — i.e. empty, or any kept die
 * contributes to no scoring combo.
 */
export function scoreSelection(dice: readonly DieValue[], ruleset: RulesetConfig): number | null {
  if (dice.length === 0) {
    return null;
  }
  const counts = toCounts(dice);
  const candidates: number[] = [];

  const faceWise = scoreFaceWise(counts, ruleset);
  if (faceWise !== null) {
    candidates.push(faceWise);
  }

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

/**
 * Face-by-face interpretation: each face's dice must score on their own —
 * singles for 1s/5s below three-of-a-kind, N-of-a-kind at three or more.
 * Any face with a non-scoring residue makes the whole interpretation illegal.
 */
function scoreFaceWise(counts: ReturnType<typeof toCounts>, ruleset: RulesetConfig): number | null {
  let total = 0;
  for (let face = 1; face <= 6; face += 1) {
    const n = counts[face] ?? 0;
    if (n === 0) {
      continue;
    }
    if (n === 3) {
      total +=
        face === 1 ? ruleset.threeOnesValue : face * ruleset.threeOfAKindFaceMultiplier;
      continue;
    }
    if (n > 3) {
      // 4/5/6-of-a-kind: next cycle.
      return null;
    }
    if (face === 1) {
      total += n * ruleset.singleOneValue;
    } else if (face === 5) {
      total += n * ruleset.singleFiveValue;
    } else {
      return null; // 1-2 of a non-single face never scores
    }
  }
  return total;
}
