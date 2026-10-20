import type { PrinterId, SlicerId } from '@retarget3mf/core';
import type { Converted, Inspected, WorkerRequest, WorkerResponse } from './protocol.ts';

/** A message the user should see: the converter's own wording, or `undefined` for an unexpected failure. */
export class ConverterError extends Error {
  constructor(readonly userMessage: string | undefined) { super(userMessage ?? 'unexpected conversion failure'); }
}

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, (r: WorkerResponse) => void>();

type Request = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never;

function call<T>(request: Request): Promise<T> {
  worker ??= Object.assign(new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), {
    onmessage: ({ data }: MessageEvent<WorkerResponse>) => { pending.get(data.id)?.(data); pending.delete(data.id); },
  });
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, (r) => (r.ok ? resolve(r.value as T) : reject(new ConverterError(r.known ? r.error : undefined))));
    // The page keeps its copy of the project for the convert step, so the bytes are copied, not transferred.
    worker!.postMessage({ ...request, id });
  });
}

export const inspectProject = (bytes: Uint8Array) => call<Inspected>({ kind: 'inspect', bytes });
export const convertProject = (bytes: Uint8Array, printer: PrinterId, slicer: SlicerId, filamentMap: Record<number, number>) =>
  call<Converted>({ kind: 'convert', bytes, printer, slicer, filamentMap });
