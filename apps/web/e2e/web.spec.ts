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

  await page.locator('input[type=file]').setInputFiles(project);
  await expect(page.getByRole('heading', { name: 'Test cube' })).toBeVisible();
  await expect(page.getByText('not used by any object, will be removed')).toHaveCount(2);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Converted “Test cube” for Flashforge AD5X' })).toBeVisible();
  await expect(page.getByText(/File → Open Project/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download cube - AD5X.3mf' }).click()]);
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
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Converted “Test cube”/ })).toBeVisible();
});
