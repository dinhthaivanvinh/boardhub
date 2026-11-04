import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { GuestRequest, LoginRequest, RegisterRequest, RenameRequest } from '@bg/protocol';
import type { AuthService } from '../auth/auth-service';
import { HubError } from '../errors';

const STATUS: Record<string, number> = {
  'invalid.payload': 400,
  'auth.required': 401,
  'auth.invalid_credentials': 401,
  'auth.email_taken': 409,
  'rate.limited': 429,
};

function bearer(req: FastifyRequest): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const res = schema.safeParse(body ?? {});
  if (!res.success) throw new HubError('invalid.payload');
  return res.data;
}

export function registerRoutes(app: FastifyInstance, auth: AuthService) {
  app.setErrorHandler((err, _req, reply: FastifyReply) => {
    if (err instanceof HubError) return reply.status(STATUS[err.code] ?? 400).send({ code: err.code });
    if ((err as { statusCode?: number }).statusCode === 429)
      return reply.status(429).send({ code: 'rate.limited' });
    app.log.error({ err }, 'request failed');
    return reply.status(500).send({ code: 'internal' });
  });

  const requireUser = async (req: FastifyRequest) => {
    const user = await auth.authenticate(bearer(req));
    if (!user) throw new HubError('auth.required');
    return user;
  };

  app.get('/health', async () => ({ ok: true }));

  app.post('/api/auth/guest', async (req) => auth.guest(parse(GuestRequest, req.body).displayName));

  app.post('/api/auth/register', async (req) => {
    const current = await auth.authenticate(bearer(req));
    return auth.register(parse(RegisterRequest, req.body), current?.id ?? null);
  });

  app.post('/api/auth/login', async (req) => auth.login(parse(LoginRequest, req.body)));

  app.get('/api/me', async (req) => auth.me((await requireUser(req)).id));

  app.patch('/api/me', async (req) => {
    const user = await requireUser(req);
    return auth.rename(user.id, parse(RenameRequest, req.body).displayName);
  });
}
