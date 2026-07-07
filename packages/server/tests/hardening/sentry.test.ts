import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { setupErrorTracking } from '../../src/observability/sentry.js';

describe('error tracking', () => {
  it('captures a deliberately thrown server error and hides details', async () => {
    const app = buildApp({ database: ':memory:' });
    const captured: Error[] = [];
    setupErrorTracking(app, (e) => captured.push(e));
    app.after(() => {
      app.get('/boom', () => {
        throw new Error('deliberate kaboom');
      });
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('kaboom'); // no internals leak
    expect(captured).toHaveLength(1);
    expect(captured[0]!.message).toBe('deliberate kaboom');
  });
});
