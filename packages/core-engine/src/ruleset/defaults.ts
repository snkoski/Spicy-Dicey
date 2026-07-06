import type { RulesetConfig } from './types.js';

/** Defaults from plan Appendix A.1 / A.1.1. */
export const DEFAULT_RULESET: RulesetConfig = {
  singleOneValue: 100,
  singleFiveValue: 50,
  threeOnesValue: 1000,
  threeOfAKindFaceMultiplier: 100,
  nOfAKindScaling: 'flat',
  fourOfAKindFlatValue: 1000,
  fiveOfAKindFlatValue: 2000,
  sixOfAKindFlatValue: 3000,
  straightValue: 1500,
  threePairsValue: 1500,
  twoTripletsEnabled: true,
  twoTripletsValue: 2500,
  onTheBoardEnabled: true,
  onTheBoardMinimum: 500,
  targetScore: 10_000,
  endGameVariant: 'final-round',
  farklePenaltyVariant: 'turn-points-only',
  farkleConsecutivePenalty: 1000,
};
