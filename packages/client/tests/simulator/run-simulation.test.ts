import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET, getBuiltinStrategy } from '@spicy-dicey/core-engine';
import { runSimulation } from '../../src/features/simulator/lib/run-simulation';
import type { SimulationConfig } from '../../src/features/simulator/lib/run-simulation';

const config = (overrides: Partial<SimulationConfig> = {}): SimulationConfig => ({
  strategies: [
    { id: 'always-bank-at-300', definition: getBuiltinStrategy('always-bank-at-300') },
    { id: 'ev-optimal', definition: getBuiltinStrategy('ev-optimal') },
  ],
  ruleset: DEFAULT_RULESET,
  numGames: 30,
  seed: 42,
  mode: 'head-to-head',
  ...overrides,
});

describe('runSimulation — head-to-head', () => {
  it('plays the configured number of games between all selected strategies', () => {
    const result = runSimulation(config());
    expect(result.perStrategy['always-bank-at-300']!.gamesPlayed).toBe(30);
    expect(result.perStrategy['ev-optimal']!.gamesPlayed).toBe(30);
    const wins =
      result.perStrategy['always-bank-at-300']!.gamesWon +
      result.perStrategy['ev-optimal']!.gamesWon;
    expect(wins).toBe(30);
  });

  it('same seed + config => identical results; different seed differs', () => {
    expect(runSimulation(config())).toEqual(runSimulation(config()));
    expect(runSimulation(config({ seed: 43 }))).not.toEqual(runSimulation(config()));
  });

  it('ranks by win rate, then average final score (decision 8)', () => {
    const result = runSimulation(config({ numGames: 100 }));
    const [first, second] = result.rankings;
    const s = result.perStrategy;
    expect(s[first!]!.winRate).toBeGreaterThanOrEqual(s[second!]!.winRate);
  });

  it('reports monotonic progress up to the total', () => {
    const seen: Array<[number, number]> = [];
    runSimulation(config({ numGames: 10 }), (completed, total) => {
      seen.push([completed, total]);
    });
    expect(seen.at(-1)).toEqual([10, 10]);
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]![0]).toBeGreaterThan(seen[i - 1]![0]);
    }
  });

  it('supports mirror matches by suffixing duplicate ids', () => {
    const result = runSimulation(
      config({
        strategies: [
          { id: 'greedy', definition: getBuiltinStrategy('greedy') },
          { id: 'greedy', definition: getBuiltinStrategy('greedy') },
        ],
        numGames: 5,
      }),
    );
    expect(Object.keys(result.perStrategy).sort()).toEqual(['greedy', 'greedy#2']);
  });
});

describe('runSimulation — sample log for replay', () => {
  it('exposes the first game log so replay can step through it', () => {
    const result = runSimulation(config({ numGames: 3 }));
    expect(result.sampleGameLog.length).toBeGreaterThan(0);
    expect(result.sampleGameLog.at(-1)!.type).toBe('game-ended');
    // deterministic: same seed reproduces the same sample
    expect(runSimulation(config({ numGames: 3 })).sampleGameLog).toEqual(result.sampleGameLog);
  });
});

describe('runSimulation — round-robin', () => {
  const rrConfig = config({
    mode: 'round-robin',
    numGames: 10,
    strategies: [
      { id: 'always-bank-at-300', definition: getBuiltinStrategy('always-bank-at-300') },
      { id: 'ev-optimal', definition: getBuiltinStrategy('ev-optimal') },
      { id: 'value-aware', definition: getBuiltinStrategy('value-aware') },
    ],
  });

  it('produces a complete NxN win matrix with empty diagonal', () => {
    const result = runSimulation(rrConfig);
    const matrix = result.matrix!;
    expect(matrix.ids).toHaveLength(3);
    for (let i = 0; i < 3; i += 1) {
      expect(matrix.wins[i]![i]).toBeNull();
      for (let j = 0; j < 3; j += 1) {
        if (i !== j) {
          // wins[i][j] + wins[j][i] account for every game of the pairing
          expect(matrix.wins[i]![j]! + matrix.wins[j]![i]!).toBe(10);
        }
      }
    }
  });

  it('each strategy plays every opponent numGames times', () => {
    const result = runSimulation(rrConfig);
    for (const id of ['always-bank-at-300', 'ev-optimal', 'value-aware']) {
      expect(result.perStrategy[id]!.gamesPlayed).toBe(20); // 2 opponents x 10
    }
  });

  it('is deterministic for the same seed', () => {
    expect(runSimulation(rrConfig)).toEqual(runSimulation(rrConfig));
  });
});
