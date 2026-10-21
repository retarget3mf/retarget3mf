/** Stroke icons in the current text colour; sized in px. */
export function ChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

const TEETH = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

export function GearIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
      {TEETH.map((a) => <line key={a} x1={12 + 7 * Math.cos(a)} y1={12 + 7 * Math.sin(a)} x2={12 + 9.5 * Math.cos(a)} y2={12 + 9.5 * Math.sin(a)} strokeWidth="3" />)}
      <circle cx="12" cy="12" r="6.5" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.5" strokeWidth="2" />
    </svg>
  );
}
