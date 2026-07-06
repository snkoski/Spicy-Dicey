import { z } from 'zod';

/**
 * The client emits intent only — dice indices into the server-known roll,
 * never dice values (plan §4 guiding rule).
 */
export const turnSelectSchema = z
  .object({
    diceIndices: z.array(z.number().int().min(0).max(5)).min(1).max(6),
  })
  .strict();

export type TurnSelectInput = z.infer<typeof turnSelectSchema>;
