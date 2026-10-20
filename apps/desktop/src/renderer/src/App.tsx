import { useEffect, useState } from 'react';
import type { AppState, ConvertResult, InspectResult, Settings } from '../../shared/api.ts';
import { ConversionView } from './components/ConversionView.tsx';
import { DropZone } from './components/DropZone.tsx';
import { Header } from './components/Header.tsx';
import { Onboarding } from './components/Onboarding.tsx';
import { ReportView } from './components/ReportView.tsx';
import { ResultView } from './components/ResultView.tsx';
import styles from './App.module.css';

type Stage =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'review'; project: InspectResult }
  | { kind: 'done'; project: InspectResult; result: ConvertResult; launchError?: string }
  | { kind: 'report'; project: InspectResult; result: ConvertResult };

const api = window.desktop;

export function App() {
  const [state, setState] = useState<AppState>();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [error, setError] = useState<string>();

  useEffect(() => { void api.getState().then(setState); }, []);
  if (!state) return null;

  const save = async (patch: Partial<Settings>) => setState(await api.saveSettings(patch));
  if (!state.settings.printer) return <Onboarding state={state} onDone={save} onPickSlicer={async (k) => setState(await api.pickSlicer(k))} />;

  const open = async (path: string) => {
    setError(undefined);
    setStage({ kind: 'busy', message: 'Reading project…' });
    const r = await api.inspect(path).catch((e: Error) => ({ ok: false as const, error: e.message }));
    if (r.ok) setStage({ kind: 'review', project: r.value });
    else { setError(r.error); setStage({ kind: 'idle' }); }
  };

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
      <Header state={state} onChange={save} onPickSlicer={async (k) => setState(await api.pickSlicer(k))} />
      <main className={styles.main}>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        {stage.kind === 'idle' && <DropZone onFile={open} />}
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
        {stage.kind === 'report' && (
          <ReportView
            result={stage.result}
            onBack={() => setStage({ kind: 'done', project: stage.project, result: stage.result })}
            onExport={(format) => api.exportReport(stage.result, format)}
          />
        )}
      </main>
    </div>
  );
}
