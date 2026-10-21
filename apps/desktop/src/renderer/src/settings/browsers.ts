import type { BrowserStatus } from '../../../shared/api.ts';

type State = 'ready' | 'failed' | 'missing' | 'unsupported';
export interface BrowserRow { name: string; state: State; found?: string[] }

/** Every Chromium browser runs the same extension build, so they share one row; Firefox and Safari always show. */
export function browserRows(statuses: readonly BrowserStatus[]): BrowserRow[] {
  const chromium = statuses.filter((b) => b.browser !== 'Firefox');
  const firefox = statuses.find((b) => b.browser === 'Firefox');
  const state = (list: readonly BrowserStatus[]): State => (list.length === 0 ? 'missing' : list.some((b) => b.registered) ? 'ready' : 'failed');
  return [
    { name: 'Chrome and Chromium browsers', state: state(chromium), found: chromium.filter((b) => b.registered).map((b) => b.browser) },
    { name: 'Firefox', state: state(firefox ? [firefox] : []) },
    { name: 'Safari', state: 'unsupported' },
  ];
}
