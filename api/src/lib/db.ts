import { PrismaClient } from '@prisma/client';

/**
 * The Prisma client. The DATABASE_URL carries `?schema=library`, which pins the
 * search_path so every model below maps to the library schema — never public.
 * One process-wide client: Prisma pools connections internally and a client per
 * request would exhaust Postgres connections under modest concurrency.
 */
export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});
