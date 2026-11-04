import { z } from 'zod';

export const configSchema = z.strictObject({
  size: z.union([z.literal(6), z.literal(8), z.literal(10)]).default(8),
});

export type ReversiConfig = z.infer<typeof configSchema>;
