import type { DieValue } from '../dice/types.js';
import type { RulesetConfig } from '../ruleset/types.js';
import { toCounts } from '../scoring/counts.js';
import { scoreSelection } from '../scoring/score-selection.js';
import { evaluateKeepPolicy } from './policies.js';
import type { ConditionContext, KeepRule } from './types.js';

/** Turn/game facts the keep policy may reference while selecting. */
export interface StrategyTurnContext {
  turnScoreBeforeSelection: number;
  scoreDifferential: number;
  hotDiceStreak: number;
}

/**
 * v1 strategy selection (plan §6 decision 2): complete combos are always
 * taken in full — whole-set combos (straight / three pairs / two triplets)
 * and every face with three or more dice. The keep policy only decides the
 * discretionary lone 1s and 5s, one die at a time (1s first). Something must
 * always be kept: if everything discretionary is declined and no combo
 * exists, the single best scoring die is forced.
 */
export function chooseStrategySelection(
  roll: readonly DieValue[],
  ruleset: RulesetConfig,
  keepPolicy: KeepRule[],
  context: StrategyTurnContext,
): DieValue[] {
  const counts = toCounts(roll);

  if (isWholeSetCombo(counts, roll.length, ruleset)) {
    return [...roll].sort((a, b) => a - b);
  }

  const kept: DieValue[] = [];
  for (let face = 1 as DieValue; face <= 6; face = (face + 1) as DieValue) {
    if ((counts[face] ?? 0) >= 3) {
      for (let i = 0; i < (counts[face] ?? 0); i += 1) {
        kept.push(face);
      }
    }
  }

  for (const face of [1, 5] as const) {
    if ((counts[face] ?? 0) >= 3) {
      continue; // already taken as a complete combo
    }
    for (let i = 0; i < (counts[face] ?? 0); i += 1) {
      const keptScore = scoreSelection(kept, ruleset) ?? 0;
      const conditionContext: ConditionContext = {
        candidateDieValue: face,
        turnScore: context.turnScoreBeforeSelection + keptScore,
        diceRemainingIfKept: roll.length - kept.length - 1,
        diceRemainingIfDeclined: roll.length - kept.length,
        scoreDifferential: context.scoreDifferential,
        hotDiceStreak: context.hotDiceStreak,
      };
      if (evaluateKeepPolicy(keepPolicy, conditionContext) === 'keep') {
        kept.push(face);
      }
    }
  }

  if (kept.length === 0) {
    // Every discretionary die was declined; a legal turn must keep one.
    const forced: DieValue | undefined =
      (counts[1] ?? 0) > 0 ? 1 : (counts[5] ?? 0) > 0 ? 5 : undefined;
    if (forced === undefined) {
      throw new Error('cannot select from a non-scoring roll');
    }
    kept.push(forced);
  }

  return kept.sort((a, b) => a - b);
}

function isWholeSetCombo(
  counts: ReturnType<typeof toCounts>,
  rollSize: number,
  ruleset: RulesetConfig,
): boolean {
  if (rollSize !== 6) {
    return false;
  }
  const pattern = counts
    .slice(1)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (pattern.length === 6) {
    return true; // straight
  }
  if (pattern.length === 3 && pattern.every((n) => n === 2)) {
    return true; // three pairs
  }
  return ruleset.twoTripletsEnabled && pattern.length === 2 && pattern.every((n) => n === 3);
}
