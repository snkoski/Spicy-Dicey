import { cn } from '../../lib/utils';
import type { ComponentProps } from 'react';

/**
 * Native select styled to match the kit — keyboard/screen-reader accessible
 * out of the box and far friendlier to jsdom tests than a portal listbox.
 */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex h-9 w-full items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
