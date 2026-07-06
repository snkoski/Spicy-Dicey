import { useMemo, useState } from 'react';
import type { GameLogEvent } from '@spicy-dicey/core-engine';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { buildReplayFrames } from './lib/replay';

/** Step-through replay of one game, driven purely by the engine's log. */
export function ReplayPanel({ log }: { log: GameLogEvent[] }) {
  const frames = useMemo(() => buildReplayFrames(log), [log]);
  const [step, setStep] = useState(0);
  const frame = frames[step]!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sample game replay</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="previous step"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ◀ Prev
          </Button>
          <span data-testid="replay-step" className="text-sm tabular-nums">
            {step + 1} / {frames.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="next step"
            disabled={step === frames.length - 1}
            onClick={() => setStep((s) => Math.min(frames.length - 1, s + 1))}
          >
            Next ▶
          </Button>
        </div>

        <p className="text-sm font-medium">{describeEvent(frame.event)}</p>

        {frame.tableDice && (
          <div className="flex gap-2" aria-label="dice on the table">
            {frame.tableDice.map((die, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white font-mono"
              >
                {die}
              </span>
            ))}
          </div>
        )}

        <div className="text-sm text-slate-600">
          <span className="mr-4">
            Turn score: <strong>{frame.turnScore}</strong>
          </span>
          {Object.entries(frame.totals).map(([id, total]) => (
            <span key={id} className="mr-4">
              {id}: <strong>{total}</strong>
              {frame.currentPlayerId === id ? ' ←' : ''}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function describeEvent(event: GameLogEvent): string {
  switch (event.type) {
    case 'turn-started':
      return `${event.playerId} starts turn ${event.turnIndex + 1}`;
    case 'rolled':
      return `${event.playerId} rolls ${event.dice.join(', ')}`;
    case 'selected':
      return `${event.playerId} keeps ${event.dice.join(', ')} for ${event.score}${event.hotDice ? ' — HOT DICE!' : ''}`;
    case 'decision':
      return `${event.playerId} rolls again with ${event.diceToRoll} dice`;
    case 'farkled':
      return `${event.playerId} farkles, losing ${event.pointsLost}${event.penaltyApplied ? ` (and a ${event.penaltyApplied} penalty)` : ''}`;
    case 'banked':
      return `${event.playerId} banks ${event.pointsAdded} → ${event.newTotal}`;
    case 'final-round-triggered':
      return `${event.playerId} triggers the final round!`;
    case 'game-ended':
      return `Game over — ${event.winnerId ?? 'nobody'} wins`;
  }
}
