import { NATIVE_HOST_NAME, isAllowedDownloadUrl, type BridgeRequest, type BridgeResponse } from '@retarget3mf/bridge';
import { NOTIFICATION_PREFIX, projectDownload } from '../src/downloads.ts';
import { idleLabel, stateFor, type AppStatus, type ToBackground } from '../src/messages.ts';

type Pending = (response: BridgeResponse | { type: 'no-app' }) => void;
/** A request without its id; distributes over the union so each request type keeps its own fields. */
type RequestBody = BridgeRequest extends infer R ? (R extends BridgeRequest ? Omit<R, 'id'> : never) : never;

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

  function request(body: RequestBody, onReply: Pending): void {
    const id = nextId++;
    pending.set(id, onReply);
    try {
      connect().postMessage({ ...body, id });
    } catch {
      pending.delete(id);
      onReply({ type: 'no-app' });
    }
  }

  const status = (body: RequestBody = { type: 'ping' }) => new Promise<AppStatus>((resolve) => {
    const timer = setTimeout(() => resolve({ connected: false }), 25_000);
    request(body, (r) => {
      clearTimeout(timer);
      if (r.type !== 'pong') return resolve({ connected: false });
      const { id: _id, type: _type, ...fields } = r;
      resolve({ connected: true, ...fields });
    });
  });

  // Passive mode (opt-in from the popup): a finished .3mf from a model site gets an "Open for <printer>?" notification.
  // The APIs exist only once the optional permissions are granted; listeners register on start-up and when granted.
  const findDownload = async (id: number) => {
    const [item] = await browser.downloads.search({ id });
    return item && item.state === 'complete' ? projectDownload(item) : undefined;
  };
  const notify = (id: string, title: string, message: string) =>
    browser.notifications.create(id, { type: 'basic', iconUrl: browser.runtime.getURL('/icon/128.png'), title, message });

  async function onDownloadChanged(delta: Browser.downloads.DownloadDelta): Promise<void> {
    if (delta.state?.current !== 'complete') return;
    const project = await findDownload(delta.id);
    if (!project) return;
    const app = await status();
    if (!app.connected) return;
    const file = project.path.split(/[\\/]/).pop()!;
    await notify(`${NOTIFICATION_PREFIX}${delta.id}`, `${idleLabel(app.printer)}?`, `${file}: convert it and open your slicer.`);
  }

  async function onNotificationClicked(notificationId: string): Promise<void> {
    if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
    await browser.notifications.clear(notificationId);
    const project = await findDownload(Number(notificationId.slice(NOTIFICATION_PREFIX.length)));
    if (!project) return;
    request({ type: 'open-file', ...project }, (r) => {
      const state = stateFor(r);
      // Success is announced by the desktop app itself.
      if (state.kind === 'error') void notify(`${NOTIFICATION_PREFIX}error`, 'Retarget3MF', state.label);
    });
  }

  let watching = false;
  function watchDownloads(): void {
    if (watching || !browser.downloads || !browser.notifications) return;
    watching = true;
    browser.downloads.onChanged.addListener((delta) => void onDownloadChanged(delta));
    browser.notifications.onClicked.addListener((id) => void onNotificationClicked(id));
  }
  watchDownloads();
  browser.permissions.onAdded.addListener(watchDownloads);

  browser.runtime.onMessage.addListener((message: ToBackground, sender, sendResponse) => {
    if (message.type === 'status') {
      void status().then(sendResponse);
      return true;
    }
    if (message.type === 'set-target') {
      void status({ type: 'set-target', printer: message.printer, slicer: message.slicer }).then(sendResponse);
      return true;
    }
    if (message.type === 'convert-in-browser') {
      if (!isAllowedDownloadUrl(message.url)) return false;
      const query = new URLSearchParams({ url: message.url, name: message.name, site: message.site, page: message.pageUrl });
      void browser.tabs.create({ url: `${browser.runtime.getURL('/convert.html')}?${query}` });
      return false;
    }
    const tabId = sender.tab?.id;
    if (message.type !== 'open' || tabId === undefined || !isAllowedDownloadUrl(message.url)) return false;
    request({ type: 'open', url: message.url, name: message.name, site: message.site, pageUrl: message.pageUrl }, (r) => {
      const state = stateFor(r);
      void browser.tabs.sendMessage(tabId, { type: 'button-state', state }).catch(() => {});
      if (state.kind !== 'busy') pending.forEach((fn, id) => fn === undefined && pending.delete(id));
    });
    sendResponse(true);
    return false;
  });
});
