import type { DieValue } from '../dice/types.js';
import { applyFarkleToBank } from '../game/farkle-penalty.js';
import type { GameLogEvent } from '../game/types.js';
import { applyRoll, applySelection, bank, canBank, chooseRoll, startTurn } from '../turn/turn.js';
import type { MatchConfig, MatchPlayer, MatchState } from './types.js';

const DEFAULT_MAX_TURNS_PER_PLAYER = 1000;

export interface MatchTransition {
  state: MatchState;
  events: GameLogEvent[];
}

export function startMatch(config: MatchConfig): MatchTransition {
  if (config.playerIds.length < 2 || config.playerIds.length > 8) {
    throw new Error(`a match needs 2-8 players, got ${config.playerIds.length}`);
  }
  const players: MatchPlayer[] = config.playerIds.map((id) => ({
    id,
    total: 0,
    onTheBoard: false,
    consecutiveFarkles: 0,
    turns: 0,
    farkles: 0,
  }));
  const state: MatchState = {
    ruleset: config.ruleset,
    players: players.map((p, i) => (i === 0 ? { ...p, turns: 1 } : p)),
    currentSeat: 0,
    turn: startTurn(),
    turnIndex: 1,
    finalRoundTriggeredBy: null,
    maxTurnsPerPlayer: config.maxTurnsPerPlayer ?? DEFAULT_MAX_TURNS_PER_PLAYER,
    status: 'active',
    finished: false,
    winnerId: null,
  };
  return {
    state,
    events: [{ type: 'turn-started', playerId: config.playerIds[0]!, turnIndex: 0 }],
  };
}

export function matchRoll(state: MatchState, dice: readonly DieValue[]): MatchTransition {
  assertActive(state);
  const player = currentPlayer(state);
  const turn = applyRoll(state.turn, dice, state.ruleset);
  const events: GameLogEvent[] = [{ type: 'rolled', playerId: player.id, dice: [...dice] }];

  if (turn.phase === 'farkled') {
    const outcome = applyFarkleToBank(
      { consecutiveFarkles: player.consecutiveFarkles, bankedTotal: player.total },
      state.ruleset,
    );
    const players = state.players.map((p, i) =>
      i === state.currentSeat
        ? {
            ...p,
            total: outcome.bankedTotal,
            consecutiveFarkles: outcome.consecutiveFarkles,
            farkles: p.farkles + 1,
          }
        : p,
    );
    events.push({
      type: 'farkled',
      playerId: player.id,
      pointsLost: turn.turnScore,
      penaltyApplied: outcome.penaltyApplied,
    });
    return endTurnAndAdvance({ ...state, players, turn }, events);
  }

  return { state: { ...state, turn }, events };
}

export function matchSelect(state: MatchState, selection: readonly DieValue[]): MatchTransition {
  assertActive(state);
  const player = currentPlayer(state);
  const before = state.turn;
  const turn = applySelection(before, selection, state.ruleset);
  return {
    state: { ...state, turn },
    events: [
      {
        type: 'selected',
        playerId: player.id,
        dice: [...selection].sort((a, b) => a - b),
        score: turn.turnScore - before.turnScore,
        turnScore: turn.turnScore,
        hotDice: turn.hotDiceStreak > before.hotDiceStreak,
      },
    ],
  };
}

export function matchDecide(state: MatchState, decision: 'bank' | 'roll'): MatchTransition {
  assertActive(state);
  const player = currentPlayer(state);

  if (decision === 'roll') {
    const turn = chooseRoll(state.turn);
    return {
      state: { ...state, turn },
      events: [
        {
          type: 'decision',
          playerId: player.id,
          decision: 'roll',
          diceToRoll: state.turn.diceToRoll,
        },
      ],
    };
  }

  const context = { onTheBoard: player.onTheBoard };
  const turn = bank(state.turn, context, state.ruleset);
  const newTotal = player.total + turn.turnScore;
  const onTheBoard =
    player.onTheBoard ||
    !state.ruleset.onTheBoardEnabled ||
    turn.turnScore >= state.ruleset.onTheBoardMinimum;
  const players = state.players.map((p, i) =>
    i === state.currentSeat ? { ...p, total: newTotal, onTheBoard, consecutiveFarkles: 0 } : p,
  );
  const events: GameLogEvent[] = [
    {
      type: 'banked',
      playerId: player.id,
      pointsAdded: turn.turnScore,
      newTotal,
      onTheBoard,
    },
  ];

  let next: MatchState = { ...state, players, turn };
  if (next.finalRoundTriggeredBy === null && newTotal >= state.ruleset.targetScore) {
    if (state.ruleset.endGameVariant === 'instant') {
      return endMatch(next, events, true);
    }
    next = { ...next, finalRoundTriggeredBy: state.currentSeat };
    events.push({ type: 'final-round-triggered', playerId: player.id });
  }
  return endTurnAndAdvance(next, events);
}

/**
 * Auto-pass (turn timeout or absent player): the turn ends with no points,
 * the farkle counter is untouched, and play advances — from any live phase.
 */
export function matchForfeit(state: MatchState): MatchTransition {
  assertActive(state);
  const player = currentPlayer(state);
  const events: GameLogEvent[] = [
    { type: 'turn-forfeited', playerId: player.id, pointsLost: state.turn.turnScore },
  ];
  return endTurnAndAdvance(state, events);
}

/** Whether the current player may bank right now (on-the-board gating). */
export function matchCanBank(state: MatchState): boolean {
  return (
    state.status === 'active' &&
    canBank(state.turn, { onTheBoard: currentPlayer(state).onTheBoard }, state.ruleset)
  );
}

function currentPlayer(state: MatchState): MatchPlayer {
  return state.players[state.currentSeat]!;
}

function assertActive(state: MatchState): void {
  if (state.status !== 'active') {
    throw new Error('the match has ended');
  }
}

function endTurnAndAdvance(state: MatchState, events: GameLogEvent[]): MatchTransition {
  const nextSeat = (state.currentSeat + 1) % state.players.length;
  if (state.finalRoundTriggeredBy === nextSeat) {
    return endMatch(state, events, true); // everyone else had their last turn
  }
  if ((state.players[nextSeat]!.turns ?? 0) >= state.maxTurnsPerPlayer) {
    return endMatch(state, events, false); // stalemate valve
  }
  const players = state.players.map((p, i) => (i === nextSeat ? { ...p, turns: p.turns + 1 } : p));
  const next: MatchState = {
    ...state,
    players,
    currentSeat: nextSeat,
    turn: startTurn(),
    turnIndex: state.turnIndex + 1,
  };
  events.push({
    type: 'turn-started',
    playerId: players[nextSeat]!.id,
    turnIndex: state.turnIndex,
  });
  return { state: next, events };
}

function endMatch(state: MatchState, events: GameLogEvent[], finished: boolean): MatchTransition {
  const placements = [...state.players]
    .map((p, seat) => ({ id: p.id, total: p.total, seat }))
    .sort((a, b) => b.total - a.total || a.seat - b.seat)
    .map((p) => p.id);
  const winnerId = finished ? placements[0]! : null;
  const finalScores = Object.fromEntries(state.players.map((p) => [p.id, p.total]));
  events.push({ type: 'game-ended', winnerId, finalScores, placements });
  return {
    state: { ...state, status: 'ended', finished, winnerId },
    events,
  };
}
