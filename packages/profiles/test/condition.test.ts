import { describe, expect, it } from 'vitest';
import { matchesCondition } from '../scripts/condition.ts';

const mk4s = { printer_notes: 'Do not remove the keywords below.\nPRINTER_VENDOR_PRUSA3D\nPRINTER_MODEL_MK4S\n', nozzle_diameter: ['0.4'], single_extruder_multi_material: '0' };

describe('matchesCondition', () => {
  it('evaluates the forms Prusa profiles use', () => {
    expect(matchesCondition('printer_notes=~/.*MK4S.*/ and nozzle_diameter[0]==0.4', mk4s)).toBe(true);
    expect(matchesCondition('printer_notes=~/.*MK4S.*/ and nozzle_diameter[0]==0.6', mk4s)).toBe(false);
    expect(matchesCondition('printer_notes!~/.*HF_NOZZLE.*/', mk4s)).toBe(true);
    expect(matchesCondition('printer_notes=~/.*PRINTER_MODEL_COREONE[^_a-zA-Z0-9].*/', mk4s)).toBe(false);
    expect(matchesCondition('single_extruder_multi_material', mk4s)).toBe(false);
  });

  it('handles negation, grouping, or and ordering comparisons', () => {
    const mmu = '! (printer_notes=~/.*PRINTER_VENDOR_PRUSA3D.*/ and printer_notes=~/.*PRINTER_MODEL_MK(2.5|3).*/ and single_extruder_multi_material)';
    expect(matchesCondition(`nozzle_diameter[0]>=0.4 and printer_notes!~/.*MINI.*/ and ${mmu}`, mk4s)).toBe(true);
    expect(matchesCondition('nozzle_diameter[0]>0.4 or printer_model=="MK4S"', { ...mk4s, printer_model: 'MK4S' })).toBe(true);
    expect(matchesCondition('! nozzle_high_flow[0]', { ...mk4s, nozzle_high_flow: ['0'] })).toBe(true);
  });

  it('refuses forms it does not understand', () => {
    expect(() => matchesCondition('one_of(printer_model, "MK4")', mk4s)).toThrow(/unsupported/);
    expect(() => matchesCondition('(nozzle_diameter[0]==0.4', mk4s)).toThrow(/unsupported/);
  });
});
