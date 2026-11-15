import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: { user: { findUnique: mocks.findUnique } },
}));
vi.mock('../../src/config/env.js', () => ({
  env: {
    AUTH_JWT_SECRET: 'user-jwt-secret-with-at-least-32-characters',
    AUTH_SERVICE_JWT_SECRET: 'separate-service-jwt-secret-with-32-chars',
    AUTH_AUDIENCE: 'authenticated',
    AUTH_ADMIN_ROLE: 'admin',
    AUTH_EDITOR_ROLE: 'editor',
    AUTH_SERVICE_ROLE: 'service_role',
    resolveIssuer: () => 'https://api.example.test',
  },
}));
vi.mock('../../src/lib/http.js', () => ({
  sendStatusPage: vi.fn(),
  sendUnauthorizedChallenge: vi.fn(),
}));

import { authenticate } from '../../src/middleware/auth.js';
import { issueServiceToken, issueToken } from '../../src/lib/jwt.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.test',
  roles: ['admin', 'editor'],
  tokenVersion: 0,
};

function requestFor(token: string): Request {
  return { headers: { authorization: `Bearer ${token}` } } as Request;
}

async function run(token: string) {
  const req = requestFor(token);
  const next = vi.fn() as unknown as NextFunction;
  await authenticate(req, {} as Response, next);
  return { req, next };
}

describe('database-backed JWT session revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(user);
  });

  it('uses persisted roles instead of stale role claims in the JWT', async () => {
    mocks.findUnique.mockResolvedValue({ ...user, roles: [] });
    const token = issueToken({ id: user.id, email: user.email, roles: ['admin'], tokenVersion: 0 });

    const { req, next } = await run(token);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toMatchObject({
      userId: user.id,
      email: user.email,
      roles: [],
      isAdmin: false,
      canEditContent: false,
    });
  });

  it('accepts a pre-migration token as version zero while using current database roles', async () => {
    mocks.findUnique.mockResolvedValue({ ...user, roles: ['editor'], tokenVersion: 0 });
    const legacyToken = jwt.sign(
      { sub: user.id, email: user.email, role: 'authenticated', roles: ['admin'] },
      'user-jwt-secret-with-at-least-32-characters',
      { issuer: 'https://api.example.test', audience: 'authenticated', expiresIn: '1h' },
    );

    const { req } = await run(legacyToken);

    expect(req.auth).toMatchObject({ roles: ['editor'], isAdmin: false, canEditContent: true });
  });

  it('rejects an existing token immediately after its token version is incremented', async () => {
    mocks.findUnique.mockResolvedValue({ ...user, tokenVersion: 1 });
    const token = issueToken({ id: user.id, email: user.email, roles: user.roles, tokenVersion: 0 });

    const { req, next } = await run(token);

    expect(req.auth).toBeUndefined();
    expect((req as Request & { authError?: string }).authError).toBe('invalid_token');
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a deleted account even when its JWT signature and expiry are valid', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const token = issueToken({ id: user.id, email: user.email, roles: user.roles, tokenVersion: 0 });

    const { req } = await run(token);

    expect(req.auth).toBeUndefined();
    expect((req as Request & { authError?: string }).authError).toBe('invalid_token');
  });

  it('does not grant service-role privileges to a user record role', async () => {
    mocks.findUnique.mockResolvedValue({ ...user, roles: ['service_role'] });
    const token = issueToken({ id: user.id, email: user.email, roles: ['service_role'], tokenVersion: 0 });

    const { req } = await run(token);

    expect(req.auth?.roles).toEqual([]);
    expect(req.auth?.isAdmin).toBe(false);
  });

  it('accepts only explicitly typed service tokens signed with the separate service secret', async () => {
    const token = issueServiceToken('background-worker');
    const { req, next } = await run(token);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toMatchObject({
      userId: null,
      email: null,
      roles: ['service_role'],
      isAdmin: true,
      canEditContent: true,
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('does not accept a user JWT containing a service role as a service token', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const token = issueToken({ id: 'background-worker', email: 'worker@example.test', roles: ['service_role'] });

    const { req } = await run(token);

    expect(req.auth).toBeUndefined();
    expect((req as Request & { authError?: string }).authError).toBe('invalid_token');
  });
});
