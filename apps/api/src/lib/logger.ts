import pino from 'pino';

/**
 * Structured logger. Pino with a compact dev formatter: the ASP.NET original
 * logged human-readable lines in Development and JSON in Production — pino
 * gives us one code path for both.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino/file', options: { destination: 1 } } }
    : {}),
});
