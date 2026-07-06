import Fastify from 'fastify';
import type { HealthResponse } from '@spicy-dicey/contracts';

export function buildApp() {
  const app = Fastify();

  app.get('/health', (): HealthResponse => ({ status: 'ok' }));

  return app;
}
