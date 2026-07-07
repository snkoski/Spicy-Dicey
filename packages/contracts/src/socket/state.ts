import type { DieValue } from '@spicy-dicey/core-engine';
import type { RulesetConfigInput } from '../entities/ruleset.js';

/** The server's authoritative room snapshot, broadcast as `room:state`. */
export interface RoomStateSnapshot {
  code: string;
  status: 'lobby' | 'active' | 'ended';
  hostId: string;
  maxPlayers: number;
  turnTimerSec: 30 | 60 | 90 | null;
  spectatorChatEnabled: boolean;
  ruleset: RulesetConfigInput;
  members: Array<{
    playerId: string;
    displayName: string;
    role: 'player' | 'spectator';
    connected: boolean;
  }>;
  turnDeadline: number | null;
  match: {
    status: 'active' | 'ended';
    winnerId: string | null;
    currentPlayerId: string | null;
    players: Array<{ id: string; total: number; onTheBoard: boolean; farkles: number }>;
    turn: {
      phase: string;
      roll: readonly DieValue[] | null;
      diceToRoll: number;
      turnScore: number;
      hotDiceStreak: number;
    };
  } | null;
}
