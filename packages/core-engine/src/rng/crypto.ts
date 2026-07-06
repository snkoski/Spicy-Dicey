import type { RandomSource } from './types.js';

/**
 * CSPRNG-backed source for live games (plan §6 decision 14): unpredictable,
 * never seedable, never replayable — replay comes from the recorded log.
 * Uses the WebCrypto global available in both Node and browsers.
 */
export function createCryptoRandom(): RandomSource {
  const buffer = new Uint32Array(64);
  let index = buffer.length; // trigger a fill on first use
  return {
    next(): number {
      if (index >= buffer.length) {
        crypto.getRandomValues(buffer);
        index = 0;
      }
      return (buffer[index++] ?? 0) / 4294967296;
    },
  };
}
