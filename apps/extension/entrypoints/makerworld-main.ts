// Runs in the page's own JavaScript world. MakerWorld opens Bambu Studio by creating a hidden
// <a href="bambustudio://open?file=…"> and calling .click() on it. While our button is waiting (armed), that click is
// captured and handed to the extension instead of the OS; otherwise MakerWorld behaves exactly as before.
export default defineUnlistedScript(() => {
  const SCHEME = /^(bambustudio|bambustudioopen|bambusuite):\/\//i;
  // The content script arms through a DOM attribute (shared and synchronous) holding an expiry timestamp.
  const ARMED = 'data-retarget3mf-armed';
  const root = document.documentElement;
  const click = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function (this: HTMLElement) {
    if (this instanceof HTMLAnchorElement && SCHEME.test(this.href) && Date.now() < Number(root.getAttribute(ARMED))) {
      root.removeAttribute(ARMED);
      window.postMessage({ source: 'retarget3mf', type: 'captured', href: this.href }, location.origin);
      return;
    }
    return click.call(this);
  };
});
