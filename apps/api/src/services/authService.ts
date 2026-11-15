import { db } from '../lib/db.js';
import { env } from '../config/env.js';
import { hashPassword, verifyPassword, VerificationResult, DUMMY_PASSWORD_HASH, isPasswordWithinLimit, MAX_PASSWORD_BYTES } from '../lib/password.js';
import { issueToken } from '../lib/jwt.js';
import { guardOptional } from '../lib/guard.js';
import { utcNow } from '../lib/clock.js';
import { randomBytes } from 'node:crypto';

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

  if (!isPasswordWithinLimit(passwordRaw)) {
    throw new AuthSignal('unauthorized', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user === null) {
    await verifyPassword(DUMMY_PASSWORD_HASH, passwordRaw);
    throw new AuthSignal('unauthorized', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  const result = await verifyPassword(user.passwordHash, passwordRaw);
  if (result === VerificationResult.Failed) {
    throw new AuthSignal('unauthorized', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  let current = user;
  if (result === VerificationResult.SuccessRehashNeeded) {
    // Legacy V2 hash: upgrade transparently so the stored format converges on
    // the current default without a user-visible flow.
    const upgraded = await hashPassword(passwordRaw);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: upgraded, updatedAt: utcNow() } });
    current = { ...user, passwordHash: upgraded };
  }

  return { token: issueToken(current), user: authUserJson(current) };
}

/**
 * Public registration and OAuth account creation are untrusted entry points.
 * They must never assign privileged roles based on an email address or an
 * allowlist: neither proves mailbox ownership. Privileged roles are provisioned
 * only through a trusted operator-controlled process after identity verification.
 */
function rolesForPublicAccount(): string[] {
  return [];
}

export async function register(emailRaw: string | null, passwordRaw: string | null): Promise<{ token: string; user: AuthUserJson }> {
  if (emailRaw === null || emailRaw === undefined || emailRaw.trim() === '' || !emailRaw.includes('@')) {
    // Deliberately mirrors the original's ArgumentException: the register
    // endpoint does not catch it, so a malformed email surfaces as the generic
    // 500 problem — an observed (and pinned) contract quirk.
    throw new Error('البريد الإلكتروني غير صالح.');
  }
  if (passwordRaw === null || passwordRaw === undefined || passwordRaw.trim() === '' || passwordRaw.length < 8 || !isPasswordWithinLimit(passwordRaw)) {
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
      passwordHash: await hashPassword(passwordRaw),
      roles: rolesForPublicAccount(),
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
    newPassword === null || newPassword === undefined || newPassword.trim() === '' || newPassword.length < 8 || !isPasswordWithinLimit(newPassword)
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

  if (!isPasswordWithinLimit(currentPassword)) throw new AuthSignal('argument', `كلمة المرور يجب ألا تتجاوز ${MAX_PASSWORD_BYTES} بايت.`);
  const result = await verifyPassword(user.passwordHash, currentPassword);
  if (result === VerificationResult.Failed) {
    throw new AuthSignal('unauthorized', 'كلمة المرور الحالية غير صحيحة.');
  }

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), updatedAt: utcNow() } });
}

export async function forgotPassword(emailRaw: string | null): Promise<void> {
  if (emailRaw === null || emailRaw === undefined || emailRaw.trim() === '') return;
  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user === null) return;

  // The token is stored server-side only and is never returned or logged: it
  // must reach the user out-of-band. Until a mailer exists the flow stays
  // intentionally inert (operators reset through controlled database access).
  const token = randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await db.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpiresAt: new Date(utcNow().getTime() + 60 * 60 * 1000), updatedAt: utcNow() },
  });
}

export async function resetPassword(token: string | null, newPassword: string | null): Promise<void> {
  if (
    token === null || token === undefined || token.trim() === '' ||
    newPassword === null || newPassword === undefined || newPassword.trim() === '' || newPassword.length < 8
  ) {
    throw new AuthSignal('argument', 'البيانات غير صالحة.');
  }

  const user = await db.user.findFirst({ where: { passwordResetToken: token } });
  if (user === null) {
    throw new AuthSignal('reset', 'رمز إعادة التعيين غير صالح.');
  }

  if (user.passwordResetExpiresAt === null || user.passwordResetExpiresAt.getTime() < utcNow().getTime()) {
    throw new AuthSignal('reset', 'رمز إعادة التعيين منتهي الصلاحية.');
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), passwordResetToken: null, passwordResetExpiresAt: null, updatedAt: utcNow() },
  });
}

export type ExternalAuthProvider = 'google' | 'facebook';

/**
 * Provider subject is the stable identity key. Email is used only for first
 * linking when the provider has explicitly proven ownership of that address.
 * Facebook identities without a verified email can sign in only after a
 * provider-subject binding has already been established.
 */
export async function externalLogin(
  provider: ExternalAuthProvider,
  providerSubject: string,
  emailRaw: string | null,
  emailVerified: boolean,
  displayName: string | null,
  avatarUrl: string | null,
): Promise<{ token: string; user: AuthUserJson }> {
  if (providerSubject.trim() === '' || providerSubject.length > 255) {
    throw new AuthSignal('unauthorized', 'هوية مزود تسجيل الدخول غير صالحة.');
  }

  return db.$transaction(async (tx) => {
    const linkedIdentity = await tx.oAuthIdentity.findUnique({
      where: { provider_providerSubject: { provider, providerSubject } },
      include: { user: true },
    });

    if (linkedIdentity !== null) {
      const data = externalProfileData(linkedIdentity.user.displayName, linkedIdentity.user.avatarUrl, displayName, avatarUrl);
      const user = await tx.user.update({ where: { id: linkedIdentity.userId }, data });
      return { token: issueToken(user), user: authUserJson(user) };
    }

    // Never create or attach an account based on an email whose ownership was
    // not explicitly verified by the provider's signed/validated response.
    if (emailVerified !== true || emailRaw === null || emailRaw.trim() === '' || !emailRaw.includes('@')) {
      throw new AuthSignal('unauthorized', 'تعذر إثبات ملكية البريد الإلكتروني من مزود تسجيل الدخول.');
    }

    const email = emailRaw.trim().toLowerCase();
    if (email.length > 255) {
      throw new AuthSignal('unauthorized', 'البريد الإلكتروني من مزود تسجيل الدخول غير صالح.');
    }

    let user = await tx.user.findUnique({ where: { email } });
    if (user === null) {
      const now = utcNow();
      user = await tx.user.create({
        data: {
          id: cryptoRandomUuid(),
          email,
          passwordHash: await hashPassword(cryptoRandomUuid().replace(/-/g, '')),
          // External identities never receive editor/admin roles at creation.
          roles: [],
          createdAt: now,
          updatedAt: null,
        },
      });
    }

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: externalProfileData(user.displayName, user.avatarUrl, displayName, avatarUrl),
    });

    await tx.oAuthIdentity.create({
      data: {
        id: cryptoRandomUuid(),
        provider,
        providerSubject,
        userId: updatedUser.id,
        emailAtLink: email,
        emailVerified: true,
        createdAt: utcNow(),
      },
    });

    return { token: issueToken(updatedUser), user: authUserJson(updatedUser) };
  });
}

function externalProfileData(
  currentDisplayName: string | null,
  currentAvatarUrl: string | null,
  providerDisplayName: string | null,
  providerAvatarUrl: string | null,
): { displayName?: string; avatarUrl?: string; updatedAt: Date } {
  const data: { displayName?: string; avatarUrl?: string; updatedAt: Date } = { updatedAt: utcNow() };
  if ((currentDisplayName === null || currentDisplayName.trim() === '') && providerDisplayName !== null) {
    const value = providerDisplayName.trim();
    if (value.length > 80) throw new AuthSignal('argument', 'اسم المستخدم من مزود تسجيل الدخول طويل جدًا.');
    if (value !== '') data.displayName = value;
  }
  if ((currentAvatarUrl === null || currentAvatarUrl.trim() === '') && providerAvatarUrl !== null) {
    const value = providerAvatarUrl.trim();
    if (value.length > 500_000) throw new AuthSignal('argument', 'رابط الصورة من مزود تسجيل الدخول غير صالح.');
    if (value !== '') data.avatarUrl = value;
  }
  return data;
}

