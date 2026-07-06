import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET, getBuiltinStrategy } from '@spicy-dicey/core-engine';
import { handleWorkerRequest } from '../../src/workers/simulation-protocol';
import type { WorkerResponse } from '../../src/workers/simulation-protocol';
import { runSimulation } from '../../src/features/simulator/lib/run-simulation';

const config = {
  strategies: [
    { id: 'always-bank-at-300', definition: getBuiltinStrategy('always-bank-at-300') },
    { id: 'ev-optimal', definition: getBuiltinStrategy('ev-optimal') },
  ],
  ruleset: DEFAULT_RULESET,
  numGames: 500,
  seed: 9,
  mode: 'head-to-head' as const,
};

describe('handleWorkerRequest', { timeout: 120_000 }, () => {
  it('posts throttled progress then a done message matching the direct run', () => {
    const messages: WorkerResponse[] = [];
    handleWorkerRequest({ type: 'run', config }, (m) => messages.push(m));

    const done = messages.at(-1)!;
    expect(done.type).toBe('done');
    if (done.type === 'done') {
      expect(done.result).toEqual(runSimulation(config));
    }

    const progress = messages.filter((m) => m.type === 'progress');
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.length).toBeLessThanOrEqual(101); // throttled, not per-game
    expect(progress.at(-1)).toMatchObject({ completed: 500, total: 500 });
  });

  it('reports errors instead of throwing across the worker boundary', () => {
    const messages: WorkerResponse[] = [];
    handleWorkerRequest(
      { type: 'run', config: { ...config, strategies: config.strategies.slice(0, 1) } },
      (m) => messages.push(m),
    );
    expect(messages.at(-1)!.type).toBe('error');
  });
});
