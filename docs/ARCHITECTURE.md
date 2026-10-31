# Architecture Overview

## System shape

Single application package: `moaz-alian/`.

- **UI:** React 19 + TanStack Start/Router + Tailwind + Radix
- **Data:** Supabase (Postgres, Auth, RLS, Storage)
- **Server routes:** TanStack file routes under `src/routes/api/` (no separate `api-server/` package)
- **ORM / SQL:** Drizzle under `moaz-alian/drizzle/`
- **Package manager:** Bun (CI uses `bun install --frozen-lockfile`)

## Request flow

1. Browser loads the TanStack Start app.
2. Public content reads use the Supabase client (publishable key + RLS).
3. Authenticated dashboard routes use session middleware.
4. Privileged server operations use the service-role client (`SUPABASE_SERVICE_ROLE_KEY`) only on the server.
5. `/api/chat` proxies to the Lovable AI gateway with ownership checks.
6. `/api/media/$` serves validated storage object paths.

## Auth and roles

- Supabase Auth for sessions.
- App roles in `user_roles` (see SQL migrations).
- First-user auto-admin behavior is a known risk tracked in issue #6; prefer controlled bootstrap.

## Frontend structure

```
moaz-alian/src/
  components/
  routes/            # pages + api/
  integrations/supabase/
  lib/
  test/
```

## CI

`.github/workflows/ci.yml`: Bun install, lint, format check, test, build. Security scan (Trivy) is documented but disabled until org `security-events` permissions allow it (issue #9).
