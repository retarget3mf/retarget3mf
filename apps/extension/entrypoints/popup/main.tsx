import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PRINTERS, type PrinterId, type SlicerId } from '@retarget3mf/profiles/printers';
import { detectLocale, ExtensionPopup, I18nProvider } from '@retarget3mf/ui';
import { releasesUrl } from '@retarget3mf/ui/links';
import '@retarget3mf/ui/tokens.css';
import './popup.css';
import { WATCH_PERMISSIONS } from '../../src/downloads.ts';
import type { AppStatus, ToBackground } from '../../src/messages.ts';
import { storedTarget, storeTarget } from '../../src/target.ts';

const slicerFor = (printer: string | undefined, slicer: string | undefined): SlicerId | undefined => {
  const allowed = PRINTERS.find((p) => p.id === printer)?.slicers ?? [];
  return allowed.includes(slicer as SlicerId) ? (slicer as SlicerId) : allowed[0];
};

function Popup() {
  const [status, setStatus] = useState<AppStatus>();
  const [printer, setPrinter] = useState<string>();
  const [slicer, setSlicer] = useState<SlicerId>();
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = (await browser.runtime.sendMessage({ type: 'status' } satisfies ToBackground)) as AppStatus;
      // With the app connected its settings are the source of truth; the extension's copy follows for in-browser conversion.
      const initial = s.connected ? { printer: s.printerId, slicer: s.slicerId } : await storedTarget();
      setPrinter(initial.printer);
      setSlicer(slicerFor(initial.printer, initial.slicer));
      setOffer(await browser.permissions.contains(WATCH_PERMISSIONS));
      setStatus(s);
    })();
  }, []);

  if (!status) return null;

  const save = async (nextPrinter: string, nextSlicer: SlicerId | undefined) => {
    setPrinter(nextPrinter);
    setSlicer(nextSlicer);
    await storeTarget({ printer: nextPrinter, ...(nextSlicer && { slicer: nextSlicer }) });
    if (!status.connected || !nextSlicer) return;
    const next = (await browser.runtime.sendMessage({ type: 'set-target', printer: nextPrinter, slicer: nextSlicer } satisfies ToBackground)) as AppStatus;
    setStatus(next);
    if (next.slicerId) setSlicer(next.slicerId as SlicerId);
  };

  return (
    <ExtensionPopup
      connected={status.connected}
      printers={PRINTERS}
      printer={printer as PrinterId | undefined}
      onPrinter={(p) => void save(p, slicerFor(p, slicer))}
      slicer={slicer}
      onSlicer={(s) => printer && void save(printer, s)}
      slicerIcon={status.slicerIcon}
      offer={offer}
      onOffer={async (on) => {
        // The permission prompt needs the click's user gesture, so it comes before anything else is awaited.
        setOffer(on ? await browser.permissions.request(WATCH_PERMISSIONS) : !(await browser.permissions.remove(WATCH_PERMISSIONS)));
        // Turning the offer off or on also forgets "Always open without asking".
        await browser.storage.local.set({ autoOpen: false });
      }}
      desktopUrl={releasesUrl || undefined}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><I18nProvider locale={detectLocale(navigator.languages)}><Popup /></I18nProvider></StrictMode>,
);
