import { z } from 'zod';
import { ACCESSORIES, EYES, MOUTHS, PALETTE, PATTERNS, SPECIES } from './catalog';

const Color = z.enum(PALETTE);

/** Avatar v1. Only catalog ids and palette colours: nothing else can reach the stage (CLAUDE.md rule 13). */
export const AvatarSchema = z.strictObject({
  v: z.literal(1),
  species: z.enum(SPECIES),
  body: Color,
  accent: Color,
  pattern: z.enum(PATTERNS),
  eyes: z.enum(EYES),
  mouth: z.enum(MOUTHS),
  accessory: z.enum(ACCESSORIES),
  accessoryColor: Color,
  background: Color,
});

export type Avatar = z.infer<typeof AvatarSchema>;

export { ACCESSORIES, EYES, MOUTHS, PALETTE, PATTERNS, SPECIES } from './catalog';
