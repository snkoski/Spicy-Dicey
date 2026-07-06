import type { DieValue } from '../dice/types.js';
import type { RulesetConfig } from '../ruleset/types.js';
import type { StrategyDefinition } from '../strategy/types.js';

export interface GamePlayerConfig {
  id: string;
  strategy: StrategyDefinition;
}

export interface GameConfig {
  players: GamePlayerConfig[];
  ruleset: RulesetConfig;
  /** Safety valve: strategies that never bank (greedy) must not loop forever. */
  maxTurnsPerPlayer?: number;
}

/**
 * The replayable game log (plan §1 Phase 1: detailed enough to drive
 * step-through replay). Every roll outcome is recorded — live-game
 * auditability comes from this log, never from a stored seed (decision 14).
 */
export type GameLogEvent =
  | { type: 'turn-started'; playerId: string; turnIndex: number }
  | { type: 'rolled'; playerId: string; dice: DieValue[] }
  | {
      type: 'selected';
      playerId: string;
      dice: DieValue[];
      score: number;
      turnScore: number;
      hotDice: boolean;
    }
  | { type: 'decision'; playerId: string; decision: 'bank' | 'roll'; diceToRoll: number }
  | { type: 'farkled'; playerId: string; pointsLost: number; penaltyApplied: number }
  | { type: 'banked'; playerId: string; pointsAdded: number; newTotal: number; onTheBoard: boolean }
  | { type: 'final-round-triggered'; playerId: string }
  | {
      type: 'game-ended';
      winnerId: string | null;
      finalScores: Record<string, number>;
      placements: string[];
    };

export interface GameResult {
  finished: boolean;
  winnerId: string | null;
  finalScores: Record<string, number>;
  /** Player ids best-to-worst (ties broken by seat order). */
  placements: string[];
  turnsTaken: Record<string, number>;
  farkleCounts: Record<string, number>;
  log: GameLogEvent[];
}
