import { useState } from 'react';
import { DEFAULT_RULESET, type RulesetConfig } from '@spicy-dicey/core-engine';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { cn } from '../../lib/utils';
import { useDiceSettings } from '../dice/settings';
import { DiceTray } from './DiceTray';
import { useHotSeatStore } from './store';

export function GamePage() {
  const match = useHotSeatStore((s) => s.match);
  return match === null ? <SetupForm /> : <GameBoard />;
}

function SetupForm() {
  const startGame = useHotSeatStore((s) => s.startGame);
  const [names, setNames] = useState<string[]>(['', '']);
  const [ruleset, setRuleset] = useState<RulesetConfig>(DEFAULT_RULESET);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    const trimmed = names.map((n) => n.trim()).filter((n) => n !== '');
    if (trimmed.length < 2 || new Set(trimmed).size !== trimmed.length) {
      setError('Enter 2–8 unique player names.');
      return;
    }
    try {
      startGame(trimmed, ruleset);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hot-seat game</CardTitle>
        <p className="text-sm text-slate-500">2–8 players sharing this screen.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid max-w-md gap-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`player-${i}`}>Player {i + 1}</Label>
                <Input
                  id={`player-${i}`}
                  value={name}
                  onChange={(e) =>
                    setNames(names.map((n, j) => (j === i ? e.target.value : n)))
                  }
                />
              </div>
              {names.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`remove player ${i + 1}`}
                  onClick={() => setNames(names.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
          {names.length < 8 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setNames([...names, ''])}>
              Add player
            </Button>
          )}
        </div>

        <div className="grid max-w-md grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="game-target">Target score</Label>
            <Input
              id="game-target"
              type="number"
              step={500}
              value={ruleset.targetScore}
              onChange={(e) => setRuleset({ ...ruleset, targetScore: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-endgame">End game</Label>
            <Select
              id="game-endgame"
              value={ruleset.endGameVariant}
              onChange={(e) =>
                setRuleset({
                  ...ruleset,
                  endGameVariant: e.target.value as RulesetConfig['endGameVariant'],
                })
              }
            >
              <option value="final-round">Final round</option>
              <option value="instant">Instant win</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game-scaling">N-of-a-kind scaling</Label>
            <Select
              id="game-scaling"
              value={ruleset.nOfAKindScaling}
              onChange={(e) =>
                setRuleset({
                  ...ruleset,
                  nOfAKindScaling: e.target.value as RulesetConfig['nOfAKindScaling'],
                })
              }
            >
              <option value="flat">Flat</option>
              <option value="doubling">Doubling</option>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ruleset.onTheBoardEnabled}
                onChange={(e) => setRuleset({ ...ruleset, onTheBoardEnabled: e.target.checked })}
                aria-label="on-the-board minimum"
              />
              On-the-board minimum ({ruleset.onTheBoardMinimum})
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="button" onClick={start}>
          Start game
        </Button>
      </CardContent>
    </Card>
  );
}

function GameBoard() {
  const match = useHotSeatStore((s) => s.match)!;
  const banner = useHotSeatStore((s) => s.lastBanner);
  const currentPlayerName = useHotSeatStore((s) => s.currentPlayerName);
  const selectionScore = useHotSeatStore((s) => s.selectionScore);
  const selectedIndices = useHotSeatStore((s) => s.selectedIndices);
  const { roll, rollAgain, confirmSelection, bank, canBankNow, reset } = useHotSeatStore.getState();
  const diceMode = useDiceSettings((s) => s.mode);
  const setDiceMode = useDiceSettings((s) => s.setMode);

  const phase = match.turn.phase;
  const ended = match.status === 'ended';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {ended ? 'Game over' : `${currentPlayerName}'s turn`}
            </CardTitle>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              <input
                type="checkbox"
                role="checkbox"
                aria-label="3D dice"
                checked={diceMode === '3d'}
                onChange={(e) => setDiceMode(e.target.checked ? '3d' : '2d')}
              />
              3D dice
            </label>
          </div>
          {banner && <p className="text-sm font-medium text-amber-700">{banner}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <DiceTray />

          {!ended && (
            <div className="flex flex-wrap items-center gap-3">
              {phase === 'awaiting-roll' && (
                <Button type="button" onClick={roll}>
                  Roll
                </Button>
              )}
              {phase === 'awaiting-selection' && (
                <>
                  <span className="text-sm">
                    {selectionScore !== null
                      ? `Selection: ${selectionScore}`
                      : selectedIndices.length > 0
                        ? 'Selection: not a legal keep'
                        : 'Tap the dice to set aside'}
                  </span>
                  <Button
                    type="button"
                    disabled={selectionScore === null}
                    onClick={confirmSelection}
                  >
                    Keep selection
                  </Button>
                </>
              )}
              {phase === 'awaiting-decision' && (
                <>
                  <span className="text-sm">
                    Turn score: <strong>{match.turn.turnScore}</strong> · {match.turn.diceToRoll}{' '}
                    dice next
                  </span>
                  <Button type="button" onClick={rollAgain}>
                    Roll again
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canBankNow()}
                    onClick={bank}
                  >
                    Bank {match.turn.turnScore}
                  </Button>
                </>
              )}
            </div>
          )}
          {ended && (
            <Button type="button" onClick={reset}>
              Play again
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {match.players.map((p, seat) => (
              <li
                key={p.id}
                className={cn(
                  'flex justify-between rounded px-2 py-1',
                  seat === match.currentSeat && !ended && 'bg-blue-50 font-medium',
                )}
              >
                <span>
                  {p.id}
                  {!p.onTheBoard && match.ruleset.onTheBoardEnabled ? ' (not on board)' : ''}
                  {match.winnerId === p.id ? ' 🏆' : ''}
                </span>
                <span className="tabular-nums">{p.total}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
