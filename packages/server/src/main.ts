import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import { buildApp } from './app.js';
import { createDbFromEnv } from './db/client.js';
import { setupErrorTracking } from './observability/sentry.js';
import { attachSockets } from './socket/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const db = await createDbFromEnv();
const app = buildApp({ db });
setupErrorTracking(app);
attachSockets(app);

// Production single-process deploy (plan §1 Phase 6 / Railway): serve the
// built client from the same long-running server that owns the sockets.
const clientDist = process.env['CLIENT_DIST'] ?? path.resolve(here, '../../client/dist');
if (existsSync(clientDist)) {
  void app.register(fastifyStatic, { root: clientDist });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api')) {
      return reply.sendFile('index.html');
    }
    return reply.status(404).send({ error: 'not found' });
  });
}

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
