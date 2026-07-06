import { describe, expect, it } from 'vitest';
import { BUILTIN_STRATEGIES } from '@spicy-dicey/core-engine';
import type { StrategyDefinition } from '@spicy-dicey/core-engine';
import { strategyDefinitionSchema } from '../src/index.js';

describe('strategyDefinitionSchema', () => {
  it('accepts every built-in engine strategy unchanged (same rule format)', () => {
    for (const builtin of BUILTIN_STRATEGIES) {
      const parsed = strategyDefinitionSchema.parse(builtin);
      expect(parsed).toEqual(builtin);
    }
  });

  it('the inferred type is assignable to the engine type', () => {
    const parsed = strategyDefinitionSchema.parse(BUILTIN_STRATEGIES[0]);
    // compile-time check: zod inference matches the engine contract
    const asEngine: StrategyDefinition = parsed;
    expect(asEngine.schemaVersion).toBe(1);
  });

  it('accepts nested AND/OR conditions', () => {
    const custom = {
      schemaVersion: 1,
      id: 'custom-1',
      name: 'My strategy',
      keepPolicy: [],
      bankPolicy: [
        {
          condition: {
            type: 'and',
            conditions: [
              { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 500 },
              {
                type: 'or',
                conditions: [
                  { type: 'comparison', subject: 'diceRemaining', cmp: 'lte', value: 2 },
                  { type: 'comparison', subject: 'scoreDifferential', cmp: 'lt', value: -1000 },
                ],
              },
            ],
          },
          action: 'bank',
        },
      ],
    };
    expect(strategyDefinitionSchema.parse(custom)).toEqual(custom);
  });

  it.each([
    ['wrong schemaVersion', { schemaVersion: 2 }],
    ['unknown subject', {
      bankPolicy: [
        {
          condition: { type: 'comparison', subject: 'lastRoll', cmp: 'eq', value: 1 },
          action: 'bank',
        },
      ],
    }],
    ['unknown action', {
      bankPolicy: [{ condition: { type: 'always' }, action: 'explode' }],
    }],
    ['missing name', { name: undefined }],
  ])('rejects %s', (_label, overrides) => {
    const base = {
      schemaVersion: 1,
      id: 'x',
      name: 'x',
      keepPolicy: [],
      bankPolicy: [],
    };
    expect(strategyDefinitionSchema.safeParse({ ...base, ...overrides }).success).toBe(false);
  });
});
