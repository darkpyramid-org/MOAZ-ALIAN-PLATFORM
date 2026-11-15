# Deployment — Vercel (multi-service)

The repo deploys as one Vercel project with three services defined in `vercel.json`:

| Service | Root | Public URL | Framework |
|---------|------|-----------|-----------|
| `public` | `apps/public` | `/` | TanStack Start (Lovable) |
| `dashboard` | `apps/dashboard` | `/dashboard/*` | TanStack Start (Lovable) |
| `api` | `apps/api` | `/api/*` (internal service; no direct public route to API-only hostnames needed) | Express |

Shared libraries (`packages/ui`, `packages/api-client`, `packages/shared-types`) are consumed directly by the frontends and API workspaces during their builds.

## Routing

- `/api/(.*)` → `api` service
- `/dashboard`, `/dashboard/(.*)` → `dashboard` service
- `/(.*)` → `public` service

## Service bindings

Both frontends call the API at runtime. Each is bound to the `api` service via
`API_URL` (Vercel injects the internal URL of `api` at runtime). The frontends read
`process.env.API_URL` for server-side rendering and API requests.

## Required environment variables — API service

Set these in the Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | **Must point at a publicly reachable Postgres** (Neon/Supabase/RDS), not localhost. Same schema convention: `?schema=library` |
| `AUTH_JWT_SECRET` | 32+ random characters. Unique per environment |
| `CORS_ALLOWED_ORIGINS` | e.g. `["https://your-vercel-app.vercel.app","https://your-domain.com"]` |
| `CORS_ALLOW_VERCEL_ORIGINS` | set `true` temporarily to allow any `*.vercel.app` origin (e.g. for preview deployments) |
| `FRONTEND_URL` | your public site origin (used by OAuth callback redirects) |
| `TRUSTED_PROXY_CIDRS` | optional JSON array of exact reverse-proxy IPs/CIDRs. Only these peers may supply trusted `X-Forwarded-For` hops. Leave unset if the hosting ingress cannot be identified precisely. |
| `AUTH_ADMIN_EMAILS` | JSON array, e.g. `["admin@example.com"]` |

Optional:

| Variable | Notes |
|----------|-------|
| `AUTH_ISSUER`, `AUTH_AUDIENCE` | JWT issuer/audience claims (defaults are fine) |
| `RATE_LIMIT_GLOBAL_PER_MINUTE`, `RATE_LIMIT_EDITORIAL_PER_MINUTE` | shared global/editorial quotas |
| `RATE_LIMIT_STORE` | `upstash` in production; `memory` only for local/test |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST credentials; required when store is `upstash` |
| `SWAGGER_ENABLED` | set `true` to enable OpenAPI UI in production |
| `AUTH_REGISTER_ROLES` | JSON array to restrict self-registration roles (defaults to editor) |
| `CONTENT_CACHE_*`, `RATE_LIMIT_*` | cache and rate limit tuning |
| `OAUTH_GOOGLE_*`, `OAUTH_FACEBOOK_*` | OAuth providers (all three per provider required) |
| `AI_API_KEY`, `OPENAI_API_KEY` | if `/api/chat` is used |

## Shared rate-limit storage

Production requires `RATE_LIMIT_STORE=upstash` and the Upstash Redis REST URL/token. The API increments fixed-window counters with a single atomic Redis Lua EVAL (INCR + PEXPIRE), keyed by a SHA-256 partition digest and a global/editorial scope. Redis TTL expires counters automatically. Local in-memory mode is retained only for development and tests; it is not a multi-instance security boundary. On a shared-store outage, the global read/API budget fails open to preserve availability, while editorial writes fail closed with HTTP 503. Both paths emit token/PII-free operational logs.

## Reverse-proxy and rate-limit trust boundary

The API ignores raw `X-Forwarded-For` values unless the immediate TCP peer matches an entry in `TRUSTED_PROXY_CIDRS`. Express then walks the forwarded chain from the nearest proxy outward and stops at the first untrusted address. Configure exact ingress proxy addresses/CIDRs (JSON array or indexed `TRUSTED_PROXY_CIDRS_0`, `TRUSTED_PROXY_CIDRS_1`, …); do not use `*`, `0.0.0.0/0`, or a numeric hop count. When unset, no proxy is trusted and rate limiting uses the socket peer address. If the hosting provider does not publish a stable, verifiable ingress range for the API, keep this setting empty and enforce client-facing rate limits at the provider edge/WAF rather than trusting a spoofable forwarding header.

## OAuth identity and account-linking policy

- **Google:** request the `openid email profile` scopes. The API validates the ID-token RS256 signature against Google's JWKS and checks issuer, audience/authorized party, expiry, issue time, OIDC nonce, and `email_verified=true`. The ID-token `sub` is the stable provider identity; user-info email is not trusted for account linking.
- **Facebook:** the API validates the access token through Graph `debug_token`, checks the configured app ID, validity, expiry, email permission when used, and requires the `/me` subject to match the token's `user_id`. Meta's Graph API does not generally provide a dependable `email_verified` claim. Therefore an unverified Facebook email is never used to link or create an account. A previously linked Facebook subject can still sign in without an email claim; first-time Facebook linking requires an explicit `email_verified=true` provider claim. Do not weaken this rule by treating the Graph `email` field or `verified` profile flag as proof of email ownership.
- Provider identities are stored by the unique `(provider, providerSubject)` pair. Email is linking metadata only and is accepted for first-time linking only after explicit provider verification.
- Apply Prisma migrations before deploying the API: the OAuth identity table is additive and does not alter existing user rows.

## Frontend environment variables

Both frontends work without env vars — they default to same-origin `/proxy-api` (or
`/api` depending on build) and use `/api` for SSR. `VITE_API_URL` only needed if you want
browser-side requests to go directly to an absolute API origin instead of same-origin.

Set in the Vercel dashboard for the frontend services:

| Variable | Notes |
|----------|-------|
| `VITE_API_URL` | optional; if set to `/api`, browser requests go same-origin |
| `AI_API_KEY` | if `/api/chat` is enabled on the frontend |

## Prisma

- `prisma generate` runs automatically on install via `allowBuilds` (and `onlyBuiltDependencies` in `pnpm-workspace.yaml`), and is also wired into the `build` script of `@moaz/api`.
- Database **migrations must be applied manually**: `pnpm --filter @moaz/api db:migrate` (i.e. `prisma migrate deploy`). This is not run automatically by Vercel builds.
- The `library` schema is owned by the EF migration history; do not use `prisma migrate dev` against it.

## Troubleshooting Vercel builds

- **`ERR_PNPM_IGNORED_BUILDS`** — `allowBuilds` in `pnpm-workspace.yaml` (and `strictDepBuilds: false`) controls which postinstall scripts are allowed (Prisma engines, esbuild).
- **`EXIT_CODE: 1` in install** — check that `pnpm-lock.yaml` is committed and consistent with `package.json` (`pnpm install --frozen-lockfile` must pass).
- **API responds 404 on `/api/auth/*` or `/api/content/*`** — the `/api/(.*)` rewrite hits the internal `api` service; ensure `DATABASE_URL` is reachable from Vercel.

## Authentication resource controls

- Password hashing and verification use Node's asynchronous `crypto.pbkdf2` API. Derivation runs in libuv's worker pool instead of synchronously blocking the API event loop.
- Password inputs are limited to 1,024 UTF-8 bytes before derivation. The existing ASP.NET Identity V2/V3 Base64 format, PRF, iteration count, salt and subkey encoding are preserved for .NET interoperability.
- Login for an unknown email performs a verification against a fixed, non-secret dummy V3 hash before returning the same generic authentication failure as a wrong password. This reduces account-enumeration timing differences; it does not make network timing perfectly identical.
- Login, registration, forgot-password, reset-password and change-password routes have additional fixed-window limits. Limits are keyed by the direct socket peer and a SHA-256 digest of the normalized account identifier (or reset token); raw email addresses and reset tokens are not retained in rate-limit keys.
- Express proxy trust is intentionally not enabled by this middleware. If deployed behind a reverse proxy, configure a trusted proxy topology before changing the IP source; do not trust arbitrary `X-Forwarded-For` input.
- Rate-limit buckets are process-local. Multi-instance deployments should additionally enforce equivalent limits at the edge/API gateway for a fleet-wide budget.
