import type { ConditionContext, StrategyCondition } from './types.js';

export function evaluateCondition(
  condition: StrategyCondition,
  context: ConditionContext,
): boolean {
  switch (condition.type) {
    case 'always':
      return true;
    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, context));
    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, context));
    case 'comparison': {
      const actual = context[condition.subject];
      if (actual === undefined) {
        return false;
      }
      switch (condition.cmp) {
        case 'lt':
          return actual < condition.value;
        case 'lte':
          return actual <= condition.value;
        case 'gt':
          return actual > condition.value;
        case 'gte':
          return actual >= condition.value;
        case 'eq':
          return actual === condition.value;
      }
    }
  }
}
