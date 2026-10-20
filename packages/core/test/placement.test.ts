import { describe, expect, it } from 'vitest';
import { parseBed, plateColumns, plateOrigin } from '../src/stages/placement.ts';

describe('plate grid (mirrors OrcaSlicer PartPlateList)', () => {
  it.each([[1, 1], [2, 2], [4, 2], [5, 3], [9, 3], [10, 4]])('%i plates → %i columns', (count, cols) => {
    expect(plateColumns(count)).toBe(cols);
  });

  it('strides by the truncated plate size plus a 20% gap', () => {
    const ad5x = parseBed(['0x0', '220x0', '220x220', '0x220']);
    expect(plateOrigin(0, 4, ad5x)).toEqual([0, -0]);
    expect(plateOrigin(1, 4, ad5x)[0]).toBeCloseTo(218 * 1.2);
    expect(plateOrigin(2, 4, ad5x)[1]).toBeCloseTo(-218 * 1.2);
  });

  it('reads centre-origin beds', () => {
    expect(parseBed(['-110x-110', '110x-110', '110x110', '-110x110'])).toEqual({ min: [-110, -110], max: [110, 110] });
  });
});
