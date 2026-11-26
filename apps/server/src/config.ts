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
  /** Sign-in, sign-up and guest requests allowed per minute from one address. */
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(20),
  GRACE_MS: z.coerce.number().int().min(1_000).default(60_000),
  BOT_DELAY_MS: z.coerce.number().int().min(0).default(1200),
  /** 0 = run bots on the main thread. */
  BOT_WORKERS: z.coerce.number().int().min(0).default(2),
  /**
   * Comma-separated emails. While nobody has the super_admin role, the registered accounts listed here get it
   * at start-up. Nobody can sign up with a listed address.
   */
  ADMIN_EMAILS: z.string().default(''),
  /** Dev and tests only: signing up with a listed address is allowed and grants super_admin. */
  ADMIN_SELF_REGISTER: z.enum(['true', 'false']).default('false'),
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
  if (parsed.ADMIN_SELF_REGISTER === 'true' && parsed.NODE_ENV === 'production') {
    // Sign-up does not verify addresses: this would hand admin rights to whoever signs up first.
    throw new Error('ADMIN_SELF_REGISTER is not allowed in production');
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
