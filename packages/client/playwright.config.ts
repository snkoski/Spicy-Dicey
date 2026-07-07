import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5199',
    actionTimeout: 5000,
  },
  webServer: [
    {
      command: 'pnpm --filter @spicy-dicey/server dev',
      port: 3000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm dev --port 5199 --strictPort',
      port: 5199,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
