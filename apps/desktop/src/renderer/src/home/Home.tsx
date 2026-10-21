import type { PrinterId } from '@retarget3mf/core';
import { Dropdown, modelName, PrinterSelect, slotsLabel, UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { AppState, HistoryEntry, SlicerKind } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import { shortcut } from '../shell/Pipeline.tsx';
import { SlicerIcon } from '../shell/SlicerIcon.tsx';
import { Arrow, StageBody, stageClass } from '../shell/Stage.tsx';
import { SLICER_KINDS, slicersFor } from '../slicerKinds.ts';
import styles from './Home.module.css';

interface Props {
  state: AppState;
  history: HistoryEntry[];
  dragging: boolean;
  onOpenFile: () => void;
  onPrinter: (printer: PrinterId) => void;
  /** One saved printer: the card's menu swaps it for another. */
  onReplacePrinter: (printer: PrinterId) => void;
  onAddPrinter: (printer: PrinterId) => void;
  onSlicer: (slicer: SlicerKind) => void;
  onManageSlicers: () => void;
  onHistory: () => void;
}

const RECENT = 3;
const stamp = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Returning home: the drop zone is the only open step; printer and slicer are small saved cards (or a list with 2+ printers). */
export function Home({ state, history, dragging, onOpenFile, onPrinter, onReplacePrinter, onAddPrinter, onSlicer, onManageSlicers, onHistory }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const tu = useT(UI_MESSAGES);
  const { settings } = state;
  const printer = state.printers.find((p) => p.id === settings.printer)!;
  const several = settings.printers.length > 1;
  const install = state.slicers.find((s) => s.kind === settings.slicer);
  const slicerName = SLICER_KINDS[settings.slicer].name;
  const others = state.printers.filter((p) => !settings.printers.some((s) => s.model === p.id));

  const addPrinter = (
    <PrinterSelect
      printers={others}
      value={undefined}
      onChange={onAddPrinter}
      triggerClassName={several ? styles.addRow : styles.addLink}
      renderTrigger={() => t.home.addPrinter}
    />
  );

  return (
    <div className={styles.home}>
      <div className={`${styles.grid} ${several ? styles.several : ''}`}>
        <button type="button" className={`${styles.zone} ${dragging ? styles.over : ''}`} onClick={onOpenFile} aria-label={tu.drop.title}>
          <span className={styles.label}>{t.stage.source}</span>
          <span className={styles.title}>{tu.drop.title}</span>
          <span className={styles.body}>{tu.drop.body}</span>
          <span className={styles.body}>{t.source.orOpen} <span className={styles.link}>{tu.drop.browse.toLowerCase()}</span> {shortcut('O')}</span>
        </button>
        <Arrow />
        <div className={styles.column}>
          {several ? (
            <>
              <span className={styles.label}>{t.stage.printer}</span>
              <div className={styles.segmented} role="radiogroup" aria-label={tu.printer.label}>
                {settings.printers.map((saved, i) => {
                  const p = state.printers.find((x) => x.id === saved.model)!;
                  const selected = p.id === printer.id;
                  return (
                    <button key={p.id} type="button" role="radio" aria-checked={selected} className={styles.segment} onClick={() => onPrinter(p.id)}>
                      <span className={styles.grow}><strong>{modelName(p)}</strong><span className={styles.sub}>{slotsLabel(tu.printer, p)}</span></span>
                      {i < 9 && <span className={styles.key}>{shortcut(String(i + 1))}</span>}
                    </button>
                  );
                })}
                {addPrinter}
              </div>
            </>
          ) : (
            <>
              <PrinterSelect
                printers={state.printers}
                value={printer.id}
                onChange={onReplacePrinter}
                triggerClassName={stageClass('idle')}
                renderTrigger={() => <StageBody label={t.stage.printer} note={t.stage.saved} value={modelName(printer)} chevron />}
              />
              <span className={styles.help}>{t.home.usedForEvery}</span>
              {addPrinter}
            </>
          )}
        </div>
        <Arrow />
        <div className={styles.column}>
          {several && <span className={styles.label}>{t.stage.slicer}</span>}
          <Dropdown
            label="Slicer"
            value={settings.slicer}
            groups={[{ options: slicersFor(state.printers, printer.id).map((kind) => {
              const found = state.slicers.find((s) => s.kind === kind);
              return { value: kind, label: SLICER_KINDS[kind].name, icon: <SlicerIcon install={found} kind={kind} size={20} />, ...(!found && { note: t.slicerState.missing, muted: true }) };
            }) }]}
            onChange={(kind) => (state.slicers.some((s) => s.kind === kind) ? onSlicer(kind) : onManageSlicers())}
            action={{ label: t.manageSlicers, onSelect: onManageSlicers }}
            triggerClassName={stageClass('idle')}
            renderTrigger={() => (several
              ? <StageBody icon={<SlicerIcon install={install} kind={settings.slicer} size={32} />} label="" value={slicerName} sub={t.home.followsPrinter} />
              : <StageBody label={t.stage.slicer} note={t.stage.saved} value={<span className={styles.inline}><SlicerIcon install={install} kind={settings.slicer} size={24} />{slicerName}</span>} chevron />)}
          />
          {!several && <span className={styles.help}>{install ? t.home.opensAfter : t.actions.slicerMissing}</span>}
        </div>
      </div>
      {history.length > 0 && (
        <section className={styles.recent} aria-label={t.home.recent}>
          <div className={styles.recentHead}><span>{t.home.recent}</span><button type="button" onClick={onHistory}>{t.home.viewAll}</button></div>
          {history.slice(0, RECENT).map((h) => (
            <div key={h.id} className={styles.recentRow}>
              <span className={styles.name}>{h.title}</span>
              <span className={styles.sub}>{h.origin?.siteName ?? h.sourceSlicer}</span>
              <span>{h.printer.replace(/^\S+ /, '')} · {h.slicer}</span>
              <span className={styles.date}>{stamp(h.createdAt)}</span>
              <span className={styles.warn}>{h.warnings > 0 ? t.home.warnings(h.warnings) : ''}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
