import { describe, expect, it } from 'vitest';
import { createMulberry32 } from '../../src/rng/mulberry32.js';

describe('createMulberry32', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createMulberry32(12345);
    const b = createMulberry32(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createMulberry32(1);
    const b = createMulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('always yields values in [0, 1)', () => {
    const rng = createMulberry32(987654321);
    for (let i = 0; i < 10_000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
