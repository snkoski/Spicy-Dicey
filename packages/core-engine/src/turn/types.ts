import type { DieValue } from '../dice/types.js';

export type TurnPhase =
  | 'awaiting-roll' // player must roll diceToRoll dice
  | 'awaiting-selection' // roll happened, player must set aside a legal subset
  | 'awaiting-decision' // subset kept, player chooses roll again vs bank
  | 'farkled' // terminal: turn score lost
  | 'banked'; // terminal: turn score committed

export interface TurnState {
  phase: TurnPhase;
  /** Dice to (re)roll next: remaining dice, or all six after hot dice. */
  diceToRoll: number;
  /** The unresolved roll while awaiting selection, else null. */
  roll: readonly DieValue[] | null;
  /** Points accumulated this turn. On 'farkled' this is what was lost. */
  turnScore: number;
  /** Consecutive hot-dice this turn (strategy "streak" condition input). */
  hotDiceStreak: number;
}
