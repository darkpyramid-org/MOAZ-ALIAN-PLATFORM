import type { NextFunction, Request, Response } from 'express';
import { isIP } from 'node:net';
import { env } from '../config/env.js';
import { sendStatusPage } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import { incrementSharedRateLimit } from '../lib/rateLimitStore.js';

const WINDOW_MS = 60_000;
const MAX_PARTITIONS = 50_000;

async function isAllowed(
  scope: string,
  req: Request & { auth?: AuthLike },
  memory: Map<string, Bucket>,
  limit: number,
): Promise<boolean> {
  const partition = partitionKey(req);
  const count =
    env.RATE_LIMIT_STORE === 'upstash'
      ? await incrementSharedRateLimit(scope, partition)
      : memoryIncrement(memory, partition);
  return count <= limit;
}

function reject(req: Request & { traceId?: string }, res: Response, status = 429): void {
  sendStatusPage(res, status, req.traceId ?? '0000000000000:00000000');
}

/**
 * Global limit is fail-open on a shared-store outage to preserve read/API
 * availability; editorial writes fail closed below. Monitor this log signal.
 */
export async function globalRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await isAllowed('global', req as Request & { auth?: AuthLike }, globalBuckets, env.RATE_LIMIT_GLOBAL_PER_MINUTE)) {
      next();
    } else {
      reject(req, res);
    }
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'unknown error' }, 'Global rate-limit store unavailable; request allowed');
    next();
  }
}

/** Editorial writes fail closed when shared enforcement is unavailable. */
export async function editorialRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await isAllowed('editorial', req as Request & { auth?: AuthLike }, editorialBuckets, env.RATE_LIMIT_EDITORIAL_PER_MINUTE)) {
      next();
    } else {
      reject(req, res);
    }
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'unknown error' }, 'Editorial rate-limit store unavailable; write rejected');
    reject(req, res, 503);
  }
}
