import type { ResultTone } from './ResultOverlay';

/** Reasons that are about what the losing side did, so their wording depends on who is reading. */
const ABOUT_THE_LOSER = new Set(['resign', 'abandon', 'timeout']);

type T = ((key: string, values?: Record<string, string | number>) => string) & { has(key: string): boolean };

/**
 * The line under the result in the overlay. "Resigned" must read "You resigned" for the player who
 * gave up, "Your opponent resigned" for the winner, and name the player for anyone else.
 */
export function resultDetail(
  t: T,
  tone: ResultTone,
  reason: string,
  opts: { loserName: string; reasonText: (reason: string) => string },
): string {
  if (ABOUT_THE_LOSER.has(reason) && tone !== 'draw') {
    if (tone === 'loss') return t(`match.overlay.reasons.${reason}.you`);
    if (tone === 'win') return t(`match.overlay.reasons.${reason}.opponent`);
    return t(`match.overlay.reasons.${reason}.player`, { player: opts.loserName });
  }
  const text = opts.reasonText(reason);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
