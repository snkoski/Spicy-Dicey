import { describe, expect, it } from 'vitest';
import { createCryptoRandom } from '../../src/rng/crypto.js';

describe('createCryptoRandom', () => {
  it('yields values in [0, 1)', () => {
    const rng = createCryptoRandom();
    for (let i = 0; i < 10_000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('two sources do not repeat each other (not seedable)', () => {
    const a = createCryptoRandom();
    const b = createCryptoRandom();
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
});
