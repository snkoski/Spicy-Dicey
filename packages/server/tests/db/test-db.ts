import { createPgDb, createSqliteDb, schema, type AppDb } from '../../src/db/client.js';

/**
 * SQLite in-memory by default; a real Postgres when TEST_DATABASE_URL is
 * set (the CI service container). The same repository tests run on both —
 * that CI matrix is the plan's dialect-parity acceptance criterion.
 */
export async function createTestDb(): Promise<{ db: AppDb; close: () => Promise<void> }> {
  const url = process.env['TEST_DATABASE_URL'];
  if (url) {
    const db = await createPgDb(url);
    for (const table of Object.values(schema)) {
      await db.delete(table);
    }
    return {
      db,
      close: async () => {
        const session = (db as unknown as { session?: { client?: { end?: () => Promise<void> } } })
          .session;
        await session?.client?.end?.();
      },
    };
  }
  return { db: createSqliteDb(':memory:'), close: () => Promise.resolve() };
}
