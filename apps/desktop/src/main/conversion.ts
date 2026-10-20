import { mkdirSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { PRINTERS } from '@retarget3mf/core';
import type { ConvertRequest, ConvertResult, InspectResult, Result, SlicerKind } from '../shared/api.ts';
import type { AppContext } from './context.ts';
import { runWorker } from './converter.ts';
import { outputPathFor } from './paths.ts';
import { launchSlicer, SLICER_NAMES } from './slicers.ts';

/** Paths from the renderer or the OS are untrusted: only existing .3mf files are accepted. */
export function assertProjectPath(path: unknown): string {
  if (typeof path !== 'string' || extname(path).toLowerCase() !== '.3mf' || !statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Only existing .3mf files can be opened.');
  }
  return path;
}

export function inspectProject(path: string): Promise<Result<InspectResult>> {
  return runWorker<InspectResult>({ kind: 'inspect', path: assertProjectPath(path) });
}

export async function convertProject(ctx: AppContext, request: ConvertRequest): Promise<Result<ConvertResult>> {
  const path = assertProjectPath(request.path);
  const printer = PRINTERS.find((p) => p.id === request.printer);
  if (!printer) return { ok: false, error: 'Pick a printer first.' };
  let folder: string | undefined;
  if (ctx.settings.output === 'app-folder') {
    folder = ctx.outputFolder;
    mkdirSync(folder, { recursive: true });
  }
  const shortName = printer.displayName.replace(new RegExp(`^${printer.vendor} `), '');
  const result = await runWorker<ConvertResult>({ kind: 'convert', request: { ...request, path }, outputPath: outputPathFor(path, shortName, folder) });
  if (result.ok) await recordHistory(ctx, path, printer.displayName, request.slicer, result.value);
  return result;
}

async function recordHistory(ctx: AppContext, inputPath: string, printer: string, slicer: SlicerKind, result: ConvertResult): Promise<void> {
  const origin = ctx.origins.get(inputPath);
  try {
    await ctx.history.add({
      title: result.title || basename(inputPath, extname(inputPath)),
      inputPath,
      outputPath: result.outputPath,
      printer,
      slicer: SLICER_NAMES[slicer],
      report: result.report,
      ...(result.thumbnail && { thumbnail: Buffer.from(result.thumbnail.replace(/^data:image\/png;base64,/, ''), 'base64') }),
      ...(origin && { origin }),
    });
  } catch (error) {
    console.error('history', error); // a full disk must not fail the conversion itself
  }
}

export async function openInSlicer(ctx: AppContext, path: string, kind: SlicerKind): Promise<Result<void>> {
  const slicer = await ctx.findSlicer(kind);
  if (!slicer) return { ok: false, error: `${SLICER_NAMES[kind]} was not found. Install it or locate it in Settings.` };
  try {
    await launchSlicer(slicer.path, assertProjectPath(path));
    return { ok: true, value: undefined };
  } catch (error) {
    console.error(error);
    return { ok: false, error: `${SLICER_NAMES[kind]} could not be started. Open the file from the slicer with File → Open Project.` };
  }
}
