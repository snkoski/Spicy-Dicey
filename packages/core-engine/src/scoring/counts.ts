import type { DieValue } from '../dice/types.js';

/** counts[face] = how many dice show `face`; index 0 unused. */
export type FaceCounts = readonly [0, number, number, number, number, number, number];

export function toCounts(dice: readonly DieValue[]): FaceCounts {
  const counts: [0, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];
  for (const die of dice) {
    counts[die] += 1;
  }
  return counts;
}
