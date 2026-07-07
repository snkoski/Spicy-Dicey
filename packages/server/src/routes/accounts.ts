import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_COOKIE } from './auth.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(30),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

const upgradeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

function setSession(reply: FastifyReply, token: string) {
  return reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export function registerAccountRoutes(app: FastifyInstance): void {
  const requireIdentity = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    const identity = token ? await app.identity.resolve(token) : null;
    if (!identity) {
      await reply.status(401).send({ error: 'not signed in' });
      return null;
    }
    return identity;
  };

  app.post('/auth/signup', async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid signup payload' });
    }
    try {
      const { user, token } = await app.accounts.signup(
        parsed.data.email,
        parsed.data.password,
        parsed.data.displayName,
      );
      return setSession(reply, token).send({ user });
    } catch (error) {
      return reply
        .status(409)
        .send({ error: error instanceof Error ? error.message : 'signup failed' });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid login payload' });
    }
    const result = await app.accounts.login(parsed.data.email, parsed.data.password);
    if (!result) {
      return reply.status(401).send({ error: 'invalid email or password' });
    }
    return setSession(reply, result.token).send({ user: result.user });
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await app.accounts.logout(token);
      await app.sessions.revoke(token);
    }
    return reply.clearCookie(SESSION_COOKIE, { path: '/' }).send({ ok: true });
  });

  /** Guest -> full upgrade (decision 6): carries the live game, backfills stats. */
  app.post('/auth/upgrade', async (request, reply) => {
    const parsed = upgradeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid upgrade payload' });
    }
    const guestToken = request.cookies[SESSION_COOKIE];
    const guest = guestToken ? await app.sessions.resolve(guestToken) : null;
    if (!guestToken || !guest) {
      return reply.status(401).send({ error: 'no guest session to upgrade' });
    }
    try {
      const { user, token } = await app.accounts.upgradeGuest(
        guestToken,
        parsed.data.email,
        parsed.data.password,
        guest.displayName,
      );
      return setSession(reply, token).send({ user });
    } catch (error) {
      return reply
        .status(409)
        .send({ error: error instanceof Error ? error.message : 'upgrade failed' });
    }
  });

  app.get('/users/me', async (request, reply) => {
    const identity = await requireIdentity(request, reply);
    if (!identity) {
      return;
    }
    return reply.send({
      kind: identity.kind,
      displayName: identity.displayName,
      userId: identity.userId,
      guestSessionId: identity.guestSessionId,
    });
  });

  app.get('/users/me/stats', async (request, reply) => {
    const identity = await requireIdentity(request, reply);
    if (!identity) {
      return;
    }
    if (!identity.userId) {
      return reply.send({ gamesPlayed: 0, wins: 0, avgScore: 0, farkleRate: 0 });
    }
    return reply.send(await app.accounts.statsFor(identity.userId));
  });

  app.get('/users/me/games', async (request, reply) => {
    const identity = await requireIdentity(request, reply);
    if (!identity) {
      return;
    }
    if (!identity.userId) {
      return reply.send({ games: [], nextCursor: null });
    }
    const query = request.query as { limit?: string; cursor?: string };
    return reply.send(
      await app.accounts.gamesFor(
        identity.userId,
        Math.min(Number(query.limit ?? 20) || 20, 100),
        query.cursor,
      ),
    );
  });
}
