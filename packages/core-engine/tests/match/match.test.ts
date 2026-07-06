import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { matchDecide, matchRoll, matchSelect, startMatch } from '../../src/match/match.js';
import type { MatchState } from '../../src/match/types.js';

const rules = { ...DEFAULT_RULESET, targetScore: 1000 };

const start = (targetScore = 1000, endGameVariant: 'instant' | 'final-round' = 'instant') =>
  startMatch({
    playerIds: ['p1', 'p2'],
    ruleset: { ...rules, targetScore, endGameVariant },
  });

describe('startMatch', () => {
  it('seats the players and starts the first turn', () => {
    const { state, events } = start();
    expect(state.status).toBe('active');
    expect(state.currentSeat).toBe(0);
    expect(state.turn.phase).toBe('awaiting-roll');
    expect(state.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(events).toEqual([{ type: 'turn-started', playerId: 'p1', turnIndex: 0 }]);
  });

  it('requires 2-8 players', () => {
    expect(() => startMatch({ playerIds: ['solo'], ruleset: rules })).toThrow(/players/i);
    expect(() =>
      startMatch({ playerIds: Array.from({ length: 9 }, (_, i) => `p${i}`), ruleset: rules }),
    ).toThrow(/players/i);
  });
});

describe('matchRoll', () => {
  it('a scoring roll awaits selection', () => {
    const { state } = start();
    const { state: next, events } = matchRoll(state, [1, 2, 3, 4, 6, 6]);
    expect(next.turn.phase).toBe('awaiting-selection');
    expect(events).toEqual([{ type: 'rolled', playerId: 'p1', dice: [1, 2, 3, 4, 6, 6] }]);
  });

  it('a farkle ends the turn and auto-advances to the next player', () => {
    const { state } = start();
    const { state: next, events } = matchRoll(state, [2, 3, 4, 6, 6, 2]);
    expect(events.map((e) => e.type)).toEqual(['rolled', 'farkled', 'turn-started']);
    expect(next.currentSeat).toBe(1);
    expect(next.players[0]!.farkles).toBe(1);
    expect(next.turn.phase).toBe('awaiting-roll');
  });
});

describe('matchSelect / matchDecide', () => {
  const rolled = (): MatchState => {
    const { state } = start();
    return matchRoll(state, [1, 1, 5, 2, 3, 4]).state;
  };

  it('keeps a legal selection and awaits the decision', () => {
    const { state, events } = matchSelect(rolled(), [1, 1, 5]);
    expect(state.turn.phase).toBe('awaiting-decision');
    expect(state.turn.turnScore).toBe(250);
    expect(events[0]).toMatchObject({ type: 'selected', dice: [1, 1, 5], score: 250 });
  });

  it('rejects illegal selections', () => {
    expect(() => matchSelect(rolled(), [2])).toThrow();
  });

  it('deciding to roll re-enters awaiting-roll with the remaining dice', () => {
    const kept = matchSelect(rolled(), [1, 1, 5]).state;
    const { state, events } = matchDecide(kept, 'roll');
    expect(state.turn).toMatchObject({ phase: 'awaiting-roll', diceToRoll: 3 });
    expect(events).toEqual([{ type: 'decision', playerId: 'p1', decision: 'roll', diceToRoll: 3 }]);
  });

  it('banking below the on-the-board minimum is rejected', () => {
    const kept = matchSelect(rolled(), [1]).state; // 100 < 500
    expect(() => matchDecide(kept, 'bank')).toThrow(/board/i);
  });

  it('banking commits the total and advances the seat', () => {
    const bigRules = { ...rules, onTheBoardEnabled: false };
    const { state } = startMatch({ playerIds: ['p1', 'p2'], ruleset: bigRules });
    const kept = matchSelect(matchRoll(state, [1, 1, 5, 2, 3, 4]).state, [1, 1, 5]).state;
    const { state: next, events } = matchDecide(kept, 'bank');
    expect(events.map((e) => e.type)).toEqual(['banked', 'turn-started']);
    expect(next.players[0]!.total).toBe(250);
    expect(next.currentSeat).toBe(1);
  });
});

describe('end game', () => {
  const winTurn = (state: MatchState): MatchState => {
    // 1000 in one selection: three 1s, then bank
    const afterRoll = matchRoll(state, [1, 1, 1, 2, 3, 4]).state;
    const kept = matchSelect(afterRoll, [1, 1, 1]).state;
    return matchDecide(kept, 'bank').state;
  };

  it('instant variant ends the game on the winning bank', () => {
    const { state } = start(1000, 'instant');
    const ended = winTurn(state);
    expect(ended.status).toBe('ended');
    expect(ended.finished).toBe(true);
    expect(ended.winnerId).toBe('p1');
  });

  it('final-round variant gives every other player one last turn', () => {
    const { state } = start(1000, 'final-round');
    const afterTrigger = winTurn(state);
    expect(afterTrigger.status).toBe('active');
    expect(afterTrigger.currentSeat).toBe(1);

    // p2's last turn: farkle -> game over, p1 wins
    const ended = matchRoll(afterTrigger, [2, 3, 4, 6, 6, 2]).state;
    expect(ended.status).toBe('ended');
    expect(ended.winnerId).toBe('p1');
  });

  it('final-round can still be stolen by a higher score', () => {
    const { state } = start(1000, 'final-round');
    const afterTrigger = winTurn(state); // p1 banks exactly 1000
    // p2 rolls 2000-worth and banks
    const afterRoll = matchRoll(afterTrigger, [1, 1, 1, 1, 1, 2]).state;
    const kept = matchSelect(afterRoll, [1, 1, 1, 1, 1]).state; // 2000 flat 5oak
    const ended = matchDecide(kept, 'bank').state;
    expect(ended.status).toBe('ended');
    expect(ended.winnerId).toBe('p2');
    expect(ended.players.map((p) => p.total)).toEqual([1000, 2000]);
  });

  it('emits game-ended with placements', () => {
    const { state } = start(1000, 'instant');
    const afterRoll = matchRoll(state, [1, 1, 1, 2, 3, 4]).state;
    const kept = matchSelect(afterRoll, [1, 1, 1]).state;
    const { events } = matchDecide(kept, 'bank');
    const ended = events.find((e) => e.type === 'game-ended');
    expect(ended).toMatchObject({
      winnerId: 'p1',
      placements: ['p1', 'p2'],
      finalScores: { p1: 1000, p2: 0 },
    });
  });

  it('actions on an ended match throw', () => {
    const { state } = start(1000, 'instant');
    const ended = winTurn(state);
    expect(() => matchRoll(ended, [1, 2, 3, 4, 5, 6])).toThrow(/ended/i);
  });
});

describe('consecutive farkle penalty', () => {
  it('third farkle in a row deducts the penalty', () => {
    const penaltyRules = {
      ...rules,
      farklePenaltyVariant: 'three-consecutive-penalty' as const,
      targetScore: 100_000,
    };
    let { state } = startMatch({ playerIds: ['p1', 'p2'], ruleset: penaltyRules });
    const farkleDice = [2, 3, 4, 6, 6, 2] as const;
    for (let i = 0; i < 5; i += 1) {
      state = matchRoll(state, [...farkleDice]).state; // alternates p1/p2
    }
    // p1 has farkled 3 times (turns 1,3,5): penalty applied once
    expect(state.players[0]!.farkles).toBe(3);
    expect(state.players[0]!.total).toBe(-1000);
    expect(state.players[1]!.total).toBe(0); // only 2 farkles so far
  });
});
