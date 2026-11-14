import { Router, type Request } from 'express';
import { bindBody } from '../middleware/body.js';
import { authRateLimit } from '../middleware/authRateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { sendJson, sendNoContent, sendProblemFramework, sendStatusPage, traceOf } from '../lib/http.js';
import { AuthSignal, getCurrentUser, changePassword, forgotPassword, login, register, resetPassword, updateProfile } from '../services/authService.js';
import type { CurrentIdentity } from '../services/authService.js';

/**
 * /api/auth — the port of AuthEndpoints.cs. Every response shape is the
 * original's, including the deliberate asymmetry:
 *   - blank-field 400s are inline {title, status} objects (framework JSON);
 *   - auth-failures are Results.Problem envelopes (rfc9110 type link +
 *     traceId extension, raw Arabic text);
 *   - register's ArgumentException is intentionally NOT caught, so a malformed
 *     email reaches the global handler as a generic 500 — an observed contract
 *     quirk the battery pins, preserved instead of "fixed" silently.
 */

const router = Router();

const BLANK_MESSAGE = 'البريد الإلكتروني وكلمة المرور مطلوبان';

function identityOf(req: Request): CurrentIdentity {
  const auth = req.auth;
  return {
    userId: auth?.userId ?? null,
    email: auth?.email ?? null,
    roles: auth?.roles ?? [],
    isAdmin: auth?.isAdmin === true,
    canEditContent: auth?.canEditContent === true,
  };
}

router.post('/api/auth/login', authRateLimit, (req, res, next) => {
  try {
    const body = bindBody(req, [
      { key: 'email', kind: 'string' },
      { key: 'password', kind: 'string' },
    ]);
    const email = body['email'] as string | null;
    const password = body['password'] as string | null;

    if (email === null || email === undefined || email.trim() === '' || password === null || password === undefined || password.trim() === '') {
      sendJson(res, 400, { title: BLANK_MESSAGE, status: 400 });
      return;
    }

    login(email, password)
      .then((result) => sendJson(res, 200, { token: result.token, user: result.user }))
      .catch((error: unknown) => {
        if (error instanceof AuthSignal && error.kind === 'unauthorized') {
          sendProblemFramework(
            res,
            401,
            { title: 'فشل تسجيل الدخول', detail: error.message },
            traceOf(req),
          );
          return;
        }
        next(error);
      });
  } catch (error) {
    next(error);
  }
});

router.post('/api/auth/register', authRateLimit, (req, res, next) => {
  try {
    const body = bindBody(req, [
      { key: 'email', kind: 'string' },
      { key: 'password', kind: 'string' },
    ]);
    const email = body['email'] as string | null;
    const password = body['password'] as string | null;

    if (email === null || email === undefined || email.trim() === '' || password === null || password === undefined || password.trim() === '') {
      sendJson(res, 400, { title: BLANK_MESSAGE, status: 400 });
      return;
    }

    register(email, password)
      .then((result) => sendJson(res, 200, { token: result.token, user: result.user }))
      .catch((error: unknown) => {
        // ONLY the conflict signal is caught here — the original caught
        // InvalidOperationException alone, leaving ArgumentException to the
        // global handler (a 500). That asymmetry is part of the contract.
        if (error instanceof AuthSignal && error.kind === 'conflict') {
          sendProblemFramework(
            res,
            409,
            { title: 'حساب موجود', detail: error.message },
            traceOf(req),
          );
          return;
        }
        next(error);
      });
  } catch (error) {
    next(error);
  }
});

router.get('/api/auth/me', requireAuth, (req, res, next) => {
  getCurrentUser(identityOf(req))
    .then((user) => {
      // Results.Unauthorized(): a bare 401 that StatusCodePages renders — no
      // WWW-Authenticate (only the auth middleware's challenge adds that).
      // Unreachable behind requireAuth (the fallback DTO answers token-only
      // identities), kept as the shape it would produce.
      if (user === null) {
        sendStatusPage(res, 401, traceOf(req));
        return;
      }
      sendJson(res, 200, user);
    })
    .catch(next);
});

router.put('/api/auth/me', requireAuth, (req, res, next) => {
  try {
    const body = bindBody(req, [
      { key: 'displayName', kind: 'string' },
      { key: 'avatarUrl', kind: 'string' },
    ]);

    updateProfile(identityOf(req), (body['displayName'] as string | null) ?? null, (body['avatarUrl'] as string | null) ?? null)
      .then((user) => sendJson(res, 200, user))
      .catch((error: unknown) => {
        if (error instanceof AuthSignal && error.kind === 'unauthorized') {
          sendProblemFramework(res, 401, { title: 'غير مصرح', detail: error.message }, traceOf(req));
          return;
        }
        // Domain invariants (length guards) stay uncaught: 422 via the handler.
        next(error);
      });
  } catch (error) {
    next(error);
  }
});

router.post('/api/auth/change-password', requireAuth, (req, res, next) => {
  try {
    const body = bindBody(req, [
      { key: 'currentPassword', kind: 'string' },
      { key: 'newPassword', kind: 'string' },
    ]);

    changePassword(identityOf(req), (body['currentPassword'] as string | null) ?? null, (body['newPassword'] as string | null) ?? null)
      .then(() => sendNoContent(res))
      .catch((error: unknown) => {
        if (error instanceof AuthSignal) {
          if (error.kind === 'unauthorized') {
            sendProblemFramework(res, 401, { title: 'غير مصرح', detail: error.message }, traceOf(req));
            return;
          }
          if (error.kind === 'argument') {
            sendJson(res, 400, { title: error.message, status: 400 });
            return;
          }
        }
        next(error);
      });
  } catch (error) {
    next(error);
  }
});

router.post('/api/auth/forgot-password', authRateLimit, (req, res, next) => {
  try {
    const body = bindBody(req, [{ key: 'email', kind: 'string' }]);
    forgotPassword((body['email'] as string | null) ?? null)
      .then(() =>
        // Identical for known and unknown addresses so the endpoint cannot
        // probe which emails are registered.
        sendJson(res, 200, { message: 'إذا كان البريد مسجلاً، تم إرسال رابط إعادة التعيين.' }),
      )
      .catch(next);
  } catch (error) {
    next(error);
  }
});

router.post('/api/auth/reset-password', authRateLimit, (req, res, next) => {
  try {
    const body = bindBody(req, [
      { key: 'token', kind: 'string' },
      { key: 'newPassword', kind: 'string' },
    ]);

    resetPassword((body['token'] as string | null) ?? null, (body['newPassword'] as string | null) ?? null)
      .then(() => sendNoContent(res))
      .catch((error: unknown) => {
        if (error instanceof AuthSignal) {
          if (error.kind === 'reset') {
            sendProblemFramework(res, 400, { title: 'رمز غير صالح', detail: error.message }, traceOf(req));
            return;
          }
          if (error.kind === 'argument') {
            sendJson(res, 400, { title: error.message, status: 400 });
            return;
          }
        }
        next(error);
      });
  } catch (error) {
    next(error);
  }
});

export const authRoutes = router;
