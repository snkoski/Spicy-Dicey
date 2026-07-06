import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET, getBuiltinStrategy } from '@spicy-dicey/core-engine';
import { runSimulation } from '../../src/features/simulator/lib/run-simulation';
import {
  exportResultsCsv,
  exportResultsJson,
  importResultsCsv,
  importResultsJson,
} from '../../src/features/simulator/lib/export';

const result = runSimulation({
  strategies: [
    { id: 'always-bank-at-300', definition: getBuiltinStrategy('always-bank-at-300') },
    { id: 'ev-optimal', definition: getBuiltinStrategy('ev-optimal') },
    { id: 'value-aware', definition: getBuiltinStrategy('value-aware') },
  ],
  ruleset: DEFAULT_RULESET,
  numGames: 20,
  seed: 7,
  mode: 'round-robin',
});

describe('simulation export', () => {
  it('JSON round-trips to identical results', () => {
    expect(importResultsJson(exportResultsJson(result))).toEqual(result);
  });

  it('CSV round-trips per-strategy stats to the same numbers', () => {
    const reimported = importResultsCsv(exportResultsCsv(result));
    expect(Object.keys(reimported).sort()).toEqual(Object.keys(result.perStrategy).sort());
    for (const [id, stats] of Object.entries(result.perStrategy)) {
      expect(reimported[id]).toEqual(stats);
    }
  });

  it('CSV has one header row and one row per strategy', () => {
    const lines = exportResultsCsv(result).trim().split('\n');
    expect(lines).toHaveLength(1 + 3);
    expect(lines[0]).toMatch(/^strategyId,/);
  });
});
