import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { rulesetConfigSchema } from '@spicy-dicey/contracts';
import {
  getBuiltinStrategy,
  runSimulation,
  type SimulationResult,
  type StrategyDefinition,
} from '@spicy-dicey/core-engine';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { schema } from '../db/client.js';
import { SESSION_COOKIE } from './auth.js';

const createSchema = z.object({
  strategyIds: z.array(z.string().min(1)).min(2).max(8),
  rulesetConfig: rulesetConfigSchema,
  numGames: z.number().int().min(1).max(200_000),
  seed: z.number().int(),
  mode: z.enum(['head-to-head', 'round-robin']),
});

/**
 * Large-run backend jobs (plan §1 Phase 6, decision 7): a simple in-process
 * async runner — POST to start, poll GET /simulations/:id. No queue at
 * launch; the runner sits behind these routes so a real queue can replace
 * it without any contract change.
 */
export function registerSimulationRoutes(app: FastifyInstance): void {
  const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    const identity = token ? await app.identity.resolve(token) : null;
    if (!identity?.userId) {
      await reply.status(401).send({ error: 'sign in to run backend simulations' });
      return null;
    }
    return identity.userId;
  };

  const resolveStrategy = async (
    id: string,
    userId: string,
  ): Promise<StrategyDefinition | null> => {
    try {
      return getBuiltinStrategy(id);
    } catch {
      const [row] = await app.db
        .select()
        .from(schema.strategies)
        .where(and(eq(schema.strategies.id, id), eq(schema.strategies.ownerUserId, userId)))
        .limit(1);
      return row ? (JSON.parse(row.rules) as StrategyDefinition) : null;
    }
  };

  app.post('/simulations', async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) {
      return;
    }
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid simulation payload' });
    }
    const strategies: Array<{ id: string; definition: StrategyDefinition }> = [];
    for (const id of parsed.data.strategyIds) {
      const definition = await resolveStrategy(id, userId);
      if (!definition) {
        return reply.status(400).send({ error: `unknown strategy '${id}'` });
      }
      strategies.push({ id, definition });
    }

    const id = `sim-${randomUUID()}`;
    await app.db.insert(schema.simulations).values({
      id,
      ownerUserId: userId,
      rulesetConfig: JSON.stringify(parsed.data.rulesetConfig),
      numGames: parsed.data.numGames,
      seed: parsed.data.seed,
      mode: parsed.data.mode.replace('-', '_').replace('-', '_'),
      status: 'running',
      createdAt: Date.now(),
      completedAt: null,
    });

    // In-process background execution (decision 7).
    setImmediate(() => {
      try {
        const result = runSimulation({
          strategies,
          ruleset: parsed.data.rulesetConfig,
          numGames: parsed.data.numGames,
          seed: parsed.data.seed,
          mode: parsed.data.mode,
        });
        void persistResults(id, result).catch(() => markFailed(id));
      } catch {
        void markFailed(id);
      }
    });

    return reply.send({ id, status: 'running' });
  });

  async function persistResults(id: string, result: SimulationResult): Promise<void> {
    await app.db.insert(schema.simulationResults).values(
      Object.entries(result.perStrategy).map(([strategyId, stats]) => ({
        id: `simres-${randomUUID()}`,
        simulationId: id,
        strategyId,
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        winRate: Math.round(stats.winRate * 1000),
        avgFinalScore: Math.round(stats.avgFinalScore),
        avgTurns: Math.round(stats.avgTurns * 1000),
        avgFarkles: Math.round(stats.avgFarkles * 1000),
        scoreDistribution: JSON.stringify(stats.scoreDistribution),
      })),
    );
    await app.db
      .update(schema.simulations)
      .set({ status: 'completed', completedAt: Date.now() })
      .where(eq(schema.simulations.id, id));
  }

  async function markFailed(id: string): Promise<void> {
    await app.db
      .update(schema.simulations)
      .set({ status: 'failed', completedAt: Date.now() })
      .where(eq(schema.simulations.id, id));
  }

  const ownedSimulation = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<{ id: string } | null> => {
    const userId = await requireUser(request, reply);
    if (!userId) {
      return null;
    }
    const { id } = request.params as { id: string };
    const [row] = await app.db
      .select()
      .from(schema.simulations)
      .where(and(eq(schema.simulations.id, id), eq(schema.simulations.ownerUserId, userId)))
      .limit(1);
    if (!row) {
      await reply.status(404).send({ error: 'simulation not found' });
      return null;
    }
    return row;
  };

  app.get('/simulations/:id', async (request, reply) => {
    const row = await ownedSimulation(request, reply);
    if (row) {
      return reply.send(row);
    }
  });

  const resultsFor = async (id: string) => {
    const rows = await app.db
      .select()
      .from(schema.simulationResults)
      .where(eq(schema.simulationResults.simulationId, id));
    return rows.map((r) => ({
      strategyId: r.strategyId,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
      winRate: r.winRate / 1000,
      avgFinalScore: r.avgFinalScore,
      avgTurns: r.avgTurns / 1000,
      avgFarkles: r.avgFarkles / 1000,
      scoreDistribution: JSON.parse(r.scoreDistribution) as unknown,
    }));
  };

  app.get('/simulations/:id/results', async (request, reply) => {
    const row = await ownedSimulation(request, reply);
    if (row) {
      return reply.send(await resultsFor(row.id));
    }
  });

  app.get('/simulations/:id/export', async (request, reply) => {
    const row = await ownedSimulation(request, reply);
    if (!row) {
      return;
    }
    const rows = await resultsFor(row.id);
    const { format } = request.query as { format?: string };
    if (format === 'csv') {
      const header = 'strategyId,gamesPlayed,gamesWon,winRate,avgFinalScore,avgTurns,avgFarkles';
      const lines = rows.map(
        (r) =>
          `${r.strategyId},${r.gamesPlayed},${r.gamesWon},${r.winRate},${r.avgFinalScore},${r.avgTurns},${r.avgFarkles}`,
      );
      return reply.type('text/csv').send([header, ...lines].join('\n') + '\n');
    }
    return reply.send(rows);
  });
}
