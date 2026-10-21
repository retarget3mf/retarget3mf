import type { BrowserStatus } from '../../../shared/api.ts';
import styles from './BrowserSupport.module.css';

type State = 'ready' | 'failed' | 'missing' | 'unsupported';
export interface BrowserRow { name: string; state: State; found?: string[] }

const LABELS: Record<State, string> = { ready: '● Ready for the extension', failed: 'Could not connect', missing: 'Not installed', unsupported: 'Not supported yet' };
const CHROMIUM_EXAMPLES = 'Chrome, Edge, Brave, Arc, Dia, Vivaldi, Opera';

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

export function BrowserSupport({ browsers }: { browsers: readonly BrowserStatus[] }) {
  return (
    <ul className={styles.list}>
      {browserRows(browsers).map((row) => (
        <li key={row.name}>
          <span className={styles.name}>
            {row.name}
            {row.found && (
              <>
                <button type="button" className={styles.info} popoverTarget="chromium-info" aria-label="Which browsers?">i</button>
                <div id="chromium-info" popover="auto" className={styles.popover}>
                  <p>One extension build works in every browser based on Chromium: {CHROMIUM_EXAMPLES} and others.</p>
                  <p>{row.found.length ? `Set up on this computer: ${row.found.join(', ')}.` : 'None found on this computer.'}</p>
                </div>
              </>
            )}
          </span>
          <span className={row.state === 'ready' ? styles.ok : styles.muted} title={row.state === 'unsupported' ? 'Safari extensions must ship inside a signed macOS app; planned separately.' : undefined}>
            {LABELS[row.state]}
          </span>
        </li>
      ))}
    </ul>
  );
}
