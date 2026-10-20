// Dependency-free so UIs can import it without pulling in profile data.

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Merges the closest colours until `slots` remain; filaments listed earlier keep the lower slot. */
export function suggestFilamentMap(filaments: readonly { index: number; colour: string }[], slots: number): Record<number, number> {
  const groups = filaments.map((f) => [f]);
  const distance = (a: string, b: string) => rgb(a).reduce((sum, v, i) => sum + (v - rgb(b)[i]!) ** 2, 0);
  while (groups.length > Math.max(1, slots)) {
    let best: [number, number, number] = [0, 1, Infinity];
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const d = distance(groups[i]![0]!.colour, groups[j]![0]!.colour);
        if (d < best[2]) best = [i, j, d];
      }
    }
    groups[best[0]]!.push(...groups.splice(best[1], 1)[0]!);
  }
  return Object.fromEntries(groups.flatMap((g, slot) => g.map((f) => [f.index, slot + 1])));
}
