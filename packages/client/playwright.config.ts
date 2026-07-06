import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5199',
  },
  webServer: {
    command: 'pnpm dev --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: !process.env['CI'],
  },
});
