import { isAllowedDownloadUrl, parseSlicerLink } from '@retarget3mf/bridge';
import { findStudioButtons, isVisible, MARKER } from '../src/makerworld.ts';
import { idleLabel, type AppStatus, type ButtonState, type ToBackground } from '../src/messages.ts';

const CAPTURE_TIMEOUT_MS = 90_000;
const ARMED = 'data-retarget3mf-armed';
const STYLE = `
  :host { display: block; margin-top: 8px; }
  button { all: unset; box-sizing: border-box; width: 100%; padding: 10px 14px; border-radius: 8px; cursor: pointer;
    font: 600 14px/1.3 system-ui, sans-serif; text-align: center; color: #fff; background: #1f6feb; }
  button:hover { background: #2f7bf5; }
  button:focus-visible { outline: 2px solid #9ec5ff; outline-offset: 2px; }
  button[data-kind="busy"] { background: #5a6b85; cursor: progress; }
  button[data-kind="done"] { background: #1a7f37; }
  button[data-kind="error"] { background: #a33; white-space: normal; }
`;

export default defineContentScript({
  matches: ['https://makerworld.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    await injectScript('/makerworld-main.js', { keepInDom: true });
    const buttons = new Set<HTMLButtonElement>();
    let status: AppStatus = { connected: false };
    const render = (state: ButtonState) => buttons.forEach((b) => { b.textContent = state.label; b.dataset.kind = state.kind; b.disabled = state.kind === 'busy'; });
    const idle = () => render({ kind: 'idle', label: idleLabel(status.printer) });

    const refreshStatus = async () => {
      status = (await browser.runtime.sendMessage({ type: 'status' } satisfies ToBackground)) as AppStatus;
      if ([...buttons].every((b) => b.dataset.kind === 'idle' || !b.dataset.kind)) idle();
    };

    browser.runtime.onMessage.addListener((message: { type: string; state?: ButtonState }) => {
      if (message.type === 'button-state' && message.state) {
        render(message.state);
        if (message.state.kind !== 'busy') setTimeout(idle, message.state.kind === 'error' ? 8000 : 4000);
      }
    });

    const start = async (studio: HTMLElement) => {
      render({ kind: 'busy', label: 'Getting the project from MakerWorld…' });
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
      const link = href ? parseSlicerLink(href) : undefined;
      if (!link || !isAllowedDownloadUrl(link.url)) {
        document.documentElement.removeAttribute(ARMED);
        render({ kind: 'error', label: href ? 'MakerWorld returned an unexpected link; this page may have changed.' : 'Log in to MakerWorld (or confirm its dialog), then press the button again.' });
        setTimeout(idle, 8000);
        return;
      }
      await browser.runtime.sendMessage({ type: 'open', url: link.url, name: link.name, pageUrl: location.href } satisfies ToBackground);
    };

    const attach = () => {
      for (const studio of findStudioButtons(document)) {
        const anchor = studio.parentElement;
        if (!anchor || !isVisible(studio) || anchor.querySelector(`[${MARKER}]`)) continue;
        const host = document.createElement('div');
        host.setAttribute(MARKER, '');
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = STYLE;
        const button = document.createElement('button');
        button.type = 'button';
        button.addEventListener('click', (e) => { e.stopPropagation(); void start(studio); });
        shadow.append(style, button);
        studio.insertAdjacentElement('afterend', host);
        buttons.add(button);
        const current = [...buttons].find((b) => b.dataset.kind);
        button.textContent = current?.textContent ?? idleLabel(status.printer);
        button.dataset.kind = current?.dataset.kind ?? 'idle';
      }
      for (const b of buttons) if (!b.isConnected) buttons.delete(b);
    };

    // MakerWorld is a single-page app: the panel re-renders on navigation and profile switches.
    const observer = new MutationObserver(() => attach());
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    attach();
    await refreshStatus();
  },
});
