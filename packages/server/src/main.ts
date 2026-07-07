import { buildApp } from './app.js';
import { attachSockets } from './socket/index.js';

const app = buildApp();
attachSockets(app);
const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
