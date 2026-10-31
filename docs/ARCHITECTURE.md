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
5. `/api/chat` proxies to the Lovable AI gateway with authentication and thread-ownership checks.
6. `/api/media/$` serves validated storage object paths.

## Auth and roles

- Supabase Auth provides user sessions.
- Application roles are stored in `public.user_roles` and checked through database policies and server-side authorization.
- Migration `0012_remove_first_user_auto_admin.sql` replaces the signup trigger so public registration creates a profile but does not grant an admin role.
- Bootstrap the first administrator through a trusted operator action (SQL editor or another privileged server-side process). Never use user metadata, signup order, or client input to grant privileged roles.
- Migration `0014_user_roles_reference_profiles.sql` backfills missing profile rows for existing role holders before changing the role foreign key. Validate this migration against a representative database before deployment.

## Frontend structure

```
moaz-alian/src/
  components/
  routes/            # pages + api/
  integrations/supabase/
  lib/
  test/
```

## CI and security

`.github/workflows/ci.yml` runs Bun install, lint, Prettier format check, unit tests, build, and a Trivy filesystem dependency vulnerability scan. The Trivy job emits table output and fails on unfixed HIGH/CRITICAL findings; it does not upload SARIF because that requires the repository/org `security-events: write` permission.

The format check is intentionally strict. At the time of the PR #13 review, the latest run still reports 88 files requiring formatting; do not consider the formatting gate resolved until the formatter output is reviewed and committed and the check passes.
