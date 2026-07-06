import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@spicy-dicey/contracts';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  it('returns a contracts-valid ok payload', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json())).toEqual({ status: 'ok' });
  });
});
