import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';

// Expected values: plan Appendix A.1 / A.1.1 (defaults in bold there).
describe('DEFAULT_RULESET', () => {
  it.each([
    ['singleOneValue', 100],
    ['singleFiveValue', 50],
    ['threeOnesValue', 1000],
    ['threeOfAKindFaceMultiplier', 100],
    ['fourOfAKindFlatValue', 1000],
    ['fiveOfAKindFlatValue', 2000],
    ['sixOfAKindFlatValue', 3000],
    ['straightValue', 1500],
    ['threePairsValue', 1500],
    ['twoTripletsValue', 2500],
    ['onTheBoardMinimum', 500],
    ['targetScore', 10_000],
    ['farkleConsecutivePenalty', 1000],
  ] as const)('%s defaults to %d', (field, value) => {
    expect(DEFAULT_RULESET[field]).toBe(value);
  });

  it('defaults the variant toggles per A.1.1', () => {
    expect(DEFAULT_RULESET.nOfAKindScaling).toBe('flat');
    expect(DEFAULT_RULESET.twoTripletsEnabled).toBe(true);
    expect(DEFAULT_RULESET.onTheBoardEnabled).toBe(true);
    expect(DEFAULT_RULESET.endGameVariant).toBe('final-round');
    expect(DEFAULT_RULESET.farklePenaltyVariant).toBe('turn-points-only');
  });
});
