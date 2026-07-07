import { randomUUID } from 'node:crypto';
import { and, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { strategyDefinitionSchema } from '@spicy-dicey/contracts';
import { BUILTIN_STRATEGIES } from '@spicy-dicey/core-engine';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { schema } from '../db/client.js';
import { SESSION_COOKIE } from './auth.js';

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(500).optional(),
  rules: strategyDefinitionSchema,
});

export function registerStrategyRoutes(app: FastifyInstance): void {
  const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    const identity = token ? await app.identity.resolve(token) : null;
    if (!identity?.userId) {
      await reply.status(401).send({ error: 'sign in to manage saved strategies' });
      return null;
    }
    return identity.userId;
  };

  /** Built-ins come from code (decision 13); owned rows from the DB. */
  app.get('/strategies', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    const identity = token ? await app.identity.resolve(token) : null;
    const builtins = BUILTIN_STRATEGIES.map((s) => ({
      id: s.id,
      name: s.name,
      description: null,
      isBuiltin: true,
      rules: s,
    }));
    const owned = identity?.userId
      ? await app.db
          .select()
          .from(schema.strategies)
          .where(
            or(
              eq(schema.strategies.ownerUserId, identity.userId),
              isNull(schema.strategies.ownerUserId),
            ),
          )
      : [];
    return reply.send([
      ...builtins,
      ...owned
        .filter((row) => !row.isBuiltin)
        .map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          isBuiltin: false,
          rules: JSON.parse(row.rules) as unknown,
        })),
    ]);
  });

  app.post('/strategies', async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) {
      return;
    }
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid strategy payload' });
    }
    const row = {
      id: `strategy-${randomUUID()}`,
      ownerUserId: userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      rules: JSON.stringify(parsed.data.rules),
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await app.db.insert(schema.strategies).values(row);
    return reply.send({ id: row.id, name: row.name });
  });

  app.get('/strategies/:id', async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) {
      return;
    }
    const { id } = request.params as { id: string };
    const [row] = await app.db
      .select()
      .from(schema.strategies)
      .where(and(eq(schema.strategies.id, id), eq(schema.strategies.ownerUserId, userId)))
      .limit(1);
    if (!row) {
      return reply.status(404).send({ error: 'strategy not found' });
    }
    return reply.send({ ...row, rules: JSON.parse(row.rules) as unknown });
  });

  app.put('/strategies/:id', async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) {
      return;
    }
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid strategy payload' });
    }
    const { id } = request.params as { id: string };
    const [existing] = await app.db
      .select({ id: schema.strategies.id })
      .from(schema.strategies)
      .where(and(eq(schema.strategies.id, id), eq(schema.strategies.ownerUserId, userId)))
      .limit(1);
    if (!existing) {
      return reply.status(404).send({ error: 'strategy not found' });
    }
    await app.db
      .update(schema.strategies)
      .set({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        rules: JSON.stringify(parsed.data.rules),
        updatedAt: Date.now(),
      })
      .where(eq(schema.strategies.id, id));
    return reply.send({ ok: true });
  });

  app.delete('/strategies/:id', async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) {
      return;
    }
    const { id } = request.params as { id: string };
    const [existing] = await app.db
      .select({ id: schema.strategies.id })
      .from(schema.strategies)
      .where(and(eq(schema.strategies.id, id), eq(schema.strategies.ownerUserId, userId)))
      .limit(1);
    if (!existing) {
      return reply.status(404).send({ error: 'strategy not found' });
    }
    await app.db.delete(schema.strategies).where(eq(schema.strategies.id, id));
    return reply.send({ ok: true });
  });
}
