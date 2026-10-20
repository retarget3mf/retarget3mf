import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';

test('onboarding → open → map slots → convert → report', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'retarget3mf-e2e-'));
  const input = join(dir, 'cube.3mf');
  writeFileSync(input, bambuProject());
  const app = await electron.launch({ args: ['.', `--user-data-dir=${join(dir, 'profile')}`] });
  // The native file dialog cannot be driven, so it answers with the fixture.
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, input);
  const page = await app.firstWindow();
  const shot = (name: string) => page.screenshot({ path: join('e2e/.results', `${name}.png`) });

  await expect(page.getByRole('heading', { name: 'Welcome to Retarget3MF' })).toBeVisible();
  await shot('1-onboarding');
  await page.getByLabel('Flashforge AD5X').check();
  await page.getByRole('button', { name: 'Start' }).click();

  await page.getByRole('button', { name: 'Open file…' }).click();
  await expect(page.getByRole('heading', { name: 'Test cube' })).toBeVisible();
  await expect(page.getByText('not used by any object, will be removed')).toHaveCount(2);
  await shot('2-review');

  await page.getByLabel('Slot for filament 3').selectOption('1');
  await page.getByRole('button', { name: 'Convert only' }).click();
  await expect(page.getByRole('heading', { name: /Converted: cube - AD5X\.3mf/ })).toBeVisible();
  await expect(page.getByText(/merged onto shared slots/)).toBeVisible();
  expect(existsSync(join(dir, 'cube - AD5X.3mf'))).toBe(true);
  await shot('3-done');

  await page.getByRole('button', { name: 'View report' }).click();
  await page.getByRole('button', { name: /^kept/ }).click();
  await page.getByLabel('Search setting').fill('layer');
  await expect(page.getByRole('cell', { name: 'layer_height', exact: true })).toBeVisible();
  await shot('4-report');
  await app.close();
});
