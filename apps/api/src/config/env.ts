import { z } from 'zod';

/**
 * Environment configuration. Fails at boot on anything missing or malformed —
 * the ASP.NET original validated JWT options eagerly (ValidateOnStart) for the
 * same reason: a misconfigured identity layer must not surface as a 500 on the
 * first login attempt.
 */
const DEVELOPMENT_JWT_SECRET =
  'fallback-secret-minimum-32-characters-for-preview-development';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5199),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required — the API cannot start without its database.')
    .default(
      process.env.DATABASE_URL ||
        'postgresql://moaz:moaz_dev@localhost:5434/moaz_alian?schema=library',
    ),

  AUTH_JWT_SECRET: z
    .string()
    .min(32, 'Auth:JwtSecret must be at least 32 characters (256 bits of HMAC-SHA256 key material).')
    .default(process.env.AUTH_JWT_SECRET || DEVELOPMENT_JWT_SECRET),
  AUTH_ISSUER: z.string().optional(),
  AUTH_AUDIENCE: z.string().default('authenticated'),
  AUTH_ADMIN_ROLE: z.string().default('admin'),
  AUTH_EDITOR_ROLE: z.string().default('editor'),
  AUTH_SERVICE_ROLE: z.string().default('service_role'),

  // Admin allowlist. A JSON array env var, or indexed keys (AUTH_ADMIN_EMAILS_0…),
  // mirroring the ASP.NET configuration binder. Comma-separated values are
  // deliberately unsupported — the .NET binder never accepted them either.
  AUTH_ADMIN_EMAILS: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:8080'),

  CORS_ALLOWED_ORIGINS: z.string().optional(),
  // Explicit proxy IPs/CIDRs allowed to supply X-Forwarded-For. Empty trusts none.
  TRUSTED_PROXY_CIDRS: z.string().optional(),
  CORS_ALLOW_VERCEL_ORIGINS: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1' || v === 'TRUE'),

  CONTENT_CACHE_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1' || v === 'TRUE'),
  CONTENT_CACHE_QUERY_TTL_MS: z.coerce.number().int().nonnegative().default(45_000),
  CONTENT_CACHE_ITEM_TTL_MS: z.coerce.number().int().nonnegative().default(120_000),
  CONTENT_CACHE_COUNTS_TTL_MS: z.coerce.number().int().nonnegative().default(300_000),

  RATE_LIMIT_GLOBAL_PER_MINUTE: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_EDITORIAL_PER_MINUTE: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_STORE: z.enum(['memory', 'upstash']).default('memory'),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  AUTH_RATE_LIMIT_IP_PER_MINUTE: z.coerce.number().int().positive().default(30),
  AUTH_RATE_LIMIT_ACCOUNT_PER_MINUTE: z.coerce.number().int().positive().default(5),

  SWAGGER_ENABLED: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v === 'true' || v === '1' || v === 'TRUE')),

  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_GOOGLE_REDIRECT_URI: z.string().optional(),
  OAUTH_GOOGLE_AUTHORIZATION_ENDPOINT: z.string().optional(),
  OAUTH_GOOGLE_TOKEN_ENDPOINT: z.string().optional(),
  OAUTH_GOOGLE_USERINFO_ENDPOINT: z.string().optional(),
  OAUTH_GOOGLE_SCOPE: z.string().default('openid email profile'),
  OAUTH_FACEBOOK_CLIENT_ID: z.string().optional(),
  OAUTH_FACEBOOK_CLIENT_SECRET: z.string().optional(),
  OAUTH_FACEBOOK_REDIRECT_URI: z.string().optional(),
  OAUTH_FACEBOOK_AUTHORIZATION_ENDPOINT: z.string().optional(),
  OAUTH_FACEBOOK_TOKEN_ENDPOINT: z.string().optional(),
  OAUTH_FACEBOOK_USERINFO_ENDPOINT: z.string().optional(),
  OAUTH_FACEBOOK_SCOPE: z.string().default('email'),
});

export type Env = z.infer<typeof schema> & {
  adminEmails: string[];
  allowedOrigins: string[];
  trustedProxyCidrs: string[];
  docsEnabled: boolean;
  isProduction: boolean;
  oauth: Record<'google' | 'facebook', OAuthProvider | undefined>;
  resolveIssuer: () => string;
};

export interface OAuthProvider {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scope: string;
}

/**
 * Collects indexed env keys (VAR_0, VAR_1, …) the way the ASP.NET configuration
 * binder expands arrays for section values.
 */
function collectIndexed(prefix: string, env: Record<string, string | undefined>): string[] {
  const values: string[] = [];
  let i = 0;
  // Bounded loop: a corrupt config must not hang the process.
  while (i < 1000) {
    const value = env[`${prefix}${i}`];
    if (value === undefined) break;
    values.push(value);
    i += 1;
  }
  return values;
}

function parseStringArray(raw: string | undefined, name: string): string[] {
  if (raw === undefined || raw.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed as string[];
    }
    throw new Error('not a string array');
  } catch {
    throw new Error(`${name} must be a JSON array of strings.`);
  }
}

export function loadEnv(): Env {
  const raw = { ...process.env } as Record<string, string | undefined>;
  const parsed = schema.parse(raw);

  const adminEmails = [
    ...parseStringArray(parsed.AUTH_ADMIN_EMAILS, 'AUTH_ADMIN_EMAILS'),
    ...collectIndexed('AUTH_ADMIN_EMAILS_', raw),
  ];

  const allowedOrigins = [
    ...parseStringArray(parsed.CORS_ALLOWED_ORIGINS, 'CORS_ALLOWED_ORIGINS'),
    ...collectIndexed('CORS_ALLOWED_ORIGINS_', raw),
  ];

  const trustedProxyCidrs = [
    ...parseStringArray(parsed.TRUSTED_PROXY_CIDRS, 'TRUSTED_PROXY_CIDRS'),
    ...collectIndexed('TRUSTED_PROXY_CIDRS_', raw),
  ];

  const isProduction = parsed.NODE_ENV === 'production';
  if (isProduction && parsed.RATE_LIMIT_STORE !== 'upstash') {
    throw new Error('Production requires RATE_LIMIT_STORE=upstash so rate limits are shared across API instances.');
  }
  if (parsed.RATE_LIMIT_STORE === 'upstash' && (!parsed.UPSTASH_REDIS_REST_URL || !parsed.UPSTASH_REDIS_REST_TOKEN)) {
    throw new Error('RATE_LIMIT_STORE=upstash requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }

  // A development fallback must never become the production signing key.
  // Require an explicitly supplied, non-placeholder secret with sufficient
  // length and character diversity before the API can start in production.
  if (isProduction) {
    const configuredSecret = raw.AUTH_JWT_SECRET;
    if (!configuredSecret || configuredSecret.trim() === '') {
      throw new Error(
        'AUTH_JWT_SECRET must be explicitly configured in production. Generate a unique secret (for example: openssl rand -base64 48).',
      );
    }

    if (
      configuredSecret === DEVELOPMENT_JWT_SECRET ||
      configuredSecret.length < 32 ||
      new Set(configuredSecret).size < 8
    ) {
      throw new Error(
        'AUTH_JWT_SECRET is weak or uses a development placeholder. Configure a unique random secret of at least 32 characters before starting the API in production.',
      );
    }
  }
  // Mirror of Program.cs: docs on in Development, off in Production unless
  // Swagger:Enabled is explicitly set.
  const docsEnabled =
    parsed.SWAGGER_ENABLED !== undefined ? parsed.SWAGGER_ENABLED : !isProduction;

  const oauth: Record<'google' | 'facebook', OAuthProvider | undefined> = {
    google: undefined,
    facebook: undefined,
  };
  if (parsed.OAUTH_GOOGLE_CLIENT_ID && parsed.OAUTH_GOOGLE_CLIENT_SECRET && parsed.OAUTH_GOOGLE_REDIRECT_URI) {
    oauth.google = {
      clientId: parsed.OAUTH_GOOGLE_CLIENT_ID,
      clientSecret: parsed.OAUTH_GOOGLE_CLIENT_SECRET,
      redirectUri: parsed.OAUTH_GOOGLE_REDIRECT_URI,
      authorizationEndpoint: parsed.OAUTH_GOOGLE_AUTHORIZATION_ENDPOINT ?? 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: parsed.OAUTH_GOOGLE_TOKEN_ENDPOINT ?? 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: parsed.OAUTH_GOOGLE_USERINFO_ENDPOINT ?? 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: parsed.OAUTH_GOOGLE_SCOPE,
    };
  }
  if (parsed.OAUTH_FACEBOOK_CLIENT_ID && parsed.OAUTH_FACEBOOK_CLIENT_SECRET && parsed.OAUTH_FACEBOOK_REDIRECT_URI) {
    oauth.facebook = {
      clientId: parsed.OAUTH_FACEBOOK_CLIENT_ID,
      clientSecret: parsed.OAUTH_FACEBOOK_CLIENT_SECRET,
      redirectUri: parsed.OAUTH_FACEBOOK_REDIRECT_URI,
      authorizationEndpoint: parsed.OAUTH_FACEBOOK_AUTHORIZATION_ENDPOINT ?? 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenEndpoint: parsed.OAUTH_FACEBOOK_TOKEN_ENDPOINT ?? 'https://graph.facebook.com/v18.0/oauth/access_token',
      userInfoEndpoint: parsed.OAUTH_FACEBOOK_USERINFO_ENDPOINT ?? 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)',
      scope: parsed.OAUTH_FACEBOOK_SCOPE,
    };
  }

  return {
    ...parsed,
    adminEmails,
    allowedOrigins,
    trustedProxyCidrs,
    docsEnabled,
    isProduction,
    oauth,
    resolveIssuer: () =>
      parsed.AUTH_ISSUER && parsed.AUTH_ISSUER.trim() !== ''
        ? parsed.AUTH_ISSUER.replace(/\/+$/, '')
        : 'http://localhost:5199',
  };
}

let resolved: Env | null = null;

function resolveEnv(): Env {
  if (resolved === null) {
    resolved = loadEnv();
  }
  return resolved;
}

/**
 * Lazily-validated config facade. Accessing any property runs the zod schema
 * on first use, so:
 *   - importing lib/cache or lib/jwt never throws in unit tests that have not
 *     configured the environment yet (validation is deferred to first access);
 *   - the API still fails fast — any real request touches the config, so a
 *     missing secret surfaces at boot, not on the first successful query.
 * A Proxy keeps the call-sites plain (`env.AUTH_JWT_SECRET`) with no loader
 * ceremony sprinkled through the modules.
 */
export const env: Env = new Proxy({} as Env, {
  get: (_target, property: string | symbol) => Reflect.get(resolveEnv() as object, property),
});

