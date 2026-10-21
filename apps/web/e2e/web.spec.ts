import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';

/** Printer cards are labels around a visually hidden radio; users click the card. */
const printerCard = (page: Page, name: string) => page.locator('label').filter({ has: page.getByLabel(name, { exact: true }) });
const project = { name: 'cube.3mf', mimeType: 'model/3mf', buffer: Buffer.from(bambuProject()) };

test('printer first, then convert and download, without leaving the site', async ({ page, baseURL }) => {
  const foreign: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) foreign.push(r.url()); });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Open file…' })).toBeDisabled();
  await printerCard(page, 'Flashforge AD5X').click();
  // The picker collapses to one line and reopens with Change.
  await expect(page.getByText('Flashforge AD5X', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change' }).click();
  await printerCard(page, 'Flashforge AD5X').click();
  await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();

  await page.locator('input[type=file]').setInputFiles(project);
  // The target slicer is chosen next to Convert and defaults to the printer maker's own.
  await expect(page.getByRole('button', { name: /^Slicer: Flash Studio/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test cube' })).toBeVisible();
  await expect(page.getByLabel('Slot for filament 3')).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/review.png', fullPage: true });
  // Converting downloads the file straight away; "Download again" repeats it.
  const [first] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Convert & download' }).click()]);
  expect(first.suggestedFilename()).toBe('cube - AD5X.3mf');

  await expect(page.getByRole('heading', { name: 'Converted for Flashforge AD5X' })).toBeVisible();
  await expect(page.getByText(/File → Open Project/)).toBeVisible();
  await expect(page.getByText('cube - AD5X.3mf · downloaded')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download again' }).click()]);
  expect(download.suggestedFilename()).toBe('cube - AD5X.3mf');
  expect([...readFileSync(await download.path()).subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  await page.screenshot({ path: 'e2e/.results/done.png', fullPage: true });

  await page.getByRole('button', { name: 'View report' }).click();
  await expect(page.getByRole('heading', { name: 'Conversion report' })).toBeVisible();
  expect(foreign).toEqual([]);
});

test('works offline once loaded', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await printerCard(page, 'Flashforge AD5X').click();
  await page.locator('input[type=file]').setInputFiles(project);
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Convert & download' }).click()]);
  await expect(page.getByRole('heading', { name: 'Converted for Flashforge AD5X' })).toBeVisible();
});

test('fits a 390 px phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await printerCard(page, 'Flashforge AD5X').click();
  await page.locator('input[type=file]').setInputFiles(project);
  await expect(page.getByRole('heading', { name: 'Test cube' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'e2e/.results/mobile-review.png', fullPage: true });
});
