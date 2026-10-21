import { useT } from './i18n.tsx';
import { ThemeIcon } from './icons.tsx';
import { UI_MESSAGES } from './messages.ts';
import type { Theme } from './ThemeSwitch.tsx';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

/** One square icon button that cycles System → Light → Dark; its label names the current mode. */
export function ThemeButton({ value, onChange, className }: { value: Theme; onChange: (theme: Theme) => void; className?: string | undefined }) {
  const t = useT(UI_MESSAGES).theme;
  const label = `${t.label}: ${t[value]}`;
  return <button type="button" className={className} aria-label={label} title={label} onClick={() => onChange(NEXT[value])}><ThemeIcon /></button>;
}

/** Applies a theme choice to <html>; "system" follows the OS. */
export function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
