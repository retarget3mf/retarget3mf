import { useState } from 'react';
import type { PrinterId } from '@retarget3mf/core';
import { Dropdown, modelName, PrinterSelect, slotsLabel, UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { AppState, Settings, SlicerKind } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import { detectSlicer, SLICER_KINDS, slicersFor } from '../slicerKinds.ts';
import { SlicerIcon } from './SlicerIcon.tsx';
import { StageBody, stageClass } from './Stage.tsx';
import styles from './FirstRun.module.css';

interface Props {
  state: AppState;
  onDone: (patch: Partial<Settings>, addAnother: boolean) => void;
  onLocate: (kind: SlicerKind) => void;
}

/** Asked once: the printer, and the slicer (found automatically when installed). */
export function FirstRun({ state, onDone, onLocate }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const tp = useT(UI_MESSAGES).printer;
  const [printerId, setPrinter] = useState<PrinterId>(state.printers[0]!.id);
  const kinds = slicersFor(state.printers, printerId);
  const [chosen, setSlicer] = useState<SlicerKind>();
  const slicer = chosen && kinds.includes(chosen) ? chosen : detectSlicer(kinds, state.slicers);
  const [several, setSeveral] = useState(false);
  const printer = state.printers.find((p) => p.id === printerId)!;
  const install = state.slicers.find((s) => s.kind === slicer);

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="first-run">
        <div>
          <h1 id="first-run" className={styles.title}>{t.firstRun.title}</h1>
          <p className={styles.muted}>{t.firstRun.sub}</p>
        </div>
        <div className={styles.grid}>
          <PrinterSelect
            printers={state.printers}
            value={printerId}
            onChange={setPrinter}
            triggerClassName={stageClass('idle', styles.printer)}
            renderTrigger={() => <StageBody large label={t.stage.printer} value={modelName(printer)} sub={`${printer.vendor} · ${slotsLabel(tp, printer)}`} chevron />}
          />
          <div className={stageClass('idle', styles.slicer)}>
            <div className={styles.iconArea}><SlicerIcon install={install} kind={slicer} size={80} /></div>
            <Dropdown
              label="Slicer"
              value={slicer}
              groups={[{ options: kinds.map((kind) => ({ value: kind, label: SLICER_KINDS[kind].name, icon: <SlicerIcon install={state.slicers.find((s) => s.kind === kind)} kind={kind} size={20} /> })) }]}
              onChange={setSlicer}
              triggerClassName={styles.slicerTrigger}
              renderTrigger={() => <StageBody large label={t.stage.slicer} value={SLICER_KINDS[slicer].name} chevron />}
            />
            {install
              ? <span className={styles.found}>{t.firstRun.found}</span>
              : <span className={styles.muted}>{t.firstRun.notFound} · <button type="button" className={styles.link} onClick={() => onLocate(slicer)}>{t.firstRun.locate}</button></span>}
          </div>
        </div>
        <label className={styles.check}><input type="checkbox" checked={several} onChange={(e) => setSeveral(e.target.checked)} />{t.firstRun.several}</label>
        <div className={styles.actions}>
          <button type="button" className="primary" onClick={() => onDone({ printer: printerId, slicer }, several)}>{t.firstRun.continue}</button>
        </div>
      </section>
    </div>
  );
}
