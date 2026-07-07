CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_idx` ON `auth_sessions` (`session_token`);--> statement-breakpoint
CREATE TABLE `game_players` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`user_id` text,
	`guest_session_id` text,
	`seat_index` integer NOT NULL,
	`display_name` text NOT NULL,
	`is_spectator` integer DEFAULT false NOT NULL,
	`final_score` integer,
	`placement` integer,
	`farkle_count` integer,
	`turn_count` integer
);
--> statement-breakpoint
CREATE INDEX `game_players_user_id_idx` ON `game_players` (`user_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`ruleset_config` text NOT NULL,
	`status` text NOT NULL,
	`target_score` integer NOT NULL,
	`end_game_variant` text NOT NULL,
	`turn_timer_sec` integer,
	`spectator_chat_enabled` integer NOT NULL,
	`created_by` text NOT NULL,
	`winner_game_player_id` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `games_room_code_idx` ON `games` (`room_code`);--> statement-breakpoint
CREATE TABLE `guest_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`upgraded_user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_sessions_token_idx` ON `guest_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `guest_sessions_expires_at_idx` ON `guest_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `simulation_results` (
	`id` text PRIMARY KEY NOT NULL,
	`simulation_id` text NOT NULL,
	`strategy_id` text NOT NULL,
	`games_played` integer NOT NULL,
	`games_won` integer NOT NULL,
	`win_rate_milli` integer NOT NULL,
	`avg_final_score` integer NOT NULL,
	`avg_turns_milli` integer NOT NULL,
	`avg_farkles_milli` integer NOT NULL,
	`score_distribution` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text,
	`ruleset_config` text NOT NULL,
	`num_games` integer NOT NULL,
	`seed` integer NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text,
	`name` text NOT NULL,
	`description` text,
	`rules` text NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);