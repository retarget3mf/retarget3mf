import { describe, expect, it } from 'vitest';
import { paintStates, remapPaint } from '../src/paint.ts';

describe('paint codec', () => {
  it.each([
    ['4', 1], ['8', 2], ['0C', 3], ['1C', 4], ['EC', 17], ['0FC', 18],
  ])('decodes leaf %s as state %i', (hex, state) => {
    expect([...paintStates(hex)]).toEqual([state]);
  });

  it('decodes split triangles into every child state', () => {
    // split_sides=1 → two children: state 1 and state 3
    expect([...paintStates('0C41')].sort()).toEqual([1, 3]);
  });

  it('renumbers states and re-encodes across the one/two-nibble boundary', () => {
    const map = new Map([[1, 1], [3, 2], [4, 3]]);
    expect(remapPaint('0C', map)).toBe('8');
    expect(remapPaint('1C', map)).toBe('0C');
    expect(remapPaint('0C41', map)).toBe('841');
  });

  it('keeps unpainted (state 0) leaves', () => {
    expect(remapPaint('0', new Map())).toBe('0');
  });

  it('clears states with no mapping to the base filament and reports them', () => {
    const unmapped: number[] = [];
    expect(remapPaint('8', new Map([[1, 1]]), (s) => unmapped.push(s))).toBe('0');
    expect(unmapped).toEqual([2]);
  });
});
