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
