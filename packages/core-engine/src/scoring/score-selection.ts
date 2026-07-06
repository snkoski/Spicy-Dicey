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

  const wholeSet = scoreWholeSet(counts, ruleset);
  if (wholeSet !== null) {
    candidates.push(wholeSet);
  }

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

/**
 * Whole-multiset combos that only exist as an exact pattern over all six
 * kept dice: straight, three pairs, two triplets.
 */
function scoreWholeSet(counts: ReturnType<typeof toCounts>, ruleset: RulesetConfig): number | null {
  const pattern = counts.slice(1).filter((n) => n > 0);
  pattern.sort((a, b) => a - b);

  if (pattern.length === 6) {
    return ruleset.straightValue; // one of each face
  }
  if (pattern.length === 3 && pattern.every((n) => n === 2)) {
    return ruleset.threePairsValue;
  }
  if (ruleset.twoTripletsEnabled && pattern.length === 2 && pattern.every((n) => n === 3)) {
    return ruleset.twoTripletsValue;
  }
  return null;
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
    if (n >= 3) {
      total += nOfAKindValue(face, n, ruleset);
      continue;
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

function nOfAKindValue(face: number, n: number, ruleset: RulesetConfig): number {
  const threeValue =
    face === 1 ? ruleset.threeOnesValue : face * ruleset.threeOfAKindFaceMultiplier;
  if (n === 3) {
    return threeValue;
  }
  if (ruleset.nOfAKindScaling === 'doubling') {
    return threeValue * 2 ** (n - 3);
  }
  if (n === 4) {
    return ruleset.fourOfAKindFlatValue;
  }
  if (n === 5) {
    return ruleset.fiveOfAKindFlatValue;
  }
  return ruleset.sixOfAKindFlatValue;
}
