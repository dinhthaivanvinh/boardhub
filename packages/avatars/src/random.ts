import { createRng, type Rng } from '@bg/engine';
import {
  ACCESSORIES,
  BACKGROUNDS,
  EYES,
  FUN_PAIRS,
  MOUTHS,
  NATURAL,
  PALETTE,
  PATTERNS,
  SPECIES,
} from './catalog';
import type { Avatar } from './schema';

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(0, items.length)]!;

/**
 * A good-looking random avatar. Most of the time the species keeps its natural colours; otherwise a
 * hand-picked colour pair. One in three has no accessory.
 */
export function randomAvatar(rng: Rng): Avatar {
  const species = pick(rng, SPECIES);
  const natural = NATURAL[species];
  const [body, accent] = rng.next() < 0.6 ? [natural.body, natural.accent] : pick(rng, FUN_PAIRS);
  return {
    v: 1,
    species,
    body,
    accent,
    pattern: rng.next() < 0.6 ? natural.pattern : pick(rng, PATTERNS),
    eyes: pick(rng, EYES),
    mouth: pick(rng, MOUTHS),
    accessory: rng.next() < 0.33 ? 'none' : pick(rng, ACCESSORIES.slice(1)),
    accessoryColor: pick(rng, PALETTE.slice(16)),
    background: pick(rng, BACKGROUNDS),
  };
}

/** The avatar a new player starts with: random but always the same for the same id. */
export const defaultAvatar = (id: string): Avatar => randomAvatar(createRng(`avatar:${id}`, 0));
