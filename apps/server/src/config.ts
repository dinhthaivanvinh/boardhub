import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-change-me-in-production-0123456789';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().default(4000),
  /** Comma-separated list of allowed web origins. Unset in dev = allow any origin (LAN play). */
  CORS_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  /** Unset = keep live rooms in memory (single process, lost on restart). */
  REDIS_URL: z.string().url().optional(),
  /** Unset = keep users and history in memory (dev only). */
  DATABASE_URL: z.string().url().optional(),
  GRACE_MS: z.coerce.number().int().min(1_000).default(60_000),
  BOT_DELAY_MS: z.coerce.number().int().min(0).default(400),
  /** 0 = run bots on the main thread. */
  BOT_WORKERS: z.coerce.number().int().min(0).default(2),
  /** Comma-separated emails of registered accounts that may open /admin (M4b). */
  ADMIN_EMAILS: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type ServerConfig = z.infer<typeof EnvSchema> & {
  JWT_SECRET: string;
  corsOrigins: string[] | true;
  adminEmails: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = EnvSchema.parse(env);
  if (!parsed.JWT_SECRET && parsed.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  if (!parsed.CORS_ORIGIN && parsed.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGIN is required in production');
  }
  return {
    ...parsed,
    JWT_SECRET: parsed.JWT_SECRET ?? DEV_SECRET,
    corsOrigins: parsed.CORS_ORIGIN ? parsed.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
    adminEmails: parsed.ADMIN_EMAILS.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}
