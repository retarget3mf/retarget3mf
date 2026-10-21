import { mkdirSync, mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';

test('first run → drop → merge colours → convert → report → history', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'retarget3mf-e2e-'));
  const input = join(dir, 'cube.3mf');
  writeFileSync(input, bambuProject());
  // No printer yet (first run), and no slicer launch: real slicers on this machine must stay closed.
  mkdirSync(join(dir, 'profile'));
  writeFileSync(join(dir, 'profile', 'settings.json'), JSON.stringify({ openAfterConvert: false }));
  const app = await electron.launch({ args: ['.', `--user-data-dir=${join(dir, 'profile')}`], env: { ...process.env, RETARGET3MF_E2E_HOME: tmpdir() } });
  const page = await app.firstWindow();
  // The native file dialog cannot be driven, so it answers with the fixture. Evaluating before the window exists races app start-up.
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, input);
  const shot = (name: string) => page.screenshot({ path: join('e2e/.results', `${name}.png`) });

  await expect(page.getByRole('heading', { name: 'Which printer do you print on?' })).toBeVisible();
  await shot('1-first-run');
  await page.getByRole('button', { name: 'Printer: AD5X' }).click();
  await page.getByRole('menuitemradio', { name: /^Adventurer 5M\b(?! Pro)/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // History is in the title bar and explains itself while empty.
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText(/No conversions yet/)).toBeVisible();
  await page.getByRole('button', { name: '← Convert' }).click();

  // One slot, two colours: only the merge question is asked, and the printer stage says so.
  await page.getByRole('button', { name: /Drop a \.3mf project here/ }).click();
  await expect(page.getByRole('heading', { name: 'This project uses 2 colours but the printer has 1 slot.' })).toBeVisible();
  await expect(page.getByText('NEEDS INPUT')).toBeVisible();
  await shot('2-merge');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Converted for Adventurer 5M' })).toBeVisible();
  await expect(page.getByText(/merged onto shared slots/)).toBeVisible();
  expect(existsSync(join(dir, 'cube - Adventurer 5M.3mf'))).toBe(true);
  await shot('3-done');

  await page.getByRole('button', { name: 'Review settings' }).click();
  await page.screenshot({ path: 'e2e/.results/4a-report-all.png' });
  await page.getByRole('button', { name: /^kept/ }).click();
  await page.getByLabel('Search setting').fill('layer');
  await expect(page.getByRole('cell', { name: 'layer_height', exact: true })).toBeVisible();
  await shot('4-report');

  // Back home: the conversion is in the recent list and the history, where it can be reopened and removed.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Drop another' }).click();
  await expect(page.getByText('RECENT')).toBeVisible();
  await expect(page.getByText('Test cube')).toBeVisible();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
  await shot('5-history');
  await page.getByRole('button', { name: 'Report' }).click();
  await expect(page.getByRole('heading', { name: 'Conversion report' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Test cube' }).click();
  await page.getByRole('button', { name: 'Remove from list' }).click();
  await expect(page.getByText(/No conversions yet/)).toBeVisible();
  expect(existsSync(join(dir, 'cube - Adventurer 5M.3mf'))).toBe(true);
  await app.close();
});

test('two printers: ⌘2 switches, each keeps its slicer, a fitting drop converts straight away', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'retarget3mf-e2e-'));
  const input = join(dir, 'cube.3mf');
  writeFileSync(input, bambuProject());
  mkdirSync(join(dir, 'profile'));
  writeFileSync(join(dir, 'profile', 'settings.json'), JSON.stringify({
    openAfterConvert: false, printer: 'adventurer-5m-0.4', slicer: 'orca',
    printers: [{ model: 'adventurer-5m-0.4', slicer: 'orca' }, { model: 'ad5x-0.4', slicer: 'flashstudio' }],
  }));
  const app = await electron.launch({ args: ['.', `--user-data-dir=${join(dir, 'profile')}`], env: { ...process.env, RETARGET3MF_E2E_HOME: tmpdir() } });
  const page = await app.firstWindow();
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, input);

  await expect(page.getByRole('radio', { name: /Adventurer 5M/ })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+2' : 'Control+2');
  await expect(page.getByRole('radio', { name: /AD5X/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Slicer: Flash Studio' })).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/two-printers.png' });

  // Four slots fit both colours: nothing to decide, so it converts on the drop.
  await page.getByRole('button', { name: /Drop a \.3mf project here/ }).click();
  await expect(page.getByRole('heading', { name: 'Converted for AD5X' })).toBeVisible();
  expect(existsSync(join(dir, 'cube - AD5X.3mf'))).toBe(true);
  await app.close();
});
