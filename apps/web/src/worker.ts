/// <reference lib="webworker" />
import { convert, ConversionError, inspect, reportToMarkdown } from '@retarget3mf/core';
import type { Converted, Inspected, WorkerRequest, WorkerResponse } from './protocol.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;

async function handle(request: WorkerRequest): Promise<{ value: Inspected | Converted; transfer: ArrayBuffer[] }> {
  if (request.kind === 'inspect') {
    const info = await inspect(request.bytes);
    const plates = info.plates.map((p) => ({ id: p.id, ...(p.thumbnail && { thumbnail: p.thumbnail }) }));
    const value: Inspected = { title: info.title, sourcePrinter: info.sourcePrinter, sourceSlicer: info.sourceSlicer, filaments: info.filaments, plates };
    return { value, transfer: [] };
  }
  const { output, report, preview } = await convert(request.bytes, { printer: request.printer, slicer: request.slicer, filamentMap: request.filamentMap });
  return { value: { output, report, markdown: reportToMarkdown(report), title: preview.title }, transfer: [output.buffer as ArrayBuffer] };
}

scope.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  let response: WorkerResponse;
  let transfer: ArrayBuffer[] = [];
  try {
    const result = await handle(data);
    response = { id: data.id, ok: true, value: result.value };
    transfer = result.transfer;
  } catch (error) {
    console.error(error);
    response = { id: data.id, ok: false, error: error instanceof Error ? error.message : String(error), known: error instanceof ConversionError };
  }
  scope.postMessage(response, transfer);
};
