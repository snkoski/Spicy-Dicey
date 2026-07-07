import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';

/**
 * Error tracking (plan §1 Phase 6), env-gated: without SENTRY_DSN this is
 * a no-op and the app runs fully offline. The capture hook is injectable
 * so the deliberate-error acceptance test observes captures without a DSN.
 */
export function setupErrorTracking(
  app: FastifyInstance,
  capture: (error: Error) => void = defaultCapture(),
): void {
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      capture(error);
    }
    void reply.status(status).send({
      error: status >= 500 ? 'internal server error' : error.message,
    });
  });
}

function defaultCapture(): (error: Error) => void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) {
    return () => {};
  }
  Sentry.init({ dsn, environment: process.env['NODE_ENV'] ?? 'development' });
  return (error) => Sentry.captureException(error);
}
