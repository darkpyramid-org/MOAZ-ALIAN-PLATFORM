import { Router } from 'express';
import { env } from '../config/env.js';
import { createOAuthState, consumeOAuthState } from '../lib/oauthState.js';
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

function defaultUserInfoEndpoint(provider: ProviderName): string {
  return provider === 'google'
    ? 'https://openidconnect.googleapis.com/v1/userinfo'
    : 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)';
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

    const url =
      `${authorizationEndpoint}?client_id=${encodeURIComponent(cfg.clientId as string)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(await createOAuthState(provider, req, res))}`;

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
    if (state === undefined || state === '' || !(await consumeOAuthState(provider, state, req, res))) {
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

    runExchange(provider, code, cfg)
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

/** 'token_exchange_failed' | 'no_access_token' | 'userinfo_failed' | 'no_email' | {token} */
async function runExchange(
  provider: ProviderName,
  code: string,
  cfg: OAuthProvider,
): Promise<string | { token: string }> {
  const tokenEndpoint = cfg.tokenEndpoint ?? defaultTokenEndpoint(provider);
  const userInfoEndpoint = cfg.userInfoEndpoint ?? defaultUserInfoEndpoint(provider);

  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId as string,
      client_secret: cfg.clientSecret as string,
      code,
      redirect_uri: cfg.redirectUri as string,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) return 'token_exchange_failed';

  const tokenJson = (await tokenResponse.json()) as Record<string, unknown>;
  const accessToken = typeof tokenJson['access_token'] === 'string' ? tokenJson['access_token'] : null;
  if (accessToken === null) return 'no_access_token';

  const userResponse = await fetch(userInfoEndpoint, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return 'userinfo_failed';

  const userJson = (await userResponse.json()) as Record<string, unknown>;
  const { email, name, avatar } = extractUserInfo(provider, userJson);
  if (email === null || email === '') return 'no_email';

  const auth = await externalLogin(email, name, avatar, provider);
  if (auth instanceof AuthSignal) {
    // externalLogin reports argument-shaped failures as signals; the original
    // would let any exception here bubble to the 502 catch below.
    throw new Error(auth.message);
  }
  return { token: auth.token };
}

function extractUserInfo(
  provider: ProviderName,
  root: Record<string, unknown>,
): { email: string | null; name: string | null; avatar: string | null } {
  const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

  if (provider === 'google') {
    return {
      email: str(root['email']),
      name: str(root['name']),
      avatar: str(root['picture']),
    };
  }

  // facebook nests the avatar under picture.data.url.
  const picture = root['picture'];
  let avatar: string | null = null;
  if (picture !== null && typeof picture === 'object' && !Array.isArray(picture)) {
    const data = (picture as Record<string, unknown>)['data'];
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      avatar = str((data as Record<string, unknown>)['url']);
    }
  }
  return {
    email: str(root['email']),
    name: str(root['name']),
    avatar,
  };
}

export const oauthRoutes = router;
