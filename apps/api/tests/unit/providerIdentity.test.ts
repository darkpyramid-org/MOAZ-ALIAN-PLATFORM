import { generateKeyPairSync, sign as signJwt } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyFacebookIdentity, verifyGoogleIdentity } from '../../src/lib/providerIdentity.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'google-test-key', alg: 'RS256', use: 'sig' };
const clientId = 'google-client-id.apps.googleusercontent.com';
const nonce = 'verified-state-nonce';

function jwt(claimOverrides: Record<string, unknown> = {}, key = privateKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'google-test-key', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: clientId,
    exp: now + 300,
    iat: now,
    sub: 'google-subject-123',
    nonce,
    email: 'verified@example.com',
    email_verified: true,
    name: 'Verified User',
    picture: 'https://example.com/avatar.png',
    ...claimOverrides,
  })).toString('base64url');
  const input = `${header}.${claims}`;
  return `${input}.${signJwt('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
}

describe('Google OIDC identity validation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ keys: [jwk] })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('accepts a signed token with the expected issuer, audience, expiry, nonce and verified email', async () => {
    const identity = await verifyGoogleIdentity(jwt(), clientId, nonce);
    expect(identity).toEqual({
      subject: 'google-subject-123',
      email: 'verified@example.com',
      emailVerified: true,
      displayName: 'Verified User',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it.each([
    ['unverified email', { email_verified: false }],
    ['missing email verification', { email_verified: undefined }],
    ['wrong audience', { aud: 'another-client-id' }],
    ['wrong issuer', { iss: 'https://attacker.example' }],
    ['expired token', { exp: Math.floor(Date.now() / 1000) - 1 }],
    ['future issued token', { iat: Math.floor(Date.now() / 1000) + 120 }],
    ['wrong nonce', { nonce: 'attacker-nonce' }],
    ['missing subject', { sub: '' }],
    ['malformed email', { email: 'not-an-email' }],
  ])('rejects %s', async (_label, claims) => {
    expect(await verifyGoogleIdentity(jwt(claims), clientId, nonce)).toBeNull();
  });

  it('rejects a signature produced by a key not present in Google JWKS', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    expect(await verifyGoogleIdentity(jwt({}, other), clientId, nonce)).toBeNull();
  });

  it('fails closed when Google signing keys cannot be retrieved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
    expect(await verifyGoogleIdentity(jwt(), clientId, nonce)).toBeNull();
  });
});

describe('Facebook access-token and identity validation', () => {
  const cfg = {
    clientId: 'facebook-app-123',
    clientSecret: 'facebook-app-secret',
    redirectUri: 'https://api.example.com/callback',
    authorizationEndpoint: 'https://www.facebook.com/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/oauth/access_token',
    userInfoEndpoint: 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)',
    scope: 'email',
  };

  afterEach(() => vi.unstubAllGlobals());

  it('requires the token to belong to the configured app and the /me subject to match', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: {
        is_valid: true, app_id: cfg.clientId, user_id: 'fb-user-1',
        expires_at: Math.floor(Date.now() / 1000) + 300, scopes: ['email'],
      } }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'fb-user-1', name: 'Facebook User', email: 'person@example.com',
        picture: { data: { url: 'https://example.com/fb.png' } },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const identity = await verifyFacebookIdentity('facebook-access-token', cfg);
    expect(identity).toEqual({
      subject: 'fb-user-1',
      email: 'person@example.com',
      emailVerified: false,
      displayName: 'Facebook User',
      avatarUrl: 'https://example.com/fb.png',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/debug_token?');
  });

  it('rejects a token issued for a different Facebook app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ data: {
      is_valid: true, app_id: 'other-app', user_id: 'fb-user-1',
      expires_at: Math.floor(Date.now() / 1000) + 300, scopes: ['email'],
    } })));
    expect(await verifyFacebookIdentity('token', cfg)).toBeNull();
  });

  it('rejects expired, invalid or missing email permission tokens', async () => {
    for (const data of [
      { is_valid: false, app_id: cfg.clientId, user_id: 'fb-user-1', expires_at: 0, scopes: ['email'] },
      { is_valid: true, app_id: cfg.clientId, user_id: 'fb-user-1', expires_at: 0, scopes: ['email'] },
      { is_valid: true, app_id: cfg.clientId, user_id: 'fb-user-1', expires_at: Math.floor(Date.now() / 1000) + 300, scopes: [] },
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ data })));
      expect(await verifyFacebookIdentity('token', cfg)).toBeNull();
      vi.unstubAllGlobals();
    }
  });

  it('rejects a /me response for a different subject', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: {
        is_valid: true, app_id: cfg.clientId, user_id: 'fb-user-1',
        expires_at: Math.floor(Date.now() / 1000) + 300, scopes: ['email'],
      } }))
      .mockResolvedValueOnce(jsonResponse({ id: 'attacker-user' })));
    expect(await verifyFacebookIdentity('token', cfg)).toBeNull();
  });
});
