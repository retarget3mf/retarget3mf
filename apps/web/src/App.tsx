import { useEffect, useState } from 'react';
import type { PrinterId, SlicerId } from '@retarget3mf/core';
import { PRINTERS } from '@retarget3mf/profiles/printers';
import {
  ConversionView, DropZone, Dropdown, I18nProvider, LOCALES, LOCALE_NAMES, PrinterPicker, ReportView, ThemeSwitch,
  detectLocale, useT, type Locale, type ProjectSummary, type Theme,
} from '@retarget3mf/ui';
import { convertProject, ConverterError, inspectProject } from './converter.ts';
import { outputName, saveFile, stored } from './files.ts';
import { WEB_MESSAGES } from './messages.ts';
import type { Converted } from './protocol.ts';
import styles from './App.module.css';

const SLICER_NAMES: Record<SlicerId, string> = { flashstudio: 'Flash Studio', orca: 'OrcaSlicer', bambustudio: 'Bambu Studio' };

interface Loaded { project: ProjectSummary; bytes: Uint8Array }
type Stage =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | ({ kind: 'review' } & Loaded)
  | ({ kind: 'done' | 'report'; result: Converted; fileName: string } & Loaded);

const initialLocale = (): Locale => {
  const saved = stored.get('locale');
  return (LOCALES as readonly string[]).includes(saved ?? '') ? (saved as Locale) : detectLocale(navigator.languages);
};
const initialPrinter = () => PRINTERS.find((p) => p.id === stored.get('printer'))?.id;

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  return (
    <I18nProvider locale={locale}>
      <Page locale={locale} onLocale={(l) => { stored.set('locale', l); setLocale(l); }} />
    </I18nProvider>
  );
}

function Page({ locale, onLocale }: { locale: Locale; onLocale: (l: Locale) => void }) {
  const t = useT(WEB_MESSAGES);
  const [theme, setTheme] = useState<Theme>(() => (stored.get('theme') as Theme | undefined) ?? 'system');
  const [printerId, setPrinterId] = useState<PrinterId | undefined>(initialPrinter);
  const [chosenSlicer, setSlicer] = useState<SlicerId | undefined>(() => stored.get('slicer') as SlicerId | undefined);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string>();

  const printer = PRINTERS.find((p) => p.id === printerId);
  const slicer = printer && (printer.slicers.includes(chosenSlicer!) ? chosenSlicer! : printer.slicers[0]!);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  // Plate thumbnails are object URLs; release them when the project changes.
  const plates = 'project' in stage ? stage.project.plates : undefined;
  useEffect(() => () => plates?.forEach((p) => p.thumbnail && URL.revokeObjectURL(p.thumbnail)), [plates]);

  const choosePrinter = (id: PrinterId) => { stored.set('printer', id); setPrinterId(id); };
  const chooseSlicer = (s: SlicerId) => { stored.set('slicer', s); setSlicer(s); };
  const chooseTheme = (th: Theme) => { stored.set('theme', th); setTheme(th); };
  const fail = (e: unknown) => setError(e instanceof ConverterError && e.userMessage ? e.userMessage : t.failed);

  async function open(file: File) {
    setError(undefined);
    setStage({ kind: 'busy', message: t.reading });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = await inspectProject(bytes);
      const project: ProjectSummary = {
        ...info,
        fileName: file.name,
        plates: info.plates.map((p) => ({ id: p.id, ...(p.thumbnail && { thumbnail: URL.createObjectURL(new Blob([p.thumbnail as BlobPart], { type: 'image/png' })) }) })),
      };
      setStage({ kind: 'review', project, bytes });
    } catch (e) {
      fail(e);
      setStage({ kind: 'idle' });
    }
  }

  async function convert(loaded: Loaded, filamentMap: Record<number, number>) {
    if (!printer || !slicer) return;
    setError(undefined);
    setStage({ kind: 'busy', message: t.converting });
    try {
      const result = await convertProject(loaded.bytes, printer.id, slicer, filamentMap);
      setStage({ project: loaded.project, bytes: loaded.bytes, kind: 'done', result, fileName: outputName(loaded.project.fileName, printer) });
    } catch (e) {
      fail(e);
      setStage({ project: loaded.project, bytes: loaded.bytes, kind: 'review' });
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <strong className={styles.brand}>Retarget3MF</strong>
        <span className={styles.spacer} />
        <ThemeSwitch value={theme} onChange={chooseTheme} />
        <label className={styles.language}>
          <span className={styles.visuallyHidden}>{t.language}</span>
          <select value={locale} onChange={(e) => onLocale(e.target.value as Locale)} aria-label={t.language}>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </label>
      </header>

      <main className={styles.main}>
        {error && <div role="alert" className={styles.error}>{error}</div>}

        {stage.kind === 'idle' && (
          <>
            <p className={styles.tagline}>{t.tagline}</p>
            <section className={styles.card} aria-labelledby="step-printer">
              {printer && !pickerOpen ? (
                <div className={styles.chosen}>
                  <h2 id="step-printer">{t.yourPrinter}</h2>
                  <strong>{printer.displayName}</strong>
                  <button type="button" onClick={() => setPickerOpen(true)}>{t.change}</button>
                </div>
              ) : (
                <>
                  <h2 id="step-printer">{t.stepPrinter}</h2>
                  <PrinterPicker printers={PRINTERS} value={printerId} onChange={(id) => { choosePrinter(id); setPickerOpen(false); }} />
                </>
              )}
            </section>
            <h2 className={styles.step}>{t.stepFile}</h2>
            <DropZone onFile={(f) => void open(f)} disabled={!printer} />
            <p className={styles.privacy}>{t.privacy}</p>
          </>
        )}

        {stage.kind === 'busy' && <p className={styles.busy} aria-live="polite">{stage.message}</p>}

        {stage.kind === 'review' && printer && (
          <ConversionView
            key={printer.id}
            project={stage.project}
            printer={printer}
            onCancel={() => setStage({ kind: 'idle' })}
            renderActions={(map) => (
              <>
                {/* The output differs per slicer (option names, filament presets); it defaults to the printer maker's own. */}
                {slicer && (
                  <span className={styles.openWith}>
                    {t.openWith}
                    <Dropdown label={t.slicer} value={slicer} groups={[{ options: printer.slicers.map((s) => ({ value: s, label: SLICER_NAMES[s] })) }]} onChange={chooseSlicer} />
                  </span>
                )}
                <button className="primary" onClick={() => void convert(stage, map)}>{t.convert}</button>
              </>
            )}
          />
        )}

        {stage.kind === 'done' && (
          <section className={styles.card} aria-labelledby="done-title">
            <h2 id="done-title">{t.converted(stage.result.title || stage.project.title || stage.project.fileName, stage.result.report.target.printer)}</h2>
            <button className="primary" onClick={() => saveFile(stage.result.output as BlobPart, stage.fileName, 'model/3mf')}>{t.download(stage.fileName)}</button>
            <p className={styles.hint}>{t.hint(stage.result.report.target.slicer)}</p>
            {stage.result.report.warnings.length > 0 && (
              <>
                <h3>{t.warnings}</h3>
                <ul className={styles.warnings}>{stage.result.report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </>
            )}
            <div className={styles.actions}>
              <button onClick={() => setStage({ ...stage, kind: 'report' })}>{t.viewReport}</button>
              <button onClick={() => setStage({ kind: 'idle' })}>{t.another}</button>
            </div>
          </section>
        )}

        {stage.kind === 'report' && (
          <ReportView
            report={stage.result.report}
            onBack={() => setStage({ ...stage, kind: 'done' })}
            onExport={(format) => {
              const base = stage.fileName.replace(/\.3mf$/i, '');
              if (format === 'md') saveFile(stage.result.markdown, `${base} - report.md`, 'text/markdown');
              else saveFile(JSON.stringify(stage.result.report, null, 2), `${base} - report.json`, 'application/json');
            }}
          />
        )}
      </main>
    </div>
  );
}
