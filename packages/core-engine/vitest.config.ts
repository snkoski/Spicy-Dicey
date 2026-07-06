import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Barrel re-exports and type-only files have no executable statements.
      exclude: ['src/index.ts', 'src/rng/types.ts', 'src/ruleset/types.ts'],
      // Ratcheted per plan §6 Q11 — core-engine targets ~100% on scoring/strategy.
      thresholds: { lines: 98, functions: 100, branches: 90, statements: 98 },
    },
  },
});
