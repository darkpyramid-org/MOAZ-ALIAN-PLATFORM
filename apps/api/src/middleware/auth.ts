import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { readRoles } from '../lib/roles.js';
import { verifyServiceToken, verifyToken } from '../lib/jwt.js';
import { sendStatusPage, sendUnauthorizedChallenge } from '../lib/http.js';

/**
 * Authentication is backed by the current user row on every request. This
 * makes account deletion and token-version increments effective across every
 * API instance without an in-memory revocation cache.
 *
 * Legacy user JWTs without a version are interpreted as version 0; persisted
 * roles always win over token role claims. Service tokens use a separate
 * signing key and explicit token_use=service contract.
 */

export interface AuthContext {
  userId: string | null;
  email: string | null;
  roles: string[];
  isAdmin: boolean;
  canEditContent: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function parseBearer(header: string | undefined): string | null {
  if (header === undefined) return null;
  const parts = header.split(' ');
  const scheme = parts[0] ?? '';
  if (scheme.toLowerCase() !== 'bearer') return null;
  const token = parts.slice(1).join(' ').trim();
  return token === '' ? null : token;
}

function rejectInvalidToken(req: Request, next: NextFunction): void {
  req.auth = undefined;
  (req as Request & { authError?: 'invalid_token' }).authError = 'invalid_token';
  next();
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = parseBearer(req.headers.authorization);
  if (token === null) {
    next();
    return;
  }

  try {
    // Service identities are deliberately separate from user accounts. They
    // are short-lived, signed with AUTH_SERVICE_JWT_SECRET and never receive a
    // userId that could be used for user-owned resources.
    const service = verifyServiceToken(token);
    if (service !== null) {
      req.auth = {
        userId: null,
        email: null,
        roles: [env.AUTH_SERVICE_ROLE],
        isAdmin: true,
        canEditContent: true,
      };
      next();
      return;
    }

    const payload = verifyToken(token);
    if (payload === null || typeof payload.sub !== 'string' || !isUuid(payload.sub)) {
      rejectInvalidToken(req, next);
      return;
    }

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, roles: true, tokenVersion: true },
    });

    const tokenVersion = payload.ver ?? 0;
    if (user === null || !Number.isSafeInteger(tokenVersion) || tokenVersion !== user.tokenVersion) {
      rejectInvalidToken(req, next);
      return;
    }

    // Service role is not a user privilege. Only the separate service-token
    // contract above can receive that permission.
    const roles = user.roles.filter((role) => role.toLowerCase() !== env.AUTH_SERVICE_ROLE.toLowerCase());
    const isAdmin = roles.some((role) => role.toLowerCase() === env.AUTH_ADMIN_ROLE.toLowerCase());
    const canEditContent = isAdmin ||
      roles.some((role) => role.toLowerCase() === env.AUTH_EDITOR_ROLE.toLowerCase());

    req.auth = {
      userId: user.id,
      email: user.email,
      roles,
      isAdmin,
      canEditContent,
    };
    next();
  } catch (error) {
    next(error);
  }
}

function challenge(req: Request, res: Response, invalid: boolean): void {
  sendUnauthorizedChallenge(
    res,
    req.traceId ?? '0000000000000:00000000',
    invalid ? 'invalid_token' : undefined,
  );
}

/** RequireAuthorization(): rejects anonymous callers (and invalid tokens). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const error = (req as Request & { authError?: 'invalid_token' }).authError;
  if (req.auth === undefined) {
    challenge(req, res, error === 'invalid_token');
    return;
  }
  next();
}

/** AuthorizationPolicies.ContentEditor — editors and admins. */
export function requireEditor(req: Request, res: Response, next: NextFunction): void {
  const error = (req as Request & { authError?: 'invalid_token' }).authError;
  if (req.auth === undefined) {
    challenge(req, res, error === 'invalid_token');
    return;
  }
  if (!req.auth.canEditContent) {
    sendUnauthorizedStatus(res, req, 403);
    return;
  }
  next();
}

/** AuthorizationPolicies.SiteAdmin — admins and explicit service tokens. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const error = (req as Request & { authError?: 'invalid_token' }).authError;
  if (req.auth === undefined) {
    challenge(req, res, error === 'invalid_token');
    return;
  }
  if (!req.auth.isAdmin) {
    sendUnauthorizedStatus(res, req, 403);
    return;
  }
  next();
}

function sendUnauthorizedStatus(res: Response, req: Request, status: 401 | 403): void {
  sendStatusPage(res, status, req.traceId ?? '0000000000000:00000000');
}
