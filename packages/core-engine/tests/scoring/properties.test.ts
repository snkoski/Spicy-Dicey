import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { enumerateLegalSelections, isFarkle } from '../../src/scoring/enumerate.js';
import { scoreSelection } from '../../src/scoring/score-selection.js';
import { toCounts } from '../../src/scoring/counts.js';
import type { DieValue } from '../../src/dice/types.js';
import type { RulesetConfig } from '../../src/ruleset/types.js';

/**
 * PR CI runs a reduced numRuns for speed; the nightly workflow sets
 * FC_NUM_RUNS=100000 to satisfy the >=100k acceptance criterion
 * (plan §5, "Property-test CI budget"). The invariant never changes,
 * only the run count.
 */
const NUM_RUNS = Number(process.env['FC_NUM_RUNS'] ?? 2000);

const dieArb = fc.integer({ min: 1, max: 6 }) as fc.Arbitrary<DieValue>;
const rollArb = fc.array(dieArb, { minLength: 1, maxLength: 6 });

const rulesetArb: fc.Arbitrary<RulesetConfig> = fc.record({
  singleOneValue: fc.constantFrom(50, 100, 200),
  singleFiveValue: fc.constantFrom(25, 50, 100),
  threeOnesValue: fc.constantFrom(300, 1000, 1500),
  threeOfAKindFaceMultiplier: fc.constantFrom(50, 100),
  nOfAKindScaling: fc.constantFrom('flat', 'doubling') as fc.Arbitrary<'flat' | 'doubling'>,
  fourOfAKindFlatValue: fc.constantFrom(500, 1000),
  fiveOfAKindFlatValue: fc.constantFrom(1000, 2000),
  sixOfAKindFlatValue: fc.constantFrom(2000, 3000),
  straightValue: fc.constantFrom(1000, 1500, 2000),
  threePairsValue: fc.constantFrom(500, 1500),
  twoTripletsEnabled: fc.boolean(),
  twoTripletsValue: fc.constantFrom(800, 2500),
  onTheBoardEnabled: fc.constant(true),
  onTheBoardMinimum: fc.constant(500),
  targetScore: fc.constant(10_000),
  endGameVariant: fc.constant('final-round') as fc.Arbitrary<'final-round'>,
  farklePenaltyVariant: fc.constant('turn-points-only') as fc.Arbitrary<'turn-points-only'>,
  farkleConsecutivePenalty: fc.constant(1000),
});

/**
 * Independent oracle: the best full partition of the kept dice into scoring
 * combos, computed by brute-force recursion over combo extractions. Written
 * against the rules (plan Appendix A.1), not against the engine's algorithm.
 */
function oracleBestScore(dice: readonly DieValue[], ruleset: RulesetConfig): number | null {
  if (dice.length === 0) {
    return null;
  }
  const counts = [...toCounts(dice)] as number[];
  return oracleRecurse(counts, ruleset);
}

function oracleRecurse(counts: number[], ruleset: RulesetConfig): number | null {
  const remaining = counts.reduce((sum, n) => sum + n, 0);
  if (remaining === 0) {
    return 0;
  }
  let best: number | null = null;
  const consider = (value: number, consume: (c: number[]) => void): void => {
    const next = [...counts];
    consume(next);
    const rest = oracleRecurse(next, ruleset);
    if (rest !== null) {
      best = Math.max(best ?? -Infinity, value + rest);
    }
  };

  if ((counts[1] ?? 0) >= 1) {
    consider(ruleset.singleOneValue, (c) => void (c[1] = (c[1] ?? 0) - 1));
  }
  if ((counts[5] ?? 0) >= 1) {
    consider(ruleset.singleFiveValue, (c) => void (c[5] = (c[5] ?? 0) - 1));
  }
  for (let face = 1; face <= 6; face += 1) {
    for (let m = 3; m <= (counts[face] ?? 0); m += 1) {
      const threeValue =
        face === 1 ? ruleset.threeOnesValue : face * ruleset.threeOfAKindFaceMultiplier;
      const value =
        m === 3
          ? threeValue
          : ruleset.nOfAKindScaling === 'doubling'
            ? threeValue * 2 ** (m - 3)
            : m === 4
              ? ruleset.fourOfAKindFlatValue
              : m === 5
                ? ruleset.fiveOfAKindFlatValue
                : ruleset.sixOfAKindFlatValue;
      consider(value, (c) => void (c[face] = (c[face] ?? 0) - m));
    }
  }
  // Whole-set combos (each consumes six dice)
  if ([1, 2, 3, 4, 5, 6].every((f) => (counts[f] ?? 0) >= 1) && remaining >= 6) {
    consider(ruleset.straightValue, (c) => {
      for (let f = 1; f <= 6; f += 1) {
        c[f] = (c[f] ?? 0) - 1;
      }
    });
  }
  const pairFaces = [1, 2, 3, 4, 5, 6].filter((f) => (counts[f] ?? 0) >= 2);
  if (pairFaces.length >= 3) {
    for (let a = 0; a < pairFaces.length; a += 1) {
      for (let b = a + 1; b < pairFaces.length; b += 1) {
        for (let cIdx = b + 1; cIdx < pairFaces.length; cIdx += 1) {
          const faces = [pairFaces[a]!, pairFaces[b]!, pairFaces[cIdx]!];
          consider(ruleset.threePairsValue, (c) => {
            for (const f of faces) {
              c[f] = (c[f] ?? 0) - 2;
            }
          });
        }
      }
    }
  }
  if (ruleset.twoTripletsEnabled) {
    const tripleFaces = [1, 2, 3, 4, 5, 6].filter((f) => (counts[f] ?? 0) >= 3);
    for (let a = 0; a < tripleFaces.length; a += 1) {
      for (let b = a + 1; b < tripleFaces.length; b += 1) {
        const faces = [tripleFaces[a]!, tripleFaces[b]!];
        consider(ruleset.twoTripletsValue, (c) => {
          for (const f of faces) {
            c[f] = (c[f] ?? 0) - 3;
          }
        });
      }
    }
  }
  return best;
}

// 100k-run nightly executions need far more than the 5s default.
const PROPERTY_TIMEOUT_MS = 300_000;

describe('scoring properties (fast-check)', { timeout: PROPERTY_TIMEOUT_MS }, () => {
  it(`matches the independent partition oracle exactly (${NUM_RUNS} runs)`, () => {
    fc.assert(
      fc.property(rollArb, rulesetArb, (dice, ruleset) => {
        expect(scoreSelection(dice, ruleset)).toBe(oracleBestScore(dice, ruleset));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('re-scoring the same selection is idempotent', () => {
    fc.assert(
      fc.property(rollArb, rulesetArb, (dice, ruleset) => {
        expect(scoreSelection(dice, ruleset)).toBe(scoreSelection(dice, ruleset));
      }),
      { numRuns: Math.min(NUM_RUNS, 10_000) },
    );
  });

  it('disjoint valid selections combine superadditively (max interpretation)', () => {
    fc.assert(
      fc.property(
        fc.array(dieArb, { minLength: 1, maxLength: 3 }),
        fc.array(dieArb, { minLength: 1, maxLength: 3 }),
        (a, b) => {
          const scoreA = scoreSelection(a, DEFAULT_RULESET);
          const scoreB = scoreSelection(b, DEFAULT_RULESET);
          fc.pre(scoreA !== null && scoreB !== null);
          const union = scoreSelection([...a, ...b], DEFAULT_RULESET);
          expect(union).not.toBeNull();
          expect(union!).toBeGreaterThanOrEqual(scoreA! + scoreB!);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('every enumerated selection is a legal scoring sub-multiset of the roll', () => {
    fc.assert(
      fc.property(rollArb, rulesetArb, (roll, ruleset) => {
        const rollCounts = toCounts(roll);
        for (const { dice, score } of enumerateLegalSelections(roll, ruleset)) {
          const keptCounts = toCounts(dice);
          for (let f = 1; f <= 6; f += 1) {
            expect(keptCounts[f]!).toBeLessThanOrEqual(rollCounts[f]!);
          }
          expect(score).toBe(scoreSelection(dice, ruleset));
          expect(score).toBeGreaterThan(0);
        }
      }),
      { numRuns: Math.min(NUM_RUNS, 10_000) },
    );
  });

  it('isFarkle exactly when no legal selection exists', () => {
    fc.assert(
      fc.property(rollArb, rulesetArb, (roll, ruleset) => {
        expect(isFarkle(roll, ruleset)).toBe(enumerateLegalSelections(roll, ruleset).length === 0);
      }),
      { numRuns: Math.min(NUM_RUNS, 10_000) },
    );
  });
});
