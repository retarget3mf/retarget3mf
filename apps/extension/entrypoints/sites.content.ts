import iconSvg from '@retarget3mf/ui/icon.svg?raw';
import { buildOpenLink, isAllowedDownloadUrl, parseSlicerLink, type OpenLink } from '@retarget3mf/bridge';
import { findImportButton, findMenu, findSlicerTarget, MARKER, siteFor } from '../src/sites.ts';
import { idleLabel, type AppStatus, type ButtonState, type DownloadOffer, type ToBackground } from '../src/messages.ts';
import { el, showCard } from '../src/card.ts';
import { strings } from '../src/strings.ts';
import { fillPrinters, storeTarget } from '../src/target.ts';
import { PRINTERS } from '@retarget3mf/profiles/printers';

const CAPTURE_TIMEOUT_MS = 90_000;
const APP_LAUNCH_WAIT_MS = 6000;
const ARMED = 'data-retarget3mf-armed';
const TOAST_STYLE = `
  :host { position: fixed; z-index: 2147483647; left: 50%; top: 84px; transform: translateX(-50%); }
  div { display: flex; align-items: center; gap: 12px; max-width: min(560px, 92vw); padding: 12px 18px; border-radius: 12px;
    font: 500 15px/1.4 system-ui, sans-serif; color: #fff; background: #1f6feb; box-shadow: 0 10px 30px rgb(0 0 0 / 0.45); }
  div[data-kind="done"] { background: #1a7f37; }
  div[data-kind="error"] { background: #a33; }
  b { font-weight: 700; }
  button { all: unset; margin-left: 6px; cursor: pointer; opacity: 0.8; } button:hover { opacity: 1; }
  button.action { opacity: 1; padding: 4px 10px; border-radius: 6px; background: #fff; color: #1f1f1f; font-weight: 600; white-space: nowrap; }
`;
const BANNER_STYLE = `
  :host { display: block; margin: 0 0 12px; }
  div { padding: 10px 14px; border-radius: 8px; border: 1px solid #4c8dff; background: rgb(31 111 235 / 0.16);
    color: inherit; font: 500 14px/1.4 system-ui, sans-serif; }
  b { color: #7fb0ff; }
`;

const ICON_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;
// Lime from the app's palette: a soft fill for our row, a mid tone that reads on light and dark sites for links.
const ROW_FILL = 'oklch(0.87 0.18 125 / 0.14)';
const LINK_INK = 'oklch(0.62 0.15 128)';

/** Our icon in the shape of the site's: an <img> keeps its classes and size attributes, an inline <svg> its box. */
function brandIcon(siteIcon: Element): Element {
  if (siteIcon instanceof HTMLImageElement) {
    const img = siteIcon.cloneNode(false) as HTMLImageElement;
    img.src = ICON_URL;
    img.alt = '';
    img.removeAttribute('srcset');
    return img;
  }
  const box = siteIcon.getBoundingClientRect();
  const svg = new DOMParser().parseFromString(iconSvg, 'image/svg+xml').documentElement;
  for (const attr of ['class', 'width', 'height', 'style']) {
    const value = siteIcon.getAttribute(attr);
    if (value) svg.setAttribute(attr, value);
  }
  if (!svg.getAttribute('width') && box.width) svg.setAttribute('width', String(Math.round(box.width)));
  if (!svg.getAttribute('height') && box.height) svg.setAttribute('height', String(Math.round(box.height)));
  svg.setAttribute('aria-hidden', 'true');
  return document.importNode(svg, true);
}

export default defineContentScript({
  matches: ['https://makerworld.com/*', 'https://www.crealitycloud.com/*', 'https://crealitycloud.com/*', 'https://space.snapmaker.com/*', 'https://www.printables.com/*', 'https://printables.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const site = siteFor(location.hostname);
    if (!site) return;
    await injectScript('/page-hook.js', { keepInDom: true });
    let status: AppStatus = { connected: false };
    let waiting = false;
    const rows = new Set<HTMLElement>();
    let opener: Element | undefined;
    document.addEventListener('pointerdown', (e) => {
      const target = e.target as Element;
      if (!target.closest(`[${MARKER}]`)) opener = target;
    }, true);
    // The site's own "Open in <slicer>" already serves printers of its brand; a second button would only confuse.
    const isOwnPrinter = () => status.vendor === site.ownVendor;
    // Files without print settings (Printables STL rows) get a disabled row, so the missing action explains itself.
    const rowLabel = (row: HTMLElement) => (row.dataset.state === 'disabled' ? `${idleLabel(status.printer)} · needs a 3MF` : idleLabel(status.printer));
    const t = strings();
    /** Title and "Converts and opens in …" under it, after the icon copied from the site's row (if any). */
    const setLabel = (row: HTMLElement) => {
      if (row.getAttribute(MARKER) === 'other') return;
      let box = row.querySelector<HTMLElement>(':scope > [data-r3="label"]');
      if (!box) {
        box = el('span', {}, el('span'), el('small'));
        box.dataset.r3 = 'label';
        Object.assign(box.style, { display: 'inline-flex', flexDirection: 'column', lineHeight: '1.3' });
        Object.assign((box.lastChild as HTMLElement).style, { fontSize: '12px', opacity: '0.7', fontWeight: '400' });
        row.append(box);
      }
      (box.firstChild as HTMLElement).textContent = `${row.dataset.gap ?? ''}${rowLabel(row)}`;
      const sub = box.lastChild as HTMLElement;
      sub.textContent = row.dataset.state === 'disabled' ? '' : status.connected && status.slicer ? t.converts(status.slicer) : t.convertsHere;
    };
    const refreshStatus = () => browser.runtime.sendMessage({ type: 'status' } satisfies ToBackground).then((s) => {
      status = s as AppStatus;
      if (isOwnPrinter()) rows.forEach((r) => r.remove());
      rows.forEach(setLabel);
    });
    void refreshStatus();

    // Progress lives in a toast: the site's menu closes as soon as a row is clicked.
    let toast: { host: HTMLElement; box: HTMLDivElement } | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const show = (state: ButtonState, action?: { label: string; run: () => void }) => {
      if (!toast) {
        const host = document.createElement('div');
        host.setAttribute(MARKER, 'toast');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = TOAST_STYLE;
        const box = document.createElement('div');
        box.setAttribute('role', 'status');
        shadow.append(style, box);
        document.body.append(host);
        toast = { host, box };
      }
      const close = document.createElement('button');
      close.textContent = '✕';
      close.setAttribute('aria-label', 'Close');
      close.addEventListener('click', () => toast?.host.remove());
      const title = document.createElement('b');
      title.textContent = 'Retarget3MF';
      const extra: HTMLElement[] = [];
      if (action) {
        const button = document.createElement('button');
        button.className = 'action';
        button.textContent = action.label;
        button.addEventListener('click', () => { toast?.host.remove(); action.run(); });
        extra.push(button);
      }
      toast.box.replaceChildren(title, document.createTextNode(state.label), ...extra, close);
      toast.box.dataset.kind = state.kind;
      if (!toast.host.isConnected) document.body.append(toast.host);
      clearTimeout(hideTimer);
      if (state.kind !== 'busy' && !action) hideTimer = setTimeout(() => toast?.host.remove(), state.kind === 'error' ? 10_000 : 5000);
    };

    /**
     * Without the native host, hand the project to the desktop app through its own scheme (the browser asks first).
     * Nothing reports back, so a page that kept focus most likely means the app is not installed.
     */
    let lastLink: OpenLink | undefined;
    const launchApp = (link: OpenLink) => {
      show({ kind: 'busy', label: 'Opening the Retarget3MF app…' });
      let left = false;
      window.addEventListener('blur', () => { left = true; }, { once: true });
      location.href = buildOpenLink(link);
      const inBrowser = { label: 'Convert in the browser', run: () => void browser.runtime.sendMessage({ type: 'convert-in-browser', ...link } satisfies ToBackground) };
      setTimeout(() => (left
        ? show({ kind: 'done', label: 'Continuing in the Retarget3MF app.' })
        : show({ kind: 'error', label: 'Nothing opened? Install the Retarget3MF desktop app, or convert here.', installHint: true }, inBrowser)), APP_LAUNCH_WAIT_MS);
    };

    browser.runtime.onMessage.addListener((message: { type: string; state?: ButtonState }) => {
      if (message.type !== 'button-state' || !message.state) return;
      if (message.state.kind === 'error' && message.state.installHint && lastLink) launchApp(lastLink);
      else show(message.state);
    });

    /** While we wait, the site may ask to confirm importing into its slicer; explain inside its dialog what will happen. */
    const annotateImportDialog = () => {
      const button = findImportButton(document, site);
      if (!button || document.querySelector(`[${MARKER}="banner"]`)) return;
      let block = button;
      while (block.parentElement && block.parentElement.childElementCount < 2) block = block.parentElement;
      const host = document.createElement('div');
      host.setAttribute(MARKER, 'banner');
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = BANNER_STYLE;
      const box = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = 'Retarget3MF: ';
      box.append(name, `press “${site.importText}” below. The project opens in Retarget3MF${status.printer ? ` for ${status.printer.replace(/^Flashforge /, '')}` : ''} instead of ${site.slicerName}.`);
      shadow.append(style, box);
      block.insertAdjacentElement('beforebegin', host);
      toast?.host.remove();
    };

    const start = async (studio: HTMLElement | undefined) => {
      if (!studio) return show({ kind: 'error', label: `Could not find “${site.slicerText}”. Pick a print profile and try again.` });
      show({ kind: 'busy', label: 'Getting the project…' });
      waiting = true;
      document.documentElement.setAttribute(ARMED, String(Date.now() + CAPTURE_TIMEOUT_MS));
      const href = await new Promise<string | undefined>((resolve) => {
        const timer = setTimeout(() => { window.removeEventListener('message', onMessage); resolve(undefined); }, CAPTURE_TIMEOUT_MS);
        const onMessage = (e: MessageEvent) => {
          if (e.source !== window || e.data?.source !== 'retarget3mf' || e.data.type !== 'captured') return;
          clearTimeout(timer);
          window.removeEventListener('message', onMessage);
          resolve(String(e.data.href));
        };
        window.addEventListener('message', onMessage);
        // The site fetches a signed link for the selected print profile; it may first ask to log in or confirm.
        studio.click();
      });
      waiting = false;
      document.querySelector(`[${MARKER}="banner"]`)?.remove();
      const link = href ? parseSlicerLink(href) : undefined;
      if (!link || !isAllowedDownloadUrl(link.url)) {
        document.documentElement.removeAttribute(ARMED);
        return show({ kind: 'error', label: href ? 'The site returned an unexpected link; this page may have changed.' : 'Log in to the site (or confirm its dialog), then try again.' });
      }
      lastLink = { url: link.url, name: link.name, site: site.id, pageUrl: location.href };
      if (!status.connected) return launchApp(lastLink);
      await browser.runtime.sendMessage({ type: 'open', ...lastLink } satisfies ToBackground);
    };

    /** Adds our row to the site's download menu, copied from one of its own rows so it matches the site's style. */
    const attach = () => {
      const menu = findMenu(document, site);
      if (!menu || isOwnPrinter()) return;
      const state = !site.isProjectMenu || (opener && site.isProjectMenu(opener)) ? 'ready' : 'disabled';
      const existing = menu.rows[0]?.parentElement?.querySelector<HTMLElement>(`[${MARKER}="row"]`);
      if (existing?.dataset.state === state) return;
      existing?.remove();
      menu.rows[0]?.parentElement?.querySelector(`[${MARKER}="other"]`)?.remove();
      const template = menu.slicerRow ?? menu.rows.find((r) => r.childElementCount === 0) ?? menu.rows[0]!;
      const row = template.cloneNode(false) as HTMLElement;
      row.setAttribute(MARKER, 'row');
      row.setAttribute('role', 'menuitem');
      row.dataset.state = state;
      // Sites that put a slicer logo before each row's text (Printables) get ours the same way, with their sizing classes.
      const siteIcon = template.querySelector(':scope > img, :scope > svg');
      if (siteIcon) row.append(brandIcon(siteIcon));
      row.dataset.gap = /^\s/.test([...template.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())?.textContent ?? '') ? ' ' : '';
      setLabel(row);
      if (state === 'disabled') {
        row.setAttribute('aria-disabled', 'true');
        row.title = 'This file has no print settings to convert. Choose a 3MF project file.';
        Object.assign(row.style, { opacity: '0.45', cursor: 'default' });
      }
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (row.dataset.state === 'disabled') return;
        // The site's slicer control is either a row of this menu (clicking it closes the menu) or the main button,
        // in which case the menu is closed the way a click elsewhere would.
        const studio = menu.slicerRow ?? findSlicerTarget(document, site);
        if (!menu.slicerRow) document.body.click();
        void start(studio);
      });
      if (state === 'ready') Object.assign(row.style, { background: ROW_FILL, borderRadius: '7px' });
      rows.add(row);
      void refreshStatus();
      // Right under the site's "Open in <slicer>" row when it is in the menu; first otherwise.
      if (menu.slicerRow) menu.slicerRow.insertAdjacentElement('afterend', row);
      else menu.rows[0]!.insertAdjacentElement('beforebegin', row);
      if (state !== 'ready') return;
      // "Other printer…": a one-off pick that also becomes the remembered printer, like switching in the app.
      const other = template.cloneNode(false) as HTMLElement;
      other.setAttribute(MARKER, 'other');
      other.setAttribute('role', 'menuitem');
      other.textContent = t.otherPrinter;
      Object.assign(other.style, { color: LINK_INK, fontSize: '12px', paddingTop: '4px', paddingBottom: '4px' });
      other.addEventListener('click', (e) => {
        e.stopPropagation();
        chooseOther(menu.slicerRow ?? findSlicerTarget(document, site), !menu.slicerRow);
      });
      rows.add(other);
      row.insertAdjacentElement('afterend', other);
    };

    const chooseOther = (studio: HTMLElement | undefined, closeMenu: boolean) => {
      const card = showCard('choose');
      const select = el('select', { ariaLabel: t.chooseTitle });
      fillPrinters(select, status.printerId);
      const open = el('button', { className: 'primary', textContent: t.open });
      const cancel = el('button', { textContent: t.cancel, onclick: card.close });
      open.addEventListener('click', async () => {
        const printer = select.value;
        const allowed = PRINTERS.find((p) => p.id === printer)?.slicers ?? [];
        const slicer = allowed.includes(status.slicerId as never) ? status.slicerId! : allowed[0]!;
        await storeTarget({ printer, slicer });
        if (status.connected) await browser.runtime.sendMessage({ type: 'set-target', printer, slicer } satisfies ToBackground);
        await refreshStatus();
        card.close();
        if (closeMenu) document.body.click();
        // The site's menu row may be gone by now; its main button still starts the download.
        void start(studio?.isConnected ? studio : findSlicerTarget(document, site));
      });
      card.body.append(el('div', { className: 'title', textContent: t.chooseTitle }), select, el('div', { className: 'row' }, open, cancel));
      select.focus();
    };

    browser.runtime.onMessage.addListener((message: DownloadOffer | { type: string }) => {
      if (message.type !== 'download-offer') return;
      const offer = message as DownloadOffer;
      const card = showCard('offer');
      const always = el('input', { type: 'checkbox' });
      const open = el('button', { className: 'primary', textContent: offer.label });
      open.addEventListener('click', () => {
        card.close();
        void browser.runtime.sendMessage({ type: 'open-download', id: offer.id, always: always.checked } satisfies ToBackground);
      });
      card.body.append(
        el('div', { className: 'head' },
          el('span', { className: 'thumb' }),
          el('div', { className: 'grow' }, el('div', { className: 'title', textContent: offer.file }), el('div', { className: 'muted', textContent: offer.siteName ? t.downloadedFrom(offer.siteName) : t.downloaded })),
          el('button', { className: 'close', textContent: '✕', ariaLabel: t.close, onclick: card.close })),
        el('div', { className: 'row' }, open, el('button', { textContent: t.notNow, onclick: card.close })),
        el('label', { className: 'muted' }, always, t.always),
      );
      open.focus();
    });

    // The menu is mounted on open and removed on close; the page is a single-page app.
    const observer = new MutationObserver(() => { attach(); if (waiting) annotateImportDialog(); });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
  },
});
