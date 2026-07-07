import { expect, test, type Browser, type Page } from '@playwright/test';

/** Fresh browser context per participant — separate cookies = separate identities. */
async function openOnline(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('tab', { name: 'Online' }).click();
  await onlinePanel(page)
    .getByLabel(/your name/i)
    .fill(name);
  return page;
}

const onlinePanel = (page: Page) => page.getByRole('tabpanel', { name: 'Online' });

async function takeTurnIfMine(page: Page): Promise<void> {
  try {
    await tryTakeTurn(page);
  } catch {
    // stale-state race (server re-rendered mid-action): loop retries
  }
}

async function tryTakeTurn(page: Page): Promise<void> {
  const panel = onlinePanel(page);
  if (!(await panel.getByText(/^your turn$/i).isVisible())) {
    return;
  }
  const roll = panel.getByRole('button', { name: /^roll$/i });
  if (await roll.isVisible()) {
    await roll.click();
    return;
  }
  const keep = panel.getByRole('button', { name: /keep selection/i });
  if (await keep.isVisible()) {
    const dice = panel.getByRole('button', { name: /die showing/i });
    const values = await dice.evaluateAll((els) =>
      els.map((el) => Number((el.getAttribute('aria-label') ?? '').replace(/\D/g, ''))),
    );
    let indices = values.flatMap((v, i) => (v === 1 || v === 5 ? [i] : []));
    if (indices.length === 0) {
      for (const face of [2, 3, 4, 6]) {
        const of = values.flatMap((v, i) => (v === face ? [i] : []));
        if (of.length >= 3) {
          indices = of;
          break;
        }
      }
    }
    if (indices.length === 0) {
      indices = values.map((_, i) => i);
    }
    for (const i of indices) {
      // only tap dice that aren't already selected (loop re-entry safety)
      if ((await dice.nth(i).getAttribute('aria-pressed')) !== 'true') {
        await dice.nth(i).click();
      }
    }
    await expect(keep).toBeEnabled({ timeout: 3000 });
    await keep.click();
    return;
  }
  const bank = panel.getByRole('button', { name: /^bank/i });
  if (await bank.isVisible()) {
    await bank.click();
  }
}

test('two clients play a full authoritative game and stay in sync', async ({ browser }) => {
  test.setTimeout(180_000);
  const ann = await openOnline(browser, 'Ann');
  const annPanel = onlinePanel(ann);
  await annPanel.getByLabel(/target score/i).fill('500');
  await annPanel.getByLabel(/turn timer/i).selectOption('off');
  await annPanel.getByRole('button', { name: /create room/i }).click();
  const code = (await annPanel.locator('span.font-mono').first().textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  const ben = await openOnline(browser, 'Ben');
  const benPanel = onlinePanel(ben);
  await benPanel.getByLabel(/room code/i).fill(code);
  await benPanel.getByRole('button', { name: /join room/i }).click();

  await expect(annPanel.getByText(/Ben/)).toBeVisible();
  await annPanel.getByRole('button', { name: /start game/i }).click();

  // chat both ways, with the profanity filter observable on Ben's screen
  await annPanel.getByLabel(/chat message/i).fill('good luck!');
  await annPanel.getByRole('button', { name: /^send$/i }).click();
  await expect(benPanel.getByText(/good luck!/)).toBeVisible();
  await benPanel.getByLabel(/chat message/i).fill('you are shit at this');
  await benPanel.getByRole('button', { name: /^send$/i }).click();
  await expect(annPanel.getByText(/\(filtered\)/)).toBeVisible();
  await expect(annPanel.getByText(/you are shit at this/)).toHaveCount(0);

  // play to completion, alternating whoever holds the turn
  for (let step = 0; step < 600; step += 1) {
    if (
      await annPanel
        .getByText(/game over — .+ wins/i)
        .first()
        .isVisible()
    ) {
      break;
    }
    await takeTurnIfMine(ann);
    await takeTurnIfMine(ben);
  }
  await expect(annPanel.getByText(/game over — .+ wins/i).first()).toBeVisible();
  await expect(benPanel.getByText(/game over — .+ wins/i).first()).toBeVisible();

  // both clients agree on the final scores
  const scoresOn = (panel: ReturnType<typeof onlinePanel>) =>
    panel.locator('li .tabular-nums').allTextContents();
  expect(await scoresOn(benPanel)).toEqual(await scoresOn(annPanel));
});

test('a spectator sees live state but has no controls; rejoining resumes a held seat', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const ann = await openOnline(browser, 'Ann');
  const annPanel = onlinePanel(ann);
  await annPanel.getByLabel(/target score/i).fill('5000');
  await annPanel.getByLabel(/turn timer/i).selectOption('off');
  await annPanel.getByRole('button', { name: /create room/i }).click();
  const code = (await annPanel.locator('span.font-mono').first().textContent())!.trim();

  const ben = await openOnline(browser, 'Ben');
  await onlinePanel(ben)
    .getByLabel(/room code/i)
    .fill(code);
  await onlinePanel(ben)
    .getByRole('button', { name: /join room/i })
    .click();
  await annPanel.getByRole('button', { name: /start game/i }).click();
  await annPanel.getByRole('button', { name: /^roll$/i }).click();

  // spectator joins mid-game
  const sam = await openOnline(browser, 'Sam');
  const samPanel = onlinePanel(sam);
  await samPanel.getByRole('checkbox', { name: /join as spectator/i }).check();
  await samPanel.getByLabel(/room code/i).fill(code);
  await samPanel.getByRole('button', { name: /join room/i }).click();
  await expect(samPanel.getByRole('button', { name: /die showing/i }).first()).toBeVisible();
  await expect(samPanel.getByRole('button', { name: /keep selection/i })).toHaveCount(0);
  await expect(samPanel.getByText(/^your turn$/i)).toHaveCount(0);

  // Ann drops mid-turn and rejoins within grace: same seat, same turn state
  const diceBefore = await annPanel
    .getByRole('button', { name: /die showing/i })
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  await ann.reload();
  await ann.getByRole('tab', { name: 'Online' }).click();
  await annPanel.getByLabel(/your name/i).fill('Ann');
  await annPanel.getByLabel(/room code/i).fill(code);
  await annPanel.getByRole('button', { name: /join room/i }).click();
  await expect(annPanel.getByText(/^your turn$/i)).toBeVisible();
  const diceAfter = await annPanel
    .getByRole('button', { name: /die showing/i })
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(diceAfter).toEqual(diceBefore);
});
