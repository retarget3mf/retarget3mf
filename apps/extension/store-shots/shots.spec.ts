import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, chromium, expect, test } from '@playwright/test';
import { EXTENSION_IDS, NATIVE_HOST_NAME } from '@retarget3mf/bridge';
import { EXTENSION } from '../e2e/extensionPath.ts';
import { fakeMakerworldPage } from '../e2e/fakeSites.ts';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';

const REPO = resolve(import.meta.dirname, '../../..');
const OUT = join(REPO, 'docs/store');
const SIGNED = 'https://makerworld.bblmw.com/makerworld/model/X/1/instance/a.3mf?exp=1&key=k';
const ACCENT = 'oklch(0.86 0.18 125)';
const INK = 'oklch(0.5 0.13 130)';

const b64 = (path: string) => readFileSync(path).toString('base64');
const png = (buf: Buffer) => `data:image/png;base64,${buf.toString('base64')}`;
const FONT = b64(join(REPO, 'packages/ui/node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'));
const ICON = `data:image/png;base64,${b64(join(REPO, 'apps/extension/public/icon/128.png'))}`;

const page = (body: string, css: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Geist; src: url(data:font/woff2;base64,${FONT}) format('woff2'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Geist, system-ui; color: #161616; background: #f4f4f2; overflow: hidden; }
  .shot { width: 1280px; height: 800px; display: grid; grid-template-columns: 430px 1fr; align-items: center; gap: 40px; padding: 0 64px; }
  .kicker { font: 600 14px ui-monospace, Menlo, monospace; letter-spacing: .08em; color: ${INK}; text-transform: uppercase; margin-bottom: 18px; }
  h1 { font-size: 46px; line-height: 1.08; letter-spacing: -.02em; font-weight: 700; }
  h1 em { font-style: normal; background: linear-gradient(transparent 62%, ${ACCENT} 62%); }
  p { margin-top: 20px; font-size: 19px; line-height: 1.5; color: #555; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 40px; font-weight: 600; font-size: 18px; }
  .brand img { width: 32px; height: 32px; }
  .frame { border-radius: 14px; overflow: hidden; box-shadow: 0 30px 60px -20px #0004, 0 0 0 1px #0001; background: #fff; justify-self: center; }
  .frame img { display: block; }
  ${css}
</style></head><body>${body}</body></html>`;

const copy = (kicker: string, title: string, text: string) =>
  `<div><div class="brand"><img src="${ICON}">Retarget3MF</div><div class="kicker">${kicker}</div><h1>${title}</h1><p>${text}</p></div>`;

test('store screenshots and promo tile', async () => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  const root = mkdtempSync(join(tmpdir(), 'store-'));
  const appData = join(root, 'app');
  const browserData = join(root, 'browser');
  mkdirSync(appData);
  writeFileSync(join(appData, 'settings.json'), JSON.stringify({ printer: 'ad5x-0.4', openAfterConvert: false }));
  const fixture = join(root, 'fixture.3mf');
  writeFileSync(fixture, bambuProject());
  const desktop = await electron.launch({
    args: [join(REPO, 'apps/desktop'), `--user-data-dir=${appData}`, '--force-device-scale-factor=2'],
    env: { ...process.env, RETARGET3MF_E2E_FIXTURE: fixture, RETARGET3MF_E2E_HOME: join(root, 'home') },
  });
  const launcher = join(appData, 'native-host', 'retarget3mf-host');
  await expect.poll(() => existsSync(launcher)).toBe(true);
  mkdirSync(join(browserData, 'NativeMessagingHosts'), { recursive: true });
  writeFileSync(join(browserData, 'NativeMessagingHosts', `${NATIVE_HOST_NAME}.json`), JSON.stringify({
    name: NATIVE_HOST_NAME, description: 'store shots', path: launcher, type: 'stdio', allowed_origins: EXTENSION_IDS.map((id) => `chrome-extension://${id}/`),
  }));
  const browser = await chromium.launchPersistentContext(browserData, {
    channel: 'chromium', deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await browser.route('https://makerworld.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fakeMakerworldPage(SIGNED, true) }));

  const popup = await browser.newPage();
  await popup.setViewportSize({ width: 348, height: 470 });
  await popup.goto(`chrome-extension://${EXTENSION_IDS[0]}/popup.html`);
  await expect(popup.getByText('Synced with the desktop app.')).toBeVisible({ timeout: 30_000 });
  const popupShot = await popup.screenshot();

  const site = await browser.newPage();
  await site.setViewportSize({ width: 560, height: 300 });
  await site.goto('https://makerworld.com/en/models/1-test-cube');
  const row = site.locator('[data-retarget3mf="row"]');
  await expect.poll(async () => { await site.locator('.icon-box').click(); return row.count(); }, { timeout: 30_000 }).toBe(1);
  await row.hover();
  const menuShot = await site.screenshot();
  await row.click();
  await expect(site.getByRole('status')).toContainText('Converted ✓', { timeout: 45_000 });

  const window = await desktop.firstWindow();
  await expect(window.getByRole('heading', { name: 'Converted for AD5X' })).toBeVisible();
  await window.evaluate(() => document.querySelectorAll('[title*="Test_Cube"]').forEach((el) => { el.textContent = '~/Downloads/Test_Cube - AD5X.3mf'; }));
  await window.setViewportSize({ width: 1000, height: 640 });
  const desktopShot = await window.screenshot();
  await browser.close();
  await desktop.close();

  const composer = await chromium.launch();
  const render = async (name: string, width: number, height: number, html: string) => {
    const p = await composer.newPage({ viewport: { width, height } });
    await p.setContent(html);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: join(OUT, name) });
  };

  await render('screenshot-1-menu.png', 1280, 800, page(`<div class="shot">${copy('MakerWorld · Printables · Creality Cloud · Snapmaker Space',
    'Any 3MF. <em>Your printer.</em> One click.',
    'Retarget3MF adds “Open for your printer” to the model site’s download menu.')}
    <div class="frame dark"><div class="bar"><i></i><i></i><i></i><span>makerworld.com/en/models/…</span></div><img src="${png(menuShot)}" width="560" height="300"></div></div>`,
  `.dark { background: #1e1e1e; } .bar { display: flex; gap: 7px; align-items: center; padding: 12px 14px; background: #2a2a2a; }
   .bar i { width: 11px; height: 11px; border-radius: 50%; background: #555; } .bar span { margin-left: 14px; font-size: 13px; color: #999; }
   .dark img { width: 700px; height: auto; }`));

  await render('screenshot-2-popup.png', 1280, 800, page(`<div class="shot">${copy('Set up once',
    'Pick your <em>printer and slicer</em>',
    'Choose from 40+ printers. Your choice stays in sync with the free desktop app.')}
    <div class="frame"><img src="${png(popupShot)}" width="348" height="470" style="width:435px;height:auto"></div></div>`, ''));

  await render('screenshot-3-converted.png', 1280, 800, page(`<div class="shot">${copy('Converted on your computer',
    'Opens <em>ready to slice</em>',
    'Printer and filament profiles, colours fitted to your slots, the author’s settings kept. Nothing is uploaded.')}
    <div class="frame"><img src="${png(desktopShot)}" style="width:700px;height:auto"></div></div>`, ''));

  await render('promo-tile-440x280.png', 440, 280, page(`<div class="tile"><img src="${ICON}"><div><b>Retarget3MF</b><span>Any 3MF. Your printer.<br>One click.</span></div></div>`,
  `.tile { width: 440px; height: 280px; display: flex; align-items: center; gap: 22px; padding: 0 36px; background: #10160a; color: #fff; }
   .tile img { width: 96px; height: 96px; } .tile b { display: block; font-size: 30px; letter-spacing: -.01em; }
   .tile span { display: block; margin-top: 10px; font-size: 20px; line-height: 1.3; color: ${ACCENT}; font-weight: 600; }`));
  await render('marquee-1400x560.png', 1400, 560, page(`<div class="marquee"><div>${copy('Free browser extension + desktop app',
    'Any 3MF. <em>Your printer.</em> One click.', 'MakerWorld, Printables, Creality Cloud and Snapmaker Space projects, converted locally for 40+ printers.')}</div>
    <div class="frame dark"><img src="${png(menuShot)}" width="560" height="300"></div></div>`,
  `.marquee { width: 1400px; height: 560px; display: grid; grid-template-columns: 1fr 560px; align-items: center; gap: 56px; padding: 0 72px; }
   .marquee .brand { margin-bottom: 28px; } .dark { background: #1e1e1e; }`));
  await composer.close();
});
