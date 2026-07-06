import fastifyCookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { HealthResponse } from '@spicy-dicey/contracts';
import { createInMemorySessionStore, type SessionStore } from './auth/session-store.js';
import { registerAuthRoutes } from './routes/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    sessions: SessionStore;
  }
}

export function buildApp() {
  const app = Fastify();
  app.decorate('sessions', createInMemorySessionStore());
  void app.register(fastifyCookie);

  app.get('/health', (): HealthResponse => ({ status: 'ok' }));
  registerAuthRoutes(app);

  return app;
}
