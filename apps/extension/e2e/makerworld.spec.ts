import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { fakeMakerworldPage } from './fakeMakerworld.ts';

const EXTENSION = resolve(import.meta.dirname, '../dist/chrome-mv3');
const SIGNED = 'https://makerworld.bblmw.com/makerworld/model/X/1/instance/a.3mf?exp=1&key=k';

for (const loggedIn of [true, false]) {
  test(`adds a native-looking menu row (${loggedIn ? 'logged in' : 'logged out'}) and captures the profile link`, async () => {
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await context.route('https://makerworld.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakeMakerworldPage(SIGNED, loggedIn) }));
    const page = await context.newPage();
    await page.goto('https://makerworld.com/en/models/1-test-cube');
    await expect(page.locator('[data-retarget3mf]')).toHaveCount(0);

    await page.locator('.icon-box').click();
    const row = page.locator('[data-retarget3mf="row"]');
    await expect(row).toHaveText(/Open (for|in) /);
    // Same element type and classes as the site's own rows, right after "Open in Bambu Studio" (or first).
    await expect(row).toHaveClass('menu-row');
    const order = await page.locator('.rows > *').allTextContents();
    expect(order.indexOf(await row.textContent() ?? '')).toBe(loggedIn ? 1 : 0);
    await page.screenshot({ path: `e2e/.results/menu-${loggedIn ? 'in' : 'out'}.png` });

    await row.click();
    await expect(page.locator('.MuiPopper-root')).toHaveCount(0);
    // No desktop app in this test: the toast explains how to get it.
    await expect(page.getByRole('status')).toContainText('Install the Retarget3MF desktop app', { timeout: 30_000 });
    await page.screenshot({ path: `e2e/.results/toast-${loggedIn ? 'in' : 'out'}.png` });
    await context.close();
  });
}
