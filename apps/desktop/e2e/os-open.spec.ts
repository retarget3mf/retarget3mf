import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { buildOpenLink } from '@retarget3mf/bridge';
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
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`, input], env: { ...process.env, RETARGET3MF_E2E_HOME: tmpdir() } });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: /Converted: cube - AD5X\.3mf/ })).toBeVisible();
  expect(existsSync(join(dir, 'cube - AD5X.3mf'))).toBe(true);
  await page.screenshot({ path: 'e2e/.results/os-open-done.png' });
  await app.close();
});

test('a retarget3mf:// link downloads, converts and records where it came from', async () => {
  const { dir, userData } = profile({ printer: 'ad5x-0.4', openAfterConvert: false });
  const fixture = join(dir, 'fixture.3mf');
  writeFileSync(fixture, bambuProject());
  const link = buildOpenLink({ url: 'https://files.printables.com/media/prints/1/3mf/2/cube.3mf', name: 'cube.3mf', site: 'printables', pageUrl: 'https://www.printables.com/model/1-cube' });
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`, link],
    env: { ...process.env, RETARGET3MF_E2E_HOME: dir, RETARGET3MF_E2E_FIXTURE: fixture },
  });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: /Converted: cube - AD5X\.3mf/ })).toBeVisible();
  expect(existsSync(join(dir, 'cube - AD5X.3mf'))).toBe(true);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('button', { name: 'Printables ↗' })).toBeVisible();
  await app.close();
});

test('a retarget3mf:// link to another host is refused', async () => {
  const { userData } = profile({ printer: 'ad5x-0.4' });
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`, 'retarget3mf://open?url=https%3A%2F%2Fevil.example%2Fa.3mf&site=printables'], env: { ...process.env, RETARGET3MF_E2E_HOME: tmpdir() } });
  const page = await app.firstWindow();
  await expect(page.getByRole('alert')).toContainText('not from a supported model site');
  await app.close();
});

test('too many colours for the printer opens the review screen instead', async () => {
  const { dir, userData } = profile({ printer: 'adventurer-5m-0.4', openAfterConvert: false });
  const input = join(dir, 'cube.3mf');
  writeFileSync(input, bambuProject());
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`, input], env: { ...process.env, RETARGET3MF_E2E_HOME: tmpdir() } });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Test cube' })).toBeVisible();
  await expect(page.getByText(/uses 2 colours but the printer has 1 slot/)).toBeVisible();
  expect(existsSync(join(dir, 'cube - Adventurer 5M.3mf'))).toBe(false);
  await app.close();
});

test('settings: theme, brand groups and slicer cards', async () => {
  const { dir, userData } = profile({ printer: 'ad5x-0.4' });
  // Chrome and Dia "installed" in the throwaway home (macOS and Linux layouts).
  for (const p of ['Library/Application Support/Google/Chrome', 'Library/Application Support/Dia/User Data', '.config/google-chrome']) mkdirSync(join(dir, p), { recursive: true });
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], env: { ...process.env, RETARGET3MF_E2E_HOME: dir } });
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

  // Chromium browsers share one row; Firefox and Safari are always listed.
  await expect(page.getByText('Chrome and Chromium browsers')).toBeVisible();
  await expect(page.getByText('Not supported yet')).toBeVisible();
  await page.getByRole('button', { name: 'Which browsers?' }).click();
  await expect(page.getByText(/Set up on this computer: Chrome/)).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/settings-browsers.png', fullPage: true });
  await app.close();
});


test('header slicer menu switches slicer and links to settings', async () => {
  const { userData } = profile({ printer: 'ad5x-0.4', slicer: 'flashstudio' });
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], env: { ...process.env, RETARGET3MF_E2E_HOME: tmpdir() } });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Slicer: Flash Studio' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/slicer-menu.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await page.getByRole('button', { name: 'Printer: AD5X' }).click();
  await expect(page.getByRole('group', { name: 'Flashforge' })).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/printer-menu.png' });
  await page.getByRole('menuitemradio', { name: /Adventurer 5M Pro/ }).click();
  await expect(page.getByRole('button', { name: 'Printer: Adventurer 5M Pro' })).toBeVisible();
  await page.getByRole('button', { name: 'Slicer: Flash Studio' }).click();
  await page.getByRole('menuitem', { name: 'Manage slicers…' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await app.close();
});
