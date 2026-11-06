// Which area of the site a session belongs to (ADR-0008). Party activities run on the same office sessions
// but live under /party, so the menus, links and QR codes point there.
export type SessionArea = 'office' | 'party';

const PARTY_ACTIVITIES = new Set(['li-xi']);

export const areaOf = (activityId: string | null | undefined): SessionArea =>
  activityId && PARTY_ACTIVITIES.has(activityId) ? 'party' : 'office';

export const areaHome = (area: SessionArea) => (area === 'party' ? '/party' : '/office');

/** /office/s/CODE or /party/s/CODE, plus an optional sub-path such as "/host". */
export const sessionPath = (activityId: string | null | undefined, code: string, sub = '') =>
  `${areaHome(areaOf(activityId))}/s/${code}${sub}`;

/** Session pages a "back" link may point to (the animal studio). */
export const SESSION_PATH_RE = /^\/(office|party)\/s\/[A-Z0-9]{6}$/;
