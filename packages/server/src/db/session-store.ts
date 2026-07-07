import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { SessionIdentity, SessionStore } from '../auth/session-store.js';
import { schema, type AppDb } from './client.js';

export const GUEST_SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/**
 * DB-backed replacement for the Phase-4 in-memory store — same interface,
 * same socket contract, now with expiry and upgrade support (plan §3
 * guest_sessions). Uses only Drizzle's await API so the identical code
 * runs on SQLite and Postgres.
 */
export function createDbSessionStore(db: AppDb, now: () => number = Date.now): SessionStore {
  return {
    async createGuest(displayName: string) {
      const token = randomBytes(32).toString('base64url');
      const id = `guest-${randomUUID()}`;
      await db.insert(schema.guestSessions).values({
        id,
        sessionToken: token,
        displayName,
        createdAt: now(),
        expiresAt: now() + GUEST_SESSION_TTL_MS,
        upgradedUserId: null,
      });
      return { token, identity: { guestSessionId: id, displayName } satisfies SessionIdentity };
    },

    async resolve(token: string) {
      const rows = await db
        .select()
        .from(schema.guestSessions)
        .where(eq(schema.guestSessions.sessionToken, token))
        .limit(1);
      const row = rows[0];
      if (!row || row.expiresAt <= now()) {
        return null;
      }
      return { guestSessionId: row.id, displayName: row.displayName };
    },

    async revoke(token: string) {
      await db.delete(schema.guestSessions).where(eq(schema.guestSessions.sessionToken, token));
    },
  };
}

/**
 * Decision 6's enforcement: expired, never-upgraded guest sessions are
 * deleted along with their orphaned game_players rows — this is what makes
 * "no stats beyond the session" true for non-upgraders.
 */
export async function purgeExpiredGuestSessions(
  db: AppDb,
  now: number = Date.now(),
): Promise<{ sessions: number; gamePlayers: number }> {
  const expired = (
    await db
      .select({ id: schema.guestSessions.id })
      .from(schema.guestSessions)
      .where(
        and(lt(schema.guestSessions.expiresAt, now), isNull(schema.guestSessions.upgradedUserId)),
      )
  ).map((r) => r.id);
  if (expired.length === 0) {
    return { sessions: 0, gamePlayers: 0 };
  }
  const orphans = await db
    .select({ id: schema.gamePlayers.id })
    .from(schema.gamePlayers)
    .where(inArray(schema.gamePlayers.guestSessionId, expired));
  await db.delete(schema.gamePlayers).where(inArray(schema.gamePlayers.guestSessionId, expired));
  await db.delete(schema.guestSessions).where(inArray(schema.guestSessions.id, expired));
  return { sessions: expired.length, gamePlayers: orphans.length };
}

/** In-process interval job (plan §1 Phase 5). Returns a stopper. */
export function startGuestPurgeJob(db: AppDb, intervalMs = 15 * 60 * 1000): () => void {
  const timer = setInterval(() => void purgeExpiredGuestSessions(db), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
