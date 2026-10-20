import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { fakeCrealityPage, fakeSnapmakerPage } from './fakeSites.ts';

const EXTENSION = resolve(import.meta.dirname, '../dist/chrome-mv3');
const cases = [
  { site: 'Creality Cloud', url: 'https://www.crealitycloud.com/model-detail/skip-bo-case', page: fakeCrealityPage('https://file2-cdn.creality.com/model/a.3mf?sig=1'), open: '.choose-operate', after: 'Open in Creality Print' },
  { site: 'Snapmaker Space', url: 'https://space.snapmaker.com/en/model/38661-jumping-spider', page: fakeSnapmakerPage('https://cdn-model.snapmaker.com/m/x.3mf?t=1'), open: '#more', after: 'Open in Snapmaker Orca' },
];

for (const c of cases) {
  test(`${c.site}: menu row after “${c.after}” captures the slicer hand-off`, async () => {
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await context.route(`${new URL(c.url).origin}/**`, (route) => route.fulfill({ contentType: 'text/html', body: c.page }));
    const page = await context.newPage();
    await page.goto(c.url);
    await page.locator(c.open).click();
    const row = page.locator('[data-retarget3mf="row"]');
    await expect(row).toHaveText(/Open (for|in) /);
    const texts = (await row.locator('xpath=..').locator(':scope > *').allTextContents()).map((t) => t.trim());
    expect(texts[texts.indexOf(c.after) + 1]).toMatch(/Open (for|in) /);
    await page.screenshot({ path: `e2e/.results/${c.site.replace(/ /g, '-')}.png` });
    await row.click();
    // The hand-off reached the extension (no desktop app in this test) and the page did not navigate away.
    await expect(page.getByRole('status')).toContainText('Install the Retarget3MF desktop app', { timeout: 30_000 });
    expect(page.url()).toBe(c.url);
    await context.close();
  });
}
