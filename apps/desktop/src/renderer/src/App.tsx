import { useEffect, useState } from 'react';
import type { AppEvent, AppState, ConvertResult, HistoryEntry, InspectResult, Settings } from '../../shared/api.ts';
import { HistoryList } from './components/HistoryList.tsx';
import { ConversionView } from './components/ConversionView.tsx';
import { DropZone } from './components/DropZone.tsx';
import { Header } from './components/Header.tsx';
import { Onboarding } from './components/Onboarding.tsx';
import { ReportView } from './components/ReportView.tsx';
import { ResultView } from './components/ResultView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import styles from './App.module.css';

type Stage =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'review'; project: InspectResult }
  | { kind: 'done'; project: InspectResult; result: ConvertResult; launchError?: string }
  | { kind: 'report'; project?: InspectResult; result: ConvertResult }
  | { kind: 'settings' };

const api = window.desktop;

export function App() {
  const [state, setState] = useState<AppState>();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<AppEvent[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => { void api.getState().then(setState); }, []);
  // Conversions can also finish outside this window (Finder, browser extension); refresh whenever the home screen shows.
  useEffect(() => { if (stage.kind === 'idle' || stage.kind === 'done') void api.listHistory().then(setHistory); }, [stage]);
  useEffect(() => api.onEvent((event) => setPending((queue) => [...queue, event])), []);
  // Events from the OS fast path wait until onboarding is done.
  useEffect(() => {
    const event = pending[0];
    if (!event || !state?.settings.printer) return;
    setPending((queue) => queue.slice(1));
    if (event.kind === 'open-project') void open(event.path);
    else if (event.kind === 'show-result') setStage({ kind: 'done', project: event.project, result: event.result, ...(event.launchError && { launchError: event.launchError }) });
    else setError(event.message);
  }, [pending, state]);

  if (!state) return null;

  const save = async (patch: Partial<Settings>) => setState(await api.saveSettings(patch));
  const locate = async (kind: Settings['slicer']) => setState(await api.pickSlicer(kind));
  if (!state.settings.printer) return <Onboarding state={state} onDone={save} onPickSlicer={locate} />;

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
    <div className={styles.app}>
      <Header state={state} onChange={save} onSettings={() => setStage({ kind: 'settings' })} />
      <main className={styles.main}>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        {stage.kind === 'idle' && (
          <>
            <DropZone onFile={open} />
            <HistoryList
              entries={history}
              onOpen={async (e) => { const r = await api.openInSlicer(e.outputPath, state.settings.slicer); if (!r.ok) setError(r.error); }}
              onShow={(e) => api.showInFolder(e.outputPath)}
              onReport={async (e) => { const result = await api.historyReport(e.id); if (result) setStage({ kind: 'report', result }); else setError('The report for this conversion is no longer available.'); }}
              onSource={(e) => api.openSourcePage(e.id)}
              onRemove={async (e, trash) => setHistory(await api.removeHistory(e.id, trash))}
            />
          </>
        )}
        {stage.kind === 'busy' && <p className={styles.busy} aria-live="polite">{stage.message}</p>}
        {stage.kind === 'review' && (
          <ConversionView
            project={stage.project}
            state={state}
            onConvert={(map, openAfter) => convert(stage.project, map, openAfter)}
            onCancel={() => setStage({ kind: 'idle' })}
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
            result={stage.result}
            onBack={() => setStage(stage.project ? { kind: 'done', project: stage.project, result: stage.result } : { kind: 'idle' })}
            onExport={(format) => api.exportReport(stage.result, format)}
          />
        )}
      </main>
    </div>
  );
}
