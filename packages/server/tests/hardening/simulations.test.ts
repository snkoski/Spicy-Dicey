import { describe, expect, it } from 'vitest';
import { DEFAULT_RULESET } from '@spicy-dicey/core-engine';
import { buildApp } from '../../src/app.js';

const cookieOf = (res: { cookies: Array<{ name: string; value: string }> }) =>
  res.cookies.find((c) => c.name === 'sd_session')!.value;

async function signedInApp() {
  const app = buildApp({ database: ':memory:' });
  const signup = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { email: 'ann@example.com', password: 'hunter22', displayName: 'Ann' },
  });
  return { app, token: cookieOf(signup) };
}

const waitForCompletion = async (app: ReturnType<typeof buildApp>, token: string, id: string) => {
  for (let i = 0; i < 100; i += 1) {
    const res = await app.inject({
      method: 'GET',
      url: `/simulations/${id}`,
      cookies: { sd_session: token },
    });
    const body = res.json() as { status: string };
    if (body.status === 'completed') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('simulation never completed');
};

describe('backend simulation jobs (decisions 7 and 9)', () => {
  it('runs a large job async and serves results + exports', async () => {
    const { app, token } = await signedInApp();
    const created = await app.inject({
      method: 'POST',
      url: '/simulations',
      cookies: { sd_session: token },
      payload: {
        strategyIds: ['always-bank-at-300', 'ev-optimal'],
        rulesetConfig: DEFAULT_RULESET,
        numGames: 200,
        seed: 42,
        mode: 'head-to-head',
      },
    });
    expect(created.statusCode).toBe(200);
    const { id, status } = created.json() as { id: string; status: string };
    expect(status).toBe('running');

    await waitForCompletion(app, token, id);

    const results = await app.inject({
      method: 'GET',
      url: `/simulations/${id}/results`,
      cookies: { sd_session: token },
    });
    expect(results.statusCode).toBe(200);
    const rows = results.json() as Array<{ strategyId: string; gamesPlayed: number }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.gamesPlayed).toBe(200);

    const csv = await app.inject({
      method: 'GET',
      url: `/simulations/${id}/export?format=csv`,
      cookies: { sd_session: token },
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.body.split('\n')[0]).toMatch(/strategyId/);

    const json = await app.inject({
      method: 'GET',
      url: `/simulations/${id}/export?format=json`,
      cookies: { sd_session: token },
    });
    expect(json.statusCode).toBe(200);
    expect(JSON.parse(json.body)).toHaveLength(2);
  });

  it('rejects unknown strategy ids and anonymous users', async () => {
    const { app, token } = await signedInApp();
    const bad = await app.inject({
      method: 'POST',
      url: '/simulations',
      cookies: { sd_session: token },
      payload: {
        strategyIds: ['nope'],
        rulesetConfig: DEFAULT_RULESET,
        numGames: 10,
        seed: 1,
        mode: 'head-to-head',
      },
    });
    expect(bad.statusCode).toBe(400);

    const anon = await app.inject({ method: 'POST', url: '/simulations', payload: {} });
    expect(anon.statusCode).toBe(401);
  });
});
