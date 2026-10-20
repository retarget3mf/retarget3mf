import { useRef, useState } from 'react';
import { useT } from './i18n.tsx';
import { UI_MESSAGES } from './messages.ts';
import styles from './DropZone.module.css';

interface Props {
  onFile: (file: File) => void;
  /** Replaces the built-in file input, e.g. with a native open dialog. */
  onBrowse?: () => void;
  disabled?: boolean;
}

export function DropZone({ onFile, onBrowse, disabled = false }: Props) {
  const t = useT(UI_MESSAGES).drop;
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <section
      className={`${styles.zone} ${over ? styles.over : ''}`}
      aria-disabled={disabled}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file && !disabled) onFile(file);
      }}
    >
      <h2>{t.title}</h2>
      <p>{t.body}</p>
      <button className="primary" disabled={disabled} onClick={() => (onBrowse ? onBrowse() : input.current?.click())}>{t.browse}</button>
      {!onBrowse && (
        <input ref={input} type="file" accept=".3mf" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onFile(file); }} />
      )}
    </section>
  );
}
