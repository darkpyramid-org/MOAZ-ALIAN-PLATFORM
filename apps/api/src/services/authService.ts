import { db } from '../lib/db.js';
import { env } from '../config/env.js';
import { hashPassword, verifyPassword, VerificationResult } from '../lib/password.js';
import { issueToken } from '../lib/jwt.js';
import { DomainError } from '../lib/errors.js';
import { guardOptional } from '../lib/guard.js';
import { utcNow } from '../lib/clock.js';
import { createHash, randomBytes } from 'node:crypto';
import { sendPasswordResetEmail } from '../lib/passwordResetMailer.js';
import { logger } from '../lib/logger.js';
import { incrementAuxiliaryRateLimit } from '../lib/rateLimitStore.js';

/**
 * The auth use cases — a port of Infrastructure.Auth.AuthService. Exception
 * shapes stay transport-agnostic: the endpoint layer maps each signal kind to
 * the wire shape the original chose for that route (a 401 problem for login,
 * an inline {title,status} 400 for change-password, an UNCAUGHT 500 for
 * register's bad-email — fidelity down to that quirk).
 */

/** Endpoint-level signals. */
export type AuthSignalKind = 'unauthorized' | 'argument' | 'conflict' | 'reset';
export class AuthSignal extends Error {
  constructor(
    public readonly kind: AuthSignalKind,
    message: string,
  ) {
    super(message);
    this.name = 'AuthSignal';
  }
}

export interface AuthUserJson {
  [key: string]: unknown;
}

/** Key order mirrors the AuthUserDto record declaration. */
function authUserJson(user: {
  id: string;
  email: string;
  roles: string[];
  displayName: string | null;
  avatarUrl: string | null;
}): AuthUserJson {
  const isAdmin = user.roles.some((role) => role.toLowerCase() === env.AUTH_ADMIN_ROLE.toLowerCase());
  const canEdit =
    isAdmin || user.roles.some((role) => role.toLowerCase() === env.AUTH_EDITOR_ROLE.toLowerCase());
  return {
    id: user.id,
    email: user.email,
    roles: user.roles,
    isAdmin,
    canEditContent: canEdit,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

export async function login(emailRaw: string | null, passwordRaw: string | null): Promise<{ token: string; user: AuthUserJson }> {
  if (emailRaw === null || emailRaw === undefined || emailRaw.trim() === '' || passwordRaw === null || passwordRaw === undefined || passwordRaw.trim() === '') {
    throw new AuthSignal('unauthorized', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user === null) {
    throw new AuthSignal('unauthorized', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  const result = verifyPassword(user.passwordHash, passwordRaw);
  if (result === VerificationResult.Failed) {
    throw new AuthSignal('unauthorized', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  let current = user;
  if (result === VerificationResult.SuccessRehashNeeded) {
    // Legacy V2 hash: upgrade transparently so the stored format converges on
    // the current default without a user-visible flow.
    const upgraded = hashPassword(passwordRaw);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: upgraded, updatedAt: utcNow() } });
    current = { ...user, passwordHash: upgraded };
  }

  return { token: issueToken(current), user: authUserJson(current) };
}

/** Admin allowlist, case-insensitive — the only path to the admin role. */
function isAdminEmail(email: string): boolean {
  return env.adminEmails.some((candidate) => candidate.toLowerCase() === email.toLowerCase());
}

function rolesForEmail(email: string): string[] {
  return isAdminEmail(email)
    ? [env.AUTH_ADMIN_ROLE, env.AUTH_EDITOR_ROLE]
    : [env.AUTH_EDITOR_ROLE];
}

export async function register(emailRaw: string | null, passwordRaw: string | null): Promise<{ token: string; user: AuthUserJson }> {
  if (emailRaw === null || emailRaw === undefined || emailRaw.trim() === '' || !emailRaw.includes('@')) {
    // Deliberately mirrors the original's ArgumentException: the register
    // endpoint does not catch it, so a malformed email surfaces as the generic
    // 500 problem — an observed (and pinned) contract quirk.
    throw new Error('البريد الإلكتروني غير صالح.');
  }
  if (passwordRaw === null || passwordRaw === undefined || passwordRaw.trim() === '' || passwordRaw.length < 8) {
    throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
  }

  const email = emailRaw.trim().toLowerCase();
  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists !== null) {
    throw new AuthSignal('conflict', 'هذا البريد الإلكتروني مسجل بالفعل.');
  }

  const now = utcNow();
  const user = await db.user.create({
    data: {
      id: cryptoRandomUuid(),
      email,
      passwordHash: hashPassword(passwordRaw),
      roles: rolesForEmail(email),
      createdAt: now,
      updatedAt: null,
    },
  });

  return { token: issueToken(user), user: authUserJson(user) };
}

function cryptoRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}

export interface CurrentIdentity {
  userId: string | null;
  email: string | null;
  roles: string[];
  isAdmin: boolean;
  canEditContent: boolean;
}

export async function getCurrentUser(identity: CurrentIdentity): Promise<AuthUserJson | null> {
  if (identity.userId === null || identity.userId.trim() === '') {
    return null;
  }

  if (isUuid(identity.userId)) {
    const user = await db.user.findUnique({ where: { id: identity.userId } });
    if (user !== null) {
      return authUserJson(user);
    }
  }

  // Token-only fallback: the token is valid but the account is gone (or the
  // sub was never a user id). Identity claims answer instead of the database.
  return {
    id: '00000000-0000-0000-0000-000000000000',
    email: identity.userId,
    roles: identity.roles,
    isAdmin: identity.isAdmin,
    canEditContent: identity.canEditContent,
    displayName: null,
    avatarUrl: null,
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function updateProfile(
  identity: CurrentIdentity,
  displayName: string | null,
  avatarUrl: string | null,
): Promise<AuthUserJson> {
  if (identity.userId === null || !isUuid(identity.userId)) {
    throw new AuthSignal('unauthorized', 'غير مصرح.');
  }

  const user = await db.user.findUnique({ where: { id: identity.userId } });
  if (user === null) {
    throw new AuthSignal('unauthorized', 'المستخدم غير موجود.');
  }

  // AppUser.UpdateProfile: null keeps the stored value; blank clears it; the
  // guard throws on over-length input (422 through the domain mapping).
  const data: { displayName?: string | null; avatarUrl?: string | null; updatedAt: Date } = { updatedAt: utcNow() };
  if (displayName !== null) {
    const trimmed = displayName.trim();
    data.displayName = trimmed === '' ? null : guardOptional(trimmed, 80, 'DisplayName');
  }
  if (avatarUrl !== null) {
    const trimmed = avatarUrl.trim();
    data.avatarUrl = trimmed === '' ? null : guardOptional(trimmed, 500_000, 'AvatarUrl');
  }

  const updated = await db.user.update({ where: { id: user.id }, data });
  return authUserJson(updated);
}

export async function changePassword(identity: CurrentIdentity, currentPassword: string | null, newPassword: string | null): Promise<void> {
  if (
    currentPassword === null || currentPassword === undefined || currentPassword.trim() === '' ||
    newPassword === null || newPassword === undefined || newPassword.trim() === '' || newPassword.length < 8
  ) {
    throw new AuthSignal('argument', 'كلمة المرور غير صالحة.');
  }

  if (identity.userId === null || !isUuid(identity.userId)) {
    throw new AuthSignal('unauthorized', 'غير مصرح.');
  }
  const user = await db.user.findUnique({ where: { id: identity.userId } });
  if (user === null) {
    throw new AuthSignal('unauthorized', 'المستخدم غير موجود.');
  }

  const result = verifyPassword(user.passwordHash, currentPassword);
  if (result === VerificationResult.Failed) {
    throw new AuthSignal('unauthorized', 'كلمة المرور الحالية غير صحيحة.');
  }

  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), updatedAt: utcNow() } });
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_RATE_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_ACCOUNT_LIMIT = 5;
const PASSWORD_RESET_IP_LIMIT = 10;

function passwordResetDigest(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function forgotPassword(emailRaw: string | null, clientIpAddress: string | null): Promise<void> {
  if (emailRaw === null || emailRaw === undefined || emailRaw.trim() === '') return;

  const email = emailRaw.trim().toLowerCase();
  const accountRequests = await incrementAuxiliaryRateLimit(
    'password-reset-account',
    email,
    PASSWORD_RESET_RATE_WINDOW_MS,
  );
  const ipRequests = await incrementAuxiliaryRateLimit(
    'password-reset-ip',
    clientIpAddress ?? 'unknown',
    PASSWORD_RESET_RATE_WINDOW_MS,
  );
  if (accountRequests > PASSWORD_RESET_ACCOUNT_LIMIT || ipRequests > PASSWORD_RESET_IP_LIMIT) {
    return;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (user === null) return;

  const token = randomBytes(32).toString('base64url');
  const digest = passwordResetDigest(token);
  const now = utcNow();
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: digest,
      passwordResetExpiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
      updatedAt: now,
    },
  });

  try {
    await sendPasswordResetEmail(email, token);
  } catch (error) {
    await db.user.updateMany({
      where: { id: user.id, passwordResetToken: digest },
      data: { passwordResetToken: null, passwordResetExpiresAt: null, updatedAt: utcNow() },
    });
    logger.error({ error: error instanceof Error ? error.message : 'unknown error' }, 'Password reset email delivery failed');
  }
}

export async function resetPassword(token: string | null, newPassword: string | null): Promise<void> {
  if (
    token === null || token === undefined || token.trim() === '' ||
    newPassword === null || newPassword === undefined || newPassword.trim() === '' || newPassword.length < 8
  ) {
    throw new AuthSignal('argument', 'البيانات غير صالحة.');
  }

  const now = utcNow();
  const digest = passwordResetDigest(token);
  const user = await db.user.findFirst({
    where: { passwordResetToken: digest, passwordResetExpiresAt: { gt: now } },
  });
  if (user === null) {
    throw new AuthSignal('reset', 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية.');
  }

  const consumed = await db.user.updateMany({
    where: { id: user.id, passwordResetToken: digest, passwordResetExpiresAt: { gt: now } },
    data: {
      passwordHash: hashPassword(newPassword),
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      updatedAt: now,
    },
  });
  if (consumed.count !== 1) {
    throw new AuthSignal('reset', 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية.');
  }
}
export async function externalLogin(
  emailRaw: string | null,
  displayName: string | null,
  avatarUrl: string | null,
  _provider: string,
): Promise<{ token: string; user: AuthUserJson }> {
  if (emailRaw === null || emailRaw === undefined || emailRaw.trim() === '' || !emailRaw.includes('@')) {
    throw new AuthSignal('argument', 'البريد الإلكتروني غير صالح.');
  }

  const email = emailRaw.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });

  if (existing === null) {
    const now = utcNow();
    const user = await db.user.create({
      data: {
        id: cryptoRandomUuid(),
        email,
        passwordHash: hashPassword(cryptoRandomUuid().replace(/-/g, '')), // opaque secret the owner never uses
        roles: rolesForEmail(email),
        createdAt: now,
        updatedAt: null,
      },
    });
    await applyProfile(user.id, displayName, avatarUrl);
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    return { token: issueToken(fresh), user: authUserJson(fresh) };
  }

  // Link profile fields only where missing — the local profile wins.
  await applyProfile(existing.id, existing.displayName === null || existing.displayName.trim() === '' ? displayName : null,
    existing.avatarUrl === null || existing.avatarUrl.trim() === '' ? avatarUrl : null);
  const fresh = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
  return { token: issueToken(fresh), user: authUserJson(fresh) };
}

async function applyProfile(userId: string, displayName: string | null, avatarUrl: string | null): Promise<void> {
  const data: { displayName?: string | null; avatarUrl?: string | null; updatedAt: Date } = { updatedAt: utcNow() };
  if (displayName !== null && displayName !== undefined) {
    const trimmed = displayName.trim();
    if (trimmed === '') {
      data.displayName = null;
    } else if (trimmed.length > 80) {
      throw new DomainError('DisplayName must be at most 80 characters (got ' + trimmed.length + ').');
    } else {
      data.displayName = trimmed;
    }
  }
  if (avatarUrl !== null && avatarUrl !== undefined) {
    const trimmed = avatarUrl.trim();
    if (trimmed === '') {
      data.avatarUrl = null;
    } else if (trimmed.length > 500_000) {
      throw new DomainError('AvatarUrl must be at most 500000 characters (got ' + trimmed.length + ').');
    } else {
      data.avatarUrl = trimmed;
    }
  }
  await db.user.update({ where: { id: userId }, data });
}
