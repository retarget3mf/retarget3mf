import { useEffect, useMemo, useState } from 'react';
import { PRINTERS, type PrinterDefinition } from '@retarget3mf/profiles/printers';
import { ExtensionPopup, groupByVendor, modelName, useT } from '@retarget3mf/ui';
import { LINKS, releasesUrl } from '@retarget3mf/ui/links';
import { LANDING_MESSAGES } from './messages';
import styles from './landing.module.css';

export const BRANDS = groupByVendor(PRINTERS);

export function HowItWorks() {
  const t = useT(LANDING_MESSAGES).how;
  return (
    <section id="how" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>{t.title}</h2>
        <ol className={styles.steps}>
          {t.steps(PRINTERS.length).map((s, i) => (
            <li key={s.title}><span className={`${styles.mono} ${styles.ink}`}>{String(i + 1).padStart(2, '0')}</span><strong>{s.title}</strong><span className={styles.muted}>{s.body}</span></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Printers() {
  const t = useT(LANDING_MESSAGES).printers;
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const capability = (p: PrinterDefinition) => (p.slots.kind === 'toolheads' ? t.heads(p.slots.count) : p.slots.count > 1 ? t.colours(p.slots.count) : t.single);
  const shown = BRANDS.map(([vendor, list]) => [vendor, list.filter((p) => !q || p.displayName.toLowerCase().includes(q))] as const).filter(([, list]) => list.length);
  return (
    <section id="printers" className={`${styles.section} ${styles.alt}`}>
      <div className={styles.wrap}>
        <div className={styles.headRow}>
          <div><h2 className={styles.h2}>{t.title}</h2><p className={styles.muted}>{t.sub(PRINTERS.length, BRANDS.length)}</p></div>
          <input type="search" className={styles.search} placeholder={t.search} aria-label={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {shown.length === 0 ? <p className={styles.muted}>{t.none}</p> : (
          <div className={styles.brands}>
            {shown.map(([vendor, list]) => (
              <div key={vendor} className={styles.brand}>
                <h3 className={styles.mono}>{vendor.toUpperCase()}</h3>
                <ul>{list.map((p) => <li key={p.id}><span>{modelName(p)}</span><span className={p.slots.count > 1 ? styles.ink : styles.muted}>{capability(p)}</span></li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const DEMO_PRINTER = PRINTERS.find((p) => p.id === 'qidi-q1-pro-0.4')!;

export function Extension() {
  const t = useT(LANDING_MESSAGES).extension;
  const [printer, setPrinter] = useState(DEMO_PRINTER.id);
  const [slicer, setSlicer] = useState(DEMO_PRINTER.slicers.at(-1)!);
  const [offer, setOffer] = useState(true);
  // The store page once listed; until then the release download (unpacked install) when published.
  const install = (store: string, label: string, primary: boolean) => {
    const href = store || releasesUrl;
    return href ? <a className={primary ? styles.primarySmall : styles.secondarySmall} href={href}>{label}</a> : <span className={styles.soonSmall}>{t.soon}</span>;
  };
  return (
    <section id="extension" className={styles.section}>
      <div className={`${styles.wrap} ${styles.split}`}>
        <div className={styles.splitText}>
          <h2 className={styles.h2}>{t.title}</h2>
          <p className={styles.lead}>{t.body}</p>
          <div className={styles.rows}>
            <div><strong>{t.chromium}</strong>{install(LINKS.chromeStore, t.addChrome, true)}</div>
            <div><strong>Firefox</strong>{install(LINKS.firefoxAddons, t.addFirefox, false)}</div>
            <div><strong>Safari</strong><span className={styles.muted}>{t.later}</span></div>
          </div>
        </div>
        <div className={styles.popupStage}>
          <ExtensionPopup
            connected
            printers={PRINTERS}
            printer={printer}
            onPrinter={(id) => { setPrinter(id); setSlicer(PRINTERS.find((p) => p.id === id)!.slicers.at(-1)!); }}
            slicer={slicer}
            onSlicer={setSlicer}
            offer={offer}
            onOffer={setOffer}
          />
        </div>
      </div>
    </section>
  );
}

type Os = 'mac' | 'windows' | 'linux';

function detectOs(ua: string): Os | undefined {
  // Phones and tablets have no desktop app; Android also reports Linux.
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) return undefined;
  if (/Mac/i.test(ua)) return 'mac';
  if (/Win/i.test(ua)) return 'windows';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return undefined;
}

export function Download() {
  const t = useT(LANDING_MESSAGES).download;
  const [os, setOs] = useState<Os>();
  useEffect(() => setOs(detectOs(navigator.userAgent)), []);
  const order = useMemo(() => (['mac', 'windows', 'linux'] as const).slice().sort((a, b) => Number(b === os) - Number(a === os)), [os]);
  return (
    <section id="download" className={`${styles.section} ${styles.alt}`}>
      <div className={styles.wrap}>
        <div className={styles.narrowHead}><h2 className={styles.h2}>{t.title}</h2><p className={styles.lead}>{t.sub}</p></div>
        <div className={styles.downloads}>
          {order.map((key) => {
            const d = t[key];
            const detected = key === os;
            return (
              <div key={key} className={`${styles.download} ${detected ? styles.detected : ''}`}>
                <div className={styles.downloadHead}><strong>{d.os}</strong>{detected && <span className={`${styles.mono} ${styles.ink}`}>{t.detected}</span>}</div>
                <span className={styles.muted}>{d.req}</span>
                {releasesUrl
                  ? <a className={detected ? styles.primarySmall : styles.secondarySmall} href={releasesUrl}>{d.button}</a>
                  : <span className={styles.soonSmall}>{t.soon}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const t = useT(LANDING_MESSAGES).faq;
  return (
    <section id="faq" className={styles.section}>
      <div className={`${styles.wrap} ${styles.faq}`}>
        <h2 className={styles.h2}>{t.title}</h2>
        <div className={styles.questions}>
          {t.items.map((item, i) => (
            <details key={item.q} id={i === 0 ? 'privacy' : undefined} open={i === 0}>
              <summary>{item.q}</summary>
              <p className={styles.muted}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
