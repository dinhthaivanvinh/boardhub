import type { FastifyInstance, FastifyRequest } from 'fastify';
import { VisitPing, type VisitorKind } from '@bg/protocol';
import type { AdminService } from '../admin/admin-service';
import type { AuthService } from '../auth/auth-service';
import { HubError } from '../errors';
import type { VisitService } from './visit-service';

const bearer = (req: FastifyRequest) => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
};

/** The visit ping (public) and the admin statistics (docs/05 §2.1). */
export function registerStatsRoutes(
  app: FastifyInstance,
  auth: AuthService,
  admin: AdminService,
  visits: VisitService,
  pingsPerMinute: number,
) {
  // Sent once a day by each browser; with or without the token of a signed-in user.
  app.post(
    '/api/visit',
    { config: { rateLimit: { max: pingsPerMinute, timeWindow: '1 minute' } } },
    async (req) => {
      const parsed = VisitPing.safeParse(req.body ?? {});
      if (!parsed.success) throw new HubError('invalid.payload');
      let kind: VisitorKind = 'anonymous';
      try {
        const user = await auth.authenticate(bearer(req));
        if (user) kind = user.kind;
      } catch {
        // A bad or banned token is counted as a visitor who is not signed in.
      }
      await visits.record(parsed.data.visitorId, kind);
      return { ok: true };
    },
  );

  app.get<{ Querystring: { days?: string } }>('/api/admin/stats', async (req) => {
    const user = await auth.authenticate(bearer(req));
    if (!user) throw new HubError('auth.required');
    admin.requireAdmin(user);
    return visits.stats(Number(req.query.days ?? 14));
  });
}
