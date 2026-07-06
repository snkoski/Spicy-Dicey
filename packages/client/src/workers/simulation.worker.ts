import { handleWorkerRequest, type WorkerRequest } from './simulation-protocol';

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  handleWorkerRequest(event.data, (response) => self.postMessage(response));
};
