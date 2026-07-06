import type { StrategyStats } from './analytics';
import type { SimulationResult } from './run-simulation';

/** JSON export is the full result verbatim. */
export function exportResultsJson(result: SimulationResult): string {
  return JSON.stringify(result, null, 2);
}

export function importResultsJson(json: string): SimulationResult {
  return JSON.parse(json) as SimulationResult;
}

const CSV_COLUMNS = [
  'strategyId',
  'gamesPlayed',
  'gamesWon',
  'winRate',
  'avgFinalScore',
  'avgTurns',
  'avgFarkles',
  'scoreDistribution',
] as const;

/**
 * One row per strategy; the distribution rides along as a quoted JSON cell
 * so the re-import acceptance criterion covers every exported number.
 */
export function exportResultsCsv(result: SimulationResult): string {
  const rows = Object.entries(result.perStrategy).map(([id, stats]) =>
    [
      csvCell(id),
      String(stats.gamesPlayed),
      String(stats.gamesWon),
      String(stats.winRate),
      String(stats.avgFinalScore),
      String(stats.avgTurns),
      String(stats.avgFarkles),
      csvCell(JSON.stringify(stats.scoreDistribution)),
    ].join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}

export function importResultsCsv(csv: string): Record<string, StrategyStats> {
  const [header, ...rows] = csv.trim().split('\n');
  if (header !== CSV_COLUMNS.join(',')) {
    throw new Error('unrecognized CSV header');
  }
  const out: Record<string, StrategyStats> = {};
  for (const row of rows) {
    const cells = parseCsvRow(row);
    if (cells.length !== CSV_COLUMNS.length) {
      throw new Error(`expected ${CSV_COLUMNS.length} cells, got ${cells.length}`);
    }
    out[cells[0]!] = {
      gamesPlayed: Number(cells[1]),
      gamesWon: Number(cells[2]),
      winRate: Number(cells[3]),
      avgFinalScore: Number(cells[4]),
      avgTurns: Number(cells[5]),
      avgFarkles: Number(cells[6]),
      scoreDistribution: JSON.parse(cells[7]!) as StrategyStats['scoreDistribution'],
    };
  }
  return out;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i]!;
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
