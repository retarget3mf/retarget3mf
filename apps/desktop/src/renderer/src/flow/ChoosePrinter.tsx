import { modelName, slotsLabel, UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { AppState, SavedPrinter } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import styles from './Flow.module.css';

interface Props { state: AppState; onChoose: (printer: SavedPrinter) => void; onCancel: () => void }

/** "Ask every time": the saved printers, one click each. */
export function ChoosePrinter({ state, onChoose, onCancel }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const tp = useT(UI_MESSAGES).printer;
  return (
    <section className={styles.narrow} aria-labelledby="choose-title">
      <h2 id="choose-title" className={styles.h2}>{t.choose.title}</h2>
      <p className={styles.muted}>{t.choose.sub}</p>
      <div className={styles.choices}>
        {state.settings.printers.map((saved) => {
          const p = state.printers.find((x) => x.id === saved.model)!;
          return (
            <button key={p.id} type="button" className={styles.choice} onClick={() => onChoose(saved)}>
              <strong>{modelName(p)}</strong>
              <span className={styles.muted}>{p.vendor} · {slotsLabel(tp, p)}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.actions}><button type="button" onClick={onCancel}>{t.actions.cancel}</button></div>
    </section>
  );
}
