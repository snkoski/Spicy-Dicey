import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '../src/index.js';

describe('healthResponseSchema', () => {
  it('accepts a valid payload', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it('rejects an invalid payload', () => {
    expect(healthResponseSchema.safeParse({ status: 'nope' }).success).toBe(false);
  });
});
