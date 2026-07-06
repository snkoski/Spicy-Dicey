import type { DieValue } from '../dice/types.js';
import type { RulesetConfig } from '../ruleset/types.js';
import { toCounts } from '../scoring/counts.js';
import { isFarkle } from '../scoring/enumerate.js';
import { scoreSelection } from '../scoring/score-selection.js';
import type { TurnState } from './types.js';

/** Game-level facts the turn machine needs but does not own. */
export interface TurnContext {
  /** Whether this player has already met the on-the-board minimum. */
  onTheBoard: boolean;
}

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

export function applySelection(
  state: TurnState,
  selection: readonly DieValue[],
  ruleset: RulesetConfig,
): TurnState {
  if (state.phase !== 'awaiting-selection' || state.roll === null) {
    throw new Error(`cannot select dice in phase '${state.phase}'`);
  }
  const rollCounts = toCounts(state.roll);
  const keptCounts = toCounts(selection);
  for (let face = 1; face <= 6; face += 1) {
    if ((keptCounts[face] ?? 0) > (rollCounts[face] ?? 0)) {
      throw new Error('selection is not part of the current roll');
    }
  }
  const score = scoreSelection(selection, ruleset);
  if (score === null) {
    throw new Error('illegal selection: every kept die must contribute to a scoring combo');
  }
  const remaining = state.roll.length - selection.length;
  const hotDice = remaining === 0;
  return {
    phase: 'awaiting-decision',
    diceToRoll: hotDice ? 6 : remaining,
    roll: null,
    turnScore: state.turnScore + score,
    hotDiceStreak: hotDice ? state.hotDiceStreak + 1 : state.hotDiceStreak,
  };
}

export function chooseRoll(state: TurnState): TurnState {
  if (state.phase !== 'awaiting-decision') {
    throw new Error(`cannot choose to roll in phase '${state.phase}'`);
  }
  return { ...state, phase: 'awaiting-roll' };
}

/** Whether banking is allowed: on-the-board gating (A.1.1 #6) applies here. */
export function canBank(state: TurnState, context: TurnContext, ruleset: RulesetConfig): boolean {
  if (state.phase !== 'awaiting-decision') {
    return false;
  }
  if (ruleset.onTheBoardEnabled && !context.onTheBoard) {
    return state.turnScore >= ruleset.onTheBoardMinimum;
  }
  return true;
}

export function bank(state: TurnState, context: TurnContext, ruleset: RulesetConfig): TurnState {
  if (state.phase !== 'awaiting-decision') {
    throw new Error(`cannot bank in phase '${state.phase}'`);
  }
  if (!canBank(state, context, ruleset)) {
    throw new Error(
      `cannot bank ${state.turnScore}: the on-the-board minimum is ${ruleset.onTheBoardMinimum}`,
    );
  }
  return { ...state, phase: 'banked' };
}
