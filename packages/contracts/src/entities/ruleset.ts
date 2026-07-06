import { z } from 'zod';

/** Wire shape of the engine's RulesetConfig — pinned in tests against the
 * engine's DEFAULT_RULESET so the two can't drift. */
export const rulesetConfigSchema = z.object({
  singleOneValue: z.number().int().nonnegative(),
  singleFiveValue: z.number().int().nonnegative(),
  threeOnesValue: z.number().int().nonnegative(),
  threeOfAKindFaceMultiplier: z.number().int().nonnegative(),
  nOfAKindScaling: z.enum(['flat', 'doubling']),
  fourOfAKindFlatValue: z.number().int().nonnegative(),
  fiveOfAKindFlatValue: z.number().int().nonnegative(),
  sixOfAKindFlatValue: z.number().int().nonnegative(),
  straightValue: z.number().int().nonnegative(),
  threePairsValue: z.number().int().nonnegative(),
  twoTripletsEnabled: z.boolean(),
  twoTripletsValue: z.number().int().nonnegative(),
  onTheBoardEnabled: z.boolean(),
  onTheBoardMinimum: z.number().int().nonnegative(),
  targetScore: z.number().int().positive(),
  endGameVariant: z.enum(['instant', 'final-round']),
  farklePenaltyVariant: z.enum(['turn-points-only', 'three-consecutive-penalty']),
  farkleConsecutivePenalty: z.number().int().nonnegative(),
});

export type RulesetConfigInput = z.infer<typeof rulesetConfigSchema>;
