import {
  createMulberry32,
  runGame,
  type GameResult,
  type RulesetConfig,
  type StrategyDefinition,
} from '@spicy-dicey/core-engine';
import { aggregateStrategyStats, type StrategyStats } from './analytics';

export interface SimStrategy {
  id: string;
  definition: StrategyDefinition;
}

export type SimulationMode = 'head-to-head' | 'round-robin';

export interface SimulationConfig {
  strategies: SimStrategy[];
  ruleset: RulesetConfig;
  /** Games per matchup: the whole field (head-to-head) or each pair (round-robin). */
  numGames: number;
  seed: number;
  mode: SimulationMode;
}

export interface RoundRobinMatrix {
  ids: string[];
  /** wins[i][j] = games participant i won against participant j; diagonal null. */
  wins: (number | null)[][];
}

export interface SimulationResult {
  perStrategy: Record<string, StrategyStats>;
  /** Ranked best-to-worst per decision 8. */
  rankings: string[];
  /** Round-robin only. */
  matrix?: RoundRobinMatrix;
}

export type ProgressCallback = (completedGames: number, totalGames: number) => void;

/**
 * Pure, synchronous simulation run — the Web Worker wraps exactly this
 * function, so determinism and analytics stay unit-testable without a
 * Worker runtime. Same (config, seed) ⇒ identical output, always.
 */
export function runSimulation(
  config: SimulationConfig,
  onProgress?: ProgressCallback,
): SimulationResult {
  const participants = uniqueParticipants(config.strategies);
  return config.mode === 'head-to-head'
    ? runHeadToHead(config, participants, onProgress)
    : runRoundRobin(config, participants, onProgress);
}

interface Participant {
  id: string; // unique (duplicates suffixed #2, #3, ...)
  definition: StrategyDefinition;
}

function uniqueParticipants(strategies: SimStrategy[]): Participant[] {
  const seen = new Map<string, number>();
  return strategies.map((s) => {
    const n = (seen.get(s.id) ?? 0) + 1;
    seen.set(s.id, n);
    return { id: n === 1 ? s.id : `${s.id}#${n}`, definition: s.definition };
  });
}

function playGame(
  participants: Participant[],
  ruleset: RulesetConfig,
  seed: number,
  rotation: number,
): GameResult {
  // Rotate seats each game so first-player advantage evens out.
  const seated = participants.map((_, i) => participants[(i + rotation) % participants.length]!);
  return runGame(
    {
      players: seated.map((p) => ({ id: p.id, strategy: p.definition })),
      ruleset,
    },
    createMulberry32(seed),
  );
}

function runHeadToHead(
  config: SimulationConfig,
  participants: Participant[],
  onProgress?: ProgressCallback,
): SimulationResult {
  const games: GameResult[] = [];
  for (let g = 0; g < config.numGames; g += 1) {
    games.push(playGame(participants, config.ruleset, config.seed + g, g));
    onProgress?.(g + 1, config.numGames);
  }
  const perStrategy = Object.fromEntries(
    participants.map((p) => [p.id, aggregateStrategyStats(games, p.id)]),
  );
  return { perStrategy, rankings: rank(participants, perStrategy) };
}

function runRoundRobin(
  config: SimulationConfig,
  participants: Participant[],
  onProgress?: ProgressCallback,
): SimulationResult {
  const n = participants.length;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      pairs.push([i, j]);
    }
  }
  const totalGames = pairs.length * config.numGames;
  const gamesByParticipant = new Map<string, GameResult[]>(participants.map((p) => [p.id, []]));
  const wins: (number | null)[][] = participants.map((_, i) =>
    participants.map((_, j) => (i === j ? null : 0)),
  );

  let completed = 0;
  pairs.forEach(([i, j], pairIndex) => {
    for (let g = 0; g < config.numGames; g += 1) {
      const seed = config.seed + pairIndex * config.numGames + g;
      const result = playGame([participants[i]!, participants[j]!], config.ruleset, seed, g);
      gamesByParticipant.get(participants[i]!.id)!.push(result);
      gamesByParticipant.get(participants[j]!.id)!.push(result);
      if (result.winnerId === participants[i]!.id) {
        wins[i]![j] = (wins[i]![j] ?? 0) + 1;
      } else if (result.winnerId === participants[j]!.id) {
        wins[j]![i] = (wins[j]![i] ?? 0) + 1;
      }
      completed += 1;
      onProgress?.(completed, totalGames);
    }
  });

  const perStrategy = Object.fromEntries(
    participants.map((p) => [p.id, aggregateStrategyStats(gamesByParticipant.get(p.id)!, p.id)]),
  );
  return {
    perStrategy,
    rankings: rank(participants, perStrategy, { ids: participants.map((p) => p.id), wins }),
    matrix: { ids: participants.map((p) => p.id), wins },
  };
}

/** Decision 8: win rate, then avg final score, then head-to-head record. */
function rank(
  participants: Participant[],
  perStrategy: Record<string, StrategyStats>,
  matrix?: RoundRobinMatrix,
): string[] {
  return participants
    .map((p, index) => ({ id: p.id, index }))
    .sort((a, b) => {
      const sa = perStrategy[a.id]!;
      const sb = perStrategy[b.id]!;
      if (sb.winRate !== sa.winRate) {
        return sb.winRate - sa.winRate;
      }
      if (sb.avgFinalScore !== sa.avgFinalScore) {
        return sb.avgFinalScore - sa.avgFinalScore;
      }
      if (matrix) {
        const headToHead =
          (matrix.wins[b.index]![a.index] ?? 0) - (matrix.wins[a.index]![b.index] ?? 0);
        if (headToHead !== 0) {
          return headToHead;
        }
      }
      return a.index - b.index;
    })
    .map((p) => p.id);
}
