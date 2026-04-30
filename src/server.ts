import Fastify from 'fastify';
import jwtPlugin from '@fastify/jwt';
import { config } from './config';
import { alertsRoutes } from './routes/alerts';
import { devicesRoutes } from './routes/devices';
import { startRetryWorker } from './services/retry-worker';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    },
  });

  await app.register(jwtPlugin, { secret: config.jwtSecret });

  app.get('/health', async () => ({ ok: true }));

  await app.register(
    async (api) => {
      await api.register(alertsRoutes);
      await api.register(devicesRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}

async function main() {
  const app = await buildServer();
  const retryHandle = startRetryWorker();

  const shutdown = async () => {
    clearInterval(retryHandle);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
