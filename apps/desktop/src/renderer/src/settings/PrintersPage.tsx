import type { PrinterId } from '@retarget3mf/core';
import { modelName, slotsLabel, UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { AppState, DropTarget, SavedPrinter, Settings, SlicerKind } from '../../../shared/api.ts';
import { shortcut } from '../shell/Pipeline.tsx';
import { SLICER_KINDS, slicersFor } from '../slicerKinds.ts';
import { Group, RadioRow } from './controls.tsx';
import { SETTINGS_MESSAGES } from './messages.ts';
import styles from './Settings.module.css';

interface Props { state: AppState; onChange: (patch: Partial<Settings>) => void; onAddPrinter: () => void }

const DROP_TARGETS: readonly DropTarget[] = ['last', 'default', 'ask'];

export function PrintersPage({ state, onChange, onAddPrinter }: Props) {
  const t = useT(SETTINGS_MESSAGES).printers;
  const tp = useT(UI_MESSAGES).printer;
  const { settings } = state;
  const def = (id: PrinterId) => state.printers.find((p) => p.id === id)!;

  const setSlicer = (saved: SavedPrinter, slicer: SlicerKind) => onChange({
    printers: settings.printers.map((p) => (p.model === saved.model ? { ...p, slicer } : p)),
    ...(saved.model === settings.printer && { slicer }),
  });
  const remove = (saved: SavedPrinter) => {
    const rest = settings.printers.filter((p) => p.model !== saved.model);
    const next = saved.model === settings.printer ? rest[0]! : undefined;
    onChange({ printers: rest, ...(next && { printer: next.model, slicer: next.slicer }) });
  };

  return (
    <>
      <Group title={t.mine} actions={<button type="button" className="primary" onClick={onAddPrinter}>{t.add}</button>}>
        {settings.printers.map((saved, i) => {
          const p = def(saved.model);
          const nozzle = p.id.split('-').at(-1)!;
          const menu = `printer-menu-${i}`;
          return (
            <div key={p.id} className={styles.row}>
              <div className={styles.grow}>
                <span className={styles.nameLine}><strong>{modelName(p)}</strong>{saved.model === settings.defaultPrinter && <span className={styles.badge}>{t.defaultBadge}</span>}</span>
                <span className={styles.sub}>{p.vendor} · {slotsLabel(tp, p)} · {t.nozzle(nozzle)}</span>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t.slicer}</span>
                <select value={saved.slicer} onChange={(e) => setSlicer(saved, e.target.value as SlicerKind)}>
                  {slicersFor(state.printers, p.id).map((k) => <option key={k} value={k}>{SLICER_KINDS[k].name}</option>)}
                </select>
              </label>
              <span className={styles.key}>{i < 9 ? shortcut(String(i + 1)) : ''}</span>
              <button type="button" className={styles.more} popoverTarget={menu} aria-label={t.more(modelName(p))} style={{ anchorName: `--${menu}` } as React.CSSProperties}>⋯</button>
              <div id={menu} popover="auto" className={styles.menu} style={{ positionAnchor: `--${menu}` } as React.CSSProperties}>
                <button type="button" disabled={saved.model === settings.defaultPrinter} onClick={() => onChange({ defaultPrinter: saved.model })}>{t.makeDefault}</button>
                <button type="button" disabled={settings.printers.length === 1} onClick={() => remove(saved)}>{t.remove}</button>
              </div>
            </div>
          );
        })}
        <div className={styles.note}>{t.hint}</div>
      </Group>
      <Group title={t.dropFor}>
        {DROP_TARGETS.map((target) => (
          <RadioRow
            key={target}
            name="dropTarget"
            value={target}
            current={settings.dropTarget}
            onChange={(dropTarget) => onChange({ dropTarget })}
            sub={target === 'default' && settings.defaultPrinter ? modelName(def(settings.defaultPrinter)) : t.dropTargets[target].sub}
          >
            {t.dropTargets[target].title}
          </RadioRow>
        ))}
      </Group>
    </>
  );
}
