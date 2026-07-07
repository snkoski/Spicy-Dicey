import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Plan §3 schema, SQLite dialect (dev/test). schema.pg.ts mirrors this
 * exactly — the parity test asserts identical table/column names, and CI
 * runs the repository suite against both dialects.
 * Portability rules: uuid-string ids, JSON as text, timestamps as epoch ms.
 */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const guestSessions = sqliteTable(
  'guest_sessions',
  {
    id: text('id').primaryKey(),
    sessionToken: text('session_token').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    upgradedUserId: text('upgraded_user_id'),
  },
  (t) => [
    uniqueIndex('guest_sessions_token_idx').on(t.sessionToken),
    index('guest_sessions_expires_at_idx').on(t.expiresAt),
  ],
);

/** Full-account auth sessions (decision 16: stateful, revocable). */
export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    sessionToken: text('session_token').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [uniqueIndex('auth_sessions_token_idx').on(t.sessionToken)],
);

export const games = sqliteTable(
  'games',
  {
    id: text('id').primaryKey(),
    roomCode: text('room_code').notNull(),
    rulesetConfig: text('ruleset_config').notNull(), // JSON
    status: text('status').notNull(), // lobby|active|finished
    targetScore: integer('target_score').notNull(),
    endGameVariant: text('end_game_variant').notNull(),
    turnTimerSec: integer('turn_timer_sec'),
    spectatorChatEnabled: integer('spectator_chat_enabled', { mode: 'boolean' }).notNull(),
    createdBy: text('created_by').notNull(),
    winnerGamePlayerId: text('winner_game_player_id'),
    startedAt: integer('started_at'),
    finishedAt: integer('finished_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('games_room_code_idx').on(t.roomCode)],
);

export const gamePlayers = sqliteTable(
  'game_players',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id').notNull(),
    userId: text('user_id'),
    guestSessionId: text('guest_session_id'),
    seatIndex: integer('seat_index').notNull(),
    displayName: text('display_name').notNull(),
    isSpectator: integer('is_spectator', { mode: 'boolean' }).notNull().default(false),
    finalScore: integer('final_score'),
    placement: integer('placement'),
    farkleCount: integer('farkle_count'),
    turnCount: integer('turn_count'),
  },
  (t) => [index('game_players_user_id_idx').on(t.userId)],
);

export const strategies = sqliteTable('strategies', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id'),
  name: text('name').notNull(),
  description: text('description'),
  rules: text('rules').notNull(), // JSON: { schemaVersion, keepPolicy, bankPolicy }
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const simulations = sqliteTable('simulations', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id'),
  rulesetConfig: text('ruleset_config').notNull(), // JSON
  numGames: integer('num_games').notNull(),
  seed: integer('seed').notNull(),
  mode: text('mode').notNull(), // head_to_head|round_robin
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
});

export const simulationResults = sqliteTable('simulation_results', {
  id: text('id').primaryKey(),
  simulationId: text('simulation_id').notNull(),
  strategyId: text('strategy_id').notNull(),
  gamesPlayed: integer('games_played').notNull(),
  gamesWon: integer('games_won').notNull(),
  winRate: integer('win_rate_milli').notNull(), // win rate x 1000, integer for portability
  avgFinalScore: integer('avg_final_score').notNull(),
  avgTurns: integer('avg_turns_milli').notNull(),
  avgFarkles: integer('avg_farkles_milli').notNull(),
  scoreDistribution: text('score_distribution').notNull(), // JSON
});
