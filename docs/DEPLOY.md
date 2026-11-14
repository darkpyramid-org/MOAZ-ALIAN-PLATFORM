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
| `AUTH_ADMIN_EMAILS` | JSON array, e.g. `["admin@example.com"]` |

Optional:

| Variable | Notes |
|----------|-------|
| `AUTH_ISSUER`, `AUTH_AUDIENCE` | JWT issuer/audience claims (defaults are fine) |
| `RATE_LIMIT_GLOBAL_PER_MINUTE`, `RATE_LIMIT_EDITORIAL_PER_MINUTE` | rate limits |
| `SWAGGER_ENABLED` | set `true` to enable OpenAPI UI in production |
| `AUTH_REGISTER_ROLES` | JSON array to restrict self-registration roles (defaults to editor) |
| `CONTENT_CACHE_*`, `RATE_LIMIT_*` | cache and rate limit tuning |
| `OAUTH_GOOGLE_*`, `OAUTH_FACEBOOK_*` | OAuth providers (all three per provider required) |
| `AI_API_KEY`, `OPENAI_API_KEY` | if `/api/chat` is used |

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
