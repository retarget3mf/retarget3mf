import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { decodeNativeMessages, encodeNativeMessage } from '@retarget3mf/bridge';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';

// Runs against a packaged build: PACKAGED_APP=<path to the app executable> npx playwright test e2e/packaged.spec.ts
const exe = process.env.PACKAGED_APP ?? '';

test('packaged app converts an OS-opened file and answers the browser through its native host', async () => {
  test.skip(!exe, 'set PACKAGED_APP');
  const dir = mkdtempSync(join(tmpdir(), 'retarget3mf-packaged-'));
  const userData = join(dir, 'profile');
  mkdirSync(userData);
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ printer: 'ad5x-0.4', openAfterConvert: false }));
  const input = join(dir, 'cube.3mf');
  writeFileSync(input, bambuProject());
  // HOME keeps browser registrations in the temp folder; a Chrome profile folder makes Chrome count as installed.
  mkdirSync(join(dir, 'Library/Application Support/Google/Chrome'), { recursive: true });
  const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`, input], env: { ...process.env, HOME: dir } });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: /Converted: cube - AD5X\.3mf/ })).toBeVisible({ timeout: 30_000 });
  expect(existsSync(join(dir, 'cube - AD5X.3mf'))).toBe(true);

  const launcher = join(userData, 'native-host', 'retarget3mf-host');
  await expect.poll(() => existsSync(launcher)).toBe(true);
  const manifest = JSON.parse(readFileSync(join(dir, 'Library/Application Support/Google/Chrome/NativeMessagingHosts/app.retarget3mf.bridge.json'), 'utf8'));
  expect(realpathSync(manifest.path)).toBe(realpathSync(launcher));
  const host = spawn(launcher, ['chrome-extension://gkpcbbjkoifgehdhgdbegojpjaaplfgp/']);
  host.stdin.write(encodeNativeMessage({ id: 1, type: 'ping' }));
  const reply = await new Promise((done) => host.stdout.on('data', (chunk: Buffer) => done(decodeNativeMessages(new Uint8Array(chunk)).messages[0])));
  expect(reply).toMatchObject({ id: 1, type: 'pong', printer: 'Flashforge AD5X' });
  host.kill();
  await app.close();
});
