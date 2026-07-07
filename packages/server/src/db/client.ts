import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as sqliteSchema from './schema.sqlite.js';
import * as pgSchema from './schema.pg.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The app-wide database handle. Typed against the SQLite schema; the
 * Postgres instance is structurally identical (enforced by the parity
 * test) and the whole repository suite runs on both dialects in CI.
 */
export type AppDb = BetterSQLite3Database<typeof sqliteSchema>;

export function createSqliteDb(url = ':memory:'): AppDb {
  const connection = new Database(url);
  connection.pragma('journal_mode = WAL');
  const db = drizzleSqlite(connection, { schema: sqliteSchema });
  migrateSqlite(db, { migrationsFolder: path.join(here, 'migrations/sqlite') });
  return db;
}

export async function createPgDb(connectionString: string): Promise<AppDb> {
  const pool = new pg.Pool({ connectionString });
  const db = drizzlePg(pool, { schema: pgSchema });
  await migratePg(db, { migrationsFolder: path.join(here, 'migrations/pg') });
  return db as unknown as AppDb;
}

/** DATABASE_URL present ⇒ Postgres (prod); otherwise SQLite (dev/test). */
export async function createDbFromEnv(): Promise<AppDb> {
  const url = process.env['DATABASE_URL'];
  if (url && url.startsWith('postgres')) {
    return createPgDb(url);
  }
  return createSqliteDb(url ?? process.env['SQLITE_PATH'] ?? ':memory:');
}

export { sqliteSchema as schema };
