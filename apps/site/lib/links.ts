export { LINKS, releasesUrl } from '@retarget3mf/ui/links';

export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;

/** The web converter: its own site (e.g. https://app.retarget3mf.app) when NEXT_PUBLIC_APP_URL is set, else app/ next to the landing page. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
export const appHref = () => (APP_URL ? `${APP_URL}/` : asset('/app/'));
