/** The three areas and their pages, shared by the header menus and the phone menu (ADR-0007, ADR-0008). */
export interface NavGroup {
  /** i18n key under nav.* for the group name. */
  key: 'boardGames' | 'office' | 'party';
  /** Paths that belong to the group (for highlighting the current area). */
  prefixes: string[];
  links: { href: string; key: string }[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: 'boardGames',
    prefixes: ['/board-games', '/games', '/play', '/room', '/live', '/leaderboard', '/replay', '/queue'],
    links: [
      { href: '/board-games', key: 'catalog' },
      { href: '/live', key: 'live' },
      { href: '/leaderboard', key: 'leaderboard' },
    ],
  },
  {
    key: 'office',
    prefixes: ['/office'],
    links: [
      { href: '/office', key: 'activities' },
      { href: '/office/avatar', key: 'myAnimal' },
    ],
  },
  {
    key: 'party',
    prefixes: ['/party'],
    links: [{ href: '/party', key: 'partyGames' }],
  },
];

export const groupOf = (pathname: string) =>
  NAV_GROUPS.find((g) => g.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)))?.key ?? null;
