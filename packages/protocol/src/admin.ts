import { z } from 'zod';

// Admin and moderation (FR-CAT-03, FR-ADM-02). REST only; see docs/05 §2.1.

const UserId = z.uuid();

/** Admin roles (table `roles`). Until each role gets its own permissions, only `super_admin` may use /admin. */
export const ROLE_IDS = ['super_admin', 'content_manager', 'moderator', 'analyst'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const REPORT_REASONS = ['cheating', 'abuse', 'spam', 'name', 'other'] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

/** POST /api/reports: a player reports another player, usually from a room. */
export const ReportCreate = z.strictObject({
  targetUserId: UserId,
  reason: ReportReasonSchema,
  note: z.string().trim().max(500).default(''),
  /** The room where it happened: lets the server attach the target's chat lines as evidence. */
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/)
    .optional(),
});
export type ReportCreatePayload = z.input<typeof ReportCreate>;

/** What an admin decides for a report. "mute" stops chat; "ban" blocks the account. */
export const REPORT_ACTIONS = ['dismiss', 'mute', 'ban'] as const;
export const ReportActionSchema = z.enum(REPORT_ACTIONS);
export type ReportAction = z.infer<typeof ReportActionSchema>;

/** Sanction lengths offered to admins, in hours; null = until lifted. */
export const SANCTION_HOURS = [24, 24 * 7, 24 * 30, null] as const;

export const ReportResolve = z.strictObject({
  action: ReportActionSchema,
  /** For mute/ban: how long, in hours (max one year). Omitted or null = until lifted. */
  hours: z
    .number()
    .int()
    .min(1)
    .max(24 * 366)
    .nullable()
    .default(null),
});
export type ReportResolvePayload = z.input<typeof ReportResolve>;

/** PUT /api/admin/users/:id/sanctions: set or lift (null) a mute or a ban by hand. */
export const SanctionsUpdate = z.strictObject({
  mutedUntil: z.number().int().nonnegative().nullable().optional(),
  bannedUntil: z.number().int().nonnegative().nullable().optional(),
});

export const GameSettingUpdate = z.strictObject({ enabled: z.boolean() });

export interface ReportEvidenceLine {
  text: string;
  at: number;
}

export interface AdminReport {
  id: string;
  reporter: { id: string; name: string };
  target: { id: string; name: string; kind: 'guest' | 'registered' };
  reason: ReportReason;
  note: string;
  roomCode: string | null;
  /** The target's last chat lines in that room when the report was made (chat is not kept otherwise). */
  evidence: ReportEvidenceLine[];
  status: 'open' | 'resolved';
  action: ReportAction | null;
  createdAt: number;
  resolvedAt: number | null;
  /** How many open reports the target has in total (several people reporting the same player). */
  openAgainstTarget: number;
  /** The target's current sanctions. */
  sanctions: UserSanctions;
}

export interface UserSanctions {
  /** Epoch ms, or null when not muted/banned. A far-future value means "until lifted". */
  mutedUntil: number | null;
  bannedUntil: number | null;
}

export interface SanctionedUser extends UserSanctions {
  id: string;
  name: string;
}

export interface AdminGameSetting {
  gameId: string;
  enabled: boolean;
  updatedAt: number | null;
}

/** GET /api/games/status: public, read by the catalog and the setup forms. */
export interface GamesStatus {
  disabled: string[];
}

/** "Until lifted" is stored as this date (year 9999), so every sanction has an end time. */
export const SANCTION_FOREVER = Date.UTC(9999, 11, 31);

// Visitor statistics: how many people used the site on a day (docs/05 §2.1, docs/06 §1 daily_visits).

const VisitorId = z.string().regex(/^[A-Za-z0-9-]{16,64}$/);

/**
 * POST /api/visit: sent once a day per browser and again for every new session. `visitorId` is a random id the
 * browser keeps; it names no one.
 */
export const VisitPing = z.strictObject({
  visitorId: VisitorId,
  /** The browser was away for 30 minutes or more: one more session today. */
  newSession: z.boolean().optional(),
});

export const LEARN_KINDS = ['lesson', 'practice', 'puzzle'] as const;
export type LearnKind = (typeof LEARN_KINDS)[number];

/** POST /api/learn-events: sent when a lesson, practice or puzzle is finished, signed in or not. */
export const LearnEventPing = z.strictObject({
  visitorId: VisitorId,
  kind: z.enum(LEARN_KINDS),
  itemId: z.string().regex(/^[a-z0-9-]{1,40}$/),
});

/** Who a visitor was that day: nobody in particular, a guest account, or a registered account. */
export type VisitorKind = 'anonymous' | 'guest' | 'registered';

/** Distinct visitors of one day (Vietnam time, `YYYY-MM-DD`). A visitor counts once, as the highest kind they had. */
export interface DayVisits {
  day: string;
  anonymous: number;
  guest: number;
  registered: number;
  total: number;
  /** Visits that day: one visitor who left and came back later counts more than once. */
  sessions: number;
}

// Admin dashboard (docs/05 §2.1). Every day is a `YYYY-MM-DD` in Vietnam time.

/** The longest range a dashboard or statistics request may cover. */
export const MAX_RANGE_DAYS = 90;
const DAY_MS = 86_400_000;
/** Vietnam has no daylight saving: a fixed +7 hours. */
const VN_OFFSET_MS = 7 * 3_600_000;

export interface DateRange {
  from: string;
  to: string;
}

/** The day of a moment, in Vietnam time. */
export const vnDay = (at: number): string => new Date(at + VN_OFFSET_MS).toISOString().slice(0, 10);
/** The first moment of a Vietnam day. */
export const vnDayStart = (day: string): number => Date.parse(day + 'T00:00:00Z') - VN_OFFSET_MS;
export const addDays = (day: string, n: number): string =>
  new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
/** How many days the range has, both ends included. */
export const spanDays = (r: DateRange): number =>
  Math.round((Date.parse(r.to) - Date.parse(r.from)) / DAY_MS) + 1;
/** Every day of the range, oldest first. */
export const daysOf = (r: DateRange): string[] =>
  Array.from({ length: Math.max(0, spanDays(r)) }, (_, i) => addDays(r.from, i));
/** The range of the same length that ends the day before this one starts. */
export const previousRange = (r: DateRange): DateRange => ({
  from: addDays(r.from, -spanDays(r)),
  to: addDays(r.from, -1),
});

const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // rejects days that do not exist, such as 2026-02-31
  .refine((d) => !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && addDays(d, 0) === d);

export const DateRangeQuery = z
  .object({ from: Day, to: Day })
  .refine((r) => r.from <= r.to && spanDays(r) <= MAX_RANGE_DAYS);

/** Distinct visitors over a range: each counts once, as the highest kind they had in it. */
export interface VisitorTotals {
  total: number;
  anonymous: number;
  guest: number;
  registered: number;
  sessions: number;
}

/** GET /api/admin/stats: today, and the days of the range (newest first). */
export interface AdminStats {
  today: DayVisits;
  days: DayVisits[];
  range: DateRange;
  unique: VisitorTotals;
  /** The same for the range just before; null when the stored days do not cover all of it. */
  previous: VisitorTotals | null;
  /** The first day with any stored visit, or null. */
  since: string | null;
}

/** A number with the one for the range just before (null when it cannot be known). */
export interface Compared {
  value: number;
  previous: number | null;
}

/** Accounts that exist at the end of the range, and how many of them were made in it. */
export interface AccountMetric {
  total: number;
  added: Compared;
}

export interface OverviewDay {
  day: string;
  /** Accounts that exist at the end of this day. */
  registered: number;
  guest: number;
  chessGames: number;
  /** Learning numbers are null before they started being collected. */
  learners: number | null;
  lesson: number | null;
  practice: number | null;
  puzzle: number | null;
}

export type AdminActivity =
  | { type: 'signup'; at: number; name: string; kind: 'guest' | 'registered' }
  | { type: 'match'; at: number; gameId: string; players: (string | null)[] }
  | { type: 'report'; at: number; name: string; reason: ReportReason }
  | { type: 'learn'; at: number; name: string | null; kind: LearnKind; itemId: string };

/** GET /api/admin/overview?from&to */
export interface AdminOverview {
  range: DateRange;
  accounts: { all: AccountMetric; registered: AccountMetric; guest: AccountMetric };
  /** Children (accounts, or browsers when not signed in) who finished something in the range. */
  learners: Compared;
  /** Lessons in the curriculum. */
  lessonsTotal: number;
  /** Lessons finished in the range, one per child and lesson; `saved` counts what accounts have ever saved. */
  completedLessons: Compared & { saved: number };
  solvedPuzzles: Compared & { saved: number };
  /** Chess games played through the server, up to the end of the range. */
  chess: { total: number; started: Compared };
  /** The first day learning was recorded, or null when nothing has been yet. */
  learningSince: string | null;
  days: OverviewDay[];
  /** How many children finished each lesson in the range, most first. */
  lessons: { itemId: string; learners: number }[];
  /** The latest things that happened, newest first (not limited to the range). */
  recent: AdminActivity[];
}
