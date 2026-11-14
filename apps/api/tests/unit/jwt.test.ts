import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';

const secret = 'integration-jwt-secret-with-at-least-32-characters';
const issuer = 'https://issuer.integration.example';
const audience = 'moaz-integration-api';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_JWT_SECRET = secret;
  process.env.AUTH_ISSUER = issuer;
  process.env.AUTH_AUDIENCE = audience;
});

describe('JWT authentication contract', () => {
  it('issues and verifies a correctly signed token with issuer, audience, and roles', async () => {
    const { issueToken, verifyToken } = await import('../../src/lib/jwt.js');
    const token = issueToken({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'jwt-user@example.test',
      roles: ['editor'],
    });

    const payload = verifyToken(token);
    expect(payload?.sub).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload?.email).toBe('jwt-user@example.test');
    expect(payload?.roles).toEqual(['editor']);
  });

  it('rejects tampered signatures and tokens signed with a different secret', async () => {
    const { verifyToken } = await import('../../src/lib/jwt.js');
    const validShape = {
      sub: '11111111-1111-4111-8111-111111111111',
      email: 'jwt-user@example.test',
      roles: ['editor'],
    };
    const wrongSecret = jwt.sign(validShape, 'different-secret-with-at-least-32-characters', {
      algorithm: 'HS256',
      issuer,
      audience,
      expiresIn: '5m',
    });
    const validSignature = jwt.sign(validShape, secret, {
      algorithm: 'HS256',
      issuer,
      audience,
      expiresIn: '5m',
    });
    const tampered = validSignature.slice(0, -1) + (validSignature.endsWith('a') ? 'b' : 'a');

    expect(verifyToken(wrongSecret)).toBeNull();
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects incorrect issuer, audience, and expired tokens', async () => {
    const { verifyToken } = await import('../../src/lib/jwt.js');
    const claims = {
      sub: '11111111-1111-4111-8111-111111111111',
      email: 'jwt-user@example.test',
      roles: ['editor'],
    };
    const wrongIssuer = jwt.sign(claims, secret, {
      algorithm: 'HS256',
      issuer: 'https://wrong-issuer.example',
      audience,
      expiresIn: '5m',
    });
    const wrongAudience = jwt.sign(claims, secret, {
      algorithm: 'HS256',
      issuer,
      audience: 'wrong-audience',
      expiresIn: '5m',
    });
    const expired = jwt.sign(claims, secret, {
      algorithm: 'HS256',
      issuer,
      audience,
      expiresIn: '-60s',
    });

    expect(verifyToken(wrongIssuer)).toBeNull();
    expect(verifyToken(wrongAudience)).toBeNull();
    expect(verifyToken(expired)).toBeNull();
  });
});
