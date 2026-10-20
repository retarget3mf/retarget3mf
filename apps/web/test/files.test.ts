import { describe, expect, it } from 'vitest';
import { PRINTERS } from '@retarget3mf/profiles/printers';
import { outputName } from '../src/files.ts';

const printer = (id: string) => PRINTERS.find((p) => p.id === id)!;

describe('outputName', () => {
  it('names the file for the printer model, like the desktop app', () => {
    expect(outputName('Benchy.3MF', printer('ad5x-0.4'))).toBe('Benchy - AD5X.3mf');
    expect(outputName('cube.3mf', printer('bambu-x1c-0.4'))).toBe('cube - X1 Carbon.3mf');
  });

  it('replaces characters file systems reject and never returns an empty name', () => {
    expect(outputName('a/b:c?.3mf', printer('ad5x-0.4'))).toBe('a_b_c_ - AD5X.3mf');
    expect(outputName('.3mf', printer('ad5x-0.4'))).toBe('model - AD5X.3mf');
  });
});
