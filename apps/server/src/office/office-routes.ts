import type { FastifyInstance } from 'fastify';
import { OfficeCode } from '@bg/protocol';
import type { OfficeHub } from './office-hub';

export function registerOfficeRoutes(app: FastifyInstance, hub: OfficeHub) {
  app.get<{ Params: { code: string } }>('/api/office/:code', async (req) => {
    const code = OfficeCode.safeParse(req.params.code);
    return code.success ? hub.exists(code.data) : { exists: false, status: null };
  });

  // Revealed draws of a session (history), newest first.
  app.get<{ Params: { code: string } }>('/api/office/:code/draws', async (req, reply) => {
    const code = OfficeCode.safeParse(req.params.code);
    const draws = code.success ? await hub.listDraws(code.data) : null;
    if (!draws) return reply.status(404).send({ code: 'office.not_found' });
    return { draws };
  });

  // A revealed draw, for the verification page (docs/office/06 §2). Unrevealed draws are never served.
  app.get<{ Params: { code: string; drawId: string } }>(
    '/api/office/:code/draws/:drawId',
    async (req, reply) => {
      const code = OfficeCode.safeParse(req.params.code);
      const draw = code.success ? await hub.getDraw(code.data, req.params.drawId) : null;
      if (!draw) return reply.status(404).send({ code: 'office.not_found' });
      return draw;
    },
  );
}
