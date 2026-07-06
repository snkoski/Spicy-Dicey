import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

export const SESSION_COOKIE = 'sd_session';

const guestBodySchema = z.object({ displayName: z.string().trim().min(1).max(30) });

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post('/auth/guest', (request, reply) => {
    const parsed = guestBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'displayName is required' });
    }
    const { token, identity } = app.sessions.createGuest(parsed.data.displayName);
    return reply
      .setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      })
      .send({ guestId: identity.guestSessionId, displayName: identity.displayName });
  });
}
