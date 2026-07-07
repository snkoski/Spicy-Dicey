import fastifyCookie from '@fastify/cookie';
import Fastify from 'fastify';
import type { HealthResponse } from '@spicy-dicey/contracts';
import { createAccountService, type AccountService } from './accounts/service.js';
import { createIdentityResolver, type IdentityResolver } from './auth/identity.js';
import type { SessionStore } from './auth/session-store.js';
import { createSqliteDb, type AppDb } from './db/client.js';
import { createDbSessionStore, startGuestPurgeJob } from './db/session-store.js';
import { registerAccountRoutes } from './routes/accounts.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerStrategyRoutes } from './routes/strategies.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: AppDb;
    sessions: SessionStore;
    accounts: AccountService;
    identity: IdentityResolver;
  }
}

export interface BuildAppOptions {
  /** SQLite path (':memory:' default) — or inject a ready AppDb (Postgres). */
  database?: string;
  db?: AppDb;
  bcryptRounds?: number;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const db = options.db ?? createSqliteDb(options.database ?? ':memory:');
  const sessions = createDbSessionStore(db);
  const accounts = createAccountService(db, {
    bcryptRounds: options.bcryptRounds ?? (process.env['NODE_ENV'] === 'production' ? 12 : 4),
  });

  app.decorate('db', db);
  app.decorate('sessions', sessions);
  app.decorate('accounts', accounts);
  app.decorate('identity', createIdentityResolver(sessions, accounts));
  void app.register(fastifyCookie);

  const stopPurge = startGuestPurgeJob(db);
  app.addHook('onClose', () => stopPurge());

  app.get('/health', (): HealthResponse => ({ status: 'ok' }));
  registerAuthRoutes(app);
  registerAccountRoutes(app);
  registerStrategyRoutes(app);

  return app;
}
