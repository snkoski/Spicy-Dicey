import { z } from 'zod';
import { rulesetConfigSchema } from '../entities/ruleset.js';

const displayNameSchema = z.string().trim().min(1).max(30);

/** Decision 4: host picks 30/60/90 seconds, or null for off. */
export const turnTimerSchema = z.union([z.literal(30), z.literal(60), z.literal(90), z.null()]);

export const roomCreateSchema = z.object({
  rulesetConfig: rulesetConfigSchema,
  maxPlayers: z.number().int().min(2).max(8),
  turnTimerSec: turnTimerSchema,
  spectatorChatEnabled: z.boolean(),
  displayName: displayNameSchema,
});

export const roomCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6}$/, 'room codes are 6 characters A-Z 0-9');

export const roomJoinSchema = z.object({
  roomCode: roomCodeSchema,
  displayName: displayNameSchema,
  asSpectator: z.boolean().default(false),
});

export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomJoinInput = z.infer<typeof roomJoinSchema>;
