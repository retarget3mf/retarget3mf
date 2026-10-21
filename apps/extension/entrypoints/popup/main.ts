import '@retarget3mf/ui/tokens.css';
import './popup.css';
import { WATCH_PERMISSIONS } from '../../src/downloads.ts';
import type { AppStatus, ToBackground } from '../../src/messages.ts';
import { fillPrinters, fillSlicers, storedTarget, storeTarget } from '../../src/target.ts';

const el = document.getElementById('status')!;
const printerSelect = document.getElementById('printer') as HTMLSelectElement;
const slicerSelect = document.getElementById('slicer') as HTMLSelectElement;
let status = (await browser.runtime.sendMessage({ type: 'status' } satisfies ToBackground)) as AppStatus;
el.className = `pill ${status.connected ? 'ok' : 'off'}`;
el.textContent = status.connected ? 'Connected' : 'Desktop app not found';
document.getElementById('sync')!.textContent = status.connected
  ? 'Synced with the desktop app.'
  : 'Used for converting in the browser. Install and open the Retarget3MF desktop app once to convert and open your slicer in one click.';

// With the app connected its settings are the source of truth; the extension's copy follows for in-browser conversion.
const initial = status.connected ? { printer: status.printerId, slicer: status.slicerId } : await storedTarget();
fillPrinters(printerSelect, initial.printer, 'Choose your printer');
fillSlicers(slicerSelect, printerSelect.value, initial.slicer);

async function save(): Promise<void> {
  if (!printerSelect.value) return;
  await storeTarget({ printer: printerSelect.value, slicer: slicerSelect.value });
  if (!status.connected) return;
  status = (await browser.runtime.sendMessage({ type: 'set-target', printer: printerSelect.value, slicer: slicerSelect.value } satisfies ToBackground)) as AppStatus;
  if (status.slicerId && status.slicerId !== slicerSelect.value) fillSlicers(slicerSelect, printerSelect.value, status.slicerId);
}
printerSelect.addEventListener('change', () => {
  printerSelect.querySelector('option[value=""]')?.remove();
  fillSlicers(slicerSelect, printerSelect.value, slicerSelect.value);
  void save();
});
slicerSelect.addEventListener('change', () => void save());

// Passive mode needs the desktop app to hand files to, so it is offered only when the app is connected.
const watch = document.getElementById('watch') as HTMLInputElement;
document.getElementById('watch-row')!.hidden = !status.connected;
watch.checked = await browser.permissions.contains(WATCH_PERMISSIONS);
watch.addEventListener('change', async () => {
  watch.checked = watch.checked ? await browser.permissions.request(WATCH_PERMISSIONS) : !(await browser.permissions.remove(WATCH_PERMISSIONS));
});
