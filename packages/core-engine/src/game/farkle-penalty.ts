import type { RulesetConfig } from '../ruleset/types.js';

export interface FarkleBankState {
  consecutiveFarkles: number;
  bankedTotal: number;
}

export interface FarkleBankResult extends FarkleBankState {
  penaltyApplied: number;
}

/**
 * Bookkeeping for a farkled turn (§6 decision 18): the counter always
 * increments; under three-consecutive-penalty the third in a row deducts
 * the configured penalty from the banked total (which may go negative)
 * and resets the counter so it recurs every third consecutive farkle.
 * The counter reset on banking is the game runner's job.
 */
export function applyFarkleToBank(
  state: FarkleBankState,
  ruleset: RulesetConfig,
): FarkleBankResult {
  const count = state.consecutiveFarkles + 1;
  if (ruleset.farklePenaltyVariant === 'three-consecutive-penalty' && count >= 3) {
    return {
      consecutiveFarkles: 0,
      bankedTotal: state.bankedTotal - ruleset.farkleConsecutivePenalty,
      penaltyApplied: ruleset.farkleConsecutivePenalty,
    };
  }
  return { consecutiveFarkles: count, bankedTotal: state.bankedTotal, penaltyApplied: 0 };
}
