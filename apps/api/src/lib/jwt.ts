import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * User access tokens carry the current persisted token version. A missing
 * version is treated as 0 for compatibility with pre-migration tokens; any
 * password or role mutation increments the database value and revokes them.
 */
export interface AuthUserRecord {
  id: string;
  email: string;
  roles: string[];
  tokenVersion?: number;
}

export function issueToken(user: AuthUserRecord): string {
  const metadata = JSON.stringify({ roles: user.roles });

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      token_use: 'user',
      ver: user.tokenVersion ?? 0,
      role: 'authenticated',
      app_metadata: metadata,
      roles: user.roles,
    },
    env.AUTH_JWT_SECRET,
    {
      issuer: env.resolveIssuer(),
      audience: env.AUTH_AUDIENCE,
      expiresIn: '7d',
    },
  );
}

export interface VerifiedToken {
  sub: string;
  email?: string;
  token_use?: 'user' | 'service';
  ver?: number;
  role?: string | string[];
  'app_metadata'?: string;
  roles?: string | string[];
  iat?: number;
  exp?: number;
}

/**
 * Verifies the user-token signing contract. Legacy user tokens without
 * token_use/version remain verifiable, but middleware resolves roles from the
 * database and compares their effective version against the current record.
 */
export function verifyToken(token: string): VerifiedToken | null {
  try {
    const payload = jwt.verify(token, env.AUTH_JWT_SECRET, {
      issuer: env.resolveIssuer(),
      audience: env.AUTH_AUDIENCE,
      clockTolerance: 30,
      algorithms: ['HS256'],
    });
    if (typeof payload === 'string' || payload === null) return null;
    const verified = payload as VerifiedToken;
    if (verified.token_use !== undefined && verified.token_use !== 'user') return null;
    if (verified.ver !== undefined && (!Number.isSafeInteger(verified.ver) || verified.ver < 0)) return null;
    return verified;
  } catch {
    return null;
  }
}

export interface VerifiedServiceToken {
  sub: string;
  token_use: 'service';
  role: string;
  iat: number;
  exp: number;
}

/**
 * Explicit non-user trust contract: service tokens use a different 256-bit
 * secret, a required token_use=service claim, the configured service role,
 * and a maximum one-hour lifetime. No database user lookup is performed.
 */
export function issueServiceToken(subject: string): string {
  const secret = env.AUTH_SERVICE_JWT_SECRET;
  if (secret === undefined) throw new Error('AUTH_SERVICE_JWT_SECRET is not configured.');
  if (subject.trim() === '' || subject.length > 255) throw new Error('Service token subject is invalid.');

  return jwt.sign(
    { sub: subject, token_use: 'service', role: env.AUTH_SERVICE_ROLE },
    secret,
    {
      issuer: env.resolveIssuer(),
      audience: env.AUTH_AUDIENCE,
      expiresIn: '1h',
    },
  );
}

export function verifyServiceToken(token: string): VerifiedServiceToken | null {
  const secret = env.AUTH_SERVICE_JWT_SECRET;
  if (secret === undefined) return null;

  try {
    const payload = jwt.verify(token, secret, {
      issuer: env.resolveIssuer(),
      audience: env.AUTH_AUDIENCE,
      clockTolerance: 0,
      algorithms: ['HS256'],
    });
    if (typeof payload === 'string' || payload === null) return null;

    const candidate = payload as Record<string, unknown>;
    if (candidate['token_use'] !== 'service' ||
        candidate['role'] !== env.AUTH_SERVICE_ROLE ||
        typeof candidate['sub'] !== 'string' || candidate['sub'].trim() === '' ||
        typeof candidate['iat'] !== 'number' || typeof candidate['exp'] !== 'number' ||
        candidate['exp'] <= candidate['iat'] || candidate['exp'] - candidate['iat'] > 3600) {
      return null;
    }

    return {
      sub: candidate['sub'],
      token_use: 'service',
      role: env.AUTH_SERVICE_ROLE,
      iat: candidate['iat'],
      exp: candidate['exp'],
    };
  } catch {
    return null;
  }
}
