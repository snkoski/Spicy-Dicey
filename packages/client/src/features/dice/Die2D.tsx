import type { DieValue } from '@spicy-dicey/core-engine';
import { cn } from '../../lib/utils';
import { PIP_LAYOUTS } from './faces';

interface Props {
  value: DieValue;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

/** 2D die: a 3x3 pip grid straight from the shared value→face mapping. */
export function Die2D({ value, selected = false, onClick, disabled = false }: Props) {
  const pips = new Set(PIP_LAYOUTS[value].map(([r, c]) => r * 3 + c));
  return (
    <button
      type="button"
      aria-label={`die showing ${value}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-14 w-14 grid-cols-3 grid-rows-3 place-items-center rounded-lg border-2 bg-white p-1.5 shadow transition-transform',
        selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-slate-300',
        !disabled && 'hover:scale-105',
      )}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={cn('h-2 w-2 rounded-full', pips.has(i) ? 'bg-slate-900' : 'bg-transparent')}
        />
      ))}
    </button>
  );
}
