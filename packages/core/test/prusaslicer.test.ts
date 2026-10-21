import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { getPrusaProfiles, PRINTERS } from '@retarget3mf/profiles';
import { convert } from '../src/index.ts';
import { parseTransform } from '../src/model.ts';
import { prusaBedOffset } from '../src/targets/prusaSlicer.ts';
import { bambuProject } from './fixtures.ts';

const files = async (input: Uint8Array, printer = 'prusa-mk4s-0.4') => {
  const { output, report } = await convert(input, { printer: printer as never, slicer: 'prusaslicer' });
  const unzipped = unzipSync(output);
  const text = (path: string) => strFromU8(unzipped[path]!);
  const ini = Object.fromEntries([...text('Metadata/Slic3r_PE.config').matchAll(/^; ([a-z0-9_]+) = (.*)$/gm)].map((m) => [m[1]!, m[2]!]));
  return { unzipped, text, ini, report };
};

const TWO_PLATES_MODEL = (x2: number) => `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <resources>
  <object id="2" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 5"/></components></object>
 </resources>
 <build>
  <item objectid="2" transform="1 0 0 0 1 0 0 0 1 100 140 0" printable="1"/>
  <item objectid="2" transform="1 0 0 0 1 0 0 0 1 ${x2} 140 0" printable="1"/>
 </build>
</model>`;
const TWO_PLATES_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="2"><metadata key="name" value="Cube"/><part id="1" subtype="normal_part"><metadata key="name" value="Body"/></part></object>
  <plate><metadata key="plater_id" value="1"/><model_instance><metadata key="object_id" value="2"/><metadata key="instance_id" value="0"/></model_instance></plate>
  <plate><metadata key="plater_id" value="2"/><model_instance><metadata key="object_id" value="2"/><metadata key="instance_id" value="1"/></model_instance></plate>
</config>`;

describe('PrusaSlicer target', () => {
  it('writes a PrusaSlicer project: its own files, presets and the author settings it has', async () => {
    const { unzipped, text, ini, report } = await files(bambuProject());
    expect(Object.keys(unzipped)).not.toContain('Metadata/project_settings.config');
    expect(text('3D/3dmodel.model')).toContain('<metadata name="Application">PrusaSlicer-2.9.6</metadata>');
    expect(text('3D/3dmodel.model')).toContain('<metadata name="slic3rpe:Version3mf">1</metadata>');
    expect(report.target).toMatchObject({ slicer: 'PrusaSlicer', profiles: 'PrusaSlicer 2.9.6' });
    expect(ini).toMatchObject({
      printer_settings_id: 'Original Prusa MK4S 0.4 nozzle', filament_settings_id: '"Prusament PLA @MK4S"',
      layer_height: '0.16', first_layer_height: '0.2', perimeters: '3', fill_density: '25%', fill_pattern: 'grid', top_fill_pattern: 'monotoniclines',
    });
    // PrusaSlicer stops reading the config at the first malformed line and refuses fewer than 80 values.
    expect(text('Metadata/Slic3r_PE.config').split('\n').slice(2).filter(Boolean).every((l) => /^; [a-z0-9_]+ = /.test(l))).toBe(true);
    expect(Object.keys(ini).length).toBeGreaterThan(80);
  });

  it('keeps per-object overrides and paint under PrusaSlicer names', async () => {
    const { text } = await files(bambuProject());
    expect(text('Metadata/Slic3r_PE_model.config')).toContain('<metadata type="object" key="perimeters" value="4"/>');
    expect(text('Metadata/Slic3r_PE_model.config')).not.toContain('outer_wall_speed');
    const model = text('3D/3dmodel.model');
    expect(model).toContain('slic3rpe:custom_supports="4"');
    expect(model).not.toMatch(/\spaint_\w+=/);
  });

  it('writes line widths as millimetres, since PrusaSlicer reads percentages over the layer height', async () => {
    const { ini } = await files(bambuProject({ line_width: '110%', support_line_width: '0.38' }));
    expect(ini).toMatchObject({ extrusion_width: '0.44', support_material_extrusion_width: '0.38' });
  });

  it('puts plate 2 on PrusaSlicer bed 2 and bakes component transforms into the mesh', async () => {
    const plate2 = 100 + 254 * 1.2; // Bambu X1C plate grid: two plates side by side.
    const { text } = await files(bambuProject({}, { '3D/3dmodel.model': TWO_PLATES_MODEL(plate2), 'Metadata/model_settings.config': TWO_PLATES_SETTINGS }));
    const items = [...text('3D/3dmodel.model').matchAll(/<item\b[^>]*transform="([^"]+)"/g)].map((m) => parseTransform(m[1]));
    const bed = getPrusaProfiles('prusa-mk4s-0.4').printer.bed_shape!.split(',').map((p) => p.split('x').map(Number));
    const [dx] = prusaBedOffset(1, { min: [0, 0], max: [Math.max(...bed.map((p) => p[0]!)), Math.max(...bed.map((p) => p[1]!))] });
    expect(items[1]![9]! - items[0]![9]!).toBeCloseTo(dx);
    expect(items[1]![10]).toBeCloseTo(items[0]![10]!);
    expect(text('3D/3dmodel.model')).toContain('z="5"');
    expect(text('Metadata/Slic3r_PE_model.config')).toContain('<object id="1" instances_count="2">');
    expect(text('Metadata/Slic3r_PE_model.config')).toContain('key="name" value="Body"');
  });

  it('lays beds out in PrusaSlicer 2.9 grid order', () => {
    const bed = { min: [0, 0] as [number, number], max: [100, 100] as [number, number] };
    const stride = 100 + Math.min(100, Math.hypot(100, 100) * 0.3);
    expect([0, 1, 2, 3, 4].map((i) => prusaBedOffset(i, bed).map((v) => Math.round(v / stride)))).toEqual([[0, 0], [1, 0], [0, 1], [1, 1], [2, 0]]);
  });

  it('converts for every Prusa printer and defaults Prusa printers to PrusaSlicer', async () => {
    for (const p of PRINTERS.filter((p) => p.vendor === 'Prusa')) {
      expect(p.slicers[0]).toBe('prusaslicer');
      const { ini } = await files(bambuProject(), p.id);
      expect(ini.printer_settings_id).toBe(p.ownSlicerPresets!.prusaslicer);
    }
  });
});
