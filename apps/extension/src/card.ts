// A floating card in a shadow root (the printer chooser, the download offer): the site's CSS cannot reach it.
const CARD_STYLE = `
  :host { all: initial; position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; }
  .card { width: 380px; max-width: calc(100vw - 40px); box-sizing: border-box; padding: 14px; display: flex; flex-direction: column; gap: 12px;
    border-radius: 12px; border: 1px solid #e0e0dc; background: #fff; color: #161616; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  @media (prefers-color-scheme: dark) { .card { background: #161719; border-color: #2e2f33; color: #e9e9ea; } .muted { color: #92949a !important; } }
  .head { display: flex; gap: 12px; align-items: flex-start; }
  .thumb { width: 48px; height: 48px; flex: none; border-radius: 8px; border: 1px solid rgba(128, 128, 128, 0.35);
    background: repeating-linear-gradient(135deg, rgba(128, 128, 128, 0.12) 0 4px, transparent 4px 8px); }
  .grow { flex: 1; min-width: 0; }
  .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .muted { font-size: 12px; color: #626468; }
  .row { display: flex; gap: 8px; }
  button { font: inherit; cursor: pointer; border-radius: 8px; padding: 8px 12px; border: 1px solid rgba(128, 128, 128, 0.35); background: transparent; color: inherit; }
  button.primary { flex: 1; border-color: transparent; background: oklch(0.87 0.18 125); color: #10160a; font-weight: 600; }
  button.close { border: none; padding: 0 2px; opacity: 0.6; }
  select { font: inherit; width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(128, 128, 128, 0.35); background: transparent; color: inherit; }
  label { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  label input { margin: 0; accent-color: oklch(0.87 0.18 125); }
`;

export interface Card { host: HTMLElement; root: ShadowRoot; body: HTMLDivElement; close: () => void }

export function showCard(marker: string): Card {
  document.querySelector(`[data-retarget3mf="${marker}"]`)?.remove();
  const host = document.createElement('div');
  host.setAttribute('data-retarget3mf', marker);
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CARD_STYLE;
  const body = document.createElement('div');
  body.className = 'card';
  body.setAttribute('role', 'dialog');
  root.append(style, body);
  // The site's menus close on outside clicks; clicks inside the card must not count as outside.
  for (const type of ['pointerdown', 'mousedown', 'click']) host.addEventListener(type, (e) => e.stopPropagation());
  document.body.append(host);
  return { host, root, body, close: () => host.remove() };
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}
