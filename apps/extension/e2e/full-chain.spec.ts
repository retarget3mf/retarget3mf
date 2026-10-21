import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, chromium, expect, test } from '@playwright/test';
import { EXTENSION } from './extensionPath.ts';
import { EXTENSION_IDS, NATIVE_HOST_NAME } from '@retarget3mf/bridge';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';
import { fakeMakerworldPage, fakePrintablesPage } from './fakeSites.ts';

const DESKTOP = resolve(import.meta.dirname, '../../desktop');
const SIGNED = 'https://makerworld.bblmw.com/makerworld/model/X/1/instance/a.3mf?exp=1&key=k';

/** Desktop app with the given printer, plus Chromium with the extension wired to its native host. */
async function startChain(printer: string) {
  const root = mkdtempSync(join(tmpdir(), 'chain-'));
  const appData = join(root, 'app');
  const browserData = join(root, 'browser');
  mkdirSync(appData);
  writeFileSync(join(appData, 'settings.json'), JSON.stringify({ printer, openAfterConvert: false }));
  const fixture = join(root, 'fixture.3mf');
  writeFileSync(fixture, bambuProject());

  const desktop = await electron.launch({
    args: [DESKTOP, `--user-data-dir=${appData}`],
    env: { ...process.env, RETARGET3MF_E2E_FIXTURE: fixture, RETARGET3MF_E2E_HOME: join(root, 'home') },
  });
  const launcher = join(appData, 'native-host', 'retarget3mf-host');
  await expect.poll(() => existsSync(launcher)).toBe(true);
  // Chromium also reads native host manifests from <user-data-dir>/NativeMessagingHosts.
  mkdirSync(join(browserData, 'NativeMessagingHosts'), { recursive: true });
  writeFileSync(join(browserData, 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`), JSON.stringify({
    name: NATIVE_HOST_NAME, description: 'e2e', path: launcher, type: 'stdio', allowed_origins: EXTENSION_IDS.map((id) => `chrome-extension://${id}/`),
  }));

  const browser = await chromium.launchPersistentContext(browserData, {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await browser.route('https://makerworld.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakeMakerworldPage(SIGNED, true) }));
  return { root, desktop, browser };
}

test('MakerWorld button → native host → desktop app → converted project', async () => {
  const { root, desktop, browser } = await startChain('ad5x-0.4');
  const page = await browser.newPage();
  await page.goto('https://makerworld.com/en/models/1-test-cube');
  // The row label comes from the desktop app's status (printer name).
  await expect.poll(async () => { await page.locator('.icon-box').click(); return page.locator('[data-retarget3mf="row"]').textContent(); }, { timeout: 30_000 }).toBe('Open for AD5X');
  await page.locator('[data-retarget3mf="row"]').click();
  await expect(page.getByRole('status')).toContainText('Converted ✓', { timeout: 45_000 });
  await page.screenshot({ path: 'e2e/.results/full-chain-done.png' });

  const window = await desktop.firstWindow();
  await expect(window.getByRole('heading', { name: /Converted: Test_Cube - AD5X\.3mf/ })).toBeVisible();
  await window.screenshot({ path: 'e2e/.results/full-chain-desktop.png' });
  // The history keeps a link back to the model page the project came from.
  await window.getByRole('button', { name: 'Convert another' }).click();
  await expect(window.getByRole('button', { name: 'MakerWorld ↗' })).toBeVisible();
  await window.screenshot({ path: 'e2e/.results/full-chain-history.png' });
  await browser.close();
  await desktop.close();
  expect(existsSync(join(root, 'home', 'Test_Cube - AD5X.3mf'))).toBe(true);
});

test('no row on MakerWorld when a Bambu Lab printer is chosen (the site already opens Bambu Studio)', async () => {
  const { desktop, browser } = await startChain('bambu-x1c-0.4');
  await browser.route('https://www.printables.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakePrintablesPage('https://files.printables.com/a.3mf') }));
  // Control: on Printables the row appears, so the extension has the app's status.
  const printables = await browser.newPage();
  await printables.goto('https://www.printables.com/model/1-test');
  await expect.poll(async () => { await printables.locator('.toggle[data-type="3mf"]').click(); return printables.locator('[data-retarget3mf="row"]').textContent(); }, { timeout: 30_000 }).toBe('Open for Bambu Lab X1 Carbon');

  const page = await browser.newPage();
  await page.goto('https://makerworld.com/en/models/1-test-cube');
  await page.locator('.icon-box').click();
  await expect(page.getByText('Download STL/CAD Files')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-retarget3mf="row"]')).toHaveCount(0);
  await browser.close();
  await desktop.close();
});
