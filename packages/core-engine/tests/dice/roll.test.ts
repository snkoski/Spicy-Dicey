import { describe, expect, it } from 'vitest';
import { createMulberry32 } from '../../src/rng/mulberry32.js';
import { rollDice } from '../../src/dice/roll.js';
import type { RandomSource } from '../../src/rng/types.js';

describe('rollDice', () => {
  it('rolls the requested number of dice', () => {
    const rng = createMulberry32(1);
    expect(rollDice(rng, 6)).toHaveLength(6);
    expect(rollDice(rng, 1)).toHaveLength(1);
  });

  it('only ever produces faces 1 through 6', () => {
    const rng = createMulberry32(42);
    for (let i = 0; i < 1000; i += 1) {
      for (const die of rollDice(rng, 6)) {
        expect(die).toBeGreaterThanOrEqual(1);
        expect(die).toBeLessThanOrEqual(6);
        expect(Number.isInteger(die)).toBe(true);
      }
    }
  });

  it('maps the injected RNG deterministically onto faces', () => {
    // A stub source proves every roll flows through the injected RNG:
    // values just under k/6 boundaries map to faces 1..6 in order.
    const values = [0, 0.166, 0.34, 0.5, 0.67, 0.999];
    let i = 0;
    const stub: RandomSource = { next: () => values[i++ % values.length]! };
    expect(rollDice(stub, 6)).toEqual([1, 1, 3, 4, 5, 6]);
  });

  it('same seed produces the same rolls forever', () => {
    const a = rollDice(createMulberry32(2024), 6);
    const b = rollDice(createMulberry32(2024), 6);
    expect(a).toEqual(b);
  });

  it('rejects a non-positive dice count', () => {
    const rng = createMulberry32(1);
    expect(() => rollDice(rng, 0)).toThrow();
    expect(() => rollDice(rng, -1)).toThrow();
  });
});
