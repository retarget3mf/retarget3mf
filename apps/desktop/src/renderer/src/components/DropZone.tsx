import { useState } from 'react';
import styles from './DropZone.module.css';

export function DropZone({ onFile }: { onFile: (path: string) => void }) {
  const [over, setOver] = useState(false);
  const pick = async () => {
    const path = await window.desktop.pickFile();
    if (path) onFile(path);
  };
  return (
    <section
      className={`${styles.zone} ${over ? styles.over : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(window.desktop.pathForFile(file));
      }}
    >
      <h2>Drop a .3mf project here</h2>
      <p>From MakerWorld: download a print profile (the 3MF with settings), not just the model.</p>
      <button className="primary" onClick={pick}>Open file…</button>
    </section>
  );
}
