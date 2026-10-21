import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { EXTENSION } from './extensionPath.ts';
import { fakeMakerworldPage } from './fakeSites.ts';

const SIGNED = 'https://makerworld.bblmw.com/makerworld/model/X/1/instance/a.3mf?exp=1&key=k';

for (const loggedIn of [true, false]) {
  test(`adds a native-looking menu row (${loggedIn ? 'logged in' : 'logged out'}) and captures the profile link`, async () => {
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await context.route('https://makerworld.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakeMakerworldPage(SIGNED, loggedIn) }));
    const page = await context.newPage();
    await page.goto('https://makerworld.com/en/models/1-test-cube');
    await expect(page.locator('[data-retarget3mf]')).toHaveCount(0);

    await page.locator('.icon-box').click();
    const row = page.locator('[data-retarget3mf="row"]');
    await expect(row).toHaveText(/Open (for|in) /);
    // Same element type and classes as the site's own rows, right after "Open in Bambu Studio" (or first).
    await expect(row).toHaveClass('menu-row');
    await expect(row.locator('img, svg')).toHaveCount(0);
    const order = await page.locator('.rows > *').allTextContents();
    expect(order.indexOf(await row.textContent() ?? '')).toBe(loggedIn ? 1 : 0);
    // "Other printer…" sits right under it.
    expect(order[order.indexOf(await row.textContent() ?? '') + 1]).toBe('Other printer…');
    await page.screenshot({ path: `e2e/.results/menu-${loggedIn ? 'in' : 'out'}.png` });

    await row.click();
    await expect(page.locator('.MuiPopper-root')).toHaveCount(0);
    // No desktop app in this test: the toast explains how to get it.
    await expect(page.getByRole('status')).toContainText('Install the Retarget3MF desktop app', { timeout: 30_000 });
    await page.screenshot({ path: `e2e/.results/toast-${loggedIn ? 'in' : 'out'}.png` });
    await context.close();
  });
}

test('explains MakerWorld’s import dialog inside it', async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://makerworld.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakeMakerworldPage(SIGNED, true, true) }));
  const page = await context.newPage();
  await page.goto('https://makerworld.com/en/models/1-test-cube');
  await page.locator('.icon-box').click();
  await page.locator('[data-retarget3mf="row"]').click();
  const banner = page.locator('[data-retarget3mf="banner"]');
  await expect(banner).toContainText('press “Import into Bambu Studio” below');
  // Sits inside the dialog, right above its confirm button.
  expect(await banner.evaluate((b) => b.nextElementSibling?.textContent)).toBe('Import into Bambu Studio');
  await page.screenshot({ path: 'e2e/.results/import-dialog.png' });
  await page.locator('.import').click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Install the Retarget3MF desktop app', { timeout: 30_000 });
  await page.screenshot({ path: 'e2e/.results/toast-top.png' });
  await context.close();
});

test('after a project download, the model page offers to open it', async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://makerworld.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakeMakerworldPage(SIGNED, true) }));
  const page = await context.newPage();
  await page.goto('https://makerworld.com/en/models/1-test-cube');
  // The background sends this when a watched download finishes; here it is sent directly.
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await expect.poll(() => worker.evaluate(async () => {
    const { tabs } = (globalThis as unknown as { chrome: typeof browser }).chrome;
    const [tab] = await tabs.query({ url: 'https://makerworld.com/*' });
    return tabs.sendMessage(tab!.id!, { type: 'download-offer', id: 7, file: 'Cable clip set.3mf', siteName: 'MakerWorld', label: 'Open for Q1 Pro' }).then(() => true, () => false);
  })).toBe(true);
  const card = page.locator('[data-retarget3mf="offer"]');
  await expect(card.getByText('Cable clip set.3mf')).toBeVisible();
  await expect(card.getByText('Downloaded from MakerWorld')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Open for Q1 Pro' })).toBeFocused();
  await expect(card.getByLabel('Always open without asking')).not.toBeChecked();
  await page.screenshot({ path: 'e2e/.results/download-offer.png' });
  await card.getByRole('button', { name: 'Not now' }).click();
  await expect(card).toHaveCount(0);
  await context.close();
});
