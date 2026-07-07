import { afterAll, describe, expect, it } from 'vitest';
import { createAccountService } from '../../src/accounts/service.js';
import { createDbSessionStore } from '../../src/db/session-store.js';
import { schema } from '../../src/db/client.js';
import { createTestDb } from '../db/test-db.js';

const closers: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const close of closers) {
    await close();
  }
});

async function setup() {
  const { db, close } = await createTestDb();
  closers.push(close);
  const guests = createDbSessionStore(db);
  const accounts = createAccountService(db, { bcryptRounds: 4 });
  return { db, guests, accounts };
}

describe('signup / login', () => {
  it('signs up, logs in with the right password, rejects the wrong one', async () => {
    const { accounts } = await setup();
    const created = await accounts.signup('ann@example.com', 'hunter22', 'Ann');
    expect(created.user.email).toBe('ann@example.com');
    expect(created.token).toMatch(/\S+/);

    const login = await accounts.login('ann@example.com', 'hunter22');
    expect(login).not.toBeNull();
    expect(login!.user.id).toBe(created.user.id);

    expect(await accounts.login('ann@example.com', 'wrong')).toBeNull();
    expect(await accounts.login('nobody@example.com', 'hunter22')).toBeNull();
  });

  it('rejects duplicate emails', async () => {
    const { accounts } = await setup();
    await accounts.signup('ann@example.com', 'hunter22', 'Ann');
    await expect(accounts.signup('ann@example.com', 'other', 'Imposter')).rejects.toThrow(
      /already/i,
    );
  });

  it('stores no plaintext passwords', async () => {
    const { accounts, db } = await setup();
    await accounts.signup('ann@example.com', 'hunter22', 'Ann');
    const [row] = await db.select().from(schema.users);
    expect(row!.passwordHash).not.toContain('hunter22');
  });

  it('account sessions resolve and revoke (logout)', async () => {
    const { accounts } = await setup();
    const { token, user } = await accounts.signup('ann@example.com', 'hunter22', 'Ann');
    const identity = await accounts.resolveSession(token);
    expect(identity).toMatchObject({ userId: user.id, displayName: 'Ann' });
    await accounts.logout(token);
    expect(await accounts.resolveSession(token)).toBeNull();
  });
});

describe('guest -> full upgrade (decision 6)', () => {
  it('re-attributes the guest games to the new account (backfill)', async () => {
    const { db, guests, accounts } = await setup();
    const guest = await guests.createGuest('Ann');

    // two finished guest games
    await db.insert(schema.gamePlayers).values([
      {
        id: 'gp1',
        gameId: 'g1',
        guestSessionId: guest.identity.guestSessionId,
        seatIndex: 0,
        displayName: 'Ann',
        finalScore: 10_000,
        placement: 1,
        farkleCount: 2,
        turnCount: 15,
      },
      {
        id: 'gp2',
        gameId: 'g2',
        guestSessionId: guest.identity.guestSessionId,
        seatIndex: 1,
        displayName: 'Ann',
        finalScore: 8000,
        placement: 2,
        farkleCount: 5,
        turnCount: 18,
      },
    ]);

    const upgraded = await accounts.upgradeGuest(
      guest.token,
      'ann@example.com',
      'hunter22',
      'Ann',
    );
    expect(upgraded).not.toBeNull();

    const players = await db.select().from(schema.gamePlayers);
    for (const p of players) {
      expect(p.userId).toBe(upgraded!.user.id);
    }
    // session marked upgraded -> survives the purge job
    const [session] = await db.select().from(schema.guestSessions);
    expect(session!.upgradedUserId).toBe(upgraded!.user.id);
    // the identity is preserved: the room seat key (guestSessionId) still resolves
    const identity = await accounts.resolveSession(upgraded!.token);
    expect(identity!.guestSessionId).toBe(guest.identity.guestSessionId);
  });

  it('rejects an invalid guest token', async () => {
    const { accounts } = await setup();
    await expect(accounts.upgradeGuest('bogus', 'a@b.c', 'pw123456', 'X')).rejects.toThrow(
      /guest/i,
    );
  });
});

describe('stats aggregation', () => {
  it('matches a recompute-from-games ground truth', async () => {
    const { db, accounts } = await setup();
    const { user } = await accounts.signup('ann@example.com', 'hunter22', 'Ann');

    const rows = [
      { score: 10_000, placement: 1, farkles: 2, turns: 20 },
      { score: 7000, placement: 2, farkles: 4, turns: 18 },
      { score: 10_500, placement: 1, farkles: 1, turns: 22 },
    ];
    await db.insert(schema.gamePlayers).values(
      rows.map((r, i) => ({
        id: `gp${i}`,
        gameId: `g${i}`,
        userId: user.id,
        seatIndex: 0,
        displayName: 'Ann',
        finalScore: r.score,
        placement: r.placement,
        farkleCount: r.farkles,
        turnCount: r.turns,
      })),
    );

    const stats = await accounts.statsFor(user.id);
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.avgScore).toBeCloseTo((10_000 + 7000 + 10_500) / 3);
    expect(stats.farkleRate).toBeCloseTo(7 / 60); // farkles / turns
  });

  it('guest games never leak into any user stats without an upgrade', async () => {
    const { db, guests, accounts } = await setup();
    const { user } = await accounts.signup('ann@example.com', 'hunter22', 'Ann');
    const guest = await guests.createGuest('Rando');
    await db.insert(schema.gamePlayers).values({
      id: 'gp-guest',
      gameId: 'g9',
      guestSessionId: guest.identity.guestSessionId,
      seatIndex: 0,
      displayName: 'Rando',
      finalScore: 10_000,
      placement: 1,
      farkleCount: 0,
      turnCount: 10,
    });
    const stats = await accounts.statsFor(user.id);
    expect(stats.gamesPlayed).toBe(0);
  });
});
