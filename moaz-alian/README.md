# MOAZ ALIAN

MOAZ ALIAN is a cultural library and research platform for publishing and exploring books, articles, videos, research, debates, and authenticated editorial content.

## Data

Content and categories come from the ASP.NET library API in [`../api-server`](../api-server) —
one source, one writer. `src/lib/api.ts` is the only module that calls it, `src/lib/api-mapping.ts`
is the only place the API's shapes become the UI's, and the root loader hydrates the in-memory
store (`src/lib/content.ts`) from `/api/content/snapshot` before any page renders. Nothing reads
`content_items` or `categories` through PostgREST any more.

Auth, profiles/roles, site settings, debates and chat still live in Supabase; the API validates
the same Supabase access token for its editorial writes, so the dashboard signs in once.

`src/data/seed.ts` and `src/data/library/` are **not** bundled into the running app. They are the
dataset's origin, used by `api-server/tools/generate-seed.mjs` to build SQL and by the test suite
as a fixture. After changing them, regenerate and re-apply the seed, then restart the API (SQL
writes do not bump its cache version).

Supabase's legacy `public.content_items` and `public.categories` tables are now dead weight — the
API keeps the same corpus in the `library` schema with typed columns. Drop them once nothing is
reading them any more (see `drizzle/schema.ts` for the statements).

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

Set `VITE_API_URL` (browser) and `API_URL` (SSR) if the API is not on `http://localhost:5199`.

## Validation

```sh
bun run lint
bun run format:check
bun run test
bun run build
```

Database migrations are managed with Drizzle under `drizzle/migrations`. Configure the migration database URL with `LOVABLE_DB_MIGRATION_URL` before applying migrations. Public signup never grants an administrative role; bootstrap administrators through a controlled service-role operation.
