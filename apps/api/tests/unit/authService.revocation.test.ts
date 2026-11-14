import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(() => 'new-password-hash'),
}));

vi.mock('../../src/lib/db.js', () => ({
  db: { user: { findUnique: mocks.findUnique, findFirst: mocks.findFirst, update: mocks.update } },
}));
vi.mock('../../src/lib/password.js', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
  VerificationResult: { Failed: 0, Success: 1, SuccessRehashNeeded: 2 },
}));
vi.mock('../../src/lib/jwt.js', () => ({ issueToken: vi.fn(() => 'token') }));
vi.mock('../../src/config/env.js', () => ({
  env: { AUTH_ADMIN_ROLE: 'admin', AUTH_EDITOR_ROLE: 'editor', adminEmails: [] },
}));

import { changePassword, getCurrentUser, resetPassword } from '../../src/services/authService.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'person@example.test',
  passwordHash: 'old-hash',
  roles: ['editor'],
  displayName: null,
  avatarUrl: null,
  passwordResetToken: 'reset-token',
  passwordResetExpiresAt: new Date(Date.now() + 60_000),
  tokenVersion: 0,
  createdAt: new Date(),
  updatedAt: null,
};

describe('password lifecycle revokes existing sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(user);
    mocks.update.mockResolvedValue({ ...user, tokenVersion: 1 });
    mocks.verifyPassword.mockReturnValue(1);
  });

  it('increments tokenVersion after a successful password change', async () => {
    await changePassword(
      { userId: user.id, email: user.email, roles: user.roles, isAdmin: false, canEditContent: true },
      'old-password',
      'new-password',
    );

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: expect.objectContaining({
        passwordHash: 'new-password-hash',
        tokenVersion: { increment: 1 },
      }),
    });
  });

  it('increments tokenVersion when a valid reset token is consumed', async () => {
    await resetPassword('reset-token', 'new-password');

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: expect.objectContaining({
        passwordHash: 'new-password-hash',
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        tokenVersion: { increment: 1 },
      }),
    });
  });

  it('does not change the version for an invalid or expired reset token', async () => {
    mocks.findFirst.mockResolvedValue({ ...user, passwordResetExpiresAt: new Date(Date.now() - 1) });

    await expect(resetPassword('reset-token', 'new-password')).rejects.toMatchObject({ kind: 'reset' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not synthesize a user profile for a deleted or unknown subject', async () => {
    mocks.findUnique.mockResolvedValue(null);

    const result = await getCurrentUser({
      userId: user.id,
      email: user.email,
      roles: ['admin'],
      isAdmin: true,
      canEditContent: true,
    });

    expect(result).toBeNull();
  });
});
