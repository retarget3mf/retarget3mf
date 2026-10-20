import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { fakePrintablesPage } from './fakeSites.ts';

const EXTENSION = resolve(import.meta.dirname, '../dist/chrome-mv3');
const URL = 'https://www.printables.com/model/1730141-marge-simpson';

test('Printables: row only for 3MF files, explains the PrusaSlicer dialog, captures the hand-off', async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://www.printables.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakePrintablesPage('https://files.printables.com/media/prints/1/3mf/2/model.3mf') }));
  const page = await context.newPage();
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
  await expect(page.getByRole('status')).toContainText('Install the Retarget3MF desktop app', { timeout: 30_000 });
  expect(page.url()).toBe(URL);
  await context.close();
});
