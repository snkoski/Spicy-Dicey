import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULESET, createMulberry32 } from '@spicy-dicey/core-engine';
import { Room, type FinishedGameSummary } from '../../src/game/room.js';
import { persistFinishedGame } from '../../src/db/game-repository.js';
import { createAccountService } from '../../src/accounts/service.js';
import { schema } from '../../src/db/client.js';
import { createTestDb } from '../db/test-db.js';

const closers: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const close of closers) {
    await close();
  }
});

const noopOutbox = { broadcast: () => {}, toIdentity: () => {} };

function playToCompletion(onGameFinished: (summary: FinishedGameSummary) => void): void {
  const room = new Room(
    'ROOM01',
    'guest-host',
    {
      rulesetConfig: { ...DEFAULT_RULESET, targetScore: 500, onTheBoardEnabled: false },
      maxPlayers: 2,
      turnTimerSec: null,
      spectatorChatEnabled: false,
      displayName: 'Host',
    },
    noopOutbox,
    { rng: createMulberry32(11), onGameFinished },
  );
  room.join('guest-host', 'Host', false);
  room.join('user-ben', 'Ben', false);
  room.start('guest-host');

  for (let guard = 0; guard < 500 && room.status === 'active'; guard += 1) {
    const snapshot = room.snapshot();
    const current = snapshot.match!.currentPlayerId!;
    const phase = snapshot.match!.turn.phase;
    if (phase === 'awaiting-roll') {
      room.roll(current);
    } else if (phase === 'awaiting-selection') {
      const roll = snapshot.match!.turn.roll!;
      const keep = roll.flatMap((v, i) => (v === 1 || v === 5 ? [i] : []));
      if (keep.length === 0) {
        for (const face of [2, 3, 4, 6]) {
          const of = roll.flatMap((v, i) => (v === face ? [i] : []));
          if (of.length >= 3) {
            keep.push(...of);
            break;
          }
        }
      }
      room.select(current, keep.length > 0 ? keep : roll.map((_, i) => i));
    } else {
      room.bank(current);
    }
  }
}

describe('finished-game persistence', () => {
  it('the room reports a complete summary when the game ends', () => {
    let summary: FinishedGameSummary | null = null;
    playToCompletion((s) => (summary = s));
    expect(summary).not.toBeNull();
    const s = summary!;
    expect(s.roomCode).toBe('ROOM01');
    expect(s.players).toHaveLength(2);
    expect(s.players.map((p) => p.identity).sort()).toEqual(['guest-host', 'user-ben']);
    expect(s.winnerId).toBeTruthy();
    for (const p of s.players) {
      expect(p.finalScore).toBeGreaterThanOrEqual(0);
      expect(p.placement).toBeGreaterThanOrEqual(1);
    }
  });

  it('a game finishing after an upgrade attributes to the new user (decision 6)', async () => {
    const { db, close } = await createTestDb();
    closers.push(close);
    const accounts = createAccountService(db, { bcryptRounds: 4 });
    // a real guest session that then upgrades
    const { createDbSessionStore } = await import('../../src/db/session-store.js');
    const guests = createDbSessionStore(db);
    const guest = await guests.createGuest('Host');
    const upgraded = await accounts.upgradeGuest(
      guest.token,
      'host@example.com',
      'hunter22',
      'Host',
    );

    let summary: FinishedGameSummary | null = null;
    playToCompletion((s) => (summary = s));
    const patched: FinishedGameSummary = {
      ...summary!,
      players: summary!.players.map((p) =>
        p.identity === 'guest-host' ? { ...p, identity: guest.identity.guestSessionId } : p,
      ),
    };
    await persistFinishedGame(db, patched);

    const players = await db.select().from(schema.gamePlayers);
    const hostRow = players.find((p) => p.userId === upgraded.user.id);
    expect(hostRow).toBeDefined();
    const stats = await accounts.statsFor(upgraded.user.id);
    expect(stats.gamesPlayed).toBe(1);
  });

  it('persistFinishedGame writes games + game_players and feeds user stats', async () => {
    const { db, close } = await createTestDb();
    closers.push(close);
    const accounts = createAccountService(db, { bcryptRounds: 4 });
    const { user } = await accounts.signup('ben@example.com', 'hunter22', 'Ben');

    let summary: FinishedGameSummary | null = null;
    playToCompletion((s) => (summary = s));
    // stamp Ben's real user id into the summary identity
    const patched: FinishedGameSummary = {
      ...summary!,
      players: summary!.players.map((p) =>
        p.identity === 'user-ben' ? { ...p, identity: user.id } : p,
      ),
    };

    await persistFinishedGame(db, patched);

    const games = await db.select().from(schema.games);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ roomCode: 'ROOM01', status: 'finished' });

    const players = await db.select().from(schema.gamePlayers);
    expect(players).toHaveLength(2);
    const ben = players.find((p) => p.userId === user.id)!;
    expect(ben).toBeDefined();
    const guest = players.find((p) => p.guestSessionId === 'guest-host')!;
    expect(guest.userId).toBeNull();

    const stats = await accounts.statsFor(user.id);
    expect(stats.gamesPlayed).toBe(1);
  });
});
