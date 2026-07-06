import type { RandomSource } from './types.js';

/**
 * Seedable PRNG for the simulator and tests only — trivially predictable,
 * so live games must never use it (plan §6 decision 14).
 * Same seed ⇒ identical sequence, forever.
 */
export function createMulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
