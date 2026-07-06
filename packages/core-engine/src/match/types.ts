import type { RulesetConfig } from '../ruleset/types.js';
import type { TurnState } from '../turn/types.js';

export interface MatchPlayer {
  id: string;
  total: number;
  onTheBoard: boolean;
  consecutiveFarkles: number;
  turns: number;
  farkles: number;
}

/**
 * The interactive multi-player match: one shared game-flow state machine
 * consumed by the hot-seat UI, the authoritative server (Phase 4), and
 * runGame's strategy autopilot. Rolled dice always arrive from outside.
 */
export interface MatchState {
  ruleset: RulesetConfig;
  players: MatchPlayer[];
  currentSeat: number;
  turn: TurnState;
  /** Global 0-based turn counter (drives turn-started events). */
  turnIndex: number;
  finalRoundTriggeredBy: number | null;
  maxTurnsPerPlayer: number;
  status: 'active' | 'ended';
  /** Set when status is 'ended': false means the stalemate valve tripped. */
  finished: boolean;
  winnerId: string | null;
}

export interface MatchConfig {
  playerIds: string[];
  ruleset: RulesetConfig;
  maxTurnsPerPlayer?: number;
}
