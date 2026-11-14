import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { resolvePermissions, readRoles, type TokenPayload } from '../lib/roles.js';
import { verifyToken } from '../lib/jwt.js';
import { sendStatusPage, sendUnauthorizedChallenge } from '../lib/http.js';

/**
 * Token parsing + authorization gates.
 *
 * Parsing never short-circuits by itself: the ASP.NET pipeline runs
 * UseAuthentication for every request and only endpoints with
 * RequireAuthorization consult the result. Keeping parse separate from gate
 * means anonymous endpoints stay anonymous even when a caller sends a stale
 * token (the token is parsed; a failure is simply ignored there).
 *
 * The challenge bytes match the original's authentication middleware +
 * StatusCodePages pairing: "Bearer" (or "Bearer error=\"invalid_token\"")
 * plus the JSON status page.
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

function parseBearer(header: string | undefined): string | null {
  if (header === undefined) return null;
  const parts = header.split(' ');
  const scheme = parts[0] ?? '';
  if (scheme.toLowerCase() !== 'bearer') return null;
  const token = parts.slice(1).join(' ').trim();
  return token === '' ? null : token;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = parseBearer(req.headers.authorization);

  if (token === null) {
    next();
    return;
  }

  const payload = verifyToken(token) as TokenPayload | null;
  if (payload === null || typeof payload.sub !== 'string' || payload.sub === '') {
    // Signature/issuer/audience/lifetime failure: the challenge carries the
    // error detail a browser console can read.
    req.auth = undefined;
    (req as Request & { authError?: 'invalid_token' }).authError = 'invalid_token';
    next();
    return;
  }

  const roles = readRoles(payload);
  const permissions = resolvePermissions(roles, true, {
    adminRole: env.AUTH_ADMIN_ROLE,
    editorRole: env.AUTH_EDITOR_ROLE,
    serviceRole: env.AUTH_SERVICE_ROLE,
  });

  req.auth = {
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    roles,
    isAdmin: permissions.isAdmin,
    canEditContent: permissions.canEditContent,
  };
  next();
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
    // Bare 403 → the status-page body, exactly like the authorization
    // middleware's rejection (no problem-details envelope here).
    sendUnauthorizedStatus(res, req, 403);
    return;
  }
  next();
}

/** AuthorizationPolicies.SiteAdmin — admins (and service tokens). */
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

/** The bare-status shapes rendered by UseStatusCodePages for 401/403. */
function sendUnauthorizedStatus(res: Response, req: Request, status: 401 | 403): void {
  sendStatusPage(res, status, req.traceId ?? '0000000000000:00000000');
}
