import { lazy, Suspense, useMemo } from 'react';
import { Die2D } from '../dice/Die2D';
import { useDiceSettings } from '../dice/settings';
import { useHotSeatStore } from './store';

const DiceTray3D = lazy(() =>
  import('../dice/DiceTray3D').then((m) => ({ default: m.DiceTray3D })),
);

/**
 * Renders the current roll. Values come from the engine's match state; taps
 * go back through the store. In 3D mode the canvas is pure presentation —
 * the accessible die buttons remain the interaction (and testing) surface,
 * so the 3D layer can never alter or misreport a result.
 */
export function DiceTray() {
  const match = useHotSeatStore((s) => s.match);
  const selectedIndices = useHotSeatStore((s) => s.selectedIndices);
  const toggleDie = useHotSeatStore((s) => s.toggleDie);
  const log = useHotSeatStore((s) => s.log);
  const mode = useDiceSettings((s) => s.mode);

  const rollKey = useMemo(() => log.filter((e) => e.type === 'rolled').length, [log]);
  const webglOk = useMemo(supportsWebgl, []);
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const roll = match?.turn.roll;
  if (!roll) {
    return <p className="text-sm text-slate-400">No dice on the table.</p>;
  }
  const selectable = match!.turn.phase === 'awaiting-selection';
  const show3d = mode === '3d' && webglOk;

  return (
    <div className="space-y-3">
      {show3d && (
        <Suspense fallback={<div className="h-32 w-full animate-pulse rounded bg-slate-100" />}>
          <DiceTray3D
            dice={roll}
            rollKey={rollKey}
            selectedIndices={selectedIndices}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      )}
      <div className="flex flex-wrap gap-3" aria-label="dice tray">
        {roll.map((value, i) => (
          <Die2D
            key={i}
            value={value}
            selected={selectedIndices.includes(i)}
            disabled={!selectable}
            onClick={() => toggleDie(i)}
          />
        ))}
      </div>
    </div>
  );
}

function supportsWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}
