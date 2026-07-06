import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { applyRoll, startTurn } from '../../src/turn/turn.js';

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
