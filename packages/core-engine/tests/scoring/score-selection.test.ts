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

describe('scoreSelection — straight 1–6 (A.1: 1500)', () => {
  it('scores the straight over the face-wise reading', () => {
    // face-wise would be 100 + 50 with four dead dice -> illegal; straight rescues it
    expect(score([1, 2, 3, 4, 5, 6])).toBe(1500);
    expect(score([6, 5, 4, 3, 2, 1])).toBe(1500);
  });

  it('reads the configured straight value', () => {
    expect(scoreSelection([1, 2, 3, 4, 5, 6], { ...DEFAULT_RULESET, straightValue: 2000 })).toBe(
      2000,
    );
  });

  it('five in a row is not a straight', () => {
    expect(score([1, 2, 3, 4, 5])).toBeNull();
    expect(score([2, 3, 4, 5, 6])).toBeNull();
  });
});

describe('scoreSelection — three pairs (A.1: 1500; exactly three distinct face pairs)', () => {
  it.each<[DieValue[]]>([[[2, 2, 3, 3, 4, 4]], [[1, 1, 5, 5, 6, 6]], [[2, 2, 4, 4, 6, 6]]])(
    '%j scores 1500',
    (dice) => {
      expect(score(dice)).toBe(1500);
    },
  );

  it('beats the face-wise reading when pairs include 1s and 5s', () => {
    // face-wise: 200 + 100 but the 3s are dead -> illegal; three pairs applies
    expect(score([1, 1, 5, 5, 3, 3])).toBe(1500);
  });

  it('four of a kind plus a pair is NOT three pairs (phase-1 notes decision)', () => {
    expect(score([2, 2, 2, 2, 3, 3])).toBeNull();
    // ...but 4oak + scoring pair still scores face-wise
    expect(score([2, 2, 2, 2, 5, 5])).toBe(1100);
  });

  it('reads the configured three-pairs value', () => {
    expect(
      scoreSelection([2, 2, 3, 3, 4, 4], { ...DEFAULT_RULESET, threePairsValue: 600 }),
    ).toBe(600);
  });
});

describe('scoreSelection — two triplets (A.1.1 #5: on by default, 2500)', () => {
  it('scores two distinct triplets as the combo when better', () => {
    // face-wise: 200 + 300 = 500; combo: 2500
    expect(score([2, 2, 2, 3, 3, 3])).toBe(2500);
    expect(score([1, 1, 1, 5, 5, 5])).toBe(2500);
  });

  it('falls back to face-wise when the combo is disabled', () => {
    const off = { ...DEFAULT_RULESET, twoTripletsEnabled: false };
    expect(scoreSelection([2, 2, 2, 3, 3, 3], off)).toBe(500);
    expect(scoreSelection([1, 1, 1, 6, 6, 6], off)).toBe(1600);
  });

  it('never scores below the face-wise reading (max interpretation)', () => {
    // face-wise: 1000 + 600 = 1600 < 2500 -> combo wins; but with a cheap
    // two-triplets config the face-wise reading must win instead
    const cheap = { ...DEFAULT_RULESET, twoTripletsValue: 800 };
    expect(scoreSelection([1, 1, 1, 6, 6, 6], cheap)).toBe(1600);
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
