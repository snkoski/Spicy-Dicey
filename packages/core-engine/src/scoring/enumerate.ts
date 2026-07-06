import type { DieValue } from '../dice/types.js';
import type { RulesetConfig } from '../ruleset/types.js';
import { toCounts } from './counts.js';
import { scoreSelection } from './score-selection.js';

export interface ScoredSelection {
  /** The kept dice as a sorted multiset. */
  dice: DieValue[];
  /** Max-interpretation score for this selection. */
  score: number;
}

/**
 * Every legal set-aside subset of a roll (plan §6 decision 2), each scored at
 * its maximum interpretation. Deterministic order: by size, then lexicographic
 * — enumeration output feeds game logs, which must be byte-stable.
 */
export function enumerateLegalSelections(
  roll: readonly DieValue[],
  ruleset: RulesetConfig,
): ScoredSelection[] {
  const counts = toCounts(roll);
  const selections: ScoredSelection[] = [];

  // Walk every sub-multiset: for each face, keep 0..count[face] dice.
  const kept: number[] = [0, 0, 0, 0, 0, 0, 0];
  const visit = (face: number): void => {
    if (face > 6) {
      const dice: DieValue[] = [];
      for (let f = 1 as DieValue; f <= 6; f = (f + 1) as DieValue) {
        for (let i = 0; i < (kept[f] ?? 0); i += 1) {
          dice.push(f);
        }
      }
      if (dice.length === 0) {
        return;
      }
      const score = scoreSelection(dice, ruleset);
      if (score !== null) {
        selections.push({ dice, score });
      }
      return;
    }
    for (let keep = 0; keep <= (counts[face] ?? 0); keep += 1) {
      kept[face] = keep;
      visit(face + 1);
    }
    kept[face] = 0;
  };
  visit(1);

  selections.sort((a, b) => {
    if (a.dice.length !== b.dice.length) {
      return a.dice.length - b.dice.length;
    }
    for (let i = 0; i < a.dice.length; i += 1) {
      const diff = (a.dice[i] ?? 0) - (b.dice[i] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  });
  return selections;
}

/** A roll with no legal selection is a Farkle. */
export function isFarkle(roll: readonly DieValue[], ruleset: RulesetConfig): boolean {
  return enumerateLegalSelections(roll, ruleset).length === 0;
}
