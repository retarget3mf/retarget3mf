import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { EXTENSION } from './extensionPath.ts';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';
import { fakePrintablesPage } from './fakeSites.ts';

const URL = 'https://www.printables.com/model/1730141-marge-simpson';

test('Printables: row only for 3MF files, explains the PrusaSlicer dialog, hands it to the app link', async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://www.printables.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakePrintablesPage('https://files.printables.com/media/prints/1/3mf/2/model.3mf') }));
  const page = await context.newPage();
  // No native host in this test, so the extension falls back to the desktop app's own scheme. Cancel that hand-off:
  // left pending, Chromium's external-protocol prompt swallows mouse input to the page (the toast's button).
  await page.addInitScript(() => (navigation as EventTarget).addEventListener('navigate', (e) => {
    const url = (e as Event & { destination: { url: string } }).destination.url;
    if (!url.startsWith('retarget3mf:')) return;
    (window as unknown as { launched: string }).launched = url;
    e.preventDefault();
  }));
  await page.goto(URL);
  const row = page.locator('[data-retarget3mf="row"]');

  // STL rows get a disabled row explaining why; clicking it does nothing.
  await page.locator('.toggle[data-type="stl"]').click();
  await expect(row).toHaveText(/· needs a 3MF$/);
  await expect(page.locator('[data-retarget3mf="other"]')).toHaveCount(0);
  await expect(row).toHaveAttribute('aria-disabled', 'true');
  await row.click({ force: true });
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.screenshot({ path: 'e2e/.results/Printables-stl.png' });

  await page.locator('.toggle[data-type="3mf"]').click();
  await expect(row).toHaveText(/^Open (for|in) [^·]*Converts in your browser$/);
  await expect(row).not.toHaveAttribute('aria-disabled');
  // Like the site's rows, ours starts with a logo (our icon, inline).
  await expect(row.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml,/);
  const texts = (await page.locator('[role=menu] > *').allTextContents()).map((t) => t.trim());
  expect(texts[1]).toMatch(/Open (for|in) /);
  await page.screenshot({ path: 'e2e/.results/Printables.png' });

  await row.click();
  await expect(page.locator('[data-retarget3mf="banner"]')).toBeAttached();
  await page.getByRole('button', { name: 'Open file in PrusaSlicer' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { launched?: string }).launched)).toMatch(/^retarget3mf:\/\/open\?url=https%3A%2F%2Ffiles\.printables\.com%2F.*&site=printables/);
  await expect(page.getByRole('status')).toContainText('Install the Retarget3MF desktop app', { timeout: 30_000 });
  expect(page.url()).toBe(URL);

  // Without the desktop app, the toast offers the in-browser converter.
  await context.route('https://files.printables.com/**', (route) => route.fulfill({ contentType: 'model/3mf', body: Buffer.from(bambuProject()) }));
  const [converter] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Convert in the browser' }).click()]);
  await expect(converter.getByText('model from')).toBeVisible();
  await converter.getByLabel('Your printer').selectOption('ad5x-0.4');
  await expect(converter.getByLabel('Your slicer')).toHaveValue('flashstudio');
  await converter.getByRole('button', { name: 'Convert' }).click();
  await expect(converter.getByText(/Converted “Test cube” for Flashforge AD5X/)).toBeVisible({ timeout: 30_000 });
  const [download] = await Promise.all([converter.waitForEvent('download'), converter.getByRole('link', { name: /Download model - AD5X\.3mf/ }).click()]);
  expect(download.suggestedFilename()).toBe('model - AD5X.3mf');
  await converter.screenshot({ path: 'e2e/.results/convert-in-browser.png', fullPage: true });
  await context.close();
});
