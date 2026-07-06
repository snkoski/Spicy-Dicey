import { useMemo, useState } from 'react';
import {
  BUILTIN_STRATEGIES,
  DEFAULT_RULESET,
  type RulesetConfig,
  type StrategyDefinition,
} from '@spicy-dicey/core-engine';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Select } from '../../components/ui/select';
import { listCustomStrategies } from '../strategy-builder/lib/storage';
import { exportResultsCsv, exportResultsJson } from './lib/export';
import {
  type SimulationConfig,
  type SimulationMode,
  type SimulationResult,
} from './lib/run-simulation';
import { runSimulationInWorker } from '../../workers/run-in-worker';
import { ResultsPanel } from './ResultsPanel';
import { ReplayPanel } from './ReplayPanel';

export type SimRunner = (
  config: SimulationConfig,
  onProgress?: (completed: number, total: number) => void,
) => Promise<SimulationResult>;

export function SimulatorPage({ runner = runSimulationInWorker }: { runner?: SimRunner }) {
  const available = useMemo<Array<{ id: string; name: string; definition: StrategyDefinition }>>(
    () => [
      ...BUILTIN_STRATEGIES.map((s) => ({ id: s.id, name: s.name, definition: s })),
      ...listCustomStrategies().map((s) => ({
        id: s.id,
        name: `${s.name} (custom)`,
        definition: s,
      })),
    ],
    [],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [numGames, setNumGames] = useState(1000);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<SimulationMode>('head-to-head');
  const [ruleset, setRuleset] = useState<RulesetConfig>(DEFAULT_RULESET);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const run = async () => {
    setError(null);
    setResult(null);
    setShowReplay(false);
    setProgress([0, 1]);
    try {
      const config: SimulationConfig = {
        strategies: available
          .filter((s) => selected.has(s.id))
          .map((s) => ({ id: s.id, definition: s.definition })),
        ruleset,
        numGames,
        seed,
        mode,
      };
      setResult(await runner(config, (completed, total) => setProgress([completed, total])));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const download = (contents: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Strategy simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="space-y-1">
            <legend className="text-sm font-semibold">Strategies (pick 2+)</legend>
            {available.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={s.name}
                />
                {s.name}
              </label>
            ))}
          </fieldset>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="sim-games">Games</Label>
              <Input
                id="sim-games"
                type="number"
                min={1}
                value={numGames}
                onChange={(e) => setNumGames(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-seed">Seed</Label>
              <Input
                id="sim-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-mode">Mode</Label>
              <Select
                id="sim-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as SimulationMode)}
              >
                <option value="head-to-head">Head-to-head</option>
                <option value="round-robin">Round-robin</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-target">Target score</Label>
              <Input
                id="sim-target"
                type="number"
                step={500}
                value={ruleset.targetScore}
                onChange={(e) => setRuleset({ ...ruleset, targetScore: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-scaling">N-of-a-kind scaling</Label>
              <Select
                id="sim-scaling"
                value={ruleset.nOfAKindScaling}
                onChange={(e) =>
                  setRuleset({
                    ...ruleset,
                    nOfAKindScaling: e.target.value as RulesetConfig['nOfAKindScaling'],
                  })
                }
              >
                <option value="flat">Flat (1000/2000/3000)</option>
                <option value="doubling">Doubling</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-endgame">End game</Label>
              <Select
                id="sim-endgame"
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
              <Label htmlFor="sim-penalty">Farkle penalty</Label>
              <Select
                id="sim-penalty"
                value={ruleset.farklePenaltyVariant}
                onChange={(e) =>
                  setRuleset({
                    ...ruleset,
                    farklePenaltyVariant: e.target.value as RulesetConfig['farklePenaltyVariant'],
                  })
                }
              >
                <option value="turn-points-only">Turn points only</option>
                <option value="three-consecutive-penalty">3-in-a-row penalty</option>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ruleset.twoTripletsEnabled}
                  onChange={(e) => setRuleset({ ...ruleset, twoTripletsEnabled: e.target.checked })}
                  aria-label="two triplets combo"
                />
                Two-triplets combo
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              disabled={selected.size < 2 || progress !== null}
              onClick={() => void run()}
            >
              Run simulation
            </Button>
            {progress && (
              <div className="w-64">
                <Progress value={(progress[0] / progress[1]) * 100} />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <ResultsPanel result={result} />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => download(exportResultsCsv(result), 'simulation.csv', 'text/csv')}
            >
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                download(exportResultsJson(result), 'simulation.json', 'application/json')
              }
            >
              Export JSON
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowReplay((v) => !v)}>
              Replay sample game
            </Button>
          </div>
          {showReplay && <ReplayPanel log={result.sampleGameLog} />}
        </>
      )}
    </div>
  );
}
