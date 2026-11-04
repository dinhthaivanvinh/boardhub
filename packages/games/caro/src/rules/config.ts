import { z } from 'zod';

export const configSchema = z.strictObject({
  size: z.union([z.literal(15), z.literal(19)]).default(15),
  winLength: z.literal(5).default(5),
  /** Vietnamese rule: a line blocked on both ends does not win. The board edge counts as a block. */
  blockedEndsRule: z.boolean().default(true),
  /** Standard Gomoku: a line longer than winLength (overline) does not win. */
  exactLength: z.boolean().default(false),
});

export type CaroConfig = z.infer<typeof configSchema>;
