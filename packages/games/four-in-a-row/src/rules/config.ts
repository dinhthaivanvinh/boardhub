import { z } from 'zod';

export const configSchema = z.strictObject({
  columns: z.union([z.literal(7), z.literal(8), z.literal(9)]).default(7),
  rows: z.union([z.literal(6), z.literal(7)]).default(6),
});

export type FourConfig = z.infer<typeof configSchema>;

/** Pieces in a row needed to win. Fixed by the rules, not configurable. */
export const WIN_LENGTH = 4;
