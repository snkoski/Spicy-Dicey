import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { applyFarkleToBank } from '../../src/game/farkle-penalty.js';

const penaltyRules = {
  ...DEFAULT_RULESET,
  farklePenaltyVariant: 'three-consecutive-penalty' as const,
};

describe('applyFarkleToBank (§6 decision 18)', () => {
  it('is a no-op under turn-points-only', () => {
    expect(applyFarkleToBank({ consecutiveFarkles: 2, bankedTotal: 700 }, DEFAULT_RULESET)).toEqual(
      {
        consecutiveFarkles: 3,
        bankedTotal: 700,
        penaltyApplied: 0,
      },
    );
  });

  it('increments the counter without penalty on the first and second farkle', () => {
    expect(applyFarkleToBank({ consecutiveFarkles: 0, bankedTotal: 700 }, penaltyRules)).toEqual({
      consecutiveFarkles: 1,
      bankedTotal: 700,
      penaltyApplied: 0,
    });
    expect(applyFarkleToBank({ consecutiveFarkles: 1, bankedTotal: 700 }, penaltyRules)).toEqual({
      consecutiveFarkles: 2,
      bankedTotal: 700,
      penaltyApplied: 0,
    });
  });

  it('deducts the penalty and resets on the third consecutive farkle', () => {
    expect(applyFarkleToBank({ consecutiveFarkles: 2, bankedTotal: 700 }, penaltyRules)).toEqual({
      consecutiveFarkles: 0,
      bankedTotal: -300, // totals may go negative
      penaltyApplied: 1000,
    });
  });

  it('recurs every third consecutive farkle after the reset', () => {
    const afterThird = applyFarkleToBank({ consecutiveFarkles: 2, bankedTotal: 3000 }, penaltyRules);
    expect(afterThird.consecutiveFarkles).toBe(0);
    const fourth = applyFarkleToBank(afterThird, penaltyRules);
    const fifth = applyFarkleToBank(fourth, penaltyRules);
    const sixth = applyFarkleToBank(fifth, penaltyRules);
    expect(sixth).toEqual({ consecutiveFarkles: 0, bankedTotal: 1000, penaltyApplied: 1000 });
  });

  it('reads the configured penalty value', () => {
    const custom = { ...penaltyRules, farkleConsecutivePenalty: 250 };
    expect(
      applyFarkleToBank({ consecutiveFarkles: 2, bankedTotal: 100 }, custom).bankedTotal,
    ).toBe(-150);
  });
});
