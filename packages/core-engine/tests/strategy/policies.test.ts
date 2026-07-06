import { describe, expect, it } from 'vitest';
import { evaluateBankPolicy, evaluateKeepPolicy } from '../../src/strategy/policies.js';
import type { BankRule, KeepRule } from '../../src/strategy/types.js';

describe('evaluateBankPolicy', () => {
  const bankAt300: BankRule[] = [
    {
      condition: { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 300 },
      action: 'bank',
    },
  ];

  it('first matching rule wins', () => {
    expect(evaluateBankPolicy(bankAt300, { turnScore: 300, diceRemaining: 4 })).toBe('bank');
    expect(evaluateBankPolicy(bankAt300, { turnScore: 250, diceRemaining: 4 })).toBe('roll');
  });

  it('earlier rules shadow later ones', () => {
    const rules: BankRule[] = [
      {
        condition: { type: 'comparison', subject: 'diceRemaining', cmp: 'gte', value: 5 },
        action: 'roll',
      },
      { condition: { type: 'always' }, action: 'bank' },
    ];
    expect(evaluateBankPolicy(rules, { turnScore: 1000, diceRemaining: 6 })).toBe('roll');
    expect(evaluateBankPolicy(rules, { turnScore: 50, diceRemaining: 2 })).toBe('bank');
  });

  it('an empty or unmatched policy falls through to roll (greedy default)', () => {
    expect(evaluateBankPolicy([], { turnScore: 5000, diceRemaining: 1 })).toBe('roll');
  });
});

describe('evaluateKeepPolicy', () => {
  const declineLoneFives: KeepRule[] = [
    {
      condition: {
        type: 'and',
        conditions: [
          { type: 'comparison', subject: 'candidateDieValue', cmp: 'eq', value: 5 },
          { type: 'comparison', subject: 'diceRemainingIfDeclined', cmp: 'gte', value: 2 },
        ],
      },
      action: 'decline',
    },
  ];

  it('declines the lone five when enough dice would remain', () => {
    expect(
      evaluateKeepPolicy(declineLoneFives, {
        candidateDieValue: 5,
        diceRemainingIfKept: 1,
        diceRemainingIfDeclined: 2,
        turnScore: 100,
      }),
    ).toBe('decline');
  });

  it('keeps the same five when too few dice would remain', () => {
    expect(
      evaluateKeepPolicy(declineLoneFives, {
        candidateDieValue: 5,
        diceRemainingIfKept: 0,
        diceRemainingIfDeclined: 1,
        turnScore: 100,
      }),
    ).toBe('keep');
  });

  it('an empty policy keeps everything (greedy default)', () => {
    expect(
      evaluateKeepPolicy([], {
        candidateDieValue: 1,
        diceRemainingIfKept: 3,
        diceRemainingIfDeclined: 4,
        turnScore: 0,
      }),
    ).toBe('keep');
  });
});
