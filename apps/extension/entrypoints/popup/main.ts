import type { AppStatus } from '../../src/messages.ts';

const el = document.getElementById('status')!;
const status = (await browser.runtime.sendMessage({ type: 'status' })) as AppStatus;
el.className = status.connected ? 'ok' : 'off';
el.textContent = status.connected
  ? `Desktop app connected: ${status.printer ?? 'no printer chosen'} · ${status.slicer ?? ''}`
  : 'Desktop app not found. Install and open Retarget3MF once, then reload this page. Until then, projects can be converted in the browser and downloaded.';
