import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { HealthResponse } from '@spicy-dicey/contracts';
import { createAccountService, type AccountService } from './accounts/service.js';
import { createCaptchaFromEnv, type CaptchaVerifier } from './auth/captcha.js';
import { createIdentityResolver, type IdentityResolver } from './auth/identity.js';
import { createMailerFromEnv, type Mailer } from './email/mailer.js';
import type { SessionStore } from './auth/session-store.js';
import { createSqliteDb, type AppDb } from './db/client.js';
import { createDbSessionStore, startGuestPurgeJob } from './db/session-store.js';
import { registerAccountRoutes } from './routes/accounts.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerSimulationRoutes } from './routes/simulations.js';
import { registerStrategyRoutes } from './routes/strategies.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: AppDb;
    sessions: SessionStore;
    accounts: AccountService;
    identity: IdentityResolver;
    captcha: CaptchaVerifier;
  }
}

export interface BuildAppOptions {
  /** SQLite path (':memory:' default) — or inject a ready AppDb (Postgres). */
  database?: string;
  db?: AppDb;
  bcryptRounds?: number;
  mailer?: Mailer;
  captcha?: CaptchaVerifier;
  /** Auth-endpoint rate limit per minute per IP (plan §1 Phase 6). */
  authRateLimitMax?: number;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const db = options.db ?? createSqliteDb(options.database ?? ':memory:');
  const sessions = createDbSessionStore(db);
  const mailer = options.mailer ?? createMailerFromEnv();
  const accounts = createAccountService(db, {
    bcryptRounds: options.bcryptRounds ?? (process.env['NODE_ENV'] === 'production' ? 12 : 4),
    mailer,
  });

  app.decorate('db', db);
  app.decorate('sessions', sessions);
  app.decorate('accounts', accounts);
  app.decorate('identity', createIdentityResolver(sessions, accounts));
  app.decorate('captcha', options.captcha ?? createCaptchaFromEnv());
  void app.register(fastifyCookie);
  void app.register(fastifyRateLimit, {
    global: false,
    max: options.authRateLimitMax ?? 30,
    timeWindow: '1 minute',
  });
  app.addHook('onRoute', (route) => {
    if (typeof route.url === 'string' && route.url.startsWith('/auth/')) {
      route.config = { ...route.config, rateLimit: {} };
    }
  });

  const stopPurge = startGuestPurgeJob(db);
  app.addHook('onClose', () => stopPurge());

  // Routes register after plugins are loaded so the rate limiter is live
  // before the /auth/* routes exist (its onRoute hook must see them).
  app.after(() => {
    app.get('/health', (): HealthResponse => ({ status: 'ok' }));
    registerAuthRoutes(app);
    registerAccountRoutes(app);
    registerStrategyRoutes(app);
    registerSimulationRoutes(app);
  });

  return app;
}
