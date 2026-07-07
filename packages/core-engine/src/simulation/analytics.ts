import type { GameResult } from '../game/types.js';

export const SCORE_BUCKET_WIDTH = 500;

export interface ScoreBucket {
  /** Inclusive lower bound; bucket covers [min, min + width). */
  min: number;
  count: number;
}

export interface StrategyStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  avgFinalScore: number;
  avgTurns: number;
  avgFarkles: number;
  scoreDistribution: ScoreBucket[];
}

/** Aggregate one participant's results across games (plan §1 Phase 2 analytics). */
export function aggregateStrategyStats(games: GameResult[], playerId: string): StrategyStats {
  if (games.length === 0) {
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      winRate: 0,
      avgFinalScore: 0,
      avgTurns: 0,
      avgFarkles: 0,
      scoreDistribution: [],
    };
  }

  let won = 0;
  let scoreSum = 0;
  let turnSum = 0;
  let farkleSum = 0;
  const buckets = new Map<number, number>();

  for (const game of games) {
    if (game.winnerId === playerId) {
      won += 1;
    }
    const score = game.finalScores[playerId] ?? 0;
    scoreSum += score;
    turnSum += game.turnsTaken[playerId] ?? 0;
    farkleSum += game.farkleCounts[playerId] ?? 0;
    const bucketMin = Math.floor(score / SCORE_BUCKET_WIDTH) * SCORE_BUCKET_WIDTH;
    buckets.set(bucketMin, (buckets.get(bucketMin) ?? 0) + 1);
  }

  return {
    gamesPlayed: games.length,
    gamesWon: won,
    winRate: won / games.length,
    avgFinalScore: scoreSum / games.length,
    avgTurns: turnSum / games.length,
    avgFarkles: farkleSum / games.length,
    scoreDistribution: [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([min, count]) => ({ min, count })),
  };
}
