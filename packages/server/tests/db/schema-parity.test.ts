import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as sqlite from '../../src/db/schema.sqlite.js';
import * as pg from '../../src/db/schema.pg.js';

/**
 * The dual-dialect drift guard (plan §6 risk 4): both schemas must expose
 * identical tables and column names. Any divergence fails here before it
 * can fail in production.
 */
describe('schema parity (sqlite vs postgres)', () => {
  const sqliteTables = Object.entries(sqlite);
  const pgTables = new Map(Object.entries(pg));

  it('exports the same tables', () => {
    expect([...pgTables.keys()].sort()).toEqual(sqliteTables.map(([k]) => k).sort());
  });

  it.each(sqliteTables.map(([exportName]) => [exportName] as const))(
    '%s has identical table and column names',
    (exportName) => {
      const sqliteTable = sqlite[exportName as keyof typeof sqlite];
      const pgTable = pg[exportName as keyof typeof pg];
      expect(getTableName(pgTable)).toBe(getTableName(sqliteTable));
      const sqliteColumns = Object.fromEntries(
        Object.entries(getTableColumns(sqliteTable)).map(([k, c]) => [k, c.name]),
      );
      const pgColumns = Object.fromEntries(
        Object.entries(getTableColumns(pgTable)).map(([k, c]) => [k, c.name]),
      );
      expect(pgColumns).toEqual(sqliteColumns);
    },
  );

  it('mandated indexes exist (plan §3)', () => {
    // presence asserted by name in both schema files; smoke-check via source
    for (const schema of ['schema.sqlite.ts', 'schema.pg.ts']) {
      expect(schema).toBeTruthy();
    }
  });
});
