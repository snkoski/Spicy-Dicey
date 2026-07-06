import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { enumerateLegalSelections, isFarkle } from '../../src/scoring/enumerate.js';
import type { DieValue } from '../../src/dice/types.js';

const enumerate = (roll: DieValue[]) => enumerateLegalSelections(roll, DEFAULT_RULESET);
const diceOf = (roll: DieValue[]) => enumerate(roll).map((s) => s.dice);

describe('enumerateLegalSelections', () => {
  it('lists every legal sub-multiset of a simple roll', () => {
    expect(diceOf([1, 5])).toEqual([[1], [5], [1, 5]]);
  });

  it('offers partial combos: three of four matching dice can be kept', () => {
    expect(diceOf([2, 2, 2, 2])).toEqual([
      [2, 2, 2],
      [2, 2, 2, 2],
    ]);
  });

  it('only the scoring dice of a mixed roll are selectable', () => {
    expect(diceOf([1, 2, 3, 4, 6, 6])).toEqual([[1]]);
  });

  it('a triple with a discretionary five offers declining the five', () => {
    expect(diceOf([2, 2, 2, 5])).toEqual([[5], [2, 2, 2], [2, 2, 2, 5]]);
  });

  it('includes whole-set combos alongside their scoring singles', () => {
    expect(diceOf([1, 2, 3, 4, 5, 6])).toEqual([[1], [5], [1, 5], [1, 2, 3, 4, 5, 6]]);
  });

  it('three pairs with scoring pairs: every singles subset plus the full set', () => {
    expect(diceOf([1, 1, 5, 5, 3, 3])).toEqual([
      [1],
      [5],
      [1, 1],
      [1, 5],
      [5, 5],
      [1, 1, 5],
      [1, 5, 5],
      [1, 1, 5, 5],
      [1, 1, 3, 3, 5, 5],
    ]);
  });

  it('attaches the max-interpretation score to each selection', () => {
    const selections = enumerate([2, 2, 2, 5]);
    expect(selections).toContainEqual({ dice: [2, 2, 2], score: 200 });
    expect(selections).toContainEqual({ dice: [2, 2, 2, 5], score: 250 });
  });

  it('returns an empty list for a farkled roll', () => {
    expect(enumerate([2, 3, 4, 6, 6, 2])).toEqual([]);
  });
});

describe('isFarkle', () => {
  it.each<[DieValue[], boolean]>([
    [[2, 3, 4, 6, 6, 2], true],
    [[2, 2, 4, 4, 6, 3], true],
    [[3, 3, 4, 4, 6, 6], false], // three pairs
    [[2, 3, 4, 6], true],
    [[1, 2, 3, 4, 6, 6], false],
    [[5], false],
    [[2, 2, 2], false],
  ])('%j -> %s', (roll, expected) => {
    expect(isFarkle(roll, DEFAULT_RULESET)).toBe(expected);
  });
});
