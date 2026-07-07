import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import type { Mailer } from '../email/mailer.js';
import { schema, type AppDb } from '../db/client.js';

const AUTH_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface AccountUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export interface AccountIdentity {
  userId: string;
  displayName: string;
  emailVerified: boolean;
  /** The linked guest identity after an upgrade — keeps live room seats. */
  guestSessionId: string | null;
}

export interface UserStats {
  gamesPlayed: number;
  wins: number;
  avgScore: number;
  farkleRate: number;
}

interface AccountServiceOptions {
  bcryptRounds?: number;
  now?: () => number;
  mailer?: Mailer;
}

const EMAIL_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function createAccountService(db: AppDb, options: AccountServiceOptions = {}) {
  const rounds = options.bcryptRounds ?? 12;
  const now = options.now ?? Date.now;
  const mailer = options.mailer;

  async function issueEmailToken(userId: string, email: string, kind: 'verify' | 'reset') {
    const token = randomBytes(24).toString('base64url');
    await db.insert(schema.emailTokens).values({
      id: randomUUID(),
      token,
      userId,
      kind,
      createdAt: now(),
      expiresAt: now() + EMAIL_TOKEN_TTL_MS,
      usedAt: null,
    });
    await mailer?.send({ to: email, kind, token });
  }

  async function consumeEmailToken(token: string, kind: 'verify' | 'reset') {
    const [row] = await db
      .select()
      .from(schema.emailTokens)
      .where(
        and(
          eq(schema.emailTokens.token, token),
          eq(schema.emailTokens.kind, kind),
          gt(schema.emailTokens.expiresAt, now()),
          isNull(schema.emailTokens.usedAt),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }
    await db
      .update(schema.emailTokens)
      .set({ usedAt: now() })
      .where(eq(schema.emailTokens.id, row.id));
    return row;
  }

  async function createAuthSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await db.insert(schema.authSessions).values({
      id: randomUUID(),
      sessionToken: token,
      userId,
      createdAt: now(),
      expiresAt: now() + AUTH_SESSION_TTL_MS,
    });
    return token;
  }

  async function createUser(
    email: string,
    password: string,
    displayName: string,
  ): Promise<AccountUser> {
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing.length > 0) {
      throw new Error('an account with this email already exists');
    }
    const user = {
      id: `user-${randomUUID()}`,
      email,
      passwordHash: await bcrypt.hash(password, rounds),
      displayName,
      emailVerified: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.insert(schema.users).values(user);
    return { id: user.id, email, displayName, emailVerified: false };
  }

  return {
    async signup(email: string, password: string, displayName: string) {
      const user = await createUser(email, password, displayName);
      await issueEmailToken(user.id, email, 'verify');
      return { user, token: await createAuthSession(user.id) };
    },

    async verifyEmail(token: string): Promise<boolean> {
      const row = await consumeEmailToken(token, 'verify');
      if (!row) {
        return false;
      }
      await db
        .update(schema.users)
        .set({ emailVerified: true, updatedAt: now() })
        .where(eq(schema.users.id, row.userId));
      return true;
    },

    /** Same response whether or not the email exists (no account probing). */
    async requestPasswordReset(email: string): Promise<void> {
      const [user] = await db
        .select({ id: schema.users.id, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (user) {
        await issueEmailToken(user.id, user.email, 'reset');
      }
    },

    async resetPassword(token: string, newPassword: string): Promise<boolean> {
      const row = await consumeEmailToken(token, 'reset');
      if (!row) {
        return false;
      }
      await db
        .update(schema.users)
        .set({ passwordHash: await bcrypt.hash(newPassword, rounds), updatedAt: now() })
        .where(eq(schema.users.id, row.userId));
      // revoke existing sessions: a reset invalidates everything outstanding
      await db.delete(schema.authSessions).where(eq(schema.authSessions.userId, row.userId));
      return true;
    },

    async login(email: string, password: string) {
      const [row] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (!row || !(await bcrypt.compare(password, row.passwordHash))) {
        return null;
      }
      const user: AccountUser = {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        emailVerified: row.emailVerified,
      };
      return { user, token: await createAuthSession(user.id) };
    },

    async logout(token: string) {
      await db.delete(schema.authSessions).where(eq(schema.authSessions.sessionToken, token));
    },

    async resolveSession(token: string): Promise<AccountIdentity | null> {
      const [session] = await db
        .select()
        .from(schema.authSessions)
        .where(
          and(
            eq(schema.authSessions.sessionToken, token),
            gt(schema.authSessions.expiresAt, now()),
          ),
        )
        .limit(1);
      if (!session) {
        return null;
      }
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, session.userId))
        .limit(1);
      if (!user) {
        return null;
      }
      const [guest] = await db
        .select({ id: schema.guestSessions.id })
        .from(schema.guestSessions)
        .where(eq(schema.guestSessions.upgradedUserId, user.id))
        .orderBy(desc(schema.guestSessions.createdAt))
        .limit(1);
      return {
        userId: user.id,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        guestSessionId: guest?.id ?? null,
      };
    },

    /**
     * Decision 6: upgrade carries the live game (the guest identity keeps
     * its seat) and backfills this session's finished games by
     * re-attributing game_players rows to the new user.
     */
    async upgradeGuest(guestToken: string, email: string, password: string, displayName: string) {
      const [guest] = await db
        .select()
        .from(schema.guestSessions)
        .where(eq(schema.guestSessions.sessionToken, guestToken))
        .limit(1);
      if (!guest || guest.expiresAt <= now() || guest.upgradedUserId !== null) {
        throw new Error('no upgradable guest session for this token');
      }
      const user = await createUser(email, password, displayName);
      await db
        .update(schema.guestSessions)
        .set({ upgradedUserId: user.id })
        .where(eq(schema.guestSessions.id, guest.id));
      await db
        .update(schema.gamePlayers)
        .set({ userId: user.id })
        .where(eq(schema.gamePlayers.guestSessionId, guest.id));
      return { user, token: await createAuthSession(user.id) };
    },

    async statsFor(userId: string): Promise<UserStats> {
      const rows = await db
        .select()
        .from(schema.gamePlayers)
        .where(
          and(eq(schema.gamePlayers.userId, userId), isNotNull(schema.gamePlayers.finalScore)),
        );
      const gamesPlayed = rows.length;
      const wins = rows.filter((r) => r.placement === 1).length;
      const scoreSum = rows.reduce((sum, r) => sum + (r.finalScore ?? 0), 0);
      const farkles = rows.reduce((sum, r) => sum + (r.farkleCount ?? 0), 0);
      const turns = rows.reduce((sum, r) => sum + (r.turnCount ?? 0), 0);
      return {
        gamesPlayed,
        wins,
        avgScore: gamesPlayed === 0 ? 0 : scoreSum / gamesPlayed,
        farkleRate: turns === 0 ? 0 : farkles / turns,
      };
    },

    async gamesFor(userId: string, limit = 20, cursor?: string) {
      const rows = await db
        .select()
        .from(schema.gamePlayers)
        .where(and(eq(schema.gamePlayers.userId, userId), isNotNull(schema.gamePlayers.finalScore)))
        .orderBy(desc(schema.gamePlayers.id))
        .limit(limit + 1);
      const filtered = cursor ? rows.filter((r) => r.id < cursor) : rows;
      const page = filtered.slice(0, limit);
      return {
        games: page,
        nextCursor: filtered.length > limit ? page.at(-1)!.id : null,
      };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
