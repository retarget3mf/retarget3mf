import { SLICER_SCHEMES } from '@retarget3mf/bridge';

// Runs in the page's own JavaScript world. Model sites hand a signed project link to their slicer either by clicking
// a hidden <a href="bambustudio://…"> (MakerWorld, Creality Cloud, Printables) or by assigning location.href (Snapmaker Space).
// While our row is waiting (armed), that hand-off is captured for the extension; otherwise sites behave as before.
export default defineUnlistedScript(() => {
  // The content script arms through a DOM attribute (shared and synchronous) holding an expiry timestamp.
  const ARMED = 'data-retarget3mf-armed';
  const root = document.documentElement;
  const capture = (href: string): boolean => {
    if (!SLICER_SCHEMES.test(href) || !(Date.now() < Number(root.getAttribute(ARMED)))) return false;
    root.removeAttribute(ARMED);
    window.postMessage({ source: 'retarget3mf', type: 'captured', href }, location.origin);
    return true;
  };
  const click = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function (this: HTMLElement) {
    if (this instanceof HTMLAnchorElement && capture(this.href)) return;
    return click.call(this);
  };
  // location.href = "scheme://…" cannot be intercepted by overriding; the Navigation API can cancel it.
  (window as unknown as { navigation?: EventTarget }).navigation?.addEventListener('navigate', (e) => {
    const event = e as Event & { destination: { url: string }; cancelable: boolean };
    if (event.cancelable && capture(event.destination.url)) event.preventDefault();
  });
});
