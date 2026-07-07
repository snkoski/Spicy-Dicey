import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

async function appWithDb() {
  const app = buildApp({ database: ':memory:' });
  await app.ready();
  return app;
}

const cookieOf = (res: { cookies: Array<{ name: string; value: string }> }) =>
  res.cookies.find((c) => c.name === 'sd_session')!.value;

describe('account routes', () => {
  it('signup -> me -> logout round-trip', async () => {
    const app = await appWithDb();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });
    expect(signup.statusCode).toBe(200);
    const token = cookieOf(signup);

    const me = await app.inject({
      method: 'GET',
      url: '/users/me',
      cookies: { sd_session: token },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ displayName: 'Ann', kind: 'user' });

    await app.inject({ method: 'POST', url: '/auth/logout', cookies: { sd_session: token } });
    const after = await app.inject({
      method: 'GET',
      url: '/users/me',
      cookies: { sd_session: token },
    });
    expect(after.statusCode).toBe(401);
  });

  it('login rejects bad credentials', async () => {
    const app = await appWithDb();
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });
    const bad = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ann@example.com', password: 'nope' },
    });
    expect(bad.statusCode).toBe(401);
    const good = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ann@example.com', password: 'hunter22' },
    });
    expect(good.statusCode).toBe(200);
  });

  it('guest cookie also resolves at /users/me (one identity path)', async () => {
    const app = await appWithDb();
    const guest = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { displayName: 'Rando' },
    });
    const me = await app.inject({
      method: 'GET',
      url: '/users/me',
      cookies: { sd_session: cookieOf(guest) },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ displayName: 'Rando', kind: 'guest' });
  });

  it('upgrade keeps the same cookie session working and returns the user', async () => {
    const app = await appWithDb();
    const guest = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { displayName: 'Ann' },
    });
    const guestToken = cookieOf(guest);

    const upgrade = await app.inject({
      method: 'POST',
      url: '/auth/upgrade',
      cookies: { sd_session: guestToken },
      payload: { email: 'ann@example.com', password: 'hunter22' },
    });
    expect(upgrade.statusCode).toBe(200);
    const newToken = cookieOf(upgrade);

    const me = await app.inject({
      method: 'GET',
      url: '/users/me',
      cookies: { sd_session: newToken },
    });
    expect(me.json()).toMatchObject({ kind: 'user', displayName: 'Ann' });
  });

  it('stats endpoint requires auth and returns aggregates', async () => {
    const app = await appWithDb();
    expect((await app.inject({ method: 'GET', url: '/users/me/stats' })).statusCode).toBe(401);

    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });
    const stats = await app.inject({
      method: 'GET',
      url: '/users/me/stats',
      cookies: { sd_session: cookieOf(signup) },
    });
    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toMatchObject({ gamesPlayed: 0, wins: 0 });
  });
});

describe('strategy routes', () => {
  const strategy = {
    schemaVersion: 1,
    id: 'custom-mine',
    name: 'Mine',
    keepPolicy: [],
    bankPolicy: [
      {
        condition: { type: 'comparison', subject: 'turnScore', cmp: 'gte', value: 300 },
        action: 'bank',
      },
    ],
  };

  it('CRUD round-trip scoped to the owner', async () => {
    const app = await appWithDb();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });
    const token = cookieOf(signup);

    const created = await app.inject({
      method: 'POST',
      url: '/strategies',
      cookies: { sd_session: token },
      payload: { name: 'Mine', description: 'test', rules: strategy },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as { id: string }).id;

    const list = await app.inject({
      method: 'GET',
      url: '/strategies',
      cookies: { sd_session: token },
    });
    const names = (list.json() as Array<{ name: string }>).map((s) => s.name);
    expect(names).toContain('Mine');

    const updated = await app.inject({
      method: 'PUT',
      url: `/strategies/${id}`,
      cookies: { sd_session: token },
      payload: { name: 'Mine v2', description: 'test', rules: strategy },
    });
    expect(updated.statusCode).toBe(200);

    // another user cannot touch it
    const other = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'eve@example.com', password: 'hunter22', displayName: 'Eve' },
    });
    const stolen = await app.inject({
      method: 'DELETE',
      url: `/strategies/${id}`,
      cookies: { sd_session: cookieOf(other) },
    });
    expect(stolen.statusCode).toBe(404);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/strategies/${id}`,
      cookies: { sd_session: token },
    });
    expect(deleted.statusCode).toBe(200);
  });

  it('rejects rules failing the shared contract schema', async () => {
    const app = await appWithDb();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
    });
    const bad = await app.inject({
      method: 'POST',
      url: '/strategies',
      cookies: { sd_session: cookieOf(signup) },
      payload: { name: 'Bad', rules: { nope: true } },
    });
    expect(bad.statusCode).toBe(400);
  });
});
