import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import type { Comparator, ConditionSubject } from '@spicy-dicey/core-engine';
import type { EditorRule } from './lib/rule-model';

export interface IdentifiedRule<Action extends string> {
  key: string;
  rule: EditorRule<Action>;
}

const COMPARATORS: Array<{ value: Comparator; label: string }> = [
  { value: 'gte', label: '≥' },
  { value: 'gt', label: '>' },
  { value: 'lte', label: '≤' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '=' },
];

interface Props<Action extends string> {
  title: string;
  addLabel: string;
  subjects: ConditionSubject[];
  actions: Action[];
  rules: IdentifiedRule<Action>[];
  onChange: (rules: IdentifiedRule<Action>[]) => void;
}

/**
 * One ordered, first-match-wins rule list (keep or bank policy). Reorder by
 * pointer drag (dnd-kit) or the keyboard-accessible up/down buttons.
 */
export function RuleListEditor<Action extends string>({
  title,
  addLabel,
  subjects,
  actions,
  rules,
  onChange,
}: Props<Action>) {
  const update = (key: string, rule: EditorRule<Action>) =>
    onChange(rules.map((r) => (r.key === key ? { ...r, rule } : r)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rules.length) {
      return;
    }
    onChange(arrayMove(rules, index, target));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const from = rules.findIndex((r) => r.key === active.id);
      const to = rules.findIndex((r) => r.key === over.id);
      onChange(arrayMove(rules, from, to));
    }
  };

  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...rules,
              {
                key: `rule-${Date.now()}-${rules.length}`,
                rule: { combinator: 'and', comparisons: [], action: actions[0]! },
              },
            ])
          }
        >
          <Plus aria-hidden className="h-4 w-4" /> {addLabel}
        </Button>
      </div>
      {rules.length === 0 && (
        <p className="text-sm text-slate-500">
          No rules — the default applies (keep everything / keep rolling).
        </p>
      )}
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rules.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {rules.map((identified, index) => (
              <SortableRuleRow
                key={identified.key}
                identified={identified}
                index={index}
                subjects={subjects}
                actions={actions}
                onUpdate={update}
                onMove={move}
                onDelete={(key) => onChange(rules.filter((r) => r.key !== key))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableRuleRow<Action extends string>({
  identified,
  index,
  subjects,
  actions,
  onUpdate,
  onMove,
  onDelete,
}: {
  identified: IdentifiedRule<Action>;
  index: number;
  subjects: ConditionSubject[];
  actions: Action[];
  onUpdate: (key: string, rule: EditorRule<Action>) => void;
  onMove: (index: number, delta: number) => void;
  onDelete: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: identified.key,
  });
  const { rule } = identified;

  const setComparison = (i: number, patch: Partial<EditorRule<Action>['comparisons'][number]>) =>
    onUpdate(identified.key, {
      ...rule,
      comparisons: rule.comparisons.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="drag to reorder"
          className="mt-1 cursor-grab text-slate-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">#{index + 1}</span>
            <span>if</span>
            {rule.comparisons.length === 0 && <span className="italic">always</span>}
            {rule.comparisons.length > 1 && (
              <Select
                aria-label="combinator"
                className="h-7 w-auto text-xs"
                value={rule.combinator}
                onChange={(e) =>
                  onUpdate(identified.key, {
                    ...rule,
                    combinator: e.target.value as 'and' | 'or',
                  })
                }
              >
                <option value="and">ALL match (AND)</option>
                <option value="or">ANY match (OR)</option>
              </Select>
            )}
          </div>
          {rule.comparisons.map((comparison, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                aria-label="subject"
                className="w-auto"
                value={comparison.subject}
                onChange={(e) =>
                  setComparison(i, { subject: e.target.value as ConditionSubject })
                }
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="comparator"
                className="w-auto"
                value={comparison.cmp}
                onChange={(e) => setComparison(i, { cmp: e.target.value as Comparator })}
              >
                {COMPARATORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="value"
                type="number"
                className="w-24"
                value={comparison.value}
                onChange={(e) => setComparison(i, { value: Number(e.target.value) })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="remove condition"
                onClick={() =>
                  onUpdate(identified.key, {
                    ...rule,
                    comparisons: rule.comparisons.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onUpdate(identified.key, {
                  ...rule,
                  comparisons: [
                    ...rule.comparisons,
                    { subject: subjects[0]!, cmp: 'gte', value: 300 },
                  ],
                })
              }
            >
              <Plus aria-hidden className="h-3 w-3" /> Add condition
            </Button>
            <span className="text-xs text-slate-500">then</span>
            <Select
              aria-label="action"
              className="w-auto"
              value={rule.action}
              onChange={(e) => onUpdate(identified.key, { ...rule, action: e.target.value as Action })}
            >
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="move rule up"
            onClick={() => onMove(index, -1)}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="move rule down"
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="delete rule"
            onClick={() => onDelete(identified.key)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
