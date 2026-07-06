import { z } from 'zod';

/**
 * Shared shape of a strategy's rule lists — the exact format the engine
 * consumes (plan §4 /strategies payloads; §1 Phase 2 builder round-trip).
 * Kept structurally identical to core-engine's StrategyDefinition; the
 * contracts test suite pins that equivalence against the real built-ins.
 */

export const comparatorSchema = z.enum(['lt', 'lte', 'gt', 'gte', 'eq']);

export const conditionSubjectSchema = z.enum([
  'turnScore',
  'diceRemaining',
  'scoreDifferential',
  'hotDiceStreak',
  'candidateDieValue',
  'diceRemainingIfKept',
  'diceRemainingIfDeclined',
]);

const comparisonConditionSchema = z.object({
  type: z.literal('comparison'),
  subject: conditionSubjectSchema,
  cmp: comparatorSchema,
  value: z.number(),
});

const alwaysConditionSchema = z.object({ type: z.literal('always') });

export type StrategyConditionInput =
  | z.infer<typeof comparisonConditionSchema>
  | z.infer<typeof alwaysConditionSchema>
  | { type: 'and' | 'or'; conditions: StrategyConditionInput[] };

export const strategyConditionSchema: z.ZodType<StrategyConditionInput> = z.lazy(() =>
  z.union([
    comparisonConditionSchema,
    alwaysConditionSchema,
    z.object({
      type: z.enum(['and', 'or']),
      conditions: z.array(strategyConditionSchema),
    }),
  ]),
);

export const keepRuleSchema = z.object({
  condition: strategyConditionSchema,
  action: z.enum(['keep', 'decline']),
});

export const bankRuleSchema = z.object({
  condition: strategyConditionSchema,
  action: z.enum(['bank', 'roll']),
});

export const strategyDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  keepPolicy: z.array(keepRuleSchema),
  bankPolicy: z.array(bankRuleSchema),
});

export type StrategyDefinitionInput = z.infer<typeof strategyDefinitionSchema>;
