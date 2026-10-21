import { buildOpenLink, isAllowedDownloadUrl, parseSlicerLink, type OpenLink } from '@retarget3mf/bridge';
import { findImportButton, findMenu, findSlicerTarget, MARKER, siteFor } from '../src/sites.ts';
import { idleLabel, type AppStatus, type ButtonState, type ToBackground } from '../src/messages.ts';

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
    const refreshStatus = () => browser.runtime.sendMessage({ type: 'status' } satisfies ToBackground).then((s) => {
      status = s as AppStatus;
      if (isOwnPrinter()) rows.forEach((r) => r.remove());
      rows.forEach((r) => { r.textContent = idleLabel(status.printer); });
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
      const existing = menu.rows[0]?.parentElement?.querySelector(`[${MARKER}="row"]`);
      if (site.isProjectMenu && !(opener && site.isProjectMenu(opener))) { existing?.remove(); return; }
      if (existing) return;
      const template = menu.slicerRow ?? menu.rows.find((r) => r.childElementCount === 0) ?? menu.rows[0]!;
      const row = template.cloneNode(false) as HTMLElement;
      row.setAttribute(MARKER, 'row');
      row.setAttribute('role', 'menuitem');
      row.textContent = idleLabel(status.printer);
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        // The site's slicer control is either a row of this menu (clicking it closes the menu) or the main button,
        // in which case the menu is closed the way a click elsewhere would.
        const studio = menu.slicerRow ?? findSlicerTarget(document, site);
        if (!menu.slicerRow) document.body.click();
        void start(studio);
      });
      rows.add(row);
      void refreshStatus();
      // Right under the site's "Open in <slicer>" row when it is in the menu; first otherwise.
      if (menu.slicerRow) menu.slicerRow.insertAdjacentElement('afterend', row);
      else menu.rows[0]!.insertAdjacentElement('beforebegin', row);
    };

    // The menu is mounted on open and removed on close; the page is a single-page app.
    const observer = new MutationObserver(() => { attach(); if (waiting) annotateImportDialog(); });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
  },
});
