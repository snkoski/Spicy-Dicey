import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { chooseStrategySelection } from '../../src/strategy/select.js';
import type { KeepRule } from '../../src/strategy/types.js';
import type { DieValue } from '../../src/dice/types.js';

const ctx = { turnScoreBeforeSelection: 0, scoreDifferential: 0, hotDiceStreak: 0 };
const greedy: KeepRule[] = [];
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

const choose = (roll: DieValue[], keepPolicy: KeepRule[]) =>
  chooseStrategySelection(roll, DEFAULT_RULESET, keepPolicy, ctx);

describe('chooseStrategySelection (v1: complete combos always; keep policy decides lone 1s/5s)', () => {
  it('greedy keeps the triple and every discretionary single', () => {
    expect(choose([2, 2, 2, 1, 5, 3], greedy)).toEqual([1, 2, 2, 2, 5]);
  });

  it('value-aware declines the lone five when two dice would remain', () => {
    expect(choose([2, 2, 2, 1, 5, 3], declineLoneFives)).toEqual([1, 2, 2, 2]);
  });

  it('keeps the five when declining it would leave too few dice', () => {
    // one 5 + junk: declining leaves 1 die -> rule doesn't match -> keep
    expect(choose([5, 3], declineLoneFives)).toEqual([5]);
  });

  it('never returns an empty selection: the best single is forced', () => {
    // decline matches (4 junk dice would remain) but something must be kept
    expect(choose([5, 2, 3, 4], declineLoneFives)).toEqual([5]);
  });

  it('takes whole-set combos in full', () => {
    expect(choose([3, 1, 4, 2, 6, 5], greedy)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(choose([4, 2, 3, 3, 2, 4], greedy)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(choose([1, 1, 1, 5, 5, 5], greedy)).toEqual([1, 1, 1, 5, 5, 5]);
  });

  it('a straight overrides the keep policy for its 1 and 5', () => {
    expect(choose([1, 2, 3, 4, 5, 6], declineLoneFives)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pairs of 1s are decided die by die', () => {
    expect(choose([1, 1, 3, 4, 6, 6], greedy)).toEqual([1, 1]);
  });

  it('the selection is always legal for the roll', () => {
    const selection = choose([2, 2, 2, 1, 5, 3], declineLoneFives);
    // triple of 2s + the kept 1
    expect(selection).toEqual([1, 2, 2, 2]);
  });
});
