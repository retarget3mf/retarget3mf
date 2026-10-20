import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';
import { fakePrintablesPage } from './fakeSites.ts';

const EXTENSION = resolve(import.meta.dirname, '../dist/chrome-mv3');
const URL = 'https://www.printables.com/model/1730141-marge-simpson';

test('Printables: row only for 3MF files, explains the PrusaSlicer dialog, hands it to the app link', async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://www.printables.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakePrintablesPage('https://files.printables.com/media/prints/1/3mf/2/model.3mf') }));
  const page = await context.newPage();
  // No native host in this test, so the extension falls back to the desktop app's own scheme.
  await page.addInitScript(() => (navigation as EventTarget).addEventListener('navigate', (e) => {
    const url = (e as Event & { destination: { url: string } }).destination.url;
    if (url.startsWith('retarget3mf:')) (window as unknown as { launched: string }).launched = url;
  }));
  await page.goto(URL);
  const row = page.locator('[data-retarget3mf="row"]');

  await page.locator('.toggle[data-type="stl"]').click();
  await expect(page.getByText('Open in OrcaSlicer')).toBeVisible();
  await expect(row).toHaveCount(0);

  await page.locator('.toggle[data-type="3mf"]').click();
  await expect(row).toHaveText(/Open (for|in) /);
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
