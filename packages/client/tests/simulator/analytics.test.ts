import { describe, expect, it } from 'vitest';
import type { GameResult } from '@spicy-dicey/core-engine';
import { aggregateStrategyStats } from '../../src/features/simulator/lib/analytics';

const game = (
  winnerId: string | null,
  scores: Record<string, number>,
  turns: Record<string, number>,
  farkles: Record<string, number>,
): GameResult => ({
  finished: winnerId !== null,
  winnerId,
  finalScores: scores,
  placements: Object.keys(scores).sort((a, b) => scores[b]! - scores[a]!),
  turnsTaken: turns,
  farkleCounts: farkles,
  log: [],
});

describe('aggregateStrategyStats', () => {
  const games: GameResult[] = [
    game('a', { a: 10_000, b: 8000 }, { a: 20, b: 20 }, { a: 3, b: 5 }),
    game('b', { a: 9000, b: 10_500 }, { a: 25, b: 24 }, { a: 6, b: 2 }),
    game('a', { a: 10_250, b: 4000 }, { a: 18, b: 17 }, { a: 1, b: 8 }),
  ];

  it('computes per-player win rate, averages, and farkle stats', () => {
    const stats = aggregateStrategyStats(games, 'a');
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.gamesWon).toBe(2);
    expect(stats.winRate).toBeCloseTo(2 / 3);
    expect(stats.avgFinalScore).toBeCloseTo((10_000 + 9000 + 10_250) / 3);
    expect(stats.avgTurns).toBeCloseTo(21);
    expect(stats.avgFarkles).toBeCloseTo(10 / 3);
  });

  it('builds a score distribution histogram over fixed buckets', () => {
    const stats = aggregateStrategyStats(games, 'a');
    const total = stats.scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0);
    expect(total).toBe(3);
    // 9000 and 10000 land in different buckets with width 500
    const bucketOf = (score: number) =>
      stats.scoreDistribution.find((b) => score >= b.min && score < b.min + 500);
    expect(bucketOf(9000)!.count).toBe(1);
    expect(bucketOf(10_000)!.count).toBe(2); // 10000 and 10250
  });

  it('handles zero games', () => {
    const stats = aggregateStrategyStats([], 'a');
    expect(stats).toMatchObject({ gamesPlayed: 0, gamesWon: 0, winRate: 0, avgFinalScore: 0 });
    expect(stats.scoreDistribution).toEqual([]);
  });
});
