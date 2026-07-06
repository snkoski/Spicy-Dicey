import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from '../src/index.js';

describe('core-engine package', () => {
  it('exposes its public entry point', () => {
    expect(ENGINE_NAME).toBe('@spicy-dicey/core-engine');
  });
});
