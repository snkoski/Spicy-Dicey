import type {
  BankRule,
  Comparator,
  ConditionSubject,
  KeepRule,
  StrategyCondition,
  StrategyDefinition,
} from '@spicy-dicey/core-engine';

/**
 * The v1 editor's rule shape: a flat list of comparisons joined by one
 * AND/OR combinator (Appendix B composition), plus the rule's action.
 * Empty comparisons mean "always" — the catch-all rule.
 */
export interface EditorComparison {
  subject: ConditionSubject;
  cmp: Comparator;
  value: number;
}

export interface EditorCondition {
  combinator: 'and' | 'or';
  comparisons: EditorComparison[];
}

export type EditorRule<Action extends string> = EditorCondition & { action: Action };

export function conditionFromEditor(editor: EditorCondition): StrategyCondition {
  if (editor.comparisons.length === 0) {
    return { type: 'always' };
  }
  const comparisons = editor.comparisons.map(
    (c) => ({ type: 'comparison', ...c }) satisfies StrategyCondition,
  );
  return comparisons.length === 1
    ? comparisons[0]!
    : { type: editor.combinator, conditions: comparisons };
}

/** Inverse of conditionFromEditor; null for trees the flat editor can't show. */
export function editorFromCondition(condition: StrategyCondition): EditorCondition | null {
  if (condition.type === 'always') {
    return { combinator: 'and', comparisons: [] };
  }
  if (condition.type === 'comparison') {
    const { subject, cmp, value } = condition;
    return { combinator: 'and', comparisons: [{ subject, cmp, value }] };
  }
  const comparisons: EditorComparison[] = [];
  for (const child of condition.conditions) {
    if (child.type !== 'comparison') {
      return null; // nested composite — not representable in the v1 editor
    }
    comparisons.push({ subject: child.subject, cmp: child.cmp, value: child.value });
  }
  return { combinator: condition.type, comparisons };
}

export function buildStrategyDefinition(
  name: string,
  bankRules: EditorRule<'bank' | 'roll'>[],
  keepRules: EditorRule<'keep' | 'decline'>[],
): StrategyDefinition {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
  return {
    schemaVersion: 1,
    id: `custom-${slug}`,
    name,
    keepPolicy: keepRules.map((r): KeepRule => ({
      condition: conditionFromEditor(r),
      action: r.action,
    })),
    bankPolicy: bankRules.map((r): BankRule => ({
      condition: conditionFromEditor(r),
      action: r.action,
    })),
  };
}
