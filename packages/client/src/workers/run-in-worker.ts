import type { SimulationConfig, SimulationResult } from '../features/simulator/lib/run-simulation';
import type { WorkerRequest, WorkerResponse } from './simulation-protocol';

/** Browser-side wrapper: batches run off the main thread (plan §1 Phase 2). */
export function runSimulationInWorker(
  config: SimulationConfig,
  onProgress?: (completed: number, total: number) => void,
): Promise<SimulationResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.(message.completed, message.total);
      } else if (message.type === 'done') {
        worker.terminate();
        resolve(message.result);
      } else {
        worker.terminate();
        reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({ type: 'run', config } satisfies WorkerRequest);
  });
}
