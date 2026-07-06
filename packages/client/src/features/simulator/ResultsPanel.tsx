import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import type { SimulationResult } from './lib/run-simulation';

export function ResultsPanel({ result }: { result: SimulationResult }) {
  const rows = result.rankings.map((id, i) => ({
    rank: i + 1,
    id,
    ...result.perStrategy[id]!,
  }));

  const winRateData = rows.map((r) => ({
    name: r.id,
    winRate: Number((r.winRate * 100).toFixed(2)),
  }));
  const distributionData = mergeDistributions(result);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Strategy</th>
                <th className="py-2 pr-4">Games</th>
                <th className="py-2 pr-4">Wins</th>
                <th className="py-2 pr-4">Win rate</th>
                <th className="py-2 pr-4">Avg score</th>
                <th className="py-2 pr-4">Avg turns</th>
                <th className="py-2 pr-4">Avg farkles</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.rank}</td>
                  <td className="py-2 pr-4 font-medium">{r.id}</td>
                  <td className="py-2 pr-4">{r.gamesPlayed}</td>
                  <td className="py-2 pr-4">{r.gamesWon}</td>
                  <td className="py-2 pr-4">{(r.winRate * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-4">{r.avgFinalScore.toFixed(0)}</td>
                  <td className="py-2 pr-4">{r.avgTurns.toFixed(1)}</td>
                  <td className="py-2 pr-4">{r.avgFarkles.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.matrix && (
          <div className="overflow-x-auto">
            <h4 className="mb-2 text-sm font-semibold">Round-robin wins (row beat column)</h4>
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="py-1 pr-3" />
                  {result.matrix.ids.map((id) => (
                    <th key={id} className="py-1 pr-3 text-left text-slate-500">
                      {id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.matrix.ids.map((rowId, i) => (
                  <tr key={rowId}>
                    <th className="py-1 pr-3 text-left text-slate-500">{rowId}</th>
                    {result.matrix!.ids.map((colId, j) => (
                      <td key={colId} className="py-1 pr-3">
                        {result.matrix!.wins[i]![j] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-8">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Win rate (%)</h4>
            <BarChart width={360} height={220} data={winRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="winRate" fill="#2563eb" />
            </BarChart>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Final score distribution</h4>
            <BarChart width={420} height={220} data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis />
              <Tooltip />
              <Legend />
              {result.rankings.map((id, i) => (
                <Bar key={id} dataKey={id} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

function mergeDistributions(result: SimulationResult): Array<Record<string, number | string>> {
  const buckets = new Map<number, Record<string, number | string>>();
  for (const [id, stats] of Object.entries(result.perStrategy)) {
    for (const bucket of stats.scoreDistribution) {
      const row = buckets.get(bucket.min) ?? { bucket: `${bucket.min / 1000}k` };
      row[id] = bucket.count;
      buckets.set(bucket.min, row);
    }
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}
