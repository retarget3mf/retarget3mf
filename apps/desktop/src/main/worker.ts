// Utility process: runs conversions off the main process so large projects never freeze the UI.
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { convert, ConversionError, inspect, reportToMarkdown } from '@retarget3mf/core';
import type { ConvertRequest, ConvertResult, InspectResult } from '../shared/api.ts';

export type WorkerRequest =
  | { id: number; kind: 'inspect'; path: string }
  | { id: number; kind: 'convert'; request: ConvertRequest; outputPath: string };

export type WorkerResponse =
  | { id: number; ok: true; value: InspectResult | ConvertResult }
  | { id: number; ok: false; error: string };

const toDataUrl = (png: Uint8Array) => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

async function handle(message: WorkerRequest): Promise<InspectResult | ConvertResult> {
  if (message.kind === 'inspect') {
    const info = await inspect(await readFile(message.path));
    return {
      path: message.path,
      fileName: basename(message.path),
      title: info.title,
      sourcePrinter: info.sourcePrinter,
      sourceSlicer: info.sourceSlicer,
      filaments: info.filaments,
      plates: info.plates.map((p) => ({ id: p.id, ...(p.thumbnail && { thumbnail: toDataUrl(p.thumbnail) }) })),
    };
  }
  const { request } = message;
  const { output, report } = await convert(await readFile(request.path), {
    printer: request.printer,
    slicer: request.slicer,
    ...(request.filamentMap && { filamentMap: request.filamentMap }),
  });
  await writeFile(message.outputPath, output);
  return { outputPath: message.outputPath, report, markdown: reportToMarkdown(report) };
}

function describe(error: unknown): string {
  if (error instanceof ConversionError) return error.message;
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return 'The file no longer exists. Pick it again.';
  console.error(error);
  return 'Something went wrong while converting. Please report this file with the model link.';
}

process.parentPort.on('message', async ({ data }: { data: WorkerRequest }) => {
  let response: WorkerResponse;
  try {
    response = { id: data.id, ok: true, value: await handle(data) };
  } catch (error) {
    response = { id: data.id, ok: false, error: describe(error) };
  }
  process.parentPort.postMessage(response);
});
