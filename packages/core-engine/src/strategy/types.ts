export type Comparator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';

/**
 * Everything a condition can reference (plan Appendix B). Bank policies see
 * turnScore / diceRemaining / scoreDifferential / hotDiceStreak; keep policies
 * additionally see the candidate die subjects. A subject absent from the
 * evaluation context simply never matches.
 */
export type ConditionSubject =
  | 'turnScore'
  | 'diceRemaining'
  | 'scoreDifferential' // own total minus best opponent total (§6 decision 3)
  | 'hotDiceStreak'
  | 'candidateDieValue'
  | 'diceRemainingIfKept'
  | 'diceRemainingIfDeclined';

export interface ComparisonCondition {
  type: 'comparison';
  subject: ConditionSubject;
  cmp: Comparator;
  value: number;
}

export interface CompositeCondition {
  type: 'and' | 'or';
  conditions: StrategyCondition[];
}

/** Explicit catch-all for the bottom of a first-match-wins list. */
export interface AlwaysCondition {
  type: 'always';
}

export type StrategyCondition = ComparisonCondition | CompositeCondition | AlwaysCondition;

export interface KeepRule {
  condition: StrategyCondition;
  action: 'keep' | 'decline';
}

export interface BankRule {
  condition: StrategyCondition;
  action: 'bank' | 'roll';
}

/** Two ordered first-match-wins rule lists (plan §1 Phase 1). */
export interface StrategyDefinition {
  schemaVersion: 1;
  id: string;
  name: string;
  keepPolicy: KeepRule[];
  bankPolicy: BankRule[];
}

/** Numeric facts a policy is evaluated against. */
export type ConditionContext = Partial<Record<ConditionSubject, number>>;
