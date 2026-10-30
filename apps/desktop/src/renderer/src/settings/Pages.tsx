import { useState } from 'react';
import { ACCENTS, Dropdown, ExternalIcon, UI_MESSAGES, useT, type Accent, type Theme } from '@retarget3mf/ui';
import { issuesUrl, licenseUrl, LINKS, releaseNotesUrl } from '@retarget3mf/ui/links';
import iconUrl from '@retarget3mf/ui/icon.svg';
import { HISTORY_RETENTION, type AppState, type HistoryRetention, type OpenMode, type Settings, type SlicerKind, type UpdateStatus } from '../../../shared/api.ts';
import { browserRows } from './browsers.ts';
import { SlicerIcon } from '../shell/SlicerIcon.tsx';
import { SLICER_KINDS } from '../slicerKinds.ts';
import { Group, RadioRow, Row, ToggleRow } from './controls.tsx';
import { SETTINGS_MESSAGES } from './messages.ts';
import styles from './Settings.module.css';

type Change = (patch: Partial<Settings>) => void;
const OPEN_MODES: readonly OpenMode[] = ['auto', 'review'];
const ALL_SLICERS = Object.keys(SLICER_KINDS) as SlicerKind[];

export function SlicersPage({ state, onLocate, onRescan }: { state: AppState; onLocate: (kind: SlicerKind) => void; onRescan: () => void }) {
  const t = useT(SETTINGS_MESSAGES).slicers;
  const installed = (k: SlicerKind) => state.slicers.find((s) => s.kind === k);
  const order = [...ALL_SLICERS].sort((a, b) => Number(Boolean(installed(b))) - Number(Boolean(installed(a))));
  return (
    <>
      <Group
        title={t.found}
        actions={(
          <>
            <button type="button" onClick={onRescan}>{t.rescan}</button>
            <Dropdown label={t.addManually} value={undefined} groups={[{ options: ALL_SLICERS.map((k) => ({ value: k, label: SLICER_KINDS[k].name })) }]} onChange={onLocate} renderTrigger={() => t.addManually} />
          </>
        )}
      >
        {order.map((kind) => {
          const install = installed(kind);
          return (
            <Row key={kind} dim={!install}>
              <SlicerIcon install={install} kind={kind} size={36} />
              <span className={styles.grow}>
                <strong>{SLICER_KINDS[kind].name}</strong>
                <span className={styles.sub}>{t.blurbs[kind]}</span>
                {install && <span className={styles.mono} title={install.path}>{install.path}</span>}
              </span>
              <span className={install ? styles.ok : styles.muted}>{install ? t.installed : t.missing}</span>
              <button type="button" className={styles.link} onClick={() => onLocate(kind)} aria-label={`${install ? t.change : t.locate} ${SLICER_KINDS[kind].name}`}>{install ? t.change : t.locate}</button>
            </Row>
          );
        })}
      </Group>
      <p className={styles.hint}>{t.hint}</p>
    </>
  );
}

export function ConvertingPage({ state, onChange, onPickFolder }: { state: AppState; onChange: Change; onPickFolder: () => void }) {
  const t = useT(SETTINGS_MESSAGES).converting;
  const { settings } = state;
  const [pattern, setPattern] = useState(settings.fileNamePattern);
  return (
    <>
      <Group title={t.files}>
        <RadioRow name="output" value="next-to-original" current={settings.output} onChange={(output) => onChange({ output })}>{t.nextTo}</RadioRow>
        <RadioRow
          name="output"
          value="app-folder"
          current={settings.output}
          onChange={(output) => onChange({ output })}
          extra={<button type="button" className={styles.link} onClick={onPickFolder}>{t.choose}</button>}
        >
          <span className={styles.nameLine}>{t.inFolder} <span className={styles.mono} title={state.outputFolder}>{state.outputFolder}</span></span>
        </RadioRow>
        <Row>
          <label className={styles.grow} htmlFor="file-name">{t.fileName}<span className={styles.sub}>{t.fileNameHelp}</span></label>
          <input
            id="file-name"
            className={styles.pattern}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onBlur={() => { onChange({ fileNamePattern: pattern }); setPattern(pattern.includes('{name}') ? pattern.replace(/\.3mf$/i, '') : settings.fileNamePattern); }}
          />
          <span className={styles.muted}>.3mf</span>
        </Row>
      </Group>
      <Group title={t.fromOs}>
        {OPEN_MODES.map((m) => <RadioRow key={m} name="openMode" value={m} current={settings.openMode} onChange={(openMode) => onChange({ openMode })}>{t.openModes[m]}</RadioRow>)}
      </Group>
      <Group title={t.during}>
        <ToggleRow label={t.openAfter} checked={settings.openAfterConvert} onChange={(openAfterConvert) => onChange({ openAfterConvert })} />
        <ToggleRow label={t.removeUnused} checked={settings.removeUnused} onChange={(removeUnused) => onChange({ removeUnused })} />
        <ToggleRow label={t.autoCombine} checked={settings.autoCombine} onChange={(autoCombine) => onChange({ autoCombine })} />
      </Group>
    </>
  );
}

const CHROMIUM_EXAMPLES = 'Chrome, Edge, Brave, Arc, Dia, Vivaldi, Opera';
/** Store pages per browser row; Safari has none yet. */
const STORES: Record<string, { store: string; label: string }> = {
  'Chrome and Chromium browsers': { store: LINKS.chromeStore, label: 'Chrome' },
  Firefox: { store: LINKS.firefoxAddons, label: 'Firefox' },
};

function StoreLink({ store, label }: { store: string; label: string }) {
  const t = useT(SETTINGS_MESSAGES).browser;
  const name = t.get(label);
  if (!store) return <span className={`${styles.iconButton} ${styles.disabled}`} role="link" aria-disabled="true" aria-label={`${name} (${t.soon})`} title={t.soon}><ExternalIcon /></span>;
  return <a className={styles.iconButton} href={store} target="_blank" rel="noreferrer" aria-label={name} title={name}><ExternalIcon /></a>;
}

export function BrowserPage({ state, onChange }: { state: AppState; onChange: Change }) {
  const t = useT(SETTINGS_MESSAGES).browser;
  return (
    <>
      <p className={styles.intro}>{t.intro}</p>
      <div className={styles.panel}>
        {browserRows(state.browsers).map((row) => (
          <Row key={row.name}>
            <span className={styles.grow}><span className={styles.nameLine}>
              <strong>{row.found ? t.chromiumRow : row.name}</strong>
              {row.found && (
                <>
                  <button type="button" className={styles.more} popoverTarget="chromium-info" aria-label={t.which} style={{ anchorName: '--chromium-info' } as React.CSSProperties}>ⓘ</button>
                  <div id="chromium-info" popover="auto" className={styles.menu} style={{ positionAnchor: '--chromium-info', padding: '10px 12px', maxWidth: 340 } as React.CSSProperties}>
                    <p style={{ margin: '0 0 6px' }}>{t.chromium(CHROMIUM_EXAMPLES)}</p>
                    <p className={styles.muted} style={{ margin: 0 }}>{row.found.length ? t.found(row.found.join(', ')) : t.noneFound}</p>
                  </div>
                </>
              )}
            </span></span>
            <span className={row.state === 'ready' ? styles.ok : styles.muted} title={row.state === 'unsupported' ? t.safari : undefined}>{t.states[row.state]}</span>
            {STORES[row.name] ? <StoreLink {...STORES[row.name]!} /> : <span className={styles.iconSpacer} aria-hidden />}
          </Row>
        ))}
      </div>
      <Group title={t.files}>
        {OPEN_MODES.map((m) => <RadioRow key={m} name="extensionMode" value={m} current={state.settings.extensionMode} onChange={(extensionMode) => onChange({ extensionMode })}>{t.modes[m]}</RadioRow>)}
      </Group>
    </>
  );
}

const THEME_PREVIEW: Record<Theme, string> = { system: 'linear-gradient(135deg, #f4f4f2 50%, #121314 50%)', light: '#f4f4f2', dark: '#121314' };
/** Swatches show each accent as the current theme draws it (light, dark). */
const SWATCH: Record<Accent, string> = {
  lime: 'light-dark(oklch(0.86 0.18 125), oklch(0.87 0.18 125))', mint: 'light-dark(oklch(0.55 0.1 175), oklch(0.82 0.12 170))',
  magenta: 'light-dark(oklch(0.57 0.21 355), oklch(0.72 0.2 350))', violet: 'light-dark(oklch(0.52 0.18 290), oklch(0.73 0.15 295))',
  yellow: 'light-dark(oklch(0.87 0.16 95), oklch(0.89 0.16 95))', amber: 'light-dark(oklch(0.6 0.15 55), oklch(0.8 0.14 70))', mono: 'light-dark(#161616, #f0f0f0)',
};

export function AppearancePage({ state, onChange }: { state: AppState; onChange: Change }) {
  const t = useT(SETTINGS_MESSAGES).appearance;
  const themeNames = useT(UI_MESSAGES).theme;
  const { theme, accent, slicer } = state.settings;
  return (
    <>
      <section className={styles.group}>
        <h3 className={styles.groupHead}>{t.theme}</h3>
        <div className={styles.tiles} role="radiogroup" aria-label={t.theme}>
          {(Object.keys(THEME_PREVIEW) as Theme[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={theme === k} className={styles.tile} onClick={() => onChange({ theme: k })}>
              <span className={styles.tilePreview} style={{ background: THEME_PREVIEW[k] }} />{themeNames[k]}
            </button>
          ))}
        </div>
      </section>
      <section className={styles.group}>
        <h3 className={styles.groupHead}>{t.accent}</h3>
        <div className={styles.swatches} role="radiogroup" aria-label={t.accent}>
          {ACCENTS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={accent === a} className={styles.swatchButton} onClick={() => onChange({ accent: a })}>
              <span className={styles.swatch} style={{ background: SWATCH[a] }} />{t.accents[a]}
            </button>
          ))}
        </div>
      </section>
      <section className={styles.group}>
        <h3 className={styles.groupHead}>{t.preview}</h3>
        <div className={styles.preview} aria-hidden>
          <span className="primary" style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600 }}>{t.previewButton(SLICER_KINDS[slicer].name)}</span>
          <span style={{ color: 'var(--accent-ink)' }}>{t.previewLink}</span>
          <span className={styles.previewRow}>{t.previewRow}</span>
        </div>
      </section>
    </>
  );
}

interface AboutProps { state: AppState; historyCount: number; onChange: Change; onCheck: () => Promise<UpdateStatus>; onClearHistory: () => void }

export function AboutPage({ state, historyCount, onChange, onCheck, onClearHistory }: AboutProps) {
  const t = useT(SETTINGS_MESSAGES).about;
  const [status, setStatus] = useState<UpdateStatus | 'checking'>();
  const [confirming, setConfirming] = useState(false);
  const statusText = status === 'checking' ? t.checking
    : status?.kind === 'available' ? t.available(status.version!)
    : status?.kind === 'error' ? t.failed
    : status?.kind === 'current' ? t.current
    : state.packaged ? '' : t.devBuild;
  const links = [[issuesUrl, t.report], [releaseNotesUrl, t.notes], [licenseUrl, t.licenses], [LINKS.privacy, t.privacy]].filter(([url]) => url);
  return (
    <>
      <div className={styles.aboutHead}>
        <img className={styles.aboutIcon} src={typeof iconUrl === 'string' ? iconUrl : iconUrl.src} alt="" />
        <div className={styles.grow}><strong style={{ fontSize: 16 }}>Retarget3MF</strong><span className={styles.sub}>{[t.version(state.version), statusText].filter(Boolean).join(' · ')}</span></div>
        <button type="button" disabled={status === 'checking'} onClick={async () => { setStatus('checking'); setStatus(await onCheck()); }}>{t.check}</button>
      </div>
      <div className={styles.panel}>
        <ToggleRow label={t.autoUpdate} checked={state.settings.autoUpdate} onChange={(autoUpdate) => onChange({ autoUpdate })} />
      </div>
      <Group title={t.history}>
        <Row>
          <label className={styles.grow} htmlFor="retention">{t.keep}</label>
          <select id="retention" value={state.settings.historyRetention} onChange={(e) => onChange({ historyRetention: e.target.value as HistoryRetention })}>
            {HISTORY_RETENTION.map((r) => <option key={r} value={r}>{t.retention[r]}</option>)}
          </select>
        </Row>
        <Row>
          <span className={`${styles.grow} ${styles.muted}`}>{t.count(historyCount)}</span>
          {confirming
            ? <><button type="button" onClick={() => setConfirming(false)}>{t.cancel}</button><button type="button" className="primary" onClick={() => { setConfirming(false); onClearHistory(); }}>{t.clearConfirm}</button></>
            : <button type="button" className={styles.danger} disabled={historyCount === 0} onClick={() => setConfirming(true)}>{t.clear}</button>}
        </Row>
      </Group>
      {links.length > 0 && <div className={styles.links}>{links.map(([url, label]) => <a key={url} href={url} target="_blank" rel="noreferrer">{label}</a>)}</div>}
    </>
  );
}
