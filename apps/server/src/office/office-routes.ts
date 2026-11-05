import type { FastifyInstance } from 'fastify';
import { OfficeCode } from '@bg/protocol';
import type { OfficeHub } from './office-hub';

export function registerOfficeRoutes(app: FastifyInstance, hub: OfficeHub) {
  app.get<{ Params: { code: string } }>('/api/office/:code', async (req) => {
    const code = OfficeCode.safeParse(req.params.code);
    return code.success ? hub.exists(code.data) : { exists: false, status: null };
  });
}
