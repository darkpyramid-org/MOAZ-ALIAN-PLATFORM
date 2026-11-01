# MOAZ ALIAN

MOAZ ALIAN is a cultural library and research platform for publishing and exploring books, articles, videos, research, debates, and authenticated editorial content.

## Data

Content and categories come from the ASP.NET library API in [`../api-server`](../api-server) —
one source, one writer. `src/lib/api.ts` is the only module that calls it, `src/lib/api-mapping.ts`
is the only place the API's shapes become the UI's, and the root loader hydrates the in-memory
store (`src/lib/content.ts`) from `/api/content/snapshot` before any page renders. Nothing reads
`content_items` or `categories` through PostgREST any more.

Auth (login/register/JWT), roles, site settings and debates are served by the same API (`/api/auth/*`,
`/api/users*`, `/api/settings/*`, `/api/debates*`) against its PostgreSQL database (`library` schema) —
there is no Supabase anywhere in the stack. Writes carry the API-issued JWT shown once by `src/lib/auth.ts`.

`src/data/seed.ts` and `src/data/library/` are **not** bundled into the running app. They are the
dataset's origin, used by `api-server/tools/generate-seed.mjs` to build SQL and by the test suite
as a fixture. After changing them, regenerate and re-apply the seed, then restart the API (SQL
writes do not bump its cache version).

The database's schema and seed travel as two generated bundles: `api-server/apply-supabase.sql`
(schema + seed + verification, one paste into any SQL console) and `api-server/supabase-schema.sql`
(the initial schema snapshot). Regenerate them from the seed data with `node tools/generate-seed.mjs`.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

Set `API_URL` (SSR) if the API is not on `http://localhost:5199`. The browser needs
no variable in production: it stays same-origin under `/proxy-api`, which the
`vercel.json` rewrite tunnels to the backend, so the HTTPS frontend never fetches
the HTTP API directly (browsers block that as mixed content). Don't set
`VITE_API_URL` in production — it would override the same-origin proxy.

## Validation

```sh
bun run lint
bun run format:check
bun run test
bun run build
```

Database migrations are managed with Drizzle under `drizzle/migrations`. Configure the migration database URL with `LOVABLE_DB_MIGRATION_URL` before applying migrations. Public signup never grants an administrative role; bootstrap administrators through a controlled service-role operation.
