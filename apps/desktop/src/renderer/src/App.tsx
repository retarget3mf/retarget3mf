import { useEffect, useState } from 'react';
import type { PrinterId } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import { applyAccent, ConversionView, I18nProvider, ReportView, useT } from '@retarget3mf/ui';
import type { AppEvent, AppState, ConvertResult, HistoryEntry, InspectResult, SavedPrinter, Settings } from '../../shared/api.ts';
import { HistoryList } from './components/HistoryList.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { ChoosePrinter } from './flow/ChoosePrinter.tsx';
import { DoneView } from './flow/DoneView.tsx';
import { MergeStep } from './flow/MergeStep.tsx';
import { Home } from './home/Home.tsx';
import { DESKTOP_MESSAGES } from './messages.ts';
import { FirstRun } from './shell/FirstRun.tsx';
import { Pipeline, type Phase } from './shell/Pipeline.tsx';
import { TitleBar } from './shell/TitleBar.tsx';
import { detectSlicer, SLICER_KINDS, slicersFor } from './slicerKinds.ts';
import styles from './App.module.css';

type Origin = 'drop' | 'os';
type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'choose'; project: InspectResult; origin: Origin }
  | { kind: 'merge'; project: InspectResult; target: SavedPrinter }
  | { kind: 'review'; project: InspectResult; target: SavedPrinter }
  | { kind: 'converting'; project: InspectResult; target: SavedPrinter }
  | { kind: 'done'; project: InspectResult; result: ConvertResult; target: SavedPrinter; opened: boolean; elapsed?: number; launchError?: string }
  | { kind: 'report'; result: ConvertResult; back: Stage }
  | { kind: 'history' }
  | { kind: 'settings' };

const api = window.desktop;
const NUMBER_KEYS = 9;

/** Mirrors the main process: which saved printer a new file is for, or undefined to ask. */
function dropPrinter(settings: Settings): SavedPrinter | undefined {
  if (settings.dropTarget === 'ask' && settings.printers.length > 1) return undefined;
  const model = settings.dropTarget === 'default' ? settings.defaultPrinter : settings.printer;
  return settings.printers.find((p) => p.model === model) ?? { model: settings.printer!, slicer: settings.slicer };
}

export function App() {
  return <I18nProvider locale="en"><Main /></I18nProvider>;
}

function Main() {
  const t = useT(DESKTOP_MESSAGES);
  const [state, setState] = useState<AppState>();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<AppEvent[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { void api.getState().then(setState); }, []);
  useEffect(() => { if (state) applyAccent(state.settings.accent); }, [state?.settings.accent]);
  // Conversions can also finish outside this window (Finder, browser extension); refresh whenever the home screen shows.
  useEffect(() => { if (stage.kind === 'idle' || stage.kind === 'done' || stage.kind === 'history') void api.listHistory().then(setHistory); }, [stage]);
  useEffect(() => api.onEvent((event) => setPending((queue) => [...queue, event])), []);
  // Events from the OS fast path wait until the first-run question is answered.
  useEffect(() => {
    const event = pending[0];
    if (!event || !state?.settings.printer) return;
    setPending((queue) => queue.slice(1));
    if (event.kind === 'open-project') void open(event.path, 'os');
    else if (event.kind === 'show-result') {
      const printer = state.printers.find((p) => p.displayName === event.result.report.target.printer);
      const target = state.settings.printers.find((p) => p.model === printer?.id) ?? dropPrinter(state.settings)!;
      setStage({ kind: 'done', project: event.project, result: event.result, target, opened: !event.launchError && state.settings.openAfterConvert, ...(event.launchError && { launchError: event.launchError }) });
    } else if (event.kind === 'settings-changed') void api.getState().then(setState);
    else setError(event.message);
  }, [pending, state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !state?.settings.printer) return;
      if (e.key.toLowerCase() === 'o') { e.preventDefault(); void browse(); return; }
      const n = Number(e.key);
      const saved = state.settings.printers[n - 1];
      if (n >= 1 && n <= NUMBER_KEYS && saved && stage.kind === 'idle') { e.preventDefault(); void choosePrinter(saved.model); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!state) return null;
  const save = async (patch: Partial<Settings>) => setState(await api.saveSettings(patch));
  const locate = async (kind: Settings['slicer']) => setState(await api.pickSlicer(kind));
  const printerDef = (id: PrinterId) => state.printers.find((p) => p.id === id)!;
  const choosePrinter = (printer: PrinterId) => save({ printer });
  const addPrinter = (printer: PrinterId) => save({ printer, slicer: detectSlicer(slicersFor(state.printers, printer), state.slicers) });
  const replacePrinter = (printer: PrinterId) => save({ printer, slicer: detectSlicer(slicersFor(state.printers, printer), state.slicers), printers: [], defaultPrinter: printer });

  async function browse() {
    const path = await api.pickFile();
    if (path) await open(path, 'drop');
  }

  async function open(path: string, origin: Origin) {
    setError(undefined);
    setStage({ kind: 'reading' });
    const r = await api.inspect(path).catch((e: Error) => ({ ok: false as const, error: e.message }));
    if (!r.ok) { setError(r.error); setStage({ kind: 'idle' }); return; }
    const target = dropPrinter(state!.settings);
    if (target) proceed(r.value, target, origin);
    else setStage({ kind: 'choose', project: r.value, origin });
  }

  /** A file for a known printer: straight through unless colours need merging (or the user wants to review OS-opened files). */
  function proceed(project: InspectResult, target: SavedPrinter, origin: Origin) {
    const printer = printerDef(target.model);
    const used = project.filaments.filter((f) => f.used);
    if (origin === 'os' && state!.settings.openMode === 'review') setStage({ kind: 'review', project, target });
    else if (used.length > printer.slots.count && !state!.settings.autoCombine) setStage({ kind: 'merge', project, target });
    else void convert(project, target, suggestFilamentMap(used, printer.slots.count), state!.settings.openAfterConvert);
  }

  async function convert(project: InspectResult, target: SavedPrinter, filamentMap: Record<number, number>, openAfter: boolean) {
    setError(undefined);
    setStage({ kind: 'converting', project, target });
    const started = performance.now();
    const r = await api.convert({ path: project.path, printer: target.model, slicer: target.slicer, filamentMap }).catch((e: Error) => ({ ok: false as const, error: e.message }));
    if (!r.ok) { setError(r.error); setStage({ kind: 'idle' }); return; }
    const elapsed = (performance.now() - started) / 1000;
    let launchError: string | undefined;
    if (openAfter) {
      const launched = await api.openInSlicer(r.value.outputPath, target.slicer);
      if (!launched.ok) launchError = launched.error;
    }
    setStage({ kind: 'done', project, result: r.value, target, opened: openAfter && !launchError, elapsed, ...(launchError && { launchError }) });
  }

  const historyActions = (back: Stage) => ({
    onOpen: async (e: HistoryEntry) => { const r = await api.openInSlicer(e.outputPath, state.settings.slicer); if (!r.ok) setError(r.error); },
    onShow: (e: HistoryEntry) => api.showInFolder(e.outputPath),
    onReport: async (e: HistoryEntry) => {
      const result = await api.historyReport(e.id);
      if (result) setStage({ kind: 'report', result, back });
      else setError('The report for this conversion is no longer available.');
    },
    onSource: (e: HistoryEntry) => api.openSourcePage(e.id),
    onRemove: async (e: HistoryEntry, trash: boolean) => setHistory(await api.removeHistory(e.id, trash)),
  });

  const convertActions = (project: InspectResult, target: SavedPrinter) => (map: Record<number, number>) => {
    const slicerName = SLICER_KINDS[target.slicer].name;
    const installed = state.slicers.some((s) => s.kind === target.slicer);
    return (
      <>
        <button type="button" onClick={() => setStage({ kind: 'idle' })}>{t.actions.cancel}</button>
        {state.settings.openAfterConvert && installed
          ? <button type="button" className="primary" onClick={() => void convert(project, target, map, true)}>{t.actions.convertOpen(slicerName)}</button>
          : <button type="button" className="primary" onClick={() => void convert(project, target, map, false)}>{t.actions.convert}</button>}
      </>
    );
  };

  const firstRun = !state.settings.printer;
  const accepting = !firstRun && (stage.kind === 'idle' || stage.kind === 'done');
  const target = 'target' in stage ? stage.target : undefined;
  const pipelineState = target ? { ...state, settings: { ...state.settings, printer: target.model, slicer: target.slicer } } : state;

  return (
    <div
      className={styles.app}
      onDragOver={(e) => { e.preventDefault(); if (accepting) setDragging(true); }}
      onDragLeave={(e) => { if (!e.relatedTarget) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && accepting) void open(api.pathForFile(file), 'drop');
      }}
    >
      <TitleBar
        section={stage.kind === 'history' || stage.kind === 'settings' ? stage.kind : 'convert'}
        onHistory={() => setStage({ kind: 'history' })}
        onSettings={() => setStage({ kind: 'settings' })}
        {...(firstRun && { minimal: true })}
      />
      {firstRun && <FirstRun state={state} onDone={(patch) => void save(patch)} onLocate={locate} />}
      {!firstRun && stage.kind === 'idle' && (
        <>
          {error && <div role="alert" className={`${styles.error} ${styles.inset}`}>{error}</div>}
          <Home
            state={state}
            history={history}
            dragging={dragging}
            onOpenFile={() => void browse()}
            onPrinter={(p) => void choosePrinter(p)}
            onAddPrinter={(p) => void addPrinter(p)}
            onReplacePrinter={(p) => void replacePrinter(p)}
            onSlicer={(slicer) => void save({ slicer })}
            onManageSlicers={() => setStage({ kind: 'settings' })}
            onHistory={() => setStage({ kind: 'history' })}
          />
        </>
      )}
      {!firstRun && stage.kind !== 'idle' && stage.kind !== 'history' && stage.kind !== 'settings' && (
        <Pipeline
          state={pipelineState}
          phase={phaseOf(stage)}
          project={projectOf(stage)}
          needsInput={stage.kind === 'merge' || stage.kind === 'choose'}
          opened={stage.kind === 'done' && stage.opened}
          onPrinter={(p) => void choosePrinter(p)}
          onSlicer={(slicer) => void save({ slicer })}
          onManageSlicers={() => setStage({ kind: 'settings' })}
          onOpenFile={() => void browse()}
          onCloseProject={() => setStage({ kind: 'idle' })}
        />
      )}
      {!firstRun && stage.kind !== 'idle' && (
        <main className={styles.main}>
          {error && <div role="alert" className={styles.error}>{error}</div>}
          {stage.kind === 'reading' && <p className={styles.busy} aria-live="polite">{t.busy.reading}</p>}
          {stage.kind === 'converting' && <p className={styles.busy} aria-live="polite">{t.busy.converting}</p>}
          {stage.kind === 'choose' && (
            <ChoosePrinter
              state={state}
              onChoose={(saved) => { void save({ printer: saved.model }); proceed(stage.project, saved, stage.origin); }}
              onCancel={() => setStage({ kind: 'idle' })}
            />
          )}
          {stage.kind === 'merge' && <MergeStep project={stage.project} printer={printerDef(stage.target.model)} actions={convertActions(stage.project, stage.target)} />}
          {stage.kind === 'review' && (
            <ConversionView
              project={stage.project}
              printer={printerDef(stage.target.model)}
              onCancel={() => setStage({ kind: 'idle' })}
              renderActions={convertActions(stage.project, stage.target)}
            />
          )}
          {stage.kind === 'done' && (
            <DoneView
              project={stage.project}
              result={stage.result}
              printer={printerDef(stage.target.model)}
              elapsed={stage.elapsed}
              launchError={stage.launchError}
              openLabel={stage.opened ? undefined : t.done.openIn(SLICER_KINDS[stage.target.slicer].name)}
              onOpen={async () => {
                const r = await api.openInSlicer(stage.result.outputPath, stage.target.slicer);
                if (r.ok) setStage({ ...stage, opened: true });
                else setError(r.error);
              }}
              onShow={() => api.showInFolder(stage.result.outputPath)}
              onReport={() => setStage({ kind: 'report', result: stage.result, back: stage })}
              onNext={() => setStage({ kind: 'idle' })}
            />
          )}
          {stage.kind === 'history' && (
            <>
              <div className={styles.pageHead}>
                <button type="button" onClick={() => setStage({ kind: 'idle' })}>{t.nav.convert}</button>
              </div>
              <HistoryList title="History" entries={history} emptyText="No conversions yet. Projects you convert, from here, Finder or the browser extension, appear here." {...historyActions({ kind: 'history' })} />
            </>
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
            <ReportView report={stage.result.report} onBack={() => setStage(stage.back)} onExport={(format) => api.exportReport(stage.result, format)} />
          )}
        </main>
      )}
    </div>
  );
}

function phaseOf(stage: Stage): Phase {
  switch (stage.kind) {
    case 'reading': return 'reading';
    case 'choose': case 'merge': case 'review': return 'review';
    case 'converting': return 'converting';
    case 'done': case 'report': return 'done';
    default: return 'idle';
  }
}

function projectOf(stage: Stage): InspectResult | undefined {
  if (stage.kind === 'report') return projectOf(stage.back);
  return 'project' in stage ? stage.project : undefined;
}
