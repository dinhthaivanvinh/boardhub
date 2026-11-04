import { buildServer } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const server = await buildServer(config);

if (!config.REDIS_URL)
  server.app.log.warn('REDIS_URL not set: rooms are kept in memory (single process only)');
if (!config.DATABASE_URL) server.app.log.warn('DATABASE_URL not set: users and history are kept in memory');

await server.app.listen({ host: config.HOST, port: config.PORT });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.app.log.info({ signal }, 'shutting down');
    void server.close().then(() => process.exit(0));
  });
}
