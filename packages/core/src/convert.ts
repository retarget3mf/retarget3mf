import { getOptions, getPrinter, getTargetProfiles, PROFILE_SOURCE, type PrinterId, type SlicerId } from '@retarget3mf/profiles';
import { asList, first, serializeProjectConfig } from './config.ts';
import { ConversionError } from './errors.ts';
import { MAIN_MODEL, moveItems, readGeometry, remapPaintInText, setModelMetadata } from './model.ts';
import { editModelSettings, MODEL_SETTINGS, readModelSettings } from './modelSettings.ts';
import { remapPaint } from './paint.ts';
import type { ConversionReport } from './report.ts';
import { FILAMENT_REF_KEYS, ruleFor } from './rules/index.ts';
import { detectSource, PROJECT_SETTINGS } from './stages/detect.ts';
import { planFilaments, remapRef } from './stages/filaments.ts';
import { parseBed, planPlacement } from './stages/placement.ts';
import { buildSettings } from './stages/settings.ts';
import { validateConfig } from './stages/validate.ts';
import { readArchive, readText, setText, writeArchive, type Archive } from './zip.ts';

export interface ConvertOptions {
  printer: PrinterId;
  /** Defaults to Flash Studio, whose stricter rules also load cleanly in OrcaSlicer. */
  slicer?: SlicerId | 'pandaforge';
}

export interface ConvertResult { output: Uint8Array; report: ConversionReport }

const CUSTOM_GCODE = 'Metadata/custom_gcode_per_layer.xml';
const LAYER_RANGES = 'Metadata/layer_config_ranges.xml';
// Slice results and caches for the source printer; the slicer would show them as a stale preview.
const STALE = /^Metadata\/(plate_\d+\.gcode(\.md5)?|plate_\d+\.json|slice_info\.config|filament_sequence\.json|_rels\/model_settings\.config\.rels)$/;
const STALE_PLATE_KEYS = new Set(['gcode_file', 'pattern_bbox_file', 'filament_volume_maps']);
const APPLICATION = 'BambuStudio-2.3.0';
const ORCA_TAG = '2.4.2';

export async function convert(input: Uint8Array, opts: ConvertOptions): Promise<ConvertResult> {
  const printer = getPrinter(opts.printer);
  if (!printer) throw new ConversionError('unknown-printer', `Unknown printer "${opts.printer}". Pick a printer from the list.`);
  const slicer = opts.slicer ?? 'flashstudio';
  if (slicer === 'pandaforge') throw new ConversionError('unsupported-slicer', 'PandaForge output is not supported yet; choose OrcaSlicer or Flash Studio.');

  const archive = readArchive(input);
  const source = detectSource(archive);
  const target = getTargetProfiles(printer.id);
  const options = { orca: getOptions('orca'), slicer: getOptions(slicer) };
  const settings = readModelSettings(readText(archive, MODEL_SETTINGS));
  const geo = readGeometry(archive);
  const plan = planFilaments(source.config, settings, geo, readText(archive, CUSTOM_GCODE));

  const towerWidth = Number(first(source.config.prime_tower_width)) || 35;
  const placement = planPlacement(geo, settings, {
    bed: parseBed(source.config.printable_area),
    towerWidth,
    ...(source.config.wipe_tower_x && source.config.wipe_tower_y && { wipeTower: { x: source.config.wipe_tower_x, y: source.config.wipe_tower_y } }),
  }, parseBed(target.machine.printable_area));

  const result = buildSettings({ source: source.config, plan, target, slicer, options, ...(placement.wipeTower && { wipeTower: placement.wipeTower }) });
  const problems = validateConfig(result.config, options.slicer);
  if (problems.length) throw new ConversionError('invalid-project', `Internal error while converting (${problems.join('; ')}). Please report this file.`);

  const output: Archive = new Map();
  for (const [path, data] of archive) if (!STALE.test(path)) output.set(path, data);
  setText(output, PROJECT_SETTINGS, serializeProjectConfig(result.config));
  rewriteModels(output, plan.map, placement.shifts);
  rewriteModelSettings(output, plan.map, plan.keep.length);
  rewriteSideFiles(output, plan.map);

  const warnings = [...result.warnings];
  if (plan.keep.length > printer.slots.count) warnings.unshift(`The project uses ${plan.keep.length} filaments but the ${printer.displayName} has ${printer.slots.count} slot(s). Merge colours before printing.`);
  const unused = asList(source.config.filament_colour).length - plan.keep.length;
  if (unused > 0) warnings.push(`${unused} unused filament(s) were removed and the rest renumbered.`);
  for (const p of placement.plates) if (!p.fits) warnings.push(`Plate ${p.id} is larger than the ${printer.displayName} bed; the objects were centred but not scaled.`);

  return {
    output: writeArchive(output),
    report: {
      source: { kind: source.kind, application: source.application, printer: first(source.config.printer_settings_id) ?? 'unknown' },
      target: { printer: printer.displayName, slicer: slicer === 'orca' ? 'OrcaSlicer' : 'Flash Studio', profiles: `OrcaSlicer ${PROFILE_SOURCE.orca.tag}` },
      warnings,
      filaments: result.filaments,
      plates: placement.plates,
      settings: result.changes,
    },
  };
}

function rewriteModels(archive: Archive, map: ReadonlyMap<number, number>, shifts: readonly [number, number][]): void {
  const identity = [...map].every(([from, to]) => from === to);
  for (const path of archive.keys()) {
    if (!path.startsWith('3D/') || !path.endsWith('.model')) continue;
    let text = readText(archive, path)!;
    if (!identity) text = remapPaintInText(text, (hex) => remapPaint(hex, map));
    if (path === MAIN_MODEL) {
      text = moveItems(text, shifts);
      text = setModelMetadata(text, 'Application', APPLICATION);
      text = setModelMetadata(text, 'OrcaSlicer', ORCA_TAG);
    }
    setText(archive, path, text);
  }
}

function rewriteModelSettings(archive: Archive, map: ReadonlyMap<number, number>, filaments: number): void {
  const text = readText(archive, MODEL_SETTINGS);
  if (!text) return;
  setText(archive, MODEL_SETTINGS, editModelSettings(text, {
    config: (key, value) => {
      if ((FILAMENT_REF_KEYS as readonly string[]).includes(key)) return remapRef(value, map);
      const rule = ruleFor(key);
      return rule && rule.action !== 'drop' && rule.action !== 'replace' ? value : undefined;
    },
    plate: (key, value) => {
      if (STALE_PLATE_KEYS.has(key)) return undefined;
      if (key === 'filament_maps') return Array(filaments).fill('1').join(' ');
      return value;
    },
  }));
}

function rewriteSideFiles(archive: Archive, map: ReadonlyMap<number, number>): void {
  const gcode = readText(archive, CUSTOM_GCODE);
  if (gcode) setText(archive, CUSTOM_GCODE, gcode.replace(/\bextruder="(\d+)"/g, (_, n: string) => `extruder="${remapRef(n, map)}"`));
  const ranges = readText(archive, LAYER_RANGES);
  if (ranges) {
    setText(archive, LAYER_RANGES, ranges.replace(/<option opt_key="([^"]+)">([^<]*)<\/option>\s*/g, (all, key: string, value: string) => {
      if (key === 'extruder') return all.replace(`>${value}<`, `>${remapRef(value, map)}<`);
      const rule = ruleFor(key);
      return rule && rule.action !== 'drop' && rule.action !== 'replace' ? all : '';
    }));
  }
}
