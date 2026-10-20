import { WATCH_PERMISSIONS } from '../../src/downloads.ts';
import type { AppStatus } from '../../src/messages.ts';

const el = document.getElementById('status')!;
const status = (await browser.runtime.sendMessage({ type: 'status' })) as AppStatus;
el.className = status.connected ? 'ok' : 'off';
el.textContent = status.connected
  ? `Desktop app connected: ${status.printer ?? 'no printer chosen'} · ${status.slicer ?? ''}`
  : 'Desktop app not found. Install and open Retarget3MF once, then reload this page. Until then, projects can be converted in the browser and downloaded.';

// Passive mode needs the desktop app to hand files to, so it is offered only when the app is connected.
const watch = document.getElementById('watch') as HTMLInputElement;
document.getElementById('watch-row')!.hidden = !status.connected;
watch.checked = await browser.permissions.contains(WATCH_PERMISSIONS);
watch.addEventListener('change', async () => {
  watch.checked = watch.checked ? await browser.permissions.request(WATCH_PERMISSIONS) : !(await browser.permissions.remove(WATCH_PERMISSIONS));
});
