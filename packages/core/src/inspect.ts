import { asList } from './config.ts';
import { readGeometry } from './model.ts';
import { MODEL_SETTINGS, readModelSettings } from './modelSettings.ts';
import { detectSource } from './stages/detect.ts';
import { planFilaments } from './stages/filaments.ts';
import { readArchive, readText } from './zip.ts';

export interface ProjectFilament { index: number; colour: string; type: string; used: boolean }
export interface ProjectPlate { id: number; name: string; thumbnail?: Uint8Array }

export interface ProjectInfo {
  source: 'bambu' | 'prusa';
  /** Display name of the slicer that saved the project. */
  sourceSlicer: string;
  title: string;
  application: string;
  sourcePrinter: string;
  filaments: ProjectFilament[];
  plates: ProjectPlate[];
}

/** Reads what the conversion UI needs to show before converting (filaments, plates, thumbnails). */
export async function inspect(input: Uint8Array): Promise<ProjectInfo> {
  const source = detectSource(readArchive(input));
  const { archive } = source;
  const settings = readModelSettings(readText(archive, MODEL_SETTINGS));
  const plan = planFilaments(source.config, settings, readGeometry(archive), readText(archive, 'Metadata/custom_gcode_per_layer.xml'));
  const types = asList(source.config.filament_type);
  const plateIds = settings.plates.length ? settings.plates.map((p) => p.id) : [1];
  const model = readText(archive, '3D/3dmodel.model') ?? '';
  return {
    source: source.kind,
    sourceSlicer: source.slicer,
    title: model.match(/<metadata name="Title">([^<]*)<\/metadata>/)?.[1] ?? '',
    application: source.application,
    sourcePrinter: asList(source.config.printer_settings_id)[0] ?? 'unknown',
    filaments: asList(source.config.filament_colour).map((colour, i) => ({
      index: i + 1, colour, type: types[i] ?? 'PLA', used: plan.keep.includes(i + 1),
    })),
    plates: plateIds.map((id) => {
      const thumbnail = archive.get(`Metadata/plate_${id}.png`);
      return { id, name: '', ...(thumbnail && { thumbnail }) };
    }),
  };
}
