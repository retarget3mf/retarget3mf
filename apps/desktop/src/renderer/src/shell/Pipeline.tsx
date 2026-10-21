import { Dropdown, modelName, PrinterSelect, slotsLabel, UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { AppState, InspectResult, SlicerKind } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import { SLICER_KINDS, slicersFor } from '../slicerKinds.ts';
import { SlicerIcon } from './SlicerIcon.tsx';
import { Arrow, StageBody, stageClass, StageStrip, type StageState } from './Stage.tsx';
import styles from './Stage.module.css';

export type Phase = 'idle' | 'reading' | 'review' | 'converting' | 'done';

interface Props {
  state: AppState;
  phase: Phase;
  project?: InspectResult | undefined;
  /** The project has more colours than the printer has slots. */
  needsInput?: boolean;
  /** The converted file was opened in the slicer. */
  opened?: boolean;
  onPrinter: (printer: AppState['printers'][number]['id']) => void;
  onSlicer: (slicer: SlicerKind) => void;
  onManageSlicers: () => void;
  onOpenFile: () => void;
  onCloseProject: () => void;
}

export const shortcut = (key: string) => (window.desktop.platform === 'darwin' ? `⌘${key}` : `Ctrl+${key}`);

export function Pipeline({ state, phase, project, needsInput, opened, onPrinter, onSlicer, onManageSlicers, onOpenFile, onCloseProject }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const tu = useT(UI_MESSAGES);
  const tp = tu.printer;
  const printer = state.printers.find((p) => p.id === state.settings.printer)!;
  const slicerName = SLICER_KINDS[state.settings.slicer].name;
  const install = state.slicers.find((s) => s.kind === state.settings.slicer);
  const done = phase === 'done';
  const locked = phase === 'converting' || done;

  const printerState: StageState = done ? 'done' : needsInput ? 'needs' : phase === 'review' || phase === 'converting' ? 'active' : 'idle';
  const printerLabel = `${t.stage.printer}${printerState === 'done' ? ' ✓' : printerState === 'needs' ? ` · ${t.stage.needsInput}` : ''}`;
  const printerSub = `${printer.vendor} · ${slotsLabel(tp, printer)}`;

  const slicerOptions = slicersFor(state.printers, printer.id).map((kind) => {
    const found = state.slicers.find((s) => s.kind === kind);
    return { value: kind, label: SLICER_KINDS[kind].name, icon: <SlicerIcon install={found} kind={kind} size={20} />, ...(!found && { note: t.slicerState.missing, muted: true }) };
  });

  return (
    <StageStrip>
      {project ? (
        <div className={stageClass('done')}>
          <StageBody
            icon={<Thumb src={project.plates.find((p) => p.thumbnail)?.thumbnail} />}
            label={`${t.stage.source} ✓`}
            value={project.fileName}
            sub={`${project.sourcePrinter} · ${project.sourceSlicer} · ${t.plates(project.plates.length)}`}
          />
          {!locked && <button type="button" className={styles.close} aria-label={t.source.remove} onClick={onCloseProject}>✕</button>}
        </div>
      ) : (
        <button type="button" className={stageClass('drop')} onClick={onOpenFile} disabled={phase === 'reading'} aria-label={tu.drop.title}>
          <StageBody
            large
            label={t.stage.source}
            value={tu.drop.title}
            sub={<>{t.source.orOpen} <span className={styles.link}>{tu.drop.browse.toLowerCase()}</span> {shortcut('O')}</>}
            {...(phase === 'reading' && { progress: true as const })}
          />
        </button>
      )}
      <Arrow done={Boolean(project)} />
      {locked ? (
        <div className={stageClass(printerState)}>
          <StageBody label={printerLabel} value={modelName(printer)} sub={printerSub} {...(phase === 'converting' && { progress: true as const })} />
        </div>
      ) : (
        <PrinterSelect
          printers={state.printers}
          value={printer.id}
          onChange={onPrinter}
          triggerClassName={stageClass(printerState)}
          renderTrigger={() => <StageBody large={!project} label={printerLabel} value={needsInput ? `${modelName(printer)} · ${t.slots(printer.slots.count, printer.slots.kind === 'toolheads')}` : modelName(printer)} sub={printerSub} chevron />}
        />
      )}
      <Arrow done={done} />
      {locked ? (
        <div className={stageClass(done ? (opened ? 'active' : 'done') : 'idle')}>
          <StageBody
            icon={<SlicerIcon install={install} kind={state.settings.slicer} size={32} />}
            label={`${t.stage.slicer}${done ? ' ✓' : ''}`}
            value={done && opened ? t.slicerState.opened(slicerName) : slicerName}
          />
        </div>
      ) : (
        <Dropdown
          label="Slicer"
          value={state.settings.slicer}
          groups={[{ options: slicerOptions }]}
          onChange={(kind) => (state.slicers.some((s) => s.kind === kind) ? onSlicer(kind) : onManageSlicers())}
          action={{ label: t.manageSlicers, onSelect: onManageSlicers }}
          triggerClassName={stageClass('idle')}
          renderTrigger={() => (
            <StageBody
              large={!project}
              icon={<SlicerIcon install={install} kind={state.settings.slicer} size={project ? 40 : 32} />}
              label={t.stage.slicer}
              value={slicerName}
              sub={install ? <span className={styles.ok}>{t.slicerState.installed}</span> : t.slicerState.missing}
              chevron
            />
          )}
        />
      )}
    </StageStrip>
  );
}

function Thumb({ src }: { src: string | undefined }) {
  return src ? <img className={styles.thumb} src={src} alt="" /> : <span className={styles.thumb} aria-hidden />;
}
