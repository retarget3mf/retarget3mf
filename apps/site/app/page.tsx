import { Logo } from '@retarget3mf/ui/logo';
import { asset, LINKS, releasesUrl } from '../lib/links';
import { DownloadButton } from './DownloadButton';
import styles from './page.module.css';

const STEPS = [
  { title: 'Pick your printer once', body: 'Flashforge or Bambu Lab, and the slicer you use. Retarget3MF remembers both.' },
  { title: 'Click “Open for <your printer>”', body: 'It sits in the download menu on MakerWorld, Printables, Creality Cloud and Snapmaker Space. Or just drop a .3mf onto the app.' },
  { title: 'Print from your slicer', body: 'The project opens with your printer’s profiles, the author’s settings kept and colours mapped to your slots.' },
];

const FEATURES = [
  { title: 'Keeps what matters', body: 'Layer height, walls, infill, supports, seams, ironing and painted colours carry over. Speeds and calibration come from your printer’s profile.' },
  { title: 'Colours that fit', body: 'Filaments are mapped to your AD5X IFS slots, Bambu AMS or Creator 5 toolheads. Too many colours? Similar ones are merged, and you can adjust.' },
  { title: 'Checked in real slicers', body: 'Every release converts test projects for every printer and slices them in OrcaSlicer, Bambu Studio and Flash Studio.' },
  { title: 'Private by design', body: 'Everything runs on your computer. No account, no upload, no tracking. Open source under AGPL-3.0.' },
];

const SUPPORT = [
  { title: 'From', items: ['MakerWorld (Bambu Studio)', 'Printables (PrusaSlicer 2.x)', 'Creality Cloud (Creality Print)', 'Snapmaker Space (Snapmaker Orca)', 'OrcaSlicer, Anycubic Slicer Next'] },
  { title: 'Flashforge', items: ['AD5X (4-colour IFS)', 'Adventurer 5M, 5M Pro', 'Creator 5, Creator 5 Pro'] },
  { title: 'Bambu Lab', items: ['A1 mini, A1', 'P1P, P1S, P2S', 'X1, X1 Carbon, X1E', 'H2S'] },
  { title: 'Opens in', items: ['Flash Studio', 'Bambu Studio', 'OrcaSlicer'] },
];

const OUTCOMES = [
  { label: 'Kept', tone: 'kept', body: 'layer height, walls, infill, top/bottom layers, supports, brim, seam, ironing' },
  { label: 'Clamped', tone: 'clamped', body: 'nozzle and bed temperatures, to the filament’s range and the printer’s limits' },
  { label: 'From your printer', tone: 'replaced', body: 'speeds, acceleration, retraction, filament calibration, start and end G-code' },
  { label: 'Dropped', tone: 'dropped', body: 'settings for the source hardware, and post-processing scripts' },
];

/** The kind of menu the extension adds its row to (drawn, not a screenshot of any site). */
function MenuMock() {
  return (
    <div className={styles.menuMock} aria-hidden>
      <div className={styles.menuButton}>Open in slicer <span>⌄</span></div>
      <div className={styles.menuList}>
        <div>Open in the site’s slicer</div>
        <div className={styles.menuOurs}><img src={asset('/favicon.svg')} width={18} height={18} alt="" />Open for AD5X</div>
        <div>Download 3MF</div>
        <div>Download STL</div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className={styles.nav}>
        <div className={styles.wrap}>
          <Logo size={30} />
          <nav className={styles.links}>
            <a href="#how">How it works</a>
            <a href="#supported">Supported</a>
            <a href="#get">Download</a>
            {LINKS.repo && <a href={LINKS.repo}>GitHub</a>}
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div>
              <p className={styles.eyebrow}>Free and open source</p>
              <h1>Print any 3MF project on <em>your</em> printer.</h1>
              <p className={styles.lead}>
                Retarget3MF turns projects made for other printers into ready-to-print projects for your Flashforge or Bambu Lab, keeps the
                author’s settings, fits the colours to your slots and opens your slicer.
              </p>
              <div className={styles.ctas}>
                <DownloadButton />
                <a className={styles.secondary} href={asset('/app/')}>Convert in your browser →</a>
              </div>
              <p className={styles.small}>macOS, Windows and Linux · Browser extension for Chrome, Edge, Brave, Arc, Dia, Vivaldi, Opera and Firefox</p>
            </div>
            <figure className={styles.window}>
              <div className={styles.windowBar}><i /><i /><i /></div>
              <img src={asset('/screenshots/review.png')} alt="Retarget3MF mapping a project's filaments to the Flashforge AD5X's slots" />
            </figure>
          </div>
        </section>

        <section id="how" className={styles.section}>
          <div className={styles.wrap}>
            <h2>One click from model page to slicer</h2>
            <div className={styles.howGrid}>
              <ol className={styles.steps}>
                {STEPS.map((s, i) => (
                  <li key={s.title}><span className={styles.stepNo}>{i + 1}</span><div><h3>{s.title}</h3><p>{s.body}</p></div></li>
                ))}
              </ol>
              <MenuMock />
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.alt}`}>
          <div className={`${styles.wrap} ${styles.features}`}>
            {FEATURES.map((f) => <div key={f.title} className={styles.feature}><h3>{f.title}</h3><p>{f.body}</p></div>)}
          </div>
        </section>

        <section id="supported" className={styles.section}>
          <div className={styles.wrap}>
            <h2>Supported today</h2>
            <div className={styles.supportGrid}>
              {SUPPORT.map((col) => (
                <div key={col.title}><h3>{col.title}</h3><ul>{col.items.map((i) => <li key={i}>{i}</li>)}</ul></div>
              ))}
            </div>
            <h2 className={styles.spaced}>What happens to the settings</h2>
            <div className={styles.outcomes}>
              {OUTCOMES.map((o) => <div key={o.label} className={styles.outcome}><span className={styles[o.tone]}>{o.label}</span><p>{o.body}</p></div>)}
            </div>
            <p className={styles.small}>Every conversion comes with a report listing each change and why.</p>
          </div>
        </section>

        <section id="get" className={`${styles.section} ${styles.alt}`}>
          <div className={styles.wrap}>
            <h2>Get Retarget3MF</h2>
            <div className={styles.getGrid}>
              <div className={styles.getCard}>
                <h3>Desktop app</h3>
                <p>Converts and opens your slicer in one step; also opens .3mf files from Finder or Explorer.</p>
                <p className={styles.small}>macOS (Apple silicon and Intel) · Windows · Linux (AppImage, deb)</p>
                <DownloadButton compact />
              </div>
              <div className={styles.getCard}>
                <h3>Browser extension</h3>
                <p>Adds “Open for &lt;your printer&gt;” to the model sites’ download menus and hands the project to the app.</p>
                <p className={styles.small}>Chrome, Edge, Brave, Arc, Dia, Vivaldi, Opera · Firefox</p>
                {releasesUrl ? <a className={styles.secondary} href={releasesUrl}>Get the extension</a> : <span className={`${styles.secondary} ${styles.soon}`}>Coming soon</span>}
              </div>
              <div className={styles.getCard}>
                <h3>In your browser</h3>
                <p>No install: drop a .3mf, download the converted project. Works offline once loaded.</p>
                <p className={styles.small}>Any modern browser</p>
                <a className={styles.secondary} href={asset('/app/')}>Open the web app</a>
              </div>
            </div>
          </div>
        </section>

        {LINKS.support && (
          <section className={styles.section}>
            <div className={`${styles.wrap} ${styles.supportUs}`}>
              <div>
                <h2>Enjoying Retarget3MF?</h2>
                <p>It’s free and built in spare time. A coffee keeps new printers and sites coming.</p>
              </div>
              <a className={styles.coffee} href={LINKS.support}>☕ Buy me a coffee</a>
            </div>
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <Logo size={22} />
          <p>Open source under AGPL-3.0{LINKS.repo && <> · <a href={LINKS.repo}>Source on GitHub</a></>}{LINKS.support && <> · <a href={LINKS.support}>Buy me a coffee</a></>}</p>
          <p className={styles.small}>Not affiliated with Bambu Lab, Flashforge, Prusa Research, Creality or Snapmaker. Product names belong to their owners.</p>
        </div>
      </footer>
    </>
  );
}
