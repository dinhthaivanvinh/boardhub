// Games shown on /party (ADR-0008). A game is "ready" once its activity is registered on the server.
export interface PartyGameEntry {
  /** Stable id, also the i18n key under party.games.<id>. */
  id: string;
  emoji: string;
  status: 'ready' | 'soon';
  /** Where "Play now" goes. */
  href?: string;
}

export const PARTY_GAMES: readonly PartyGameEntry[] = [
  { id: 'li-xi', emoji: '🧧', status: 'ready', href: '/party/li-xi/new' },
  { id: 'tet-quiz', emoji: '🎆', status: 'soon' },
  { id: 'fortune-shake', emoji: '🎲', status: 'soon' },
];
