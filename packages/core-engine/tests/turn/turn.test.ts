import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import {
  applyRoll,
  applySelection,
  bank,
  canBank,
  chooseRoll,
  startTurn,
} from '../../src/turn/turn.js';

describe('startTurn', () => {
  it('begins awaiting a roll of all six dice with a clean score', () => {
    expect(startTurn()).toEqual({
      phase: 'awaiting-roll',
      diceToRoll: 6,
      roll: null,
      turnScore: 0,
      hotDiceStreak: 0,
    });
  });
});

describe('applyRoll', () => {
  it('moves to awaiting-selection when the roll can score', () => {
    const state = applyRoll(startTurn(), [1, 2, 3, 4, 6, 6], DEFAULT_RULESET);
    expect(state.phase).toBe('awaiting-selection');
    expect(state.roll).toEqual([1, 2, 3, 4, 6, 6]);
    expect(state.turnScore).toBe(0);
  });

  it('farkles when the roll has no scoring selection, keeping the lost score visible', () => {
    let state = applyRoll(startTurn(), [1, 1, 1, 2, 3, 4], DEFAULT_RULESET);
    // pretend mid-turn: force a turn score via a fresh state literal
    state = { ...state, turnScore: 450, phase: 'awaiting-roll', roll: null, diceToRoll: 3 };
    const farkled = applyRoll(state, [2, 3, 4], DEFAULT_RULESET);
    expect(farkled.phase).toBe('farkled');
    expect(farkled.turnScore).toBe(450); // what was lost — game layer awards 0
  });

  it('rejects a roll whose size does not match diceToRoll', () => {
    expect(() => applyRoll(startTurn(), [1, 5], DEFAULT_RULESET)).toThrow(/dice/i);
  });

  it('rejects a roll outside the awaiting-roll phase', () => {
    const state = applyRoll(startTurn(), [1, 2, 3, 4, 6, 6], DEFAULT_RULESET);
    expect(() => applyRoll(state, [1, 2, 3, 4, 6, 6], DEFAULT_RULESET)).toThrow(/phase/i);
  });
});

describe('applySelection', () => {
  const afterRoll = applyRoll(startTurn(), [1, 5, 2, 3, 4, 6], DEFAULT_RULESET);

  it('adds the max-interpretation score and awaits the bank-or-roll decision', () => {
    const state = applySelection(afterRoll, [1, 5], DEFAULT_RULESET);
    expect(state).toMatchObject({
      phase: 'awaiting-decision',
      turnScore: 150,
      diceToRoll: 4,
      roll: null,
      hotDiceStreak: 0,
    });
  });

  it('may decline scoring dice: keep the 1, re-roll the lone 5', () => {
    const state = applySelection(afterRoll, [1], DEFAULT_RULESET);
    expect(state.turnScore).toBe(100);
    expect(state.diceToRoll).toBe(5);
  });

  it('rejects an illegal selection', () => {
    expect(() => applySelection(afterRoll, [1, 2], DEFAULT_RULESET)).toThrow(/selection/i);
  });

  it('rejects a selection that is not a sub-multiset of the roll', () => {
    expect(() => applySelection(afterRoll, [1, 1], DEFAULT_RULESET)).toThrow(/roll/i);
  });

  it('rejects selecting outside awaiting-selection', () => {
    expect(() => applySelection(startTurn(), [1], DEFAULT_RULESET)).toThrow(/phase/i);
  });

  it('hot dice: scoring all remaining dice restores six and bumps the streak', () => {
    const rolled = applyRoll(startTurn(), [2, 2, 2, 3, 3, 3], DEFAULT_RULESET);
    const state = applySelection(rolled, [2, 2, 2, 3, 3, 3], DEFAULT_RULESET);
    expect(state).toMatchObject({
      phase: 'awaiting-decision',
      turnScore: 2500,
      diceToRoll: 6,
      hotDiceStreak: 1,
    });

    // keep going: a second hot dice bumps the streak again
    const rolled2 = applyRoll(chooseRoll(state), [1, 1, 1, 1, 1, 1], DEFAULT_RULESET);
    const state2 = applySelection(rolled2, [1, 1, 1, 1, 1, 1], DEFAULT_RULESET);
    expect(state2.turnScore).toBe(2500 + 3000);
    expect(state2.hotDiceStreak).toBe(2);
    expect(state2.diceToRoll).toBe(6);
  });
});

describe('chooseRoll / bank', () => {
  const decided = applySelection(
    applyRoll(startTurn(), [1, 5, 2, 3, 4, 6], DEFAULT_RULESET),
    [1, 5],
    DEFAULT_RULESET,
  );

  it('chooseRoll returns to awaiting-roll for the remaining dice', () => {
    expect(chooseRoll(decided)).toMatchObject({ phase: 'awaiting-roll', diceToRoll: 4 });
  });

  it('bank commits the turn score for a player already on the board', () => {
    expect(bank(decided, { onTheBoard: true }, DEFAULT_RULESET)).toMatchObject({
      phase: 'banked',
      turnScore: 150,
    });
  });

  it('a player not yet on the board cannot bank below the minimum', () => {
    expect(canBank(decided, { onTheBoard: false }, DEFAULT_RULESET)).toBe(false);
    expect(() => bank(decided, { onTheBoard: false }, DEFAULT_RULESET)).toThrow(/board/i);
  });

  it('a player not on the board banks once the minimum is reached', () => {
    const bigTurn = { ...decided, turnScore: 500 };
    expect(canBank(bigTurn, { onTheBoard: false }, DEFAULT_RULESET)).toBe(true);
    expect(bank(bigTurn, { onTheBoard: false }, DEFAULT_RULESET).phase).toBe('banked');
  });

  it('the gate disappears when the on-the-board rule is disabled', () => {
    const noGate = { ...DEFAULT_RULESET, onTheBoardEnabled: false };
    expect(canBank(decided, { onTheBoard: false }, noGate)).toBe(true);
  });

  it('both reject wrong phases', () => {
    expect(() => chooseRoll(startTurn())).toThrow(/phase/i);
    expect(() => bank(startTurn(), { onTheBoard: true }, DEFAULT_RULESET)).toThrow(/phase/i);
  });
});
