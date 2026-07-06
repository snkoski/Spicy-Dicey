import { z } from 'zod';

export const chatSendSchema = z.object({
  text: z.string().min(1).max(500),
});

/**
 * Moderation-ready message shape (plan §4): stable ids, sender ids,
 * timestamps, and a filtered flag — v1 only auto-filters and never
 * persists, but the contract already supports report/mute/block.
 */
export const chatMessageSchema = z.object({
  messageId: z.string().min(1),
  senderId: z.string().min(1),
  displayName: z.string().min(1),
  text: z.string(),
  ts: z.number().int().nonnegative(),
  filtered: z.boolean(),
});

export type ChatSendInput = z.infer<typeof chatSendSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
