import type { BridgeResponse, SourceSite } from '@retarget3mf/bridge';

/** content script → background */
export type ToBackground =
  | { type: 'open'; url: string; name: string; site: SourceSite; pageUrl: string }
  | { type: 'status' }
  | { type: 'set-target'; printer: string; slicer: string }
  | { type: 'convert-in-browser'; url: string; name: string; site: SourceSite; pageUrl: string };

/** background → content script / popup */
export type ButtonState =
  | { kind: 'idle'; label: string }
  | { kind: 'busy'; label: string }
  | { kind: 'done'; label: string }
  | { kind: 'error'; label: string; installHint?: boolean };

export interface AppStatus { connected: boolean; printer?: string; vendor?: string; slicer?: string; printerId?: string; slicerId?: string; version?: string }

/** What the button says for a bridge response; `printer` personalises the idle label. */
export function stateFor(response: BridgeResponse | { type: 'no-app' }): ButtonState {
  switch (response.type) {
    case 'progress':
      return { kind: 'busy', label: response.stage === 'downloading' ? 'Downloading…' : response.stage === 'converting' ? 'Converting…' : 'Opening slicer…' };
    case 'done':
      return { kind: 'done', label: response.outcome === 'review' ? 'Review in Retarget3MF' : response.outcome === 'converted' ? 'Converted ✓' : 'Opened ✓' };
    case 'error':
      return { kind: 'error', label: response.message };
    case 'no-app':
      return { kind: 'error', label: 'Install the Retarget3MF desktop app to open projects for your printer.', installHint: true };
    default:
      return { kind: 'busy', label: 'Working…' };
  }
}

export const idleLabel = (printer: string | undefined) => (printer ? `Open for ${printer.replace(/^Flashforge /, '')}` : 'Open in Retarget3MF');
