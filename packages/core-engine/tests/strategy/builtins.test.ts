import { describe, expect, it } from 'vitest';
import { BUILTIN_STRATEGIES, getBuiltinStrategy } from '../../src/strategy/builtins.js';
import { evaluateBankPolicy, evaluateKeepPolicy } from '../../src/strategy/policies.js';

const bankDecision = (id: string, turnScore: number, diceRemaining: number) =>
  evaluateBankPolicy(getBuiltinStrategy(id).bankPolicy, { turnScore, diceRemaining });

const keepDecision = (
  id: string,
  candidateDieValue: number,
  diceRemainingIfDeclined: number,
  turnScore: number,
) =>
  evaluateKeepPolicy(getBuiltinStrategy(id).keepPolicy, {
    candidateDieValue,
    diceRemainingIfKept: diceRemainingIfDeclined - 1,
    diceRemainingIfDeclined,
    turnScore,
  });

describe('built-in registry', () => {
  it('ships the four reference strategies under stable ids (decision 13)', () => {
    expect(BUILTIN_STRATEGIES.map((s) => s.id)).toEqual([
      'always-bank-at-300',
      'greedy',
      'value-aware',
      'ev-optimal',
    ]);
    for (const s of BUILTIN_STRATEGIES) {
      expect(s.schemaVersion).toBe(1);
      expect(getBuiltinStrategy(s.id)).toBe(s);
    }
  });

  it('rejects unknown ids', () => {
    expect(() => getBuiltinStrategy('nope')).toThrow(/unknown/i);
  });
});

describe('always-bank-at-300 (keep all, bank at >=300)', () => {
  it.each([
    [300, 4, 'bank'],
    [250, 4, 'roll'],
    [1000, 6, 'bank'],
    [0, 6, 'roll'],
  ])('turn=%d dice=%d -> %s', (turnScore, dice, expected) => {
    expect(bankDecision('always-bank-at-300', turnScore, dice)).toBe(expected);
  });

  it('keeps every discretionary die', () => {
    expect(keepDecision('always-bank-at-300', 5, 5, 0)).toBe('keep');
  });
});

describe('greedy (keep all, never bank voluntarily)', () => {
  it('always rolls', () => {
    expect(bankDecision('greedy', 10_000, 1)).toBe('roll');
    expect(bankDecision('greedy', 500, 6)).toBe('roll');
  });
});

describe('value-aware (declines lone 5s when >=2 dice would remain)', () => {
  it.each([
    [5, 2, 'decline'],
    [5, 5, 'decline'],
    [5, 1, 'keep'],
    [1, 5, 'keep'], // only 5s are declined
  ])('candidate=%d remaining-if-declined=%d -> %s', (value, remaining, expected) => {
    expect(keepDecision('value-aware', value, remaining, 0)).toBe(expected);
  });

  it('banks at 300 like the baseline', () => {
    expect(bankDecision('value-aware', 300, 3)).toBe('bank');
    expect(bankDecision('value-aware', 250, 3)).toBe('roll');
  });
});

describe('ev-optimal (default-ruleset DP table — tools/compute-ev.ts)', () => {
  // Bank thresholds by dice remaining: 1->350, 2->250, 3->450, 4->1050, 5->3100, 6->never.
  it.each([
    [350, 1, 'bank'],
    [300, 1, 'roll'],
    [250, 2, 'bank'],
    [200, 2, 'roll'],
    [450, 3, 'bank'],
    [400, 3, 'roll'],
    [1050, 4, 'bank'],
    [1000, 4, 'roll'],
    [3100, 5, 'bank'],
    [3050, 5, 'roll'],
    [9000, 6, 'roll'],
  ])('turn=%d dice=%d -> %s', (turnScore, dice, expected) => {
    expect(bankDecision('ev-optimal', turnScore, dice)).toBe(expected);
  });

  // Keep table: decline lone 5 at (r=3, s<250), (r=4, s<750), (r>=5, always);
  // decline lone 1 at (r=4, s<450) and (r=5, s<1800).
  it.each([
    [5, 2, 0, 'keep'],
    [5, 3, 200, 'decline'],
    [5, 3, 250, 'keep'],
    [5, 4, 700, 'decline'],
    [5, 4, 750, 'keep'],
    [5, 5, 5000, 'decline'],
    [1, 3, 0, 'keep'],
    [1, 4, 400, 'decline'],
    [1, 4, 450, 'keep'],
    [1, 5, 1750, 'decline'],
    [1, 5, 1800, 'keep'],
  ])('candidate=%d remaining-if-declined=%d turn=%d -> %s', (value, r, s, expected) => {
    expect(keepDecision('ev-optimal', value, r, s)).toBe(expected);
  });
});
