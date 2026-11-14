import { createApp } from './app.js';
import { env } from './config/env.js';
import { db } from './lib/db.js';
import { logger } from './lib/logger.js';

/**
 * The process entrypoint — the parts of Program.cs that belong to hosting,
 * not to the request pipeline. Environment validation happens on the first
 * `env` access (the app factory reads it): a missing DATABASE_URL or a short
 * JWT secret aborts the boot with a named error instead of failing later on
 * the first login, exactly what the original's ValidateOnStart bought.
 *
 * Shutdown closes the Prisma pool before the process exits so PostgreSQL never
 * sees abandoned connections after a redeploy.
 */

// First env access validates the whole schema — fail before anything binds.
const port = env.PORT;

const app = createApp();
const server = app.listen(port, () => {
  logger.info('MOAZ ALIAN API listening on http://localhost:%d', port);
});

function shutdown(signal: string): void {
  logger.info('%s received — closing the HTTP server and the database pool', signal);
  server.close(() => {
    db.$disconnect()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Failed to disconnect cleanly');
        process.exit(1);
      });
  });
  // Force-exit if a keep-alive connection holds the server open — load
  // balancers drain with a timeout, and so do we.
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
