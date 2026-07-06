import { Die2D } from '../dice/Die2D';
import { useDiceSettings } from '../dice/settings';
import { useHotSeatStore } from './store';

/**
 * Renders the current roll in the active dice mode. Purely a view: values
 * come from the engine's match state; taps go back through the store.
 * The 3D renderer lands in the dice-3d slice — until then both modes draw
 * the 2D dice (mode state and toggle are already live).
 */
export function DiceTray() {
  const match = useHotSeatStore((s) => s.match);
  const selectedIndices = useHotSeatStore((s) => s.selectedIndices);
  const toggleDie = useHotSeatStore((s) => s.toggleDie);
  useDiceSettings((s) => s.mode); // re-render on mode change (3D path pending)

  const roll = match?.turn.roll;
  if (!roll) {
    return <p className="text-sm text-slate-400">No dice on the table.</p>;
  }
  const selectable = match!.turn.phase === 'awaiting-selection';

  return (
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
  );
}
