import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../../src/strategy/conditions.js';
import type { StrategyCondition } from '../../src/strategy/types.js';

const ctx = { turnScore: 500, diceRemaining: 2, scoreDifferential: -700, hotDiceStreak: 1 };

describe('evaluateCondition', () => {
  it.each<[StrategyCondition, boolean]>([
    [{ type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 500 }, true],
    [{ type: 'comparison', subject: 'turnScore', cmp: 'gt', value: 500 }, false],
    [{ type: 'comparison', subject: 'turnScore', cmp: 'lte', value: 500 }, true],
    [{ type: 'comparison', subject: 'turnScore', cmp: 'lt', value: 500 }, false],
    [{ type: 'comparison', subject: 'turnScore', cmp: 'eq', value: 500 }, true],
    [{ type: 'comparison', subject: 'diceRemaining', cmp: 'lte', value: 1 }, false],
    [{ type: 'comparison', subject: 'scoreDifferential', cmp: 'lt', value: -500 }, true],
    [{ type: 'comparison', subject: 'hotDiceStreak', cmp: 'gte', value: 2 }, false],
  ])('%j -> %s', (condition, expected) => {
    expect(evaluateCondition(condition, ctx)).toBe(expected);
  });

  it('AND requires every branch; OR requires any', () => {
    const turnHigh: StrategyCondition = {
      type: 'comparison',
      subject: 'turnScore',
      cmp: 'gte',
      value: 500,
    };
    const oneDie: StrategyCondition = {
      type: 'comparison',
      subject: 'diceRemaining',
      cmp: 'lte',
      value: 1,
    };
    expect(evaluateCondition({ type: 'and', conditions: [turnHigh, oneDie] }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'or', conditions: [turnHigh, oneDie] }, ctx)).toBe(true);
    // nesting composes
    expect(
      evaluateCondition(
        { type: 'and', conditions: [turnHigh, { type: 'or', conditions: [oneDie, turnHigh] }] },
        ctx,
      ),
    ).toBe(true);
  });

  it('always matches unconditionally (explicit catch-all rules)', () => {
    expect(evaluateCondition({ type: 'always' }, ctx)).toBe(true);
  });

  it('a subject missing from the context never matches', () => {
    // keep-policy-only subjects evaluated in a bank context, e.g.
    expect(
      evaluateCondition(
        { type: 'comparison', subject: 'candidateDieValue', cmp: 'eq', value: 5 },
        ctx,
      ),
    ).toBe(false);
  });

  it('empty AND is true; empty OR is false (neutral elements)', () => {
    expect(evaluateCondition({ type: 'and', conditions: [] }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'or', conditions: [] }, ctx)).toBe(false);
  });
});
