import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * The platform's own access token, byte-compatible with the one AuthService
 * issues: HS256 signed, "sub"/"email"/"role" claims plus an "app_metadata"
 * claim holding {"roles":[…]} and a flat "roles" claim per platform role.
 * Seven-day expiry; the issuer defaults to http://localhost:5199 — the value
 * the ASP.NET AuthOptions.ResolveIssuer() falls back to when none is set.
 *
 * The claims shape matters beyond login: ClaimsCurrentUser reads roles from
 * "role" (GoTrue-style), "app_metadata".roles and "roles" — see lib/roles.ts.
 */
export interface AuthUserRecord {
  id: string;
  email: string;
  roles: string[];
}

export function issueToken(user: AuthUserRecord): string {
  const metadata = JSON.stringify({ roles: user.roles });

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
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
  role?: string | string[];
  'app_metadata'?: string;
  roles?: string | string[];
}

/**
 * Verifies signature, issuer, audience and lifetime. jsonwebtoken applies the
 * 30-second leeway .NET's ClockSkewSeconds allowed (its default).
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
    return payload as VerifiedToken;
  } catch {
    return null;
  }
}
