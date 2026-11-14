import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  identityFindUnique: vi.fn(),
  identityCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));
vi.mock('../../src/lib/password.js', () => ({
  hashPassword: vi.fn(() => 'opaque-hash'),
  verifyPassword: vi.fn(),
  VerificationResult: { Failed: 0, Success: 1, SuccessRehashNeeded: 2 },
}));
vi.mock('../../src/lib/jwt.js', () => ({
  issueToken: vi.fn(() => 'platform-jwt'),
}));
vi.mock('../../src/config/env.js', () => ({
  env: {
    AUTH_ADMIN_ROLE: 'admin',
    AUTH_EDITOR_ROLE: 'editor',
    adminEmails: ['admin@example.com'],
  },
}));

import { externalLogin, AuthSignal } from '../../src/services/authService.js';

const localUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'person@example.com',
  passwordHash: 'local-hash',
  roles: [],
  displayName: null,
  avatarUrl: null,
  passwordResetToken: null,
  passwordResetExpiresAt: null,
  createdAt: new Date(),
  updatedAt: null,
};

const tx = {
  oAuthIdentity: {
    findUnique: mocks.identityFindUnique,
    create: mocks.identityCreate,
  },
  user: {
    findUnique: mocks.userFindUnique,
    create: mocks.userCreate,
    update: mocks.userUpdate,
  },
};

describe('external OAuth account linking policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    mocks.identityFindUnique.mockResolvedValue(null);
    mocks.identityCreate.mockResolvedValue({});
    mocks.userFindUnique.mockResolvedValue(localUser);
    mocks.userCreate.mockResolvedValue(localUser);
    mocks.userUpdate.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      ...localUser,
      id: where.id,
    }));
  });

  it('rejects unverified email before looking up or creating a local account', async () => {
    await expect(externalLogin(
      'facebook', 'fb-subject-1', 'person@example.com', false, 'Person', null,
    )).rejects.toMatchObject({ kind: 'unauthorized' });

    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.identityCreate).not.toHaveBeenCalled();
  });

  it('allows a previously linked Facebook subject to sign in without a verified email claim', async () => {
    mocks.identityFindUnique.mockResolvedValue({ userId: localUser.id, user: localUser });

    const result = await externalLogin('facebook', 'fb-subject-1', null, false, 'Facebook Name', null);

    expect(result.token).toBe('platform-jwt');
    expect(mocks.identityFindUnique).toHaveBeenCalledWith({
      where: { provider_providerSubject: { provider: 'facebook', providerSubject: 'fb-subject-1' } },
      include: { user: true },
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.identityCreate).not.toHaveBeenCalled();
  });

  it('links an existing local account only when the provider email is verified', async () => {
    const result = await externalLogin(
      'google', 'google-subject-1', 'person@example.com', true, 'Google Name', null,
    );

    expect(result.token).toBe('platform-jwt');
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { email: 'person@example.com' } });
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.identityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'google',
        providerSubject: 'google-subject-1',
        userId: localUser.id,
        emailAtLink: 'person@example.com',
        emailVerified: true,
      }),
    });
  });

  it('creates a new least-privilege account and binds the provider subject', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...localUser,
      ...data,
    }));
    mocks.userUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      ...localUser,
      ...data,
      id: where.id,
    }));

    await externalLogin('google', 'google-subject-2', 'new@example.com', true, 'New User', null);

    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@example.com',
        roles: [],
        passwordHash: 'opaque-hash',
      }),
    });
    expect(mocks.identityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'google',
        providerSubject: 'google-subject-2',
        emailVerified: true,
      }),
    });
  });

  it('rejects malformed provider subjects', async () => {
    await expect(externalLogin('google', ' ', 'person@example.com', true, null, null))
      .rejects.toBeInstanceOf(AuthSignal);
    expect(mocks.identityFindUnique).not.toHaveBeenCalled();
  });
});
