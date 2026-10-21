import { useEffect, useState } from 'react';
import type { PrinterDefinition, PrinterId, SlicerId } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import { PRINTERS, SLICER_NAMES } from '@retarget3mf/profiles/printers';
import {
  applyTheme, CoffeeIcon, Dropdown, DropZone, FilamentRows, GitHubIcon, I18nProvider, Logo, LOCALES, LOCALE_NAMES, PrinterPicker,
  ReportView, ThemeButton, UI_MESSAGES, detectLocale, useT, type Locale, type ProjectSummary, type Theme,
} from '@retarget3mf/ui';
import { issuesUrl, LINKS } from '@retarget3mf/ui/links';
import { convertProject, ConverterError, inspectProject } from './converter.ts';
import { outputName, saveFile, stored } from './files.ts';
import { WEB_MESSAGES } from './messages.ts';
import type { Converted } from './protocol.ts';
import styles from './App.module.css';

interface Loaded { project: ProjectSummary; bytes: Uint8Array }
type Stage =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | ({ kind: 'review' } & Loaded)
  | ({ kind: 'done' | 'report'; result: Converted; fileName: string } & Loaded);

/** The landing page sits one level up (the app is deployed at app/). */
const SITE = '../';
const MAX_DOTS = 8;

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
  useEffect(() => applyTheme(theme), [theme]);
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
      const fileName = outputName(loaded.project.fileName, printer);
      saveFile(result.output as BlobPart, fileName, 'model/3mf');
      setStage({ project: loaded.project, bytes: loaded.bytes, kind: 'done', result, fileName });
    } catch (e) {
      fail(e);
      setStage({ project: loaded.project, bytes: loaded.bytes, kind: 'review' });
    }
  }

  const iconLink = (href: string, label: string, icon: React.ReactNode, wide = false) => (
    <a className={`${styles.square} ${wide ? styles.wideOnly : ''}`} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>{icon}</a>
  );

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <a className={styles.brand} href={SITE}><Logo size={22} /></a>
        <span className={styles.spacer} />
        <label className={`${styles.language} ${styles.wideOnly}`}>
          <span className={styles.visuallyHidden}>{t.language}</span>
          <select value={locale} onChange={(e) => onLocale(e.target.value as Locale)} aria-label={t.language}>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </label>
        <a className={`${styles.textLink} ${styles.wideOnly}`} href={`${SITE}#download`}>{t.getDesktop}</a>
        {LINKS.support && iconLink(LINKS.support, t.coffee, <CoffeeIcon />, true)}
        {LINKS.repo && iconLink(LINKS.repo, t.github, <GitHubIcon />)}
        <ThemeButton className={styles.square} value={theme} onChange={chooseTheme} />
      </header>

      <main className={styles.main}>
        {error && <div role="alert" className={styles.error}>{error}</div>}

        {stage.kind === 'idle' && (
          <>
            {printer && !pickerOpen ? (
              <PrinterCard printer={printer} onChange={() => setPickerOpen(true)} />
            ) : (
              <section className={styles.card} aria-labelledby="step-printer">
                <h2 id="step-printer" className={styles.label}>{t.yourPrinter}</h2>
                <PrinterPicker printers={PRINTERS} value={printerId} onChange={(id) => { choosePrinter(id); setPickerOpen(false); }} />
              </section>
            )}
            <DropZone label={t.openProject} onFile={(f) => void open(f)} disabled={!printer} />
            <div className={styles.footnote}><span>{t.privacy}</span><a href={`${SITE}#how`}>{t.howItWorks}</a></div>
          </>
        )}

        {stage.kind === 'busy' && <p className={styles.busy} aria-live="polite">{stage.message}</p>}

        {stage.kind === 'review' && printer && slicer && (
          <Review key={printer.id} loaded={stage} printer={printer} slicer={slicer} onSlicer={chooseSlicer} onCancel={() => setStage({ kind: 'idle' })} onConvert={(map) => void convert(stage, map)} />
        )}

        {stage.kind === 'done' && (
          <Done
            stage={stage}
            onAnother={() => setStage({ kind: 'idle' })}
            onDownload={() => saveFile(stage.result.output as BlobPart, stage.fileName, 'model/3mf')}
            onReport={() => setStage({ ...stage, kind: 'report' })}
          />
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

function PrinterCard({ printer, onChange }: { printer: PrinterDefinition; onChange: () => void }) {
  const t = useT(WEB_MESSAGES);
  const slots = t.slots(printer.slots.count, printer.slots.kind === 'toolheads');
  return (
    <section className={`${styles.card} ${styles.printer}`} aria-labelledby="step-printer">
      <div className={styles.grow}>
        <h2 id="step-printer" className={styles.label}>{t.yourPrinter}</h2>
        <div className={styles.printerName}>{printer.displayName}</div>
        <div className={styles.meta}>
          <span className={styles.dots} aria-hidden>{Array.from({ length: Math.min(printer.slots.count, MAX_DOTS) }, (_, i) => <span key={i} />)}</span>
          {t.remembered(slots)}
        </div>
      </div>
      <button type="button" onClick={onChange}>{t.change}</button>
    </section>
  );
}

interface ReviewProps { loaded: Loaded; printer: PrinterDefinition; slicer: SlicerId; onSlicer: (s: SlicerId) => void; onCancel: () => void; onConvert: (map: Record<number, number>) => void }

function Review({ loaded, printer, slicer, onSlicer, onCancel, onConvert }: ReviewProps) {
  const t = useT(WEB_MESSAGES);
  const tc = useT(UI_MESSAGES).conversion;
  const { project } = loaded;
  const used = project.filaments.filter((f) => f.used);
  const [map, setMap] = useState(() => suggestFilamentMap(used, printer.slots.count));
  const thumbnail = project.plates.find((p) => p.thumbnail)?.thumbnail;
  return (
    <section className={`${styles.card} ${styles.flush}`} aria-labelledby="project-title">
      <div className={styles.projectHead}>
        {thumbnail ? <img className={styles.thumb} src={thumbnail} alt={tc.plate(1)} /> : <span className={styles.thumb} aria-hidden />}
        <div className={styles.grow}>
          <span className={styles.label}>{t.project}</span>
          <h2 id="project-title" className={styles.projectName}>{project.title || project.fileName}</h2>
          <div className={styles.meta}>{tc.madeFor(project.sourcePrinter, project.sourceSlicer, project.plates.length)}</div>
        </div>
        <button type="button" className={styles.link} onClick={onCancel}>{tc.chooseAnother}</button>
      </div>
      <div className={styles.body}>
        <h3 className={styles.h3}>{tc.filamentsTo(printer.displayName, printer.slots.kind)}</h3>
        {used.length > printer.slots.count && <p className={styles.warn}>{tc.tooMany(used.length, printer.slots.count, printer.slots.kind)}</p>}
        <FilamentRows filaments={project.filaments} printer={printer} map={map} onChange={setMap} />
        <p className={styles.meta}>{tc.shared}</p>
      </div>
      <div className={styles.foot}>
        {/* The output differs per slicer (option names, filament presets); it defaults to the printer maker's own. */}
        {printer.slicers.length > 1 && (
          <span className={styles.openWith}>
            {t.openWith}
            <Dropdown label={t.slicer} value={slicer} groups={[{ options: printer.slicers.map((s) => ({ value: s, label: SLICER_NAMES[s] })) }]} onChange={onSlicer} />
          </span>
        )}
        <button type="button" className="primary" onClick={() => onConvert(map)}>{t.convertDownload}</button>
      </div>
    </section>
  );
}

interface DoneProps { stage: Loaded & { result: Converted; fileName: string }; onAnother: () => void; onDownload: () => void; onReport: () => void }

function Done({ stage, onAnother, onDownload, onReport }: DoneProps) {
  const t = useT(WEB_MESSAGES);
  const { result, project } = stage;
  const printer = PRINTERS.find((p) => p.displayName === result.report.target.printer);
  const used = project.filaments.filter((f) => f.used).length;
  const kept = new Set(result.report.filaments.map((f) => f.to)).size || used;
  const colours = kept < used && printer ? t.merged(used, t.slots(kept, printer.slots.kind === 'toolheads')) : t.colours(used);
  const warnings = result.report.warnings;
  return (
    <>
      <section className={`${styles.card} ${styles.done}`} aria-labelledby="done-title">
        <div className={styles.doneHead}>
          <span className={styles.check} aria-hidden>✓</span>
          <div className={styles.grow}>
            <h2 id="done-title" className={styles.doneTitle}>{t.convertedFor(result.report.target.printer)}</h2>
            <div className={styles.meta}>
              {[result.title || project.title || project.fileName, colours, warnings.length > 0 && t.warningCount(warnings.length)].filter(Boolean).join(' · ')}
              {' · '}<button type="button" className={styles.link} onClick={onReport}>{t.viewReport}</button>
            </div>
          </div>
        </div>
        <div className={styles.file}>{t.downloaded(stage.fileName)}</div>
        {warnings.length > 0 && <ul className={styles.warn}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        <p className={styles.meta}>{t.hint(result.report.target.slicer)}</p>
        <div className={styles.actions}>
          <button type="button" className="primary" onClick={onAnother}>{t.another}</button>
          <button type="button" onClick={onDownload}>{t.downloadAgain}</button>
          {issuesUrl && <a className={styles.button} href={issuesUrl} target="_blank" rel="noreferrer">{t.reportProblem}</a>}
        </div>
      </section>
      <div className={styles.upsell}><span>{t.upsell}</span><a href={`${SITE}#download`}>{t.getDesktopLink}</a></div>
    </>
  );
}
