import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { RuleListEditor, type IdentifiedRule } from './RuleListEditor';
import { buildStrategyDefinition } from './lib/rule-model';
import { accountApi } from '../account/api';
import { listCustomStrategies, saveCustomStrategy } from './lib/storage';

const BANK_SUBJECTS = ['turnScore', 'diceRemaining', 'scoreDifferential', 'hotDiceStreak'] as const;
const KEEP_SUBJECTS = [
  'candidateDieValue',
  'diceRemainingIfKept',
  'diceRemainingIfDeclined',
  'turnScore',
  'scoreDifferential',
  'hotDiceStreak',
] as const;

export function BuilderPage() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(() => listCustomStrategies().length);
  const [bankRules, setBankRules] = useState<IdentifiedRule<'bank' | 'roll'>[]>([]);
  const [keepRules, setKeepRules] = useState<IdentifiedRule<'keep' | 'decline'>[]>([]);

  const save = () => {
    if (name.trim() === '') {
      setError('A name is required.');
      return;
    }
    try {
      const definition = buildStrategyDefinition(
        name.trim(),
        bankRules.map((r) => r.rule),
        keepRules.map((r) => r.rule),
      );
      saveCustomStrategy(definition);
      setError(null);
      setSavedCount(listCustomStrategies().length);
      // Signed-in users also get the strategy saved to their account
      // (plan §1 Phase 5); guests keep the localStorage copy only.
      void accountApi
        .me()
        .then((me) => {
          if (me?.kind === 'user') {
            return fetch('/strategies', {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: definition.name, rules: definition }),
            });
          }
          return undefined;
        })
        .catch(() => undefined); // offline/anonymous: local copy is enough
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy builder</CardTitle>
        <p className="text-sm text-slate-500">
          Two ordered rule lists, evaluated top to bottom — the first matching rule wins. The keep
          policy decides lone 1s and 5s; complete combos are always kept.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="strategy-name">Strategy name</Label>
          <Input
            id="strategy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cautious closer"
          />
        </div>

        <RuleListEditor
          title="Keep policy (which lone 1s/5s to set aside)"
          addLabel="Add keep rule"
          subjects={[...KEEP_SUBJECTS]}
          actions={['keep', 'decline']}
          rules={keepRules}
          onChange={setKeepRules}
        />

        <RuleListEditor
          title="Bank policy (bank or roll again)"
          addLabel="Add bank rule"
          subjects={[...BANK_SUBJECTS]}
          actions={['bank', 'roll']}
          rules={bankRules}
          onChange={setBankRules}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save}>
            Save strategy
          </Button>
          <span className="text-sm text-slate-500">{savedCount} custom saved</span>
        </div>
      </CardContent>
    </Card>
  );
}
