import type { RandomSource } from '../rng/types.js';
import { DIE_FACES } from './types.js';
import type { DieValue } from './types.js';

/** Roll `count` dice from the injected RNG. The engine's only way to roll. */
export function rollDice(rng: RandomSource, count: number): DieValue[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`dice count must be a positive integer, got ${count}`);
  }
  return Array.from({ length: count }, () => {
    return (Math.floor(rng.next() * DIE_FACES) + 1) as DieValue;
  });
}
