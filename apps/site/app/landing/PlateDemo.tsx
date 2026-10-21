import { useT } from '@retarget3mf/ui';
import { LANDING_MESSAGES } from './messages';
import styles from './landing.module.css';

// Seven objects on a plate, as [left, top, width, height] in % of the plate, with the author's colours.
const OBJECTS: [number, number, number, number][] = [
  [6.67, 10, 31.67, 30], [41.67, 10, 21.67, 30], [68.33, 10, 25, 30], [6.67, 46, 18.33, 44], [28.33, 46, 36.67, 20], [28.33, 70, 36.67, 20], [68.33, 46, 25, 44],
];
const SOURCE = ['#1D1D1F', '#D8352A', '#F2F2EE', '#3A3B3E', '#8C9096', '#E9E2CF', '#1D1D1F'];
/** The same objects after merging six colours onto four slots: dark grey joins black, cream joins white. */
const TARGET = ['#1D1D1F', '#D8352A', '#F2F2EE', '#1D1D1F', '#8C9096', '#F2F2EE', '#1D1D1F'];
// Six source colours → four slots: [y of the colour, y of its slot].
const CURVES: [string, number, number][] = [['#1D1D1F', 14, 27], ['#3A3B3E', 40, 27], ['#F2F2EE', 66, 66], ['#E9E2CF', 92, 66], ['#D8352A', 118, 105], ['#8C9096', 144, 144]];
const SLOTS: [string, number][] = [['#1D1D1F', 15], ['#F2F2EE', 54], ['#D8352A', 93], ['#8C9096', 132]];

function Plate({ colours, label, target }: { colours: string[]; label: string; target?: boolean }) {
  return (
    <div className={`${styles.plate} ${target ? styles.plateTarget : ''}`}>
      {OBJECTS.map(([l, t, w, h], i) => <span key={i} className={styles.object} style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, background: colours[i] }} />)}
      <span className={styles.plateLabel}>{label}</span>
    </div>
  );
}

export function PlateDemo({ from, to, slicer }: { from: string; to: string; slicer: string }) {
  const t = useT(LANDING_MESSAGES).plate;
  return (
    <figure className={styles.demo}>
      <figcaption className={styles.hidden}>{t.caption}</figcaption>
      <div className={styles.demoRow} aria-hidden>
        <div className={styles.demoSide}>
          <Plate colours={SOURCE} label={t.label} />
          <div><div className={styles.mono}>{t.madeFor}</div><div className={styles.demoName}>{from}</div></div>
        </div>
        <div className={styles.demoMiddle}>
          <svg viewBox="0 0 200 170" className={styles.curves}>
            {CURVES.map(([c, y1, y2]) => (
              <g key={y1}>
                <path d={`M18 ${y1} C 100 ${y1}, 100 ${y2}, 182 ${y2}`} fill="none" stroke="var(--edge)" strokeWidth="8" strokeLinecap="round" />
                <path d={`M18 ${y1} C 100 ${y1}, 100 ${y2}, 182 ${y2}`} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" opacity=".9" />
              </g>
            ))}
            {CURVES.map(([c, y]) => <circle key={y} cx="12" cy={y} r="8" fill={c} stroke="var(--edge)" strokeWidth="1.5" />)}
            {SLOTS.map(([c, y]) => <rect key={y} x="178" y={y} width="20" height="24" rx="5" fill={c} stroke="var(--accent)" strokeWidth="2" />)}
          </svg>
          <div className={`${styles.mono} ${styles.ink}`}>{t.colours(6)} → {t.slots(4)}</div>
        </div>
        <div className={styles.demoSide}>
          <Plate colours={TARGET} label={t.label} target />
          <div><div className={`${styles.mono} ${styles.ink}`}>{t.retargeted}</div><div className={styles.demoName}>{to}</div></div>
        </div>
      </div>
      <div className={styles.chips}>
        {t.chips.map((c) => <span key={c} className={styles.chip}><span className={styles.ink}>✓</span>{c}</span>)}
        <span className={styles.grow} />
        <span className={styles.opens}>{t.opens(slicer)}</span>
      </div>
    </figure>
  );
}
