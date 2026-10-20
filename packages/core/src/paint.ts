// TriangleSelector serialization used by paint_color / paint_supports / paint_seam attributes.
// Hex string = nibble stream reversed. Node nibble: bits 0-1 split_sides, bits 2-3 special side or state.
// Leaf state >= 3: nibble 0xC, then (state - 3) as a run of 0xF (15 each) plus a final nibble < 15.
// (BambuStudio@79df7ae:src/libslic3r/TriangleSelector.cpp:2031-2190; Orca reads one nibble after 0xC, so states <= 17 round-trip.)

function toNibbles(hex: string): number[] {
  const out: number[] = [];
  for (let i = hex.length - 1; i >= 0; i--) {
    const n = parseInt(hex[i]!, 16);
    if (Number.isNaN(n)) throw new Error(`invalid paint string "${hex}"`);
    out.push(n);
  }
  return out;
}

function toHex(nibbles: readonly number[]): string {
  let s = '';
  for (const n of nibbles) s = n.toString(16).toUpperCase() + s;
  return s;
}

function encodeState(state: number, out: number[]): void {
  if (state < 3) { out.push(state << 2); return; }
  out.push(0xc);
  let rest = state - 3;
  for (; rest >= 15; rest -= 15) out.push(0xf);
  out.push(rest);
}

/** Walks the tree, calling `onLeaf` for every leaf state and re-encoding with its return value. */
function rewrite(hex: string, onLeaf: (state: number) => number): string {
  const input = toNibbles(hex);
  const out: number[] = [];
  let pos = 0;
  const next = (): number => {
    const n = input[pos++];
    if (n === undefined) throw new Error(`truncated paint string "${hex}"`);
    return n;
  };
  const node = (): void => {
    const code = next();
    const splitSides = code & 3;
    if (splitSides > 0) {
      out.push(code);
      for (let i = 0; i <= splitSides; i++) node();
      return;
    }
    let state = code >> 2;
    if (state === 3) {
      let n = next();
      let escapes = 0;
      for (; n === 0xf; n = next()) escapes++;
      state = n + 15 * escapes + 3;
    }
    encodeState(onLeaf(state), out);
  };
  while (pos < input.length) node();
  return toHex(out);
}

export function paintStates(hex: string): Set<number> {
  const states = new Set<number>();
  rewrite(hex, (s) => (states.add(s), s));
  return states;
}

/** `map[old] = new` for filament states (1-based); state 0 (unpainted) is kept. */
export function remapPaint(hex: string, map: ReadonlyMap<number, number>): string {
  return rewrite(hex, (s) => {
    if (s === 0) return 0;
    const to = map.get(s);
    if (to === undefined) throw new Error(`paint state ${s} has no mapping`);
    return to;
  });
}
