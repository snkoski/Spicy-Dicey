import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '../../src/ruleset/defaults.js';
import { matchForfeit, matchRoll, matchSelect, startMatch } from '../../src/match/match.js';

const rules = { ...DEFAULT_RULESET, targetScore: 1000, onTheBoardEnabled: false };

describe('matchForfeit (turn timeout / absent player auto-pass)', () => {
  it('ends the turn with no points and advances the seat', () => {
    const { state } = startMatch({ playerIds: ['p1', 'p2'], ruleset: rules });
    const mid = matchSelect(matchRoll(state, [1, 1, 5, 2, 3, 4]).state, [1, 1, 5]).state;
    expect(mid.turn.turnScore).toBe(250);

    const { state: next, events } = matchForfeit(mid);
    expect(events.map((e) => e.type)).toEqual(['turn-forfeited', 'turn-started']);
    expect(events[0]).toMatchObject({ type: 'turn-forfeited', playerId: 'p1', pointsLost: 250 });
    expect(next.players[0]!.total).toBe(0);
    expect(next.currentSeat).toBe(1);
    expect(next.turn.phase).toBe('awaiting-roll');
  });

  it('does not touch the consecutive-farkle counter', () => {
    const penaltyRules = { ...rules, farklePenaltyVariant: 'three-consecutive-penalty' as const };
    let { state } = startMatch({ playerIds: ['p1', 'p2'], ruleset: penaltyRules });
    state = matchRoll(state, [2, 3, 4, 6, 6, 2]).state; // p1 farkles -> counter 1 -> p2's turn
    state = matchForfeit(state).state; // p2 forfeits -> back to p1
    expect(state.players[0]!.consecutiveFarkles).toBe(1);
    expect(state.players[1]!.consecutiveFarkles).toBe(0);
  });

  it('works from any live phase, including mid-roll', () => {
    const { state } = startMatch({ playerIds: ['p1', 'p2'], ruleset: rules });
    const rolled = matchRoll(state, [1, 1, 5, 2, 3, 4]).state;
    const { state: next } = matchForfeit(rolled);
    expect(next.currentSeat).toBe(1);
  });

  it('respects the final round: forfeiting the last turn ends the game', () => {
    const finalRound = { ...rules, endGameVariant: 'final-round' as const };
    let { state } = startMatch({ playerIds: ['p1', 'p2'], ruleset: finalRound });
    state = matchSelect(matchRoll(state, [1, 1, 1, 2, 3, 4]).state, [1, 1, 1]).state;
    state = matchForfeit(state).state; // p1 forfeits instead of banking - no trigger
    expect(state.currentSeat).toBe(1);
    expect(state.status).toBe('active');
  });
});
