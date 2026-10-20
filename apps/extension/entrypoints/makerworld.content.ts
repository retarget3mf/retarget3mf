import { isAllowedDownloadUrl, parseSlicerLink } from '@retarget3mf/bridge';
import { findMenu, findStudioTarget, MARKER } from '../src/makerworld.ts';
import { idleLabel, type AppStatus, type ButtonState, type ToBackground } from '../src/messages.ts';

const CAPTURE_TIMEOUT_MS = 90_000;
const ARMED = 'data-retarget3mf-armed';
const TOAST_STYLE = `
  :host { position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%); }
  div { display: flex; align-items: center; gap: 10px; max-width: min(520px, 90vw); padding: 10px 16px; border-radius: 10px;
    font: 500 14px/1.35 system-ui, sans-serif; color: #fff; background: #2b2f36; box-shadow: 0 8px 24px rgb(0 0 0 / 0.3); }
  div[data-kind="done"] { background: #1a7f37; }
  div[data-kind="error"] { background: #a33; }
  b { font-weight: 700; }
  button { all: unset; margin-left: 6px; cursor: pointer; opacity: 0.8; } button:hover { opacity: 1; }
`;

export default defineContentScript({
  matches: ['https://makerworld.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    await injectScript('/makerworld-main.js', { keepInDom: true });
    let status: AppStatus = { connected: false };
    const rows = new Set<HTMLElement>();
    const refreshStatus = () => browser.runtime.sendMessage({ type: 'status' } satisfies ToBackground).then((s) => {
      status = s as AppStatus;
      rows.forEach((r) => { r.textContent = idleLabel(status.printer); });
    });
    void refreshStatus();

    // Progress lives in a toast: the site's menu closes as soon as a row is clicked.
    let toast: { host: HTMLElement; box: HTMLDivElement } | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const show = (state: ButtonState) => {
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
      toast.box.replaceChildren(title, document.createTextNode(state.label), close);
      toast.box.dataset.kind = state.kind;
      if (!toast.host.isConnected) document.body.append(toast.host);
      clearTimeout(hideTimer);
      if (state.kind !== 'busy') hideTimer = setTimeout(() => toast?.host.remove(), state.kind === 'error' ? 10_000 : 5000);
    };

    browser.runtime.onMessage.addListener((message: { type: string; state?: ButtonState }) => {
      if (message.type === 'button-state' && message.state) show(message.state);
    });

    const DIALOG_HINT_MS = 1500;
    const start = async (studio: HTMLElement | undefined) => {
      if (!studio) return show({ kind: 'error', label: 'Could not find MakerWorld’s “Open in Bambu Studio”. Pick a print profile and try again.' });
      show({ kind: 'busy', label: 'Getting the project from MakerWorld…' });
      // MakerWorld may show its "Import into Bambu Studio" dialog first; confirming it is what releases the link.
      const hint = setTimeout(() => show({ kind: 'busy', label: 'If MakerWorld asks, press “Import into Bambu Studio”: the project opens in Retarget3MF instead.' }), DIALOG_HINT_MS);
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
        // MakerWorld fetches a signed link for the selected print profile; it may first ask to log in or confirm.
        studio.click();
      });
      clearTimeout(hint);
      const link = href ? parseSlicerLink(href) : undefined;
      if (!link || !isAllowedDownloadUrl(link.url)) {
        document.documentElement.removeAttribute(ARMED);
        return show({ kind: 'error', label: href ? 'MakerWorld returned an unexpected link; this page may have changed.' : 'Log in to MakerWorld (or confirm its dialog), then try again.' });
      }
      await browser.runtime.sendMessage({ type: 'open', url: link.url, name: link.name, pageUrl: location.href } satisfies ToBackground);
    };

    /** Adds our row to MakerWorld's download menu, copied from one of its own rows so it matches the site's style. */
    const attach = () => {
      const menu = findMenu(document);
      if (!menu || menu.rows[0]?.parentElement?.querySelector(`[${MARKER}]`)) return;
      const template = menu.studioRow ?? menu.rows.find((r) => r.childElementCount === 0) ?? menu.rows[0]!;
      const row = template.cloneNode(false) as HTMLElement;
      row.setAttribute(MARKER, 'row');
      row.setAttribute('role', 'menuitem');
      row.textContent = idleLabel(status.printer);
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        // Logged in, "Open in Bambu Studio" is a row of this menu and clicking it closes the menu; otherwise it is the
        // main button and the menu is closed the way a click elsewhere would.
        const studio = menu.studioRow ?? findStudioTarget(document);
        if (!menu.studioRow) document.body.click();
        void start(studio);
      });
      rows.add(row);
      void refreshStatus();
      // Right under "Open in Bambu Studio" when it is a menu row; first otherwise (it is then the main button).
      if (menu.studioRow) menu.studioRow.insertAdjacentElement('afterend', row);
      else menu.rows[0]!.insertAdjacentElement('beforebegin', row);
    };

    // The menu is mounted on open and removed on close; the page is a single-page app.
    const observer = new MutationObserver(() => attach());
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
  },
});
