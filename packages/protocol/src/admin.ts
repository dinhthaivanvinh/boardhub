import { z } from 'zod';

// Admin and moderation (FR-CAT-03, FR-ADM-02). REST only; see docs/05 §2.1.

const UserId = z.uuid();

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

/** POST /api/visit: sent once a day per browser. `visitorId` is a random id the browser keeps; it names no one. */
export const VisitPing = z.strictObject({ visitorId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/) });

/** Who a visitor was that day: nobody in particular, a guest account, or a registered account. */
export type VisitorKind = 'anonymous' | 'guest' | 'registered';

/** Distinct visitors of one day (Vietnam time, `YYYY-MM-DD`). A visitor counts once, as the highest kind they had. */
export interface DayVisits {
  day: string;
  anonymous: number;
  guest: number;
  registered: number;
  total: number;
}

/** GET /api/admin/stats: today and the days before it, newest first. */
export interface AdminStats {
  today: DayVisits;
  days: DayVisits[];
}
