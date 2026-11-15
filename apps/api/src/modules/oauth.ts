import { Router } from 'express';
import { env } from '../config/env.js';
import { createOAuthState, consumeOAuthState, getOAuthStateNonce } from '../lib/oauthState.js';
import { verifyFacebookIdentity, verifyGoogleIdentity } from '../lib/providerIdentity.js';
import { sendProblemFramework, sendRedirect, sendJson, traceOf } from '../lib/http.js';
import { AuthSignal, externalLogin } from '../services/authService.js';
import type { OAuthProvider } from '../config/env.js';

/**
 * /api/auth/oauth/{google,facebook} — the port of OAuthEndpoints.cs. The
 * battery pins the DISABLED path (every provider unconfigured): the challenge
 * answers 501 with an Arabic title and a config hint, and the callback answers
 * 501 with a bare detail (no title — the reason phrase "Not Implemented"
 * fills in). The happy path mirrors the original's exchange flow, including
 * its failure REDIRECTS back to the frontend instead of error bodies.
 */

const router = Router();

const PROVIDERS = ['google', 'facebook'] as const;
type ProviderName = (typeof PROVIDERS)[number];

function providerConfig(provider: ProviderName): OAuthProvider | undefined {
  return env.oauth[provider];
}

/** Default endpoints per provider (AuthOptions defaults). */
function defaultAuthorizationEndpoint(provider: ProviderName): string {
  return provider === 'google'
    ? 'https://accounts.google.com/o/oauth2/v2/auth'
    : 'https://www.facebook.com/v18.0/dialog/oauth';
}

function defaultTokenEndpoint(provider: ProviderName): string {
  return provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : 'https://graph.facebook.com/v18.0/oauth/access_token';
}


for (const provider of PROVIDERS) {
  router.get(`/api/auth/oauth/${provider}`, async (req, res) => {
    const cfg = providerConfig(provider);
    if (cfg === undefined || !isConfigured(cfg)) {
      sendProblemFramework(
        res,
        501,
        {
          title: 'غير مُفعَّل',
          detail: `OAuth provider '${provider}' is not configured. Set Auth:OAuth:${provider}:ClientId/ClientSecret/RedirectUri.`,
        },
        traceOf(req),
      );
      return;
    }

    const redirectUri = cfg.redirectUri as string;
    const authorizationEndpoint = cfg.authorizationEndpoint ?? defaultAuthorizationEndpoint(provider);
    const scope = encodeURIComponent(cfg.scope ?? 'openid email profile');

    const state = await createOAuthState(provider, req, res);
    const oidcNonce = getOAuthStateNonce(state);
    if (oidcNonce === null) {
      sendJson(res, 500, { title: 'تعذر بدء تسجيل الدخول', status: 500 });
      return;
    }

    const url =
      `${authorizationEndpoint}?client_id=${encodeURIComponent(cfg.clientId as string)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(state)}` +
      `&nonce=${encodeURIComponent(oidcNonce)}`;

    sendRedirect(res, url, 302);
  });

  router.get(`/api/auth/oauth/${provider}/callback`, async (req, res) => {
    const query = req.query as Record<string, string | string[] | undefined>;
    const single = (name: string): string | undefined => {
      const value = query[name];
      return Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
    };

    const cfg = providerConfig(provider);
    if (cfg === undefined || !isConfigured(cfg)) {
      sendProblemFramework(res, 501, { detail: 'Provider not configured.' }, traceOf(req));
      return;
    }

    // Provider errors are still correlated to the initiating browser. A
    // provider cannot force an unbound redirect into the local auth flow.
    const state = single('state');
    const oidcNonce = state === undefined ? null : getOAuthStateNonce(state);
    if (state === undefined || state === '' || oidcNonce === null || !(await consumeOAuthState(provider, state, req, res))) {
      sendJson(res, 400, { title: 'حالة OAuth غير صالحة', status: 400 });
      return;
    }

    const error = single('error');
    if (error !== undefined && error !== '') {
      sendRedirect(res, `${env.FRONTEND_URL}/auth?oauth_error=${encodeURIComponent(error)}`, 302);
      return;
    }

    const code = single('code');
    if (code === undefined || code === '') {
      sendJson(res, 400, { title: 'رمز التفويض مفقود', status: 400 });
      return;
    }

    runExchange(provider, code, cfg, oidcNonce)
      .then((result) => {
        if (typeof result === 'string') {
          // Exchange failures go back to the frontend as query flags — the
          // original never rendered its own error page for these.
          sendRedirect(res, `${env.FRONTEND_URL}/auth?oauth_error=${result}`, 302);
          return;
        }
        sendRedirect(res, `${env.FRONTEND_URL}/auth?token=${encodeURIComponent(result.token)}`, 302);
      })
      .catch((cause: unknown) => {
        // Transport/JSON failures during the exchange → 502 with the message.
        sendProblemFramework(
          res,
          502,
          { title: 'OAuth فشل', detail: cause instanceof Error ? cause.message : String(cause) },
          traceOf(req),
        );
      });
  });
}

function isConfigured(cfg: OAuthProvider): boolean {
  return (
    typeof cfg.clientId === 'string' && cfg.clientId.trim() !== '' &&
    typeof cfg.clientSecret === 'string' && cfg.clientSecret.trim() !== '' &&
    typeof cfg.redirectUri === 'string' && cfg.redirectUri.trim() !== ''
  );
}

/** Provider token exchange and identity verification are fail-closed. */
async function runExchange(
  provider: ProviderName,
  code: string,
  cfg: OAuthProvider,
  expectedNonce: string,
): Promise<string | { token: string }> {
  const tokenEndpoint = cfg.tokenEndpoint ?? defaultTokenEndpoint(provider);

  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) return 'token_exchange_failed';

  const tokenJson = (await tokenResponse.json()) as Record<string, unknown>;
  const accessToken = typeof tokenJson['access_token'] === 'string' ? tokenJson['access_token'] : null;

  let identity: Awaited<ReturnType<typeof verifyGoogleIdentity>>;
  if (provider === 'google') {
    const idToken = typeof tokenJson['id_token'] === 'string' ? tokenJson['id_token'] : null;
    if (idToken === null) return 'provider_identity_invalid';
    identity = await verifyGoogleIdentity(idToken, cfg.clientId, expectedNonce);
  } else {
    if (accessToken === null) return 'no_access_token';
    identity = await verifyFacebookIdentity(accessToken, cfg);
  }

  if (identity === null) return 'provider_identity_invalid';

  try {
    const auth = await externalLogin(
      provider,
      identity.subject,
      identity.email,
      identity.emailVerified,
      identity.displayName,
      identity.avatarUrl,
    );
    return { token: auth.token };
  } catch (cause) {
    if (cause instanceof AuthSignal && cause.kind === 'unauthorized') {
      return 'provider_email_not_verified';
    }
    throw cause;
  }
}

export const oauthRoutes = router;
