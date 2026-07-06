import type { BankRule, KeepRule, StrategyCondition, StrategyDefinition } from './types.js';

/** Built-ins are defined in code as the source of truth (plan §6 decision 13). */

const bankWhen = (diceRemaining: number, minTurnScore: number): BankRule => ({
  condition: {
    type: 'and',
    conditions: [
      { type: 'comparison', subject: 'diceRemaining', cmp: 'eq', value: diceRemaining },
      { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: minTurnScore },
    ],
  },
  action: 'bank',
});

const candidateIs = (value: number): StrategyCondition => ({
  type: 'comparison',
  subject: 'candidateDieValue',
  cmp: 'eq',
  value,
});

const declineWhen = (
  candidate: number,
  remainingIfDeclined: { cmp: 'eq' | 'gte'; value: number },
  turnScoreBelow?: number,
): KeepRule => ({
  condition: {
    type: 'and',
    conditions: [
      candidateIs(candidate),
      {
        type: 'comparison',
        subject: 'diceRemainingIfDeclined',
        cmp: remainingIfDeclined.cmp,
        value: remainingIfDeclined.value,
      },
      ...(turnScoreBelow === undefined
        ? []
        : [
            {
              type: 'comparison',
              subject: 'turnScore',
              cmp: 'lt',
              value: turnScoreBelow,
            } satisfies StrategyCondition,
          ]),
    ],
  },
  action: 'decline',
});

const alwaysBankAt300: StrategyDefinition = {
  schemaVersion: 1,
  id: 'always-bank-at-300',
  name: 'Always bank at 300',
  keepPolicy: [],
  bankPolicy: [
    {
      condition: { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 300 },
      action: 'bank',
    },
  ],
};

const greedy: StrategyDefinition = {
  schemaVersion: 1,
  id: 'greedy',
  name: 'Greedy',
  keepPolicy: [],
  bankPolicy: [], // fallthrough: roll until forced to stop
};

const valueAware: StrategyDefinition = {
  schemaVersion: 1,
  id: 'value-aware',
  name: 'Value-aware',
  // Declines lone 5s when at least two dice would remain (plan §1 Phase 1);
  // banks at 300 like the baseline so the keep policy is the only variable.
  keepPolicy: [declineWhen(5, { cmp: 'gte', value: 2 })],
  bankPolicy: alwaysBankAt300.bankPolicy,
};

/**
 * EV-optimal for the DEFAULT ruleset only (plan §6 decision 1). Thresholds
 * computed by the value-iteration DP in tools/compute-ev.ts over the v1
 * action space; regenerate there if the default scoring table ever changes.
 */
const evOptimal: StrategyDefinition = {
  schemaVersion: 1,
  id: 'ev-optimal',
  name: 'EV-optimal (default rules)',
  keepPolicy: [
    declineWhen(5, { cmp: 'eq', value: 3 }, 250),
    declineWhen(5, { cmp: 'eq', value: 4 }, 750),
    declineWhen(5, { cmp: 'gte', value: 5 }),
    declineWhen(1, { cmp: 'eq', value: 4 }, 450),
    declineWhen(1, { cmp: 'eq', value: 5 }, 1800),
  ],
  bankPolicy: [
    bankWhen(1, 350),
    bankWhen(2, 250),
    bankWhen(3, 450),
    bankWhen(4, 1050),
    bankWhen(5, 3100),
    // six dice: rolling always dominates banking
  ],
};

export const BUILTIN_STRATEGIES: readonly StrategyDefinition[] = [
  alwaysBankAt300,
  greedy,
  valueAware,
  evOptimal,
];

export function getBuiltinStrategy(id: string): StrategyDefinition {
  const strategy = BUILTIN_STRATEGIES.find((s) => s.id === id);
  if (!strategy) {
    throw new Error(`unknown built-in strategy '${id}'`);
  }
  return strategy;
}
