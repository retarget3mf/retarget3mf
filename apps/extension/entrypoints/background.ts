import { NATIVE_HOST_NAME, isAllowedDownloadUrl, type BridgeRequest, type BridgeResponse } from '@retarget3mf/bridge';
import { stateFor, type AppStatus, type ToBackground } from '../src/messages.ts';

type Pending = (response: BridgeResponse | { type: 'no-app' }) => void;

export default defineBackground(() => {
  let port: Browser.runtime.Port | undefined;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  // One native host process per port; it relays to the desktop app and starts the app when needed.
  function connect(): Browser.runtime.Port {
    if (port) return port;
    const p = browser.runtime.connectNative(NATIVE_HOST_NAME);
    p.onMessage.addListener((r: BridgeResponse) => pending.get(r.id)?.(r));
    p.onDisconnect.addListener(() => {
      port = undefined;
      for (const [, reply] of pending) reply({ type: 'no-app' });
      pending.clear();
    });
    port = p;
    return p;
  }

  function request(body: Omit<BridgeRequest, 'id'>, onReply: Pending): void {
    const id = nextId++;
    pending.set(id, onReply);
    try {
      connect().postMessage({ ...body, id });
    } catch {
      pending.delete(id);
      onReply({ type: 'no-app' });
    }
  }

  const status = () => new Promise<AppStatus>((resolve) => {
    const timer = setTimeout(() => resolve({ connected: false }), 25_000);
    request({ type: 'ping' }, (r) => {
      clearTimeout(timer);
      resolve(r.type === 'pong' ? { connected: true, version: r.version, ...(r.printer && { printer: r.printer }), ...(r.slicer && { slicer: r.slicer }) } : { connected: false });
    });
  });

  browser.runtime.onMessage.addListener((message: ToBackground, sender, sendResponse) => {
    if (message.type === 'status') {
      void status().then(sendResponse);
      return true;
    }
    const tabId = sender.tab?.id;
    if (message.type !== 'open' || tabId === undefined || !isAllowedDownloadUrl(message.url)) return false;
    request({ type: 'open', url: message.url, name: message.name, site: message.site, pageUrl: message.pageUrl } as Omit<BridgeRequest, 'id'>, (r) => {
      const state = stateFor(r);
      void browser.tabs.sendMessage(tabId, { type: 'button-state', state }).catch(() => {});
      if (state.kind !== 'busy') pending.forEach((fn, id) => fn === undefined && pending.delete(id));
    });
    sendResponse(true);
    return false;
  });
});
