import { expect, test, type Page } from '@playwright/test';

/**
 * Drives a complete hot-seat game with a simple human-like policy:
 * keep 1s and 5s; else keep a triple; else keep everything (whole-set
 * combos); bank whenever allowed. Low target keeps it quick.
 */
async function playFullGame(page: Page, endGame: 'final-round' | 'instant') {
  await page.goto('/');
  // All tab panels stay mounted; scope every query to the Play panel.
  const panel = page.getByRole('tabpanel', { name: 'Play' });
  await panel.getByLabel(/player 1/i).fill('Ann');
  await panel.getByLabel(/player 2/i).fill('Ben');
  await panel.getByLabel(/target score/i).fill('500');
  await panel.getByLabel(/end game/i).selectOption(endGame);
  await panel.getByRole('checkbox', { name: /on-the-board minimum/i }).uncheck();
  await panel.getByRole('button', { name: /start game/i }).click();

  for (let step = 0; step < 400; step += 1) {
    if (await panel.getByText(/game over — /i).isVisible()) {
      return;
    }
    const rollButton = panel.getByRole('button', { name: /^roll$/i });
    if (await rollButton.isVisible()) {
      await rollButton.click();
      continue;
    }
    const keepButton = panel.getByRole('button', { name: /keep selection/i });
    if (await keepButton.isVisible()) {
      const dice = panel.getByRole('button', { name: /die showing/i });
      const labels = await dice
        .allTextContents()
        .then(() =>
          dice.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? '')),
        );
      const values = labels.map((l) => Number(l.replace(/\D/g, '')));

      // preferred keeps: 1s and 5s
      let indices = values.flatMap((v, i) => (v === 1 || v === 5 ? [i] : []));
      if (indices.length === 0) {
        // a face with 3+ dice
        for (const face of [2, 3, 4, 6]) {
          const of = values.flatMap((v, i) => (v === face ? [i] : []));
          if (of.length >= 3) {
            indices = of;
            break;
          }
        }
      }
      if (indices.length === 0) {
        indices = values.map((_, i) => i); // whole-set combo
      }
      for (const i of indices) {
        await dice.nth(i).click();
      }
      if (await keepButton.isEnabled()) {
        await keepButton.click();
      }
      continue;
    }
    const bankButton = panel.getByRole('button', { name: /^bank/i });
    if (await bankButton.isVisible()) {
      if (await bankButton.isEnabled()) {
        await bankButton.click();
      } else {
        await panel.getByRole('button', { name: /roll again/i }).click();
      }
      continue;
    }
  }
  throw new Error('game did not finish within the step budget');
}

test('a complete hot-seat game finishes and crowns the top scorer (final round)', async ({
  page,
}) => {
  await playFullGame(page, 'final-round');
  await expect(page.getByText(/game over — \w+ wins/i)).toBeVisible();
  await expect(page.getByText('🏆')).toBeVisible();
  await expect(page.getByRole('button', { name: /play again/i })).toBeVisible();
});

test('instant-win variant also completes', async ({ page }) => {
  await playFullGame(page, 'instant');
  await expect(page.getByText(/game over — \w+ wins/i)).toBeVisible();
});

test('3D dice render alongside the accessible dice and values always match the engine', async ({
  page,
}) => {
  await page.goto('/');
  const panel = page.getByRole('tabpanel', { name: 'Play' });
  await panel.getByLabel(/player 1/i).fill('Ann');
  await panel.getByLabel(/player 2/i).fill('Ben');
  await panel.getByRole('button', { name: /start game/i }).click();
  await panel.getByRole('button', { name: /^roll$/i }).click();

  // 3D on (default without reduced motion) -> canvas is present
  await expect(panel.getByTestId('dice-3d-canvas')).toBeVisible();
  // the interaction surface stays the accessible dice buttons
  await expect(panel.getByRole('button', { name: /die showing/i })).toHaveCount(6);

  // toggling mid-turn keeps the same dice values on the table
  const before = await panel
    .getByRole('button', { name: /die showing/i })
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  await panel.getByRole('checkbox', { name: /3d dice/i }).uncheck();
  await expect(panel.getByTestId('dice-3d-canvas')).toHaveCount(0);
  const after = await panel
    .getByRole('button', { name: /die showing/i })
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(after).toEqual(before);
});
