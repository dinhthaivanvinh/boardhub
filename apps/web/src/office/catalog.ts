// Office activities shown on /office. An activity becomes "ready" once its package is registered (docs/office/08-roadmap.md).
export type OfficeActivityStatus = 'ready' | 'soon';

export interface OfficeActivityEntry {
  /** Stable id, also the i18n key under office.activities.<id>. */
  id: string;
  emoji: string;
  status: OfficeActivityStatus;
}

export const OFFICE_ACTIVITIES: readonly OfficeActivityEntry[] = [
  { id: 'lucky-animal', emoji: '🎯', status: 'soon' },
  { id: 'team-split', emoji: '🧩', status: 'soon' },
  { id: 'random-order', emoji: '🔢', status: 'soon' },
  { id: 'prize-draw', emoji: '🎁', status: 'soon' },
];
