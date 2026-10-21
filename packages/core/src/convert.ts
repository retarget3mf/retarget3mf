import { getOptions, getPrinter, getTargetProfiles, PROFILE_SOURCE, type PrinterId, type SlicerId } from '@retarget3mf/profiles';
import { asList, first, serializeProjectConfig } from './config.ts';
import { ConversionError } from './errors.ts';
import { MAIN_MODEL, moveItems, readGeometry, remapPaintInText, setModelMetadata } from './model.ts';
import { editModelSettings, MODEL_SETTINGS, readModelSettings } from './modelSettings.ts';
import { remapPaint } from './paint.ts';
import type { ConversionReport } from './report.ts';
import { detectSource, PROJECT_SETTINGS } from './stages/detect.ts';
import { applyFilamentMap, padToToolheads, planFilaments, remapRef, type FilamentMap } from './stages/filaments.ts';
import { parseBed, planPlacement } from './stages/placement.ts';
import { buildSettings, SLICER_NAMES, type SettingsResult } from './stages/settings.ts';
import { optionsInOrcaSpace } from './targets/bambuStudio.ts';

type OverrideConverter = SettingsResult['convertOverride'];
import { validateConfig } from './stages/validate.ts';
import { readArchive, readText, setText, writeArchive, type Archive } from './zip.ts';

export interface ConvertOptions {
  printer: PrinterId;
  /** Defaults to the printer's preferred slicer (Flash Studio for Flashforge, whose output also loads in OrcaSlicer). */
  slicer?: SlicerId | 'pandaforge';
  /** Source filament → target filament (1-based); merges colours when the printer has fewer slots. */
  filamentMap?: FilamentMap;
}

/** `preview` is what UIs show in lists: the project title and its first plate thumbnail (PNG). */
export interface ConvertResult { output: Uint8Array; report: ConversionReport; preview: { title: string; thumbnail?: Uint8Array } }

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
  const slicer = opts.slicer ?? printer.slicers[0]!;
  if (slicer === 'pandaforge') throw new ConversionError('unsupported-slicer', 'PandaForge output is not supported yet; choose OrcaSlicer or Flash Studio.');
  if (!printer.slicers.includes(slicer)) {
    throw new ConversionError('unsupported-slicer', `${SLICER_NAMES[slicer]} has no profiles for the ${printer.displayName}; choose ${printer.slicers.map((s) => SLICER_NAMES[s]).join(' or ')}.`);
  }

  const source = detectSource(readArchive(input));
  const { archive } = source;
  const target = getTargetProfiles(printer.id, slicer);
  // Bambu Studio and OrcaSlicer-based vendor slicers get a final rewrite into their own option names.
  const writer = slicer === 'bambustudio' ? 'bambustudio' : printer.ownSlicerPresets?.[slicer] ? 'own' : undefined;
  const orca = getOptions('orca');
  const options = writer
    ? { orca, slicer: optionsInOrcaSpace(orca, getOptions(slicer)), native: getOptions(slicer) }
    : { orca, slicer: getOptions(slicer) };
  const settings = readModelSettings(readText(archive, MODEL_SETTINGS));
  const geo = readGeometry(archive);
  const used = planFilaments(source.config, settings, geo, readText(archive, CUSTOM_GCODE));
  const mapped = opts.filamentMap ? mapFilaments(used, opts.filamentMap) : used;
  const plan = printer.slots.kind === 'toolheads' ? padToToolheads(mapped, printer.slots.count) : mapped;

  const towerWidth = Number(first(source.config.prime_tower_width)) || 35;
  const placement = planPlacement(geo, settings, {
    bed: sourceBed(source.config.printable_area),
    towerWidth,
    ...(source.config.wipe_tower_x && source.config.wipe_tower_y && { wipeTower: { x: source.config.wipe_tower_x, y: source.config.wipe_tower_y } }),
  }, parseBed(target.machine.printable_area));

  const result = buildSettings({ source: source.config, plan, usedFilaments: mapped.keep.length, target, slicer, options, ...(writer && { writer }), ...(placement.wipeTower && { wipeTower: placement.wipeTower }) });
  const problems = validateConfig(result.config, options.native ?? options.slicer);
  if (problems.length) throw new ConversionError('invalid-project', `Internal error while converting (${problems.join('; ')}). Please report this file.`);

  const output: Archive = new Map();
  for (const [path, data] of archive) if (!STALE.test(path)) output.set(path, data);
  setText(output, PROJECT_SETTINGS, serializeProjectConfig(result.config));
  const unmappedPaint = rewriteModels(output, plan.map, placement.shifts);
  rewriteModelSettings(output, plan.keep.length, printer.slots.kind === 'toolheads', result.convertOverride);
  rewriteSideFiles(output, plan.map, result.convertOverride);

  const warnings = [...result.warnings];
  if (unmappedPaint.size) warnings.push(`Paint for filament(s) ${[...unmappedPaint].join(', ')} is on parts that never print or beyond the filament list; it was cleared.`);
  if (mapped.keep.length > printer.slots.count) warnings.unshift(`The project uses ${mapped.keep.length} filaments but the ${printer.displayName} has ${printer.slots.count} ${printer.slots.kind === 'toolheads' ? 'toolhead' : 'slot'}(s). Merge colours before printing.`);
  const unused = asList(source.config.filament_colour).length - used.keep.length;
  if (unused > 0) warnings.push(`${unused} unused filament(s) were removed and the rest renumbered.`);
  const merged = used.keep.length - mapped.keep.length;
  if (merged > 0) warnings.push(`${merged} colour(s) were merged onto shared slots as you chose.`);
  for (const p of placement.plates) if (!p.fits) warnings.push(`Plate ${p.id} is larger than the ${printer.displayName} bed; the objects were centred but not scaled.`);

  const title = readText(archive, MAIN_MODEL)?.match(/<metadata name="Title">([^<]*)<\/metadata>/)?.[1] ?? '';
  const thumbnail = archive.get('Metadata/plate_1.png');
  return {
    preview: { title, ...(thumbnail && { thumbnail }) },
    output: writeArchive(output),
    report: {
      source: { kind: source.kind, slicer: source.slicer, application: source.application, printer: first(source.config.printer_settings_id) ?? 'unknown' },
      target: {
        printer: printer.displayName, slicer: SLICER_NAMES[slicer],
        profiles: slicer === 'bambustudio' ? `Bambu Studio ${PROFILE_SOURCE.bambuStudio.tag}`
          : slicer === 'crealityprint' ? `Creality Print ${PROFILE_SOURCE.crealityPrint.tag}` : `OrcaSlicer ${PROFILE_SOURCE.orca.tag}`,
      },
      warnings,
      filaments: result.filaments,
      plates: placement.plates,
      settings: result.changes,
    },
  };
}

function sourceBed(printableArea: Parameters<typeof parseBed>[0]) {
  try {
    return parseBed(printableArea);
  } catch (cause) {
    throw new ConversionError('invalid-project', 'The project does not say which printer bed it was made for, so the objects cannot be placed. Re-save it in its slicer and try again.', { cause });
  }
}

function mapFilaments(plan: ReturnType<typeof planFilaments>, map: FilamentMap) {
  try {
    return applyFilamentMap(plan, map);
  } catch (cause) {
    throw new ConversionError('invalid-filament-map', `The slot assignment is incomplete: ${(cause as Error).message}. Assign every colour to a slot and retry.`, { cause });
  }
}

/** Returns paint states that had no target filament. */
function rewriteModels(archive: Archive, map: ReadonlyMap<number, number>, shifts: readonly [number, number][]): Set<number> {
  const identity = [...map].every(([from, to]) => from === to);
  const unmapped = new Set<number>();
  for (const path of archive.keys()) {
    if (!path.startsWith('3D/') || !path.endsWith('.model')) continue;
    let text = readText(archive, path)!;
    if (!identity) text = remapPaintInText(text, (hex) => remapPaint(hex, map, (s) => unmapped.add(s)));
    if (path === MAIN_MODEL) {
      text = moveItems(text, shifts);
      text = setModelMetadata(text, 'Application', APPLICATION);
      text = setModelMetadata(text, 'OrcaSlicer', ORCA_TAG);
      text = setModelMetadata(text, 'BambuStudio:3mfVersion', '1');
    }
    setText(archive, path, text);
  }
  return unmapped;
}

function rewriteModelSettings(archive: Archive, filaments: number, toolheads: boolean, convertOverride: OverrideConverter): void {
  const text = readText(archive, MODEL_SETTINGS);
  if (!text) return;
  setText(archive, MODEL_SETTINGS, editModelSettings(text, {
    config: (key, value, owner) => convertOverride(key, value, `object "${owner}"`),
    plate: (key, value) => {
      if (STALE_PLATE_KEYS.has(key)) return [];
      // Filament → nozzle: one shared nozzle (SEMM / single), or filament i on toolhead i.
      if (key === 'filament_maps') return [[key, Array.from({ length: filaments }, (_, i) => (toolheads ? i + 1 : 1)).join(' ')]];
      return [[key, value]];
    },
  }));
}

function rewriteSideFiles(archive: Archive, map: ReadonlyMap<number, number>, convertOverride: OverrideConverter): void {
  const gcode = readText(archive, CUSTOM_GCODE);
  if (gcode) setText(archive, CUSTOM_GCODE, gcode.replace(/\bextruder="(\d+)"/g, (_, n: string) => `extruder="${remapRef(n, map)}"`));
  const ranges = readText(archive, LAYER_RANGES);
  if (!ranges) return;
  setText(archive, LAYER_RANGES, ranges.replace(/<option opt_key="([^"]+)">([^<]*)<\/option>/g, (_, key: string, value: string) =>
    convertOverride(key, value, 'height range').map(([k, v]) => `<option opt_key="${k}">${v}</option>`).join('')));
}
