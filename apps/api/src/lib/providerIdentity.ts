import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { OAuthProvider } from '../config/env.js';

interface GoogleJwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface GoogleJwksResponse {
  keys?: GoogleJwk[];
}

export interface VerifiedProviderIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

interface GoogleIdTokenClaims {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  exp?: unknown;
  iat?: unknown;
  sub?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}

interface FacebookDebugResponse {
  data?: {
    app_id?: unknown;
    is_valid?: unknown;
    user_id?: unknown;
    expires_at?: unknown;
    scopes?: unknown;
  };
}

interface FacebookProfile {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  email_verified?: unknown;
  picture?: { data?: { url?: unknown } };
}

let googleJwksCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;

function decodeJsonSegment<T>(segment: string): T | null {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(segment)) return null;
    const decoded = Buffer.from(segment, 'base64url').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== segment) return null;
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

async function getGoogleSigningKeys(forceRefresh = false): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (!forceRefresh && googleJwksCache !== null && googleJwksCache.expiresAt > now) {
    return googleJwksCache.keys;
  }

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!response.ok) throw new Error('Google signing keys could not be retrieved.');

  const body = (await response.json()) as GoogleJwksResponse;
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error('Google signing keys response is invalid.');
  }

  const cacheControl = response.headers.get('cache-control') ?? '';
  const maxAge = Number(cacheControl.match(/max-age=(\\d+)/i)?.[1] ?? 300);
  googleJwksCache = {
    keys: body.keys,
    expiresAt: now + Math.max(60, Math.min(maxAge, 3600)) * 1000,
  };
  return body.keys;
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 255 &&
    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

/**
 * Validates Google's OIDC ID token locally against Google's published RS256
 * signing keys. User-info email is never an authority for account linking.
 */
export async function verifyGoogleIdentity(
  idToken: string,
  clientId: string,
  expectedNonce: string,
): Promise<VerifiedProviderIdentity | null> {
  const segments = idToken.split('.');
  if (segments.length !== 3) return null;

  const header = decodeJsonSegment<{ alg?: unknown; kid?: unknown; typ?: unknown }>(segments[0] ?? '');
  const claims = decodeJsonSegment<GoogleIdTokenClaims>(segments[1] ?? '');
  if (header === null || claims === null || header.alg !== 'RS256' ||
      typeof header.kid !== 'string' || header.kid.length === 0 ||
      (header.typ !== undefined && header.typ !== 'JWT')) return null;

  let keys: GoogleJwk[];
  try {
    keys = await getGoogleSigningKeys();
  } catch {
    return null;
  }

  let jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA' &&
    (key.alg === undefined || key.alg === 'RS256') && (key.use === undefined || key.use === 'sig'));
  if (jwk === undefined) {
    try {
      keys = await getGoogleSigningKeys(true);
      jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA' &&
        (key.alg === undefined || key.alg === 'RS256') && (key.use === undefined || key.use === 'sig'));
    } catch {
      return null;
    }
  }
  if (jwk === undefined) return null;

  let signatureValid = false;
  try {
    const publicKey = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
    signatureValid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${segments[0]}.${segments[1]}`, 'ascii'),
      publicKey,
      Buffer.from(segments[2] ?? '', 'base64url'),
    );
  } catch {
    return null;
  }
  if (!signatureValid) return null;

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches = claims.aud === clientId ||
    (Array.isArray(claims.aud) && claims.aud.includes(clientId));
  const authorizedPartyMatches = Array.isArray(claims.aud) && claims.aud.length > 1
    ? claims.azp === clientId
    : claims.azp === undefined || claims.azp === clientId;
  const issuerMatches = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';

  if (!issuerMatches || !audienceMatches || !authorizedPartyMatches ||
      typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
      typeof claims.iat !== 'number' || !Number.isSafeInteger(claims.iat) || claims.iat > now + 60 ||
      typeof claims.sub !== 'string' || claims.sub.trim() === '' ||
      typeof claims.nonce !== 'string' || claims.nonce !== expectedNonce ||
      claims.email_verified !== true || !validEmail(claims.email)) {
    return null;
  }

  return {
    subject: claims.sub,
    email: claims.email,
    emailVerified: true,
    displayName: typeof claims.name === 'string' ? claims.name : null,
    avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
  };
}

/**
 * Facebook's Graph API does not provide a generally dependable email_verified
 * claim. Validate the access token against this app and the /me subject, but
 * treat the email as unverified unless Meta explicitly returns
 * email_verified=true. Existing subject bindings may still authenticate.
 */
export async function verifyFacebookIdentity(
  accessToken: string,
  cfg: OAuthProvider,
): Promise<VerifiedProviderIdentity | null> {
  try {  
    const appAccessToken = `${cfg.clientId}|${cfg.clientSecret}`;
    const debugUrl = new URL('https://graph.facebook.com/debug_token');
    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set('access_token', appAccessToken);
  
    const debugResponse = await fetch(debugUrl);
    if (!debugResponse.ok) return null;
    const debug = (await debugResponse.json()) as FacebookDebugResponse;
    const data = debug.data;
    const now = Math.floor(Date.now() / 1000);
    if (data?.is_valid !== true || data.app_id !== cfg.clientId ||
        typeof data.user_id !== 'string' || data.user_id.trim() === '' ||
        typeof data.expires_at !== 'number' || data.expires_at <= now ||
        !Array.isArray(data.scopes) || !data.scopes.includes('email')) {
      return null;
    }
  
    const profileResponse = await fetch(cfg.userInfoEndpoint, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!profileResponse.ok) return null;
    const profile = (await profileResponse.json()) as FacebookProfile;
    if (profile.id !== data.user_id) return null;
  
    const picture = profile.picture?.data?.url;
    return {
      subject: data.user_id,
      email: validEmail(profile.email) ? profile.email : null,
      emailVerified: profile.email_verified === true,
      displayName: typeof profile.name === 'string' ? profile.name : null,
      avatarUrl: typeof picture === 'string' ? picture : null,
    };
  } catch {
    return null;
  }
}
