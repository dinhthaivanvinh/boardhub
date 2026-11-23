/**
 * The header and phone menus. The site is a chess site first (ADR-0010): a link to learning, a link to playing,
 * and "Board game" for the other games. The Office and Party areas still work (direct links, join codes) but
 * are not in the menus; set SHOW_WORKPLACE_AREAS to bring them back (ADR-0007, ADR-0008).
 */
export const SHOW_WORKPLACE_AREAS = false;

export interface NavGroup {
  /** i18n key under nav.* for the group name. */
  key: 'boardGames' | 'office' | 'party';
  /** Paths that belong to the group (for highlighting the current area). */
  prefixes: string[];
  links: { href: string; key: string }[];
}

/** Plain links before the groups. `prefixes` decide which pages mark the link as current. */
export interface NavLink {
  href: string;
  /** i18n key under nav.*. */
  key: 'learnChess' | 'playChess';
  prefixes: string[];
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: '/learn/chess', key: 'learnChess', prefixes: ['/learn'] },
  { href: '/games/chess', key: 'playChess', prefixes: ['/games/chess', '/play/chess'] },
];

const ALL_GROUPS: readonly NavGroup[] = [
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

export const NAV_GROUPS: readonly NavGroup[] = ALL_GROUPS.filter(
  (g) => SHOW_WORKPLACE_AREAS || g.key === 'boardGames',
);

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export const linkOf = (pathname: string) =>
  NAV_LINKS.find((l) => l.prefixes.some((p) => under(pathname, p)))?.key ?? null;

/** The group a page belongs to; a page of a plain link (learn/play chess) belongs to no group. */
export const groupOf = (pathname: string) =>
  linkOf(pathname) ? null : (NAV_GROUPS.find((g) => g.prefixes.some((p) => under(pathname, p)))?.key ?? null);
