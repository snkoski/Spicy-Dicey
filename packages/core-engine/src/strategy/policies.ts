import { evaluateCondition } from './conditions.js';
import type { BankRule, ConditionContext, KeepRule } from './types.js';

/**
 * First match wins. Fallthroughs are the greedy defaults from the plan:
 * an unmatched bank policy rolls; an unmatched keep policy keeps.
 */
export function evaluateBankPolicy(rules: BankRule[], context: ConditionContext): 'bank' | 'roll' {
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, context)) {
      return rule.action;
    }
  }
  return 'roll';
}

export function evaluateKeepPolicy(
  rules: KeepRule[],
  context: ConditionContext,
): 'keep' | 'decline' {
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, context)) {
      return rule.action;
    }
  }
  return 'keep';
}
