import {
  runSimulation,
  type SimulationConfig,
  type SimulationResult,
} from '../features/simulator/lib/run-simulation';

export type WorkerRequest = { type: 'run'; config: SimulationConfig };

export type WorkerResponse =
  | { type: 'progress'; completed: number; total: number }
  | { type: 'done'; result: SimulationResult }
  | { type: 'error'; message: string };

/**
 * The whole worker behavior as a pure function of (request, post) — the
 * .worker.ts shell only wires this to self.onmessage/postMessage, keeping
 * determinism and the message protocol unit-testable without a Worker.
 */
export function handleWorkerRequest(
  request: WorkerRequest,
  post: (response: WorkerResponse) => void,
): void {
  try {
    // ~100 progress messages regardless of batch size.
    let interval = 1;
    const result = runSimulation(request.config, (completed, total) => {
      interval = Math.max(1, Math.floor(total / 100));
      if (completed % interval === 0 || completed === total) {
        post({ type: 'progress', completed, total });
      }
    });
    post({ type: 'done', result });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}
