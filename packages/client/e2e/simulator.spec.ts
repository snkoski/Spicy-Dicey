import { expect, test } from '@playwright/test';

test('app boots with simulator and builder tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Simulator' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Strategy builder' })).toBeVisible();
});

test('3 strategies x 10k games run in the worker without freezing the UI', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: /always bank at 300/i }).check();
  await page.getByRole('checkbox', { name: /ev-optimal/i }).check();
  await page.getByRole('checkbox', { name: /value-aware/i }).check();
  await page.getByLabel(/games/i).fill('10000');
  await page.getByLabel(/seed/i).fill('7');
  await page.getByRole('button', { name: /run simulation/i }).click();

  // Worker offload: the progress bar must appear and the page must stay
  // interactive while the batch runs — switch tabs mid-run.
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.getByRole('tab', { name: 'Strategy builder' }).click();
  await expect(page.getByLabel(/strategy name/i)).toBeVisible();
  await page.getByRole('tab', { name: 'Simulator' }).click();

  await expect(page.getByRole('table')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('table')).toContainText('10000');
});

test('same seed reproduces identical results', async ({ page }) => {
  const run = async () => {
    await page.goto('/');
    await page.getByRole('checkbox', { name: /always bank at 300/i }).check();
    await page.getByRole('checkbox', { name: /ev-optimal/i }).check();
    await page.getByLabel(/games/i).fill('300');
    await page.getByLabel(/seed/i).fill('99');
    await page.getByRole('button', { name: /run simulation/i }).click();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 60_000 });
    return page.getByRole('table').textContent();
  };
  const first = await run();
  const second = await run();
  expect(second).toBe(first);
});

test('replay steps through the sample game', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: /greedy/i }).check();
  await page.getByRole('checkbox', { name: /ev-optimal/i }).check();
  await page.getByLabel(/games/i).fill('50');
  await page.getByRole('button', { name: /run simulation/i }).click();
  await expect(page.getByRole('table')).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: /replay sample game/i }).click();
  await expect(page.getByTestId('replay-step')).toHaveText(/^1 \//);
  await page.getByRole('button', { name: /next step/i }).click();
  await expect(page.getByTestId('replay-step')).toHaveText(/^2 \//);
  await page.getByRole('button', { name: /previous step/i }).click();
  await expect(page.getByTestId('replay-step')).toHaveText(/^1 \//);
});
