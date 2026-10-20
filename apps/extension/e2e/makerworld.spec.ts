import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const EXTENSION = resolve(import.meta.dirname, '../.output/chrome-mv3');
const SIGNED = 'https://makerworld.bblmw.com/makerworld/model/X/1/instance/a.3mf?exp=1&key=k';

// Markup and click behaviour mirror makerworld.com as observed on 2026-10-20: the green button is a span tree whose
// handler fetches a signed URL, then clicks a hidden <a href="bambustudio://open?file=…">.
const PAGE = `<!doctype html><html><body>
<div class="panel"><div class="mw-css-ot33tq" id="studio"><span class="primaryButton"><div class="mw-css-0"><span>Open in Bambu Studio</span></div></span></div></div>
<script>
  window.studioOpened = [];
  document.getElementById('studio').addEventListener('click', async () => {
    await new Promise((r) => setTimeout(r, 50));
    const a = document.createElement('a');
    a.href = 'bambustudio://open?file=' + encodeURIComponent(${JSON.stringify(SIGNED)} + '&name=Carabiner_Heart');
    a.style.display = 'none';
    document.body.appendChild(a);
    window.studioOpened.push(a.href);
    a.click();
    a.remove();
  });
</script></body></html>`;

test('adds a button that captures MakerWorld’s slicer link and leaves the site button alone otherwise', async () => {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ext-')), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://makerworld.com/**', (route) => route.fulfill({ contentType: 'text/html', body: PAGE }));
  // Bambu Studio is not installed here: block the scheme hand-off so a real navigation can be observed.
  const page = await context.newPage();
  await page.goto('https://makerworld.com/en/models/2504620-carabiner-heart');

  const ours = page.locator('[data-retarget3mf]');
  await expect(ours).toHaveCount(1);
  await page.screenshot({ path: 'e2e/.results/makerworld-button.png' });

  // Without our button, MakerWorld's own click still goes through untouched.
  await page.getByText('Open in Bambu Studio').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { studioOpened: string[] }).studioOpened.length)).toBe(1);

  // With our button the link is captured; with no desktop app installed the button says how to get it.
  await ours.click();
  await expect(ours).toHaveText(/Install the Retarget3MF desktop app/, { timeout: 30_000 });
  await page.screenshot({ path: 'e2e/.results/makerworld-no-app.png' });
  await context.close();
});
