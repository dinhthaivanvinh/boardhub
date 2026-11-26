import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import {
  GameSettingUpdate,
  ReportCreate,
  ReportResolve,
  SanctionsUpdate,
  type GamesStatus,
} from '@bg/protocol';
import type { AuthService } from '../auth/auth-service';
import { HubError } from '../errors';
import type { AdminService } from './admin-service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const res = schema.safeParse(body ?? {});
  if (!res.success) throw new HubError('invalid.payload');
  return res.data;
}

/** Admin pages and player reports (docs/05 §2.1). Every /api/admin route checks the admin role. */
export function registerAdminRoutes(app: FastifyInstance, auth: AuthService, admin: AdminService) {
  const requireUser = async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    const user = await auth.authenticate(header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!user) throw new HubError('auth.required');
    return user;
  };
  const requireAdmin = async (req: FastifyRequest) => {
    const user = await requireUser(req);
    await admin.requireAdmin(user);
    return user;
  };

  // Public: the catalog greys out games that are turned off.
  app.get('/api/games/status', async (): Promise<GamesStatus> => ({
    disabled: [...(await admin.disabledGames())].sort(),
  }));

  app.post('/api/reports', async (req) => {
    const user = await requireUser(req);
    return admin.report(user, parse(ReportCreate, req.body));
  });

  app.get('/api/admin/games', async (req) => {
    await requireAdmin(req);
    return { games: await admin.gameSettings() };
  });

  app.put<{ Params: { gameId: string } }>('/api/admin/games/:gameId', async (req) => {
    const user = await requireAdmin(req);
    const { enabled } = parse(GameSettingUpdate, req.body);
    return admin.setGameEnabled(user, req.params.gameId, enabled);
  });

  app.get<{ Querystring: { status?: string } }>('/api/admin/reports', async (req) => {
    const user = await requireAdmin(req);
    const status = req.query.status === 'resolved' ? 'resolved' : 'open';
    return { reports: await admin.listReports(user, status) };
  });

  app.post<{ Params: { id: string } }>('/api/admin/reports/:id/resolve', async (req) => {
    const user = await requireAdmin(req);
    if (!UUID.test(req.params.id)) throw new HubError('report.not_found');
    const { action, hours } = parse(ReportResolve, req.body);
    return { report: await admin.resolve(user, req.params.id, action, hours) };
  });

  app.get('/api/admin/sanctions', async (req) => {
    const user = await requireAdmin(req);
    return { users: await admin.sanctioned(user) };
  });

  app.put<{ Params: { id: string } }>('/api/admin/users/:id/sanctions', async (req) => {
    const user = await requireAdmin(req);
    if (!UUID.test(req.params.id)) throw new HubError('user.not_found');
    const patch = parse(SanctionsUpdate, req.body);
    return { sanctions: await admin.setSanctions(user, req.params.id, patch) };
  });
}
