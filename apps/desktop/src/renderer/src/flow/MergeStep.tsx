import { useState, type ReactNode } from 'react';
import type { PrinterDefinition } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import { FilamentRows, UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { InspectResult } from '../../../shared/api.ts';
import styles from './Flow.module.css';

interface Props {
  project: InspectResult;
  printer: PrinterDefinition;
  /** Buttons for the current map (Cancel, Convert…). */
  actions: (map: Record<number, number>) => ReactNode;
}

/** The one question asked when a project has more colours than the printer has slots. */
export function MergeStep({ project, printer, actions }: Props) {
  const t = useT(UI_MESSAGES).conversion;
  const used = project.filaments.filter((f) => f.used);
  const [map, setMap] = useState(() => suggestFilamentMap(used, printer.slots.count));
  return (
    <section className={styles.narrow} aria-labelledby="merge-title">
      <h2 id="merge-title" className={styles.h2}>{t.tooManyTitle(used.length, printer.slots.count, printer.slots.kind)}</h2>
      <p className={styles.muted}>{t.combined}</p>
      <FilamentRows filaments={project.filaments} printer={printer} map={map} onChange={setMap} />
      <p className={styles.small}>{t.shared}</p>
      <div className={styles.actions}>{actions(map)}</div>
    </section>
  );
}
