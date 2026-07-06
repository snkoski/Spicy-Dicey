import { expect, test } from '@playwright/test';

// Phase 0: trivial spec proving the Playwright harness runs in CI.
// Real browser e2e (full game flows) starts in Phase 3/4.
test('playwright harness runs', () => {
  expect(1 + 1).toBe(2);
});
