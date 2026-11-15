import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  oauthFindUnique: vi.fn(),
  oauthCreate: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  issueToken: vi.fn(),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      user: {
        findUnique: mocks.findUnique,
        create: mocks.create,
        update: mocks.update,
      },
      oAuthIdentity: {
        findUnique: mocks.oauthFindUnique,
        create: mocks.oauthCreate,
      },
    }),
    user: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
  },
}));

vi.mock('../../src/lib/password.js', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
  VerificationResult: { Failed: 0, Success: 1, SuccessRehashNeeded: 2 },
  DUMMY_PASSWORD_HASH: 'dummy-hash',
  isPasswordWithinLimit: () => true,
  MAX_PASSWORD_BYTES: 1024,
}));

vi.mock('../../src/lib/jwt.js', () => ({ issueToken: mocks.issueToken }));

// Deliberately include an allowlisted address: public flows must not treat an
// email string as proof that the caller owns the mailbox.
vi.mock('../../src/config/env.js', () => ({
  env: {
    AUTH_ADMIN_ROLE: 'admin',
    AUTH_EDITOR_ROLE: 'editor',
    adminEmails: ['admin@example.com'],
  },
}));

import { externalLogin, register } from '../../src/services/authService.js';

describe('public account role assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue('test-password-hash');
    mocks.issueToken.mockReturnValue('test-token');
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(data));
    mocks.update.mockImplementation(({ where, data }: { where: { id?: string }; data?: Record<string, unknown> }) => Promise.resolve({
      id: where.id ?? 'created-user-id',
      email: 'admin@example.com',
      passwordHash: 'test-password-hash',
      roles: [],
      displayName: null,
      avatarUrl: null,
      ...data,
    }));
    mocks.oauthFindUnique.mockResolvedValue(null);
    mocks.oauthCreate.mockResolvedValue({});
    mocks.findUniqueOrThrow.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        id: where.id,
        email: 'admin@example.com',
        passwordHash: 'test-password-hash',
        roles: [],
        displayName: null,
        avatarUrl: null,
      }),
    );
  });

  it('does not grant editor or admin roles during password registration, even for an allowlisted email', async () => {
    const result = await register('admin@example.com', 'StrongPass123!');

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@example.com',
          roles: [],
        }),
      }),
    );
    expect(result.user).toMatchObject({ roles: [], isAdmin: false, canEditContent: false });
  });

  it('does not grant editor or admin roles during OAuth account creation', async () => {
    const result = await externalLogin('google', 'provider-subject-123', 'admin@example.com', true, 'Admin', null);

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@example.com',
          roles: [],
        }),
      }),
    );
    expect(result.user).toMatchObject({ roles: [], isAdmin: false, canEditContent: false });
  });
});
