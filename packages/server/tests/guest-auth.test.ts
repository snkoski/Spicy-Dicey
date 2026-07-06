import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('POST /auth/guest', () => {
  it('issues a guest identity in an httpOnly cookie (decision 16)', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { displayName: 'Ann' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { guestId: string; displayName: string };
    expect(body.displayName).toBe('Ann');
    expect(body.guestId).toMatch(/\S+/);

    const cookie = res.cookies.find((c) => c.name === 'sd_session');
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Lax');
  });

  it('rejects a missing display name', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/guest', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('the cookie resolves back to the same identity via the session store', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { displayName: 'Ann' },
    });
    const token = res.cookies.find((c) => c.name === 'sd_session')!.value;
    const identity = app.sessions.resolve(token);
    expect(identity).toMatchObject({
      guestSessionId: res.json().guestId,
      displayName: 'Ann',
    });
    expect(app.sessions.resolve('bogus')).toBeNull();
  });
});
