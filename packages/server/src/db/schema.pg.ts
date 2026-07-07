import { bigint, boolean, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

/** Postgres mirror of schema.sqlite.ts — see the parity test. */

const epochMs = (name: string) => bigint(name, { mode: 'number' });

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: epochMs('created_at').notNull(),
  updatedAt: epochMs('updated_at').notNull(),
});

export const guestSessions = pgTable(
  'guest_sessions',
  {
    id: text('id').primaryKey(),
    sessionToken: text('session_token').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: epochMs('created_at').notNull(),
    expiresAt: epochMs('expires_at').notNull(),
    upgradedUserId: text('upgraded_user_id'),
  },
  (t) => [
    uniqueIndex('guest_sessions_token_idx').on(t.sessionToken),
    index('guest_sessions_expires_at_idx').on(t.expiresAt),
  ],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    sessionToken: text('session_token').notNull(),
    userId: text('user_id').notNull(),
    createdAt: epochMs('created_at').notNull(),
    expiresAt: epochMs('expires_at').notNull(),
  },
  (t) => [uniqueIndex('auth_sessions_token_idx').on(t.sessionToken)],
);

export const games = pgTable(
  'games',
  {
    id: text('id').primaryKey(),
    roomCode: text('room_code').notNull(),
    rulesetConfig: text('ruleset_config').notNull(),
    status: text('status').notNull(),
    targetScore: integer('target_score').notNull(),
    endGameVariant: text('end_game_variant').notNull(),
    turnTimerSec: integer('turn_timer_sec'),
    spectatorChatEnabled: boolean('spectator_chat_enabled').notNull(),
    createdBy: text('created_by').notNull(),
    winnerGamePlayerId: text('winner_game_player_id'),
    startedAt: epochMs('started_at'),
    finishedAt: epochMs('finished_at'),
    createdAt: epochMs('created_at').notNull(),
  },
  (t) => [index('games_room_code_idx').on(t.roomCode)],
);

export const gamePlayers = pgTable(
  'game_players',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id').notNull(),
    userId: text('user_id'),
    guestSessionId: text('guest_session_id'),
    seatIndex: integer('seat_index').notNull(),
    displayName: text('display_name').notNull(),
    isSpectator: boolean('is_spectator').notNull().default(false),
    finalScore: integer('final_score'),
    placement: integer('placement'),
    farkleCount: integer('farkle_count'),
    turnCount: integer('turn_count'),
  },
  (t) => [index('game_players_user_id_idx').on(t.userId)],
);

export const strategies = pgTable('strategies', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id'),
  name: text('name').notNull(),
  description: text('description'),
  rules: text('rules').notNull(),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  createdAt: epochMs('created_at').notNull(),
  updatedAt: epochMs('updated_at').notNull(),
});

export const simulations = pgTable('simulations', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id'),
  rulesetConfig: text('ruleset_config').notNull(),
  numGames: integer('num_games').notNull(),
  seed: integer('seed').notNull(),
  mode: text('mode').notNull(),
  status: text('status').notNull(),
  createdAt: epochMs('created_at').notNull(),
  completedAt: epochMs('completed_at'),
});

export const simulationResults = pgTable('simulation_results', {
  id: text('id').primaryKey(),
  simulationId: text('simulation_id').notNull(),
  strategyId: text('strategy_id').notNull(),
  gamesPlayed: integer('games_played').notNull(),
  gamesWon: integer('games_won').notNull(),
  winRate: integer('win_rate_milli').notNull(),
  avgFinalScore: integer('avg_final_score').notNull(),
  avgTurns: integer('avg_turns_milli').notNull(),
  avgFarkles: integer('avg_farkles_milli').notNull(),
  scoreDistribution: text('score_distribution').notNull(),
});

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    createdAt: epochMs('created_at').notNull(),
    expiresAt: epochMs('expires_at').notNull(),
    usedAt: epochMs('used_at'),
  },
  (t) => [uniqueIndex('email_tokens_token_idx').on(t.token)],
);
