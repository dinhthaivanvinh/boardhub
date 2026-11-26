import type { FastifyInstance, FastifyRequest } from 'fastify';
import { LearnEventPing, VisitPing, type VisitorKind } from '@bg/protocol';
import type { AdminService } from '../admin/admin-service';
import type { AuthService } from '../auth/auth-service';
import { HubError } from '../errors';
import type { LearnEventService } from './learn-events';
import type { VisitService } from './visit-service';

const bearer = (req: FastifyRequest) => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
};

/** The visit and learning pings (public) and the admin statistics (docs/05 §2.1). */
export function registerStatsRoutes(
  app: FastifyInstance,
  auth: AuthService,
  admin: AdminService,
  visits: VisitService,
  learning: LearnEventService,
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

  app.get<{ Querystring: { days?: string } }>('/api/admin/stats', async (req) => {
    const user = await auth.authenticate(bearer(req));
    if (!user) throw new HubError('auth.required');
    await admin.requireAdmin(user);
    return visits.stats(Number(req.query.days ?? 14));
  });
}
