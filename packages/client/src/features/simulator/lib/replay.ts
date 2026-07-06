import type { DieValue, GameLogEvent } from '@spicy-dicey/core-engine';

/** One renderable snapshot per log event — pure fold, no rules recomputation. */
export interface ReplayFrame {
  event: GameLogEvent;
  /** Banked totals after this event (penalties included). */
  totals: Record<string, number>;
  currentPlayerId: string | null;
  /** Dice showing on the table (set on roll, cleared once the turn resolves). */
  tableDice: DieValue[] | null;
  /** Running turn score for the current player. */
  turnScore: number;
}

export function buildReplayFrames(log: GameLogEvent[]): ReplayFrame[] {
  const totals: Record<string, number> = {};
  let currentPlayerId: string | null = null;
  let tableDice: DieValue[] | null = null;
  let turnScore = 0;

  return log.map((event) => {
    switch (event.type) {
      case 'turn-started':
        currentPlayerId = event.playerId;
        totals[event.playerId] ??= 0;
        tableDice = null;
        turnScore = 0;
        break;
      case 'rolled':
        tableDice = event.dice;
        break;
      case 'selected':
        turnScore = event.turnScore;
        tableDice = null;
        break;
      case 'decision':
        break;
      case 'farkled':
        totals[event.playerId] = (totals[event.playerId] ?? 0) - event.penaltyApplied;
        tableDice = null;
        turnScore = 0;
        break;
      case 'banked':
        totals[event.playerId] = event.newTotal;
        tableDice = null;
        turnScore = 0;
        break;
      case 'final-round-triggered':
      case 'game-ended':
        tableDice = null;
        break;
    }
    return {
      event,
      totals: { ...totals },
      currentPlayerId,
      tableDice: tableDice ? [...tableDice] : null,
      turnScore,
    };
  });
}
