import { getOptions } from '@retarget3mf/profiles';
import { parseProjectConfig, type Config } from '../config.ts';
import { ConversionError } from '../errors.ts';
import { MAIN_MODEL } from '../model.ts';
import { PRUSA_CONFIG, prusaToBambu } from '../sources/prusa.ts';
import { readText, type Archive } from '../zip.ts';

export const PROJECT_SETTINGS = 'Metadata/project_settings.config';

export type SourceKind = 'bambu' | 'prusa';

/** `archive` is in Bambu/Orca layout whatever the source was. `slicer` is a display name for the app that saved it. */
export interface DetectedSource { kind: SourceKind; slicer: string; application: string; config: Config; archive: Archive }

// Bambu Studio forks write the same project layout; the Application metadata says which one saved the file.
const SLICER_NAMES: [RegExp, string][] = [
  [/^Creality[_ ]Print/i, 'Creality Print'],
  [/^Snapmaker/i, 'Snapmaker Orca'],
  [/^Anycubic/i, 'Anycubic Slicer Next'],
  [/^OrcaSlicer/i, 'OrcaSlicer'],
  [/^PrusaSlicer/i, 'PrusaSlicer'],
  [/^BambuStudio/i, 'Bambu Studio'],
];
export const slicerName = (application: string) => SLICER_NAMES.find(([re]) => re.test(application))?.[1] ?? application;

export function detectSource(archive: Archive): DetectedSource {
  const model = readText(archive, MAIN_MODEL);
  if (!model) throw new ConversionError('not-a-project', 'This .3mf has no 3D model inside. Download the file again from the model page.');
  const application = model.match(/<metadata name="Application">([^<]*)<\/metadata>/)?.[1] ?? 'unknown';

  if (archive.has('Metadata/PrusaSlicer3_project.json')) {
    throw new ConversionError('unsupported-source', 'This project was saved by PrusaSlicer 3.0, which is not supported yet. Save it from PrusaSlicer 2.9 (or OrcaSlicer) and try again.');
  }
  if (archive.has(PRUSA_CONFIG)) {
    try {
      return { kind: 'prusa', slicer: 'PrusaSlicer', application, ...prusaToBambu(archive, getOptions('orca')) };
    } catch (cause) {
      throw new ConversionError('invalid-project', 'The PrusaSlicer project could not be read. Re-download the file; if it keeps failing, report it with the model link.', { cause });
    }
  }
  const settings = readText(archive, PROJECT_SETTINGS);
  if (!settings) {
    throw new ConversionError('not-a-project', 'This 3MF holds only geometry, no print settings. On MakerWorld, download a print profile ("Open in Bambu Studio" or the 3MF of a profile), not the plain model file.');
  }
  try {
    const config = parseProjectConfig(settings);
    if (!Array.isArray(config.filament_colour) || config.filament_colour.length === 0) throw new Error('filament_colour missing');
    // An OrcaSlicer tag marks Orca-saved files even when Application says BambuStudio.
    const orca = /<metadata name="OrcaSlicer">/.test(model);
    return { kind: 'bambu', slicer: orca ? 'OrcaSlicer' : slicerName(application), application, config, archive };
  } catch (cause) {
    throw new ConversionError('invalid-project', 'The print settings in this 3MF are damaged and cannot be read. Re-download the file; if it keeps failing, report it with the model link.', { cause });
  }
}
