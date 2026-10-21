import { useEffect, useState } from 'react';
import type { AppEvent, AppState, ConvertResult, HistoryEntry, InspectResult, Settings } from '../../shared/api.ts';
import { HistoryList } from './components/HistoryList.tsx';
import { Header } from './components/Header.tsx';
import { Onboarding } from './components/Onboarding.tsx';
import { ResultView } from './components/ResultView.tsx';
import { ConversionView, DropZone, I18nProvider, ReportView } from '@retarget3mf/ui';
import { SettingsView } from './components/SettingsView.tsx';
import styles from './App.module.css';

type Stage =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'review'; project: InspectResult }
  | { kind: 'done'; project: InspectResult; result: ConvertResult; launchError?: string }
  | { kind: 'report'; project?: InspectResult; result: ConvertResult; backTo?: 'history' }
  | { kind: 'history' }
  | { kind: 'settings' };

const api = window.desktop;
const HOME_HISTORY = 5;

export function App() {
  const [state, setState] = useState<AppState>();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<AppEvent[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => { void api.getState().then(setState); }, []);
  // Conversions can also finish outside this window (Finder, browser extension); refresh whenever the home screen shows.
  useEffect(() => { if (stage.kind === 'idle' || stage.kind === 'done' || stage.kind === 'history') void api.listHistory().then(setHistory); }, [stage]);
  useEffect(() => api.onEvent((event) => setPending((queue) => [...queue, event])), []);
  // Events from the OS fast path wait until onboarding is done.
  useEffect(() => {
    const event = pending[0];
    if (!event || !state?.settings.printer) return;
    setPending((queue) => queue.slice(1));
    if (event.kind === 'open-project') void open(event.path);
    else if (event.kind === 'show-result') setStage({ kind: 'done', project: event.project, result: event.result, ...(event.launchError && { launchError: event.launchError }) });
    else if (event.kind === 'settings-changed') void api.getState().then(setState);
    else setError(event.message);
  }, [pending, state]);

  if (!state) return null;

  const save = async (patch: Partial<Settings>) => setState(await api.saveSettings(patch));
  const locate = async (kind: Settings['slicer']) => setState(await api.pickSlicer(kind));
  if (!state.settings.printer) return <Onboarding state={state} onDone={save} onPickSlicer={locate} />;

  const historyActions = (backTo: 'history' | undefined) => ({
    onOpen: async (e: HistoryEntry) => { const r = await api.openInSlicer(e.outputPath, state.settings.slicer); if (!r.ok) setError(r.error); },
    onShow: (e: HistoryEntry) => api.showInFolder(e.outputPath),
    onReport: async (e: HistoryEntry) => {
      const result = await api.historyReport(e.id);
      if (result) setStage({ kind: 'report', result, ...(backTo && { backTo }) });
      else setError('The report for this conversion is no longer available.');
    },
    onSource: (e: HistoryEntry) => api.openSourcePage(e.id),
    onRemove: async (e: HistoryEntry, trash: boolean) => setHistory(await api.removeHistory(e.id, trash)),
  });

  async function open(path: string) {
    setError(undefined);
    setStage({ kind: 'busy', message: 'Reading project…' });
    const r = await api.inspect(path).catch((e: Error) => ({ ok: false as const, error: e.message }));
    if (r.ok) setStage({ kind: 'review', project: r.value });
    else { setError(r.error); setStage({ kind: 'idle' }); }
  }

  const convert = async (project: InspectResult, filamentMap: Record<number, number>, openAfter: boolean) => {
    setError(undefined);
    setStage({ kind: 'busy', message: 'Converting…' });
    const { printer, slicer } = state.settings;
    const r = await api.convert({ path: project.path, printer: printer!, slicer, filamentMap }).catch((e: Error) => ({ ok: false as const, error: e.message }));
    if (!r.ok) { setError(r.error); setStage({ kind: 'review', project }); return; }
    let launchError: string | undefined;
    if (openAfter) {
      const launched = await api.openInSlicer(r.value.outputPath, slicer);
      if (!launched.ok) launchError = launched.error;
    }
    setStage({ kind: 'done', project, result: r.value, ...(launchError && { launchError }) });
  };

  return (
    <I18nProvider locale="en">
    <div className={styles.app}>
      <Header state={state} onChange={save} onSettings={() => setStage({ kind: 'settings' })} onHistory={() => setStage({ kind: 'history' })} />
      <main className={styles.main}>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        {stage.kind === 'idle' && (
          <>
            <DropZone onFile={(file) => void open(api.pathForFile(file))} onBrowse={async () => { const path = await api.pickFile(); if (path) await open(path); }} />
            <HistoryList title="Recent conversions" limit={HOME_HISTORY} onShowAll={() => setStage({ kind: 'history' })} entries={history} {...historyActions(undefined)} />
          </>
        )}
        {stage.kind === 'history' && (
          <>
            <div className={styles.pageHead}>
              <button type="button" onClick={() => setStage({ kind: 'idle' })}>← Back</button>
            </div>
            <HistoryList title="History" entries={history} emptyText="No conversions yet. Projects you convert, from here, Finder or the browser extension, appear here." {...historyActions('history')} />
          </>
        )}
        {stage.kind === 'busy' && <p className={styles.busy} aria-live="polite">{stage.message}</p>}
        {stage.kind === 'review' && (
          <ConversionView
            project={stage.project}
            printer={state.printers.find((p) => p.id === state.settings.printer)!}
            onCancel={() => setStage({ kind: 'idle' })}
            renderActions={(map) => <ConvertActions state={state} onConvert={(openAfter) => convert(stage.project, map, openAfter)} />}
          />
        )}
        {stage.kind === 'done' && (
          <ResultView
            state={state}
            result={stage.result}
            {...(stage.launchError && { launchError: stage.launchError })}
            onOpen={async () => {
              const r = await api.openInSlicer(stage.result.outputPath, state.settings.slicer);
              if (!r.ok) setError(r.error);
            }}
            onShow={() => api.showInFolder(stage.result.outputPath)}
            onReport={() => setStage({ kind: 'report', project: stage.project, result: stage.result })}
            onNext={() => setStage({ kind: 'idle' })}
          />
        )}
        {stage.kind === 'settings' && (
          <SettingsView
            state={state}
            onChange={save}
            onLocate={locate}
            onRescan={async () => setState(await api.refreshSlicers())}
            onBack={() => setStage({ kind: 'idle' })}
          />
        )}
        {stage.kind === 'report' && (
          <ReportView
            report={stage.result.report}
            onBack={() => setStage(stage.project ? { kind: 'done', project: stage.project, result: stage.result } : { kind: stage.backTo ?? 'idle' })}
            onExport={(format) => api.exportReport(stage.result, format)}
          />
        )}
      </main>
    </div>
    </I18nProvider>
  );
}

function ConvertActions({ state, onConvert }: { state: AppState; onConvert: (openAfter: boolean) => void }) {
  const slicer = state.slicers.find((s) => s.kind === state.settings.slicer);
  return (
    <>
      <button className="primary" onClick={() => onConvert(true)} disabled={!slicer}>Convert &amp; open in {slicer?.name ?? 'slicer'}</button>
      <button onClick={() => onConvert(false)}>Convert only</button>
      {!slicer && <span className={styles.muted}>Slicer not found: use “Locate slicer…” above.</span>}
    </>
  );
}
