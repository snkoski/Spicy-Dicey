import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteCustomStrategy,
  listCustomStrategies,
  saveCustomStrategy,
} from '../../src/features/strategy-builder/lib/storage';
import type { StrategyDefinitionInput } from '@spicy-dicey/contracts';

const custom: StrategyDefinitionInput = {
  schemaVersion: 1,
  id: 'custom-cautious',
  name: 'Cautious',
  keepPolicy: [],
  bankPolicy: [
    {
      condition: { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 250 },
      action: 'bank',
    },
  ],
};

describe('custom strategy storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a strategy through save/load', () => {
    saveCustomStrategy(custom);
    expect(listCustomStrategies()).toEqual([custom]);
  });

  it('overwrites by id', () => {
    saveCustomStrategy(custom);
    saveCustomStrategy({ ...custom, name: 'Cautious v2' });
    expect(listCustomStrategies()).toHaveLength(1);
    expect(listCustomStrategies()[0]!.name).toBe('Cautious v2');
  });

  it('deletes by id', () => {
    saveCustomStrategy(custom);
    deleteCustomStrategy(custom.id);
    expect(listCustomStrategies()).toEqual([]);
  });

  it('rejects definitions that fail the shared contract schema', () => {
    expect(() => saveCustomStrategy({ ...custom, bankPolicy: [{ bad: true }] } as never)).toThrow();
    expect(listCustomStrategies()).toEqual([]);
  });

  it('ignores corrupted storage instead of crashing', () => {
    localStorage.setItem('spicy-dicey.custom-strategies', '{not json');
    expect(listCustomStrategies()).toEqual([]);
  });
});
