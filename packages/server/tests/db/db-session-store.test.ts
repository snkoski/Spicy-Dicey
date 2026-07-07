import { afterAll, describe, expect, it } from 'vitest';
import { schema } from '../../src/db/client.js';
import {
  createDbSessionStore,
  GUEST_SESSION_TTL_MS,
  purgeExpiredGuestSessions,
} from '../../src/db/session-store.js';
import { createTestDb } from './test-db.js';

const closers: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const close of closers) {
    await close();
  }
});

const setup = async (now = 1_000_000) => {
  const { db, close } = await createTestDb();
  closers.push(close);
  let clock = now;
  const store = createDbSessionStore(db, () => clock);
  return { db, store, setClock: (t: number) => (clock = t) };
};

describe('DB-backed session store', () => {
  it('creates and resolves guest sessions', async () => {
    const { store } = await setup();
    const { token, identity } = await store.createGuest('Ann');
    expect(await store.resolve(token)).toEqual(identity);
    expect(await store.resolve('bogus')).toBeNull();
  });

  it('revokes sessions', async () => {
    const { store } = await setup();
    const { token } = await store.createGuest('Ann');
    await store.revoke(token);
    expect(await store.resolve(token)).toBeNull();
  });

  it('expired guest sessions do not resolve', async () => {
    const { store, setClock } = await setup(1_000_000);
    const { token } = await store.createGuest('Ann');
    setClock(1_000_000 + GUEST_SESSION_TTL_MS + 1);
    expect(await store.resolve(token)).toBeNull();
  });
});

describe('purgeExpiredGuestSessions (decision 6 enforcement)', () => {
  it('removes expired non-upgraded sessions and their game_players rows', async () => {
    const { db, store } = await setup(1_000_000);
    const { identity } = await store.createGuest('Ann');
    await db.insert(schema.gamePlayers).values({
      id: 'gp1',
      gameId: 'g1',
      guestSessionId: identity.guestSessionId,
      seatIndex: 0,
      displayName: 'Ann',
    });

    const purged = await purgeExpiredGuestSessions(db, 1_000_000 + GUEST_SESSION_TTL_MS + 1);
    expect(purged.sessions).toBe(1);
    expect(purged.gamePlayers).toBe(1);
    expect(await db.select().from(schema.guestSessions)).toHaveLength(0);
    expect(await db.select().from(schema.gamePlayers)).toHaveLength(0);
  });

  it('keeps live sessions and upgraded ones (their stats now belong to a user)', async () => {
    const { db } = await setup(1_000_000);
    await db.insert(schema.guestSessions).values([
      {
        id: 'guest-live',
        sessionToken: 't1',
        displayName: 'Live',
        createdAt: 1_000_000,
        expiresAt: 99_999_999,
        upgradedUserId: null,
      },
      {
        id: 'guest-upgraded',
        sessionToken: 't2',
        displayName: 'Upgraded',
        createdAt: 1_000_000,
        expiresAt: 1_000_001,
        upgradedUserId: 'user-1',
      },
    ]);

    const purged = await purgeExpiredGuestSessions(db, 2_000_000);
    expect(purged.sessions).toBe(0);
    expect(await db.select().from(schema.guestSessions)).toHaveLength(2);
  });
});
