import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';

function profile(settings: object): { dir: string; userData: string } {
  const dir = mkdtempSync(join(tmpdir(), 'retarget3mf-os-'));
  const userData = join(dir, 'profile');
  mkdirSync(userData);
  writeFileSync(join(userData, 'settings.json'), JSON.stringify(settings));
  return { dir, userData };
}

test('a file opened from the OS converts straight away', async () => {
  const { dir, userData } = profile({ printer: 'ad5x-0.4', openAfterConvert: false });
  const input = join(dir, 'cube.3mf');
  writeFileSync(input, bambuProject());
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`, input] });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: /Converted: cube - AD5X\.3mf/ })).toBeVisible();
  expect(existsSync(join(dir, 'cube - AD5X.3mf'))).toBe(true);
  await page.screenshot({ path: 'e2e/.results/os-open-done.png' });
  await app.close();
});

test('too many colours for the printer opens the review screen instead', async () => {
  const { dir, userData } = profile({ printer: 'adventurer-5m-0.4', openAfterConvert: false });
  const input = join(dir, 'cube.3mf');
  writeFileSync(input, bambuProject());
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`, input] });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Test cube' })).toBeVisible();
  await expect(page.getByText(/uses 2 colours but the printer has 1 slot/)).toBeVisible();
  expect(existsSync(join(dir, 'cube - Adventurer 5M.3mf'))).toBe(false);
  await app.close();
});

test('settings: theme, brand groups and slicer cards', async () => {
  const { userData } = profile({ printer: 'ad5x-0.4' });
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`] });
  const page = await app.firstWindow();
  // Playwright emulates a light scheme by default, which would hide Electron's nativeTheme.
  await page.emulateMedia({ colorScheme: null });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('group', { name: 'Flashforge' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Flash Studio' })).toBeVisible();
  await page.getByRole('radio', { name: 'Dark' }).first().click();
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');
  await page.screenshot({ path: 'e2e/.results/settings-dark.png', fullPage: true });
  await page.getByRole('radio', { name: 'Light' }).first().click();
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(false);
  await page.screenshot({ path: 'e2e/.results/settings-light.png', fullPage: true });
  await app.close();
});


test('header slicer menu switches slicer and links to settings', async () => {
  const { userData } = profile({ printer: 'ad5x-0.4', slicer: 'flashstudio' });
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`] });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Slicer: Flash Studio' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/slicer-menu.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await page.getByRole('button', { name: 'Slicer: Flash Studio' }).click();
  await page.getByRole('menuitem', { name: 'Manage slicers…' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await app.close();
});
