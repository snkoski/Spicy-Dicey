import type { DieValue } from '../dice/types.js';
import type { RulesetConfig } from '../ruleset/types.js';
import { isFarkle } from '../scoring/enumerate.js';
import type { TurnState } from './types.js';

/** A single turn's state machine. Pure: every transition returns a new state.
 * Rolled values are inputs — the machine never rolls (the game runner or the
 * live server does, through the same rollDice, differing only in RNG source).
 */
export function startTurn(): TurnState {
  return {
    phase: 'awaiting-roll',
    diceToRoll: 6,
    roll: null,
    turnScore: 0,
    hotDiceStreak: 0,
  };
}

export function applyRoll(
  state: TurnState,
  dice: readonly DieValue[],
  ruleset: RulesetConfig,
): TurnState {
  if (state.phase !== 'awaiting-roll') {
    throw new Error(`cannot roll in phase '${state.phase}'`);
  }
  if (dice.length !== state.diceToRoll) {
    throw new Error(`expected ${state.diceToRoll} dice, got ${dice.length}`);
  }
  if (isFarkle(dice, ruleset)) {
    return { ...state, phase: 'farkled', roll: dice };
  }
  return { ...state, phase: 'awaiting-selection', roll: dice };
}
