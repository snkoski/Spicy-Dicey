import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { scoreSelection } from '../../src/scoring/score-selection.js';
import type { DieValue } from '../../src/dice/types.js';

const score = (dice: DieValue[]) => scoreSelection(dice, DEFAULT_RULESET);

describe('scoreSelection — singles (A.1: only 1s and 5s score as singles)', () => {
  it.each<[DieValue[], number]>([
    [[1], 100],
    [[5], 50],
    [[1, 1], 200],
    [[5, 5], 100],
    [[1, 5], 150],
    [[1, 1, 5], 250],
    [[1, 5, 5], 200],
  ])('%j scores %d', (dice, expected) => {
    expect(score(dice)).toBe(expected);
  });
});

describe('scoreSelection — three of a kind (A.1: face × 100, three 1s = 1000)', () => {
  it.each<[DieValue[], number]>([
    [[1, 1, 1], 1000],
    [[2, 2, 2], 200],
    [[3, 3, 3], 300],
    [[4, 4, 4], 400],
    [[5, 5, 5], 500],
    [[6, 6, 6], 600],
  ])('%j scores %d', (dice, expected) => {
    expect(score(dice)).toBe(expected);
  });

  it.each<[DieValue[], number]>([
    [[2, 2, 2, 1], 300],
    [[2, 2, 2, 5], 250],
    [[6, 6, 6, 1, 5], 750],
    [[3, 3, 3, 1, 1], 500],
    [[4, 4, 4, 5, 5], 500],
  ])('triple plus singles %j scores %d', (dice, expected) => {
    expect(score(dice)).toBe(expected);
  });

  it('a triple plus a non-scoring die is illegal', () => {
    expect(score([2, 2, 2, 6])).toBeNull();
    expect(score([1, 1, 1, 4])).toBeNull();
  });
});

describe('scoreSelection — 4/5/6 of a kind, flat scaling (A.1 default: 1000/2000/3000 regardless of face)', () => {
  it.each<[DieValue[], number]>([
    [[2, 2, 2, 2], 1000],
    [[1, 1, 1, 1], 1000],
    [[6, 6, 6, 6], 1000],
    [[3, 3, 3, 3, 3], 2000],
    [[5, 5, 5, 5, 5], 2000],
    [[4, 4, 4, 4, 4, 4], 3000],
    [[1, 1, 1, 1, 1, 1], 3000],
  ])('%j scores %d', (dice, expected) => {
    expect(score(dice)).toBe(expected);
  });

  it.each<[DieValue[], number]>([
    [[2, 2, 2, 2, 1], 1100],
    [[6, 6, 6, 6, 5, 5], 1100],
    [[3, 3, 3, 3, 3, 1], 2100],
    [[1, 1, 1, 1, 5], 1050],
  ])('n-of-a-kind plus singles %j scores %d', (dice, expected) => {
    expect(score(dice)).toBe(expected);
  });

  it('an n-of-a-kind plus a non-scoring die is illegal', () => {
    expect(score([2, 2, 2, 2, 3])).toBeNull();
    expect(score([6, 6, 6, 6, 6, 2])).toBeNull();
  });
});

describe('scoreSelection — doubling n-of-a-kind scaling (§6 decision 17: 3oak(face) × 2^(n−3))', () => {
  const doubling = { ...DEFAULT_RULESET, nOfAKindScaling: 'doubling' as const };
  const scoreDoubling = (dice: DieValue[]) => scoreSelection(dice, doubling);

  it.each<[DieValue[], number]>([
    // examples straight from the plan appendix
    [[1, 1, 1, 1], 2000],
    [[1, 1, 1, 1, 1], 4000],
    [[1, 1, 1, 1, 1, 1], 8000],
    [[5, 5, 5, 5], 1000],
    [[5, 5, 5, 5, 5, 5], 4000],
    [[2, 2, 2, 2], 400],
    [[6, 6, 6, 6, 6], 2400],
  ])('%j scores %d under doubling', (dice, expected) => {
    expect(scoreDoubling(dice)).toBe(expected);
  });

  it('three of a kind is unchanged by the scaling toggle', () => {
    expect(scoreDoubling([4, 4, 4])).toBe(400);
    expect(scoreDoubling([1, 1, 1])).toBe(1000);
  });
});

describe('scoreSelection — illegal selections score null', () => {
  it.each<[DieValue[]]>([
    [[]], // must keep at least one scoring die
    [[2]],
    [[3]],
    [[4]],
    [[6]],
    [[6, 6]], // a lone pair never scores
    [[1, 2]], // the 2 contributes nothing -> whole selection illegal
    [[5, 3]],
    [[1, 1, 5, 4]],
  ])('%j is not a legal selection', (dice) => {
    expect(score(dice)).toBeNull();
  });
});
