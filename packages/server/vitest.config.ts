import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/main.ts'],
      thresholds: { lines: 50, functions: 50, branches: 50, statements: 50 },
    },
  },
});
