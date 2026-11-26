import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  DateRangeQuery,
  LearnEventPing,
  VisitPing,
  vnDay,
  type DateRange,
  type VisitorKind,
} from '@bg/protocol';
import type { AdminService } from '../admin/admin-service';
import type { AnalyticsService } from '../analytics/analytics-service';
import type { AuthService } from '../auth/auth-service';
import { HubError } from '../errors';
import type { LearnEventService } from './learn-events';
import type { VisitService } from './visit-service';

const bearer = (req: FastifyRequest) => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
};

/** A range asked for by the admin pages: well formed, at most 90 days, not in the future. */
function rangeOf(query: unknown): DateRange {
  const res = DateRangeQuery.safeParse(query);
  if (!res.success || res.data.to > vnDay(Date.now())) throw new HubError('invalid.payload');
  return res.data;
}

/** The visit and learning pings (public), the dashboard and the visitor statistics (docs/05 §2.1). */
export function registerStatsRoutes(
  app: FastifyInstance,
  auth: AuthService,
  admin: AdminService,
  visits: VisitService,
  learning: LearnEventService,
  analytics: AnalyticsService,
  pingsPerMinute: number,
) {
  const limited = { config: { rateLimit: { max: pingsPerMinute, timeWindow: '1 minute' } } };

  // Public pings: a bad or banned token counts as someone who is not signed in.
  const signedIn = (req: FastifyRequest) => auth.authenticate(bearer(req)).catch(() => null);

  // Sent once a day and at every new session by each browser, with or without the token of a signed-in user.
  app.post('/api/visit', limited, async (req) => {
    const parsed = VisitPing.safeParse(req.body ?? {});
    if (!parsed.success) throw new HubError('invalid.payload');
    const kind: VisitorKind = (await signedIn(req))?.kind ?? 'anonymous';
    await visits.record(parsed.data.visitorId, kind, parsed.data.newSession);
    return { ok: true };
  });

  // Sent when a lesson, practice or puzzle is finished.
  app.post('/api/learn-events', limited, async (req) => {
    const parsed = LearnEventPing.safeParse(req.body ?? {});
    if (!parsed.success) throw new HubError('invalid.payload');
    const { visitorId, kind, itemId } = parsed.data;
    await learning.record({ userId: (await signedIn(req))?.id ?? null, visitorId }, kind, itemId);
    return { ok: true };
  });

  const requireAdmin = async (req: FastifyRequest) => {
    const user = await auth.authenticate(bearer(req));
    if (!user) throw new HubError('auth.required');
    await admin.requireAdmin(user);
  };

  app.get<{ Querystring: { days?: string; from?: string; to?: string } }>('/api/admin/stats', async (req) => {
    await requireAdmin(req);
    const { days, from, to } = req.query;
    // `days` is the older form of the request: the last n days.
    return visits.stats(from || to ? rangeOf(req.query) : visits.lastDays(Number(days ?? 14)));
  });

  app.get('/api/admin/overview', async (req) => {
    await requireAdmin(req);
    return analytics.overview(rangeOf(req.query));
  });
}
