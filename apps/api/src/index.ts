import { createApp } from './app.js';
import { env } from './config/env.js';
import { db } from './lib/db.js';
import { logger } from './lib/logger.js';

/**
 * The process entrypoint.
 *
 * Exports `app` as default so Vercel Serverless / Express framework can invoke
 * requests directly without a hanging port listener.
 * In standalone / local execution (!process.env.VERCEL), it starts the HTTP server.
 */
const app = createApp();

if (!process.env.VERCEL) {
  const port = env.PORT;
  const server = app.listen(port, () => {
    logger.info('MOAZ ALIAN API listening on http://localhost:%d', port);
  });

  const shutdown = (signal: string): void => {
    logger.info('%s received — closing the HTTP server and the database pool', signal);
    server.close(() => {
      db.$disconnect()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Failed to disconnect cleanly');
          process.exit(1);
        });
    });
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
