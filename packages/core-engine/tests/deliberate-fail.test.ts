import { expect, it } from 'vitest';

// Temporary: Phase 0 acceptance check that a failing test fails CI. Reverted next commit.
it('deliberately fails to prove the CI gate gates', () => {
  expect(1).toBe(2);
});
