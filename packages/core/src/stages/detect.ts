import { parseProjectConfig, type Config } from '../config.ts';
import { ConversionError } from '../errors.ts';
import { MAIN_MODEL } from '../model.ts';
import { readText, type Archive } from '../zip.ts';

export const PROJECT_SETTINGS = 'Metadata/project_settings.config';

export interface DetectedSource { kind: 'bambu'; application: string; config: Config }

export function detectSource(archive: Archive): DetectedSource {
  const model = readText(archive, MAIN_MODEL);
  if (!model) throw new ConversionError('not-a-project', 'This .3mf has no 3D model inside. Download the file again from the model page.');
  const application = model.match(/<metadata name="Application">([^<]*)<\/metadata>/)?.[1] ?? 'unknown';

  if (archive.has('Metadata/Slic3r_PE.config') || archive.has('Metadata/PrusaSlicer3_project.json')) {
    throw new ConversionError('unsupported-source', 'PrusaSlicer / Printables projects are not supported yet. Support is planned; for now, open the file in PrusaSlicer and export it as a 3MF from OrcaSlicer.');
  }
  const settings = readText(archive, PROJECT_SETTINGS);
  if (!settings) {
    throw new ConversionError('not-a-project', 'This 3MF holds only geometry, no print settings. On MakerWorld, download a print profile ("Open in Bambu Studio" or the 3MF of a profile), not the plain model file.');
  }
  try {
    const config = parseProjectConfig(settings);
    if (!Array.isArray(config.filament_colour) || config.filament_colour.length === 0) throw new Error('filament_colour missing');
    return { kind: 'bambu', application, config };
  } catch (cause) {
    throw new ConversionError('invalid-project', 'The print settings in this 3MF are damaged and cannot be read. Re-download the file; if it keeps failing, report it with the model link.', { cause });
  }
}
