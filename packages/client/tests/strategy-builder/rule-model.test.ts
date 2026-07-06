import { describe, expect, it } from 'vitest';
import { strategyDefinitionSchema } from '@spicy-dicey/contracts';
import {
  createMulberry32,
  DEFAULT_RULESET,
  getBuiltinStrategy,
  runGame,
} from '@spicy-dicey/core-engine';
import {
  buildStrategyDefinition,
  conditionFromEditor,
  editorFromCondition,
  type EditorRule,
} from '../../src/features/strategy-builder/lib/rule-model';

describe('conditionFromEditor', () => {
  it('empty comparisons -> always', () => {
    expect(conditionFromEditor({ combinator: 'and', comparisons: [] })).toEqual({
      type: 'always',
    });
  });

  it('single comparison -> the bare comparison', () => {
    const cmp = { subject: 'turnScore' as const, cmp: 'gte' as const, value: 300 };
    expect(conditionFromEditor({ combinator: 'and', comparisons: [cmp] })).toEqual({
      type: 'comparison',
      ...cmp,
    });
  });

  it('multiple comparisons -> composite with the chosen combinator', () => {
    const a = { subject: 'turnScore' as const, cmp: 'gte' as const, value: 500 };
    const b = { subject: 'diceRemaining' as const, cmp: 'lte' as const, value: 2 };
    expect(conditionFromEditor({ combinator: 'or', comparisons: [a, b] })).toEqual({
      type: 'or',
      conditions: [
        { type: 'comparison', ...a },
        { type: 'comparison', ...b },
      ],
    });
  });

  it('round-trips through editorFromCondition', () => {
    for (const editor of [
      { combinator: 'and' as const, comparisons: [] },
      {
        combinator: 'and' as const,
        comparisons: [{ subject: 'turnScore' as const, cmp: 'gte' as const, value: 300 }],
      },
      {
        combinator: 'or' as const,
        comparisons: [
          { subject: 'turnScore' as const, cmp: 'gte' as const, value: 500 },
          { subject: 'hotDiceStreak' as const, cmp: 'gte' as const, value: 1 },
        ],
      },
    ]) {
      const roundTripped = editorFromCondition(conditionFromEditor(editor));
      expect(conditionFromEditor(roundTripped!)).toEqual(conditionFromEditor(editor));
    }
  });

  it('returns null for nested trees the v1 editor cannot represent', () => {
    expect(
      editorFromCondition({
        type: 'and',
        conditions: [
          { type: 'or', conditions: [] },
          { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 1 },
        ],
      }),
    ).toBeNull();
  });
});

describe('buildStrategyDefinition', () => {
  const bankRules: EditorRule<'bank' | 'roll'>[] = [
    {
      combinator: 'and',
      comparisons: [
        { subject: 'turnScore', cmp: 'gte', value: 400 },
        { subject: 'diceRemaining', cmp: 'lte', value: 3 },
      ],
      action: 'bank',
    },
    { combinator: 'and', comparisons: [], action: 'roll' },
  ];

  it('produces a contracts-valid definition that the engine can run', () => {
    const definition = buildStrategyDefinition('My Custom', bankRules, []);
    expect(strategyDefinitionSchema.parse(definition)).toEqual(definition);

    const result = runGame(
      {
        players: [
          { id: definition.id, strategy: definition },
          { id: 'ev-optimal', strategy: getBuiltinStrategy('ev-optimal') },
        ],
        ruleset: DEFAULT_RULESET,
      },
      createMulberry32(4),
    );
    expect(result.finished).toBe(true);
  });

  it('derives a stable slug id from the name', () => {
    expect(buildStrategyDefinition('My Custom', [], []).id).toBe('custom-my-custom');
  });
});
