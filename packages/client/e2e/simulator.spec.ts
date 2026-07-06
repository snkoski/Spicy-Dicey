import { expect, test } from '@playwright/test';

test('app boots with simulator and builder tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Simulator' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Strategy builder' })).toBeVisible();
});

async function openSimulator(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Simulator' }).click();
  return page.getByRole('tabpanel', { name: 'Simulator' });
}

test('3 strategies x 10k games run in the worker without freezing the UI', async ({ page }) => {
  const panel = await openSimulator(page);
  await panel.getByRole('checkbox', { name: /always bank at 300/i }).check();
  await panel.getByRole('checkbox', { name: /ev-optimal/i }).check();
  await panel.getByRole('checkbox', { name: /value-aware/i }).check();
  await panel.getByLabel(/games/i).fill('10000');
  await panel.getByLabel(/seed/i).fill('7');
  await panel.getByRole('button', { name: /run simulation/i }).click();

  // Worker offload: the progress bar must appear and the page must stay
  // interactive while the batch runs — switch tabs mid-run.
  await expect(panel.getByRole('progressbar')).toBeVisible();
  await page.getByRole('tab', { name: 'Strategy builder' }).click();
  await expect(page.getByLabel(/strategy name/i)).toBeVisible();
  await page.getByRole('tab', { name: 'Simulator' }).click();

  await expect(panel.getByRole('table')).toBeVisible({ timeout: 90_000 });
  await expect(panel.getByRole('table')).toContainText('10000');
});

test('same seed reproduces identical results', async ({ page }) => {
  const run = async () => {
    const panel = await openSimulator(page);
    await panel.getByRole('checkbox', { name: /always bank at 300/i }).check();
    await panel.getByRole('checkbox', { name: /ev-optimal/i }).check();
    await panel.getByLabel(/games/i).fill('300');
    await panel.getByLabel(/seed/i).fill('99');
    await panel.getByRole('button', { name: /run simulation/i }).click();
    await expect(panel.getByRole('table')).toBeVisible({ timeout: 60_000 });
    return panel.getByRole('table').textContent();
  };
  const first = await run();
  const second = await run();
  expect(second).toBe(first);
});

test('replay steps through the sample game', async ({ page }) => {
  const panel = await openSimulator(page);
  await panel.getByRole('checkbox', { name: /greedy/i }).check();
  await panel.getByRole('checkbox', { name: /ev-optimal/i }).check();
  await panel.getByLabel(/games/i).fill('50');
  await panel.getByRole('button', { name: /run simulation/i }).click();
  await expect(panel.getByRole('table')).toBeVisible({ timeout: 60_000 });

  await panel.getByRole('button', { name: /replay sample game/i }).click();
  await expect(panel.getByTestId('replay-step')).toHaveText(/^1 \//);
  await panel.getByRole('button', { name: /next step/i }).click();
  await expect(panel.getByTestId('replay-step')).toHaveText(/^2 \//);
  await panel.getByRole('button', { name: /previous step/i }).click();
  await expect(panel.getByTestId('replay-step')).toHaveText(/^1 \//);
});
