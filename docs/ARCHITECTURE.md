# Architecture Overview

## System shape

Multi-service monorepo with Node/Express backend and two TanStack Start frontends:

- **`apps/api/`** — Express 5 + TypeScript API; Prisma over PostgreSQL (`library` schema)
- **`apps/public/`** — public site (SSR/SEO friendly), TanStack Start + React 19 + Tailwind + Radix
- **`apps/dashboard/`** — admin dashboard (auth, content, debates, media, settings, users)
- **`packages/`** — shared workspace packages (`api-client`, `shared-types`, `ui`)
- **`vercel.json`** — Vercel multi-service deploy (see Deployment section)

## Request flow

1. Browser loads a TanStack Start app from Vercel.
2. Public content hydrates from `GET /api/content/snapshot` (via `packages/api-client`).
3. Dashboard writes carry the API-issued JWT (`Authorization: Bearer`).
4. The API validates the JWT locally, enforces role policies,
   and serves RFC 7807 `application/problem+json` errors.
5. `/api/chat` proxies to the AI gateway on the server (Lovable AI).
6. `/api/media/$` is a reserved route — return 404 until implemented.

## Auth and roles

- The backend is its own identity provider: `POST /api/auth/register` / `login` issue 7-day JWTs.
- The public site is anonymous for reads; the dashboard requires JWT auth.
- Roles live in `library.users`; admin is granted only via `AUTH_ADMIN_EMAILS` env (comma-separated emails).
- First-user auto-admin has been removed — there is no implicit privilege elevation.

## Frontend structure

```
apps/public/src/        apps/dashboard/src/
  components/             components/
  routes/                 routes/           # pages + api/ (chat, media)
  lib/                    lib/              # api.ts re-exports the shared API client
  hooks/                  hooks/
  test/                   test/
```

The shared API client lives in `packages/api-client` (single source of truth);
`api-mapping.ts` is the only place API shapes become UI models.

## Backend structure (`apps/api/src/`)

```
  domain/         # enums, ContentItem aggregate, validators — pure domain, no Express/Prisma
  services/       # application layer: content, category, auth orchestration
  middleware/     # trace, cors, body binding, rate limit, auth, error handler
  modules/        # route registration: auth, content, categories, admin, chat, docs, health
  lib/            # cross-cutting: prisma, cache, jwt, password, netjson, http helpers
  routes.ts       # top-level route mount
```

## Deployment (Vercel multi-service)

`vercel.json` declares four services: `api` (Express), `public`, `dashboard` (TanStack Start),
and `ui` (shared component library — not publicly exposed). The public site and
dashboard bind to the internal `api` service via the `API_URL` env binding injected at runtime.

Rewrites route:
- `/api/*` → `api` service
- `/dashboard/*` → `dashboard` service
- everything else → `public` service
