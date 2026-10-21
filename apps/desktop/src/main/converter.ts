import { utilityProcess, type UtilityProcess } from 'electron';
import type { Result } from '../shared/api.ts';
import workerPath from './worker.ts?modulePath';
import type { WorkerRequest, WorkerResponse } from './worker.ts';

type Pending = (response: WorkerResponse) => void;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type RequestBody = DistributiveOmit<WorkerRequest, 'id'>;

let child: UtilityProcess | undefined;
let nextId = 1;
let cancelling = false;
const pending = new Map<number, Pending>();

function worker(): UtilityProcess {
  if (child) return child;
  const proc = utilityProcess.fork(workerPath, [], { serviceName: 'retarget3mf-converter' });
  proc.on('message', (response: WorkerResponse) => {
    pending.get(response.id)?.(response);
    pending.delete(response.id);
  });
  proc.on('exit', () => {
    child = undefined;
    const error = cancelling ? CANCELLED : 'The converter stopped unexpectedly. Try again; if it repeats, report the file.';
    cancelling = false;
    for (const [id, resolve] of pending) resolve({ id, ok: false, error });
    pending.clear();
  });
  child = proc;
  return proc;
}

export function runWorker<T>(body: RequestBody): Promise<Result<T>> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, (r) => resolve(r.ok ? { ok: true, value: r.value as T } : { ok: false, error: r.error }));
    worker().postMessage({ ...body, id });
  });
}

export const CANCELLED = 'Conversion cancelled.';

/** Stops the running conversion before it writes its file; the next request starts a fresh worker. */
export function cancelWorker(): void {
  if (!child || pending.size === 0) return;
  cancelling = true;
  child.kill();
}
