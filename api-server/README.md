# api-server — the platform's read/write API

ASP.NET Core (.NET 9) minimal APIs over **PostgreSQL**, issuing and validating its own JWT access
tokens. The TanStack Start app in `../moaz-alian` talks to this API instead of touching the database
directly; the response contracts mirror `../moaz-alian/src/types/content.ts` (camelCase, stringified
enums) so the frontend consumes them with no translation layer.

## Architecture

```
src/
  ApiServer.Domain          entities, value objects, enums, invariants — zero dependencies
  ApiServer.Application     use cases + ports (readers, repositories, cache, clock, identity)
  ApiServer.Infrastructure  adapters: EF Core/Npgsql, JWT auth, memory cache, clock
  ApiServer.WebApi          endpoints, transport binding, middleware, composition root
tests/
  ApiServer.Application.Tests  45 unit tests with hand-written fakes (no mocking library)
```

Dependencies point inward only; the reference graph is the dependency rule. Deliberately absent:
MediatR, AutoMapper, a repository-per-aggregate framework, CQRS-as-a-library. The read/write port
split (`IContentReader` vs `IContentRepository`) exists because reads project straight onto DTOs
with `AsNoTracking` while writes work on aggregates — that is the whole reason for two ports, and
it does not need a framework.

Layering is enforced mechanically: `TreatWarningsAsErrors` plus `AnalysisLevel latest-recommended`.

## Database

EF Core 9 + Npgsql, targeting the same Supabase Postgres project as the frontend, but under a
dedicated **`library` schema**:

- `public` still holds the legacy tables left over from the Supabase era (`content_items` as a
  jsonb blob, `categories`, chat, debates); `library.*` owns the API's normalized tables and
  coexists without name collisions. The legacy tables are read by nothing and can be dropped
  once the export is safely stored.
- Arabic behaves like the old frontend expectations: ICU collation `ar-x-icu` on the text columns
  that were `Arabic_100_CI_AS_SC_UTF8` on SQL Server, and `EF.Functions.ILike` for search
  (case-insensitive by definition; wildcards escaped with backslashes).
- Enums are `smallint`; `authorized_links` is a `jsonb` column on `content_items` (owned
  collection via `ToJson()`); timestamps are `timestamp(3) with time zone`.
- The EF migration history table is `library."__EFMigrationsHistory"` — nothing is added to
  `public`.

Indexes: unique `(Type, Slug)`, `(Type, PublishedAt)`, `PublishedAt`, `Featured`, `SeriesName`,
plus FK indices. Search is LIKE-boundary; at tens of thousands of rows upgrade to `pg_trgm`
expressions or a `tsvector` generated column with a GIN index — the schema does not block it.

Writes use `EnableRetryOnFailure(3, 5s)` for transient pooler blips.

## Auth

The API is its own identity provider: `POST /api/auth/register` and `POST /api/auth/login` issue
HMAC-SHA256 JWTs signed with `Auth:JwtSecret` (7-day expiry), and every write validates that token
locally — no external identity service, no sessions. The first registered account is seeded with
the `admin` + `editor` roles; later registrations get `editor` and stay board-invisible until an
admin promotes or demotes them with `POST /api/users/{id}/roles`.

Authorization: `ContentEditor` requires a `roles` claim containing `admin` or `editor`;
`SiteAdmin` requires `admin`. Roles live in the `library.users` table and are stamped into the
signed token at login, so a role change takes effect on the next login (or `GET /api/auth/me`,
which re-reads the database).

Rate limits: 300 req/min per user (or IP when anonymous) globally, 30 req/min for the editorial
writes. CORS allows only the origins listed in `Cors:AllowedOrigins` (no credentials — the bearer
header is CSRF-inert).

## Frontend contract

| Endpoint | Notes |
| --- | --- |
| `GET /api/content` | filters `type, categoryId, series, featured, demo, search, sort, page, pageSize`; enums are camelCase strings; paging clamped 1..100 |
| `GET /api/content/counts` | per-type totals for the library tabs |
| `GET /api/content/{type}/{slug}` | `video|book|article|research` (+ plural aliases), mirrors frontend routes; body included here only |
| `POST /api/content` | editor/admin; 201 + Location |
| `PUT /api/content/{id}` | full replacement, editor/admin |
| `DELETE /api/content/{id}` | editor/admin |
| `GET /api/categories` | includes `contentCount` |
| `POST/PUT/DELETE /api/categories/{id}` | admin only for delete-with-content → 409 |
| `POST /api/auth/register`, `POST /api/auth/login` | issue the API's own JWT; first account ever registered is admin+editor |
| `GET /api/auth/me` | profile + roles of the token's user, re-read from the database |
| `GET /api/users`, `POST /api/users/{id}/roles` | admin only; dashboard user management |
| `GET/PUT /api/settings/{id}` | site settings blob (PUT editor/admin) |
| `GET/POST/PUT/DELETE /api/debates` | debates archive (writes editor/admin) |

Errors are RFC 7807 Problem Details everywhere, including the 401/403 from middleware
(`{title, status, traceId}`, plus `errors` field-wise for validation). Slugs and ids are Arabic —
URL-encode them (standard client behavior).

Caching is a read-through memory cache keyed by a version token: any successful write bumps the
version and every listing/detail/counts key is instantly cold. Single instance only — a second
API instance would need the version token in a shared store (trivial port).

## Running locally

```bash
cd api-server
dotnet run --project src/ApiServer.WebApi    # Swagger UI at /swagger, OpenAPI at /openapi/v1.json
```

The connection string already points at the hosted PostgreSQL database
(`db77224.public.databaseasp.net`) via `appsettings*.json`; override it anywhere in the chain
(user-secrets, environment variables) without code changes:

```bash
cd src/ApiServer.WebApi
dotnet user-secrets set "ConnectionStrings:Postgres" "<Server=...;Database=...;User Id=...;Password=...;SSL Mode=...;Trust Server Certificate=true>"
```

Npgsql accepts either the key-value form or a `postgres://` URI; the key-value form is preferred
because hosted poolers often need `Trust Server Certificate=true`, which is what makes
`SSL Mode=Require` work when the certificate is not issued for the proxy hostname.
`EnableRetryOnFailure(3, 5s)` absorbs transient pooler resets.

For migrations, apply [`apply-supabase.sql`](apply-supabase.sql) / [`supabase-schema.sql`](supabase-schema.sql)
in the database's SQL console (idempotent — the recommended path against a hosted instance), or run

```bash
dotnet ef database update --project src/ApiServer.Infrastructure --startup-project src/ApiServer.WebApi
```

against a connection that bypasses a transaction-mode pooler.

### Seed data

`seed-library.sql` carries the platform's real dataset — the 8 categories and 29 library records
from `moaz-alian/src/data/` (19 videos, 5 books, 3 articles, 2 research) converted to this
schema. It is an idempotent upsert: re-running refreshes every row in place. Regenerate it after
frontend data changes:

```bash
node --experimental-strip-types tools/generate-seed.mjs     # writes seed-library.sql
node --experimental-strip-types tools/verify-identity.mjs   # deep-compares API vs frontend arrays
```

The verifier imports the frontend modules directly, so "IDENTICAL" means the API responses match
the `ContentItem` objects field for field — the integration contract proven, not assumed.
Caveat: seeding through SQL does not bump the API's cache version; restart the API (or wait out
the ≤2-minute item TTL) to see fresh data.

## Production configuration

Environment variables only — the same keys as user-secrets with `__`:
`ConnectionStrings__Postgres`, `Auth__JwtSecret`, `Auth__Issuer` (optional pin),
`Cors__AllowedOrigins__0`. The API refuses to start with an empty connection string, refuses to
start with a missing/short JWT secret, and refuses cross-origin writes when no origins are
configured (`Cors__AllowedOrigins__n` enumerates them).

Never commit database passwords or JWT secrets. `appsettings.json` carries placeholders; the
development credentials currently live in `appsettings.Development.json` — move them into
user-secrets before sharing the repo. If credentials were ever pasted into a chat, issue, or
ticket: rotate the database password and the JWT secret first, then update user-secrets/env.

### What production mode changes

| Concern | Development | Production (`appsettings.Production.json`) |
| --- | --- | --- |
| Swagger UI + OpenAPI JSON | served at `/swagger`, `/openapi/v1.json` | off by default; `Swagger:Enabled=true` opts a staging environment in |
| Token validation (`RequireHttpsMetadata`) | `false` | `true` |
| Startup validation | same | JWT secret must exist and be ≥ 32 chars, connection string must be present, or the process exits |
| `root` | redirects to Swagger | `{ status, service, health }` status document |
| HTTPS | plain local loopback | `UseHsts` + `UseHttpsRedirection`; terminate TLS at your edge |

### Deploy: Docker

```bash
cd api-server
docker build -t moaz-alian-api .
docker run -p 5199:5199 \
  -e ConnectionStrings__Postgres="Server=...;Database=...;User Id=...;Password=...;SSL Mode=Require;Trust Server Certificate=true" \
  -e Auth__JwtSecret="<32+ characters>" \
  -e Auth__Issuer="https://api.example.com" \
  -e Cors__AllowedOrigins__0="https://your-frontend.example.com" \
  moaz-alian-api
```

Then set the frontend's `VITE_API_URL` / `API_URL` to the API's public URL and redeploy.

### Deploy: bare / systemd

```bash
dotnet publish src/ApiServer.WebApi -c Release -o out
# out/ is self-describing; run behind your reverse proxy:
ASPNETCORE_ENVIRONMENT=Production dotnet out/ApiServer.WebApi.dll
```

Set the same environment variables as above; point `/health` at your readiness probe.

### Deploy: IIS / runasp.net (WebDeploy — the publish profile path)

`src/ApiServer.WebApi/Properties/PublishProfiles/site103859-WebDeploy.pubxml` targets the hosted
IIS site (`moaz-alian.runasp.net`). Use it from Visual Studio (Publish → profile) or:

```bash
dotnet publish src/ApiServer.WebApi -c Release /p:PublishProfile=site103859-WebDeploy
```

The profile is self-contained (`win-x86`) and deploys through MSDeploy/WMSVC. The companion
`*.pubxml.user` file (encrypted deploy password, connection-string prompt) is machine-local and
git-ignored — never commit it.

**The production secret lives in `appsettings.Production.user.json`** (project root, the deploy
machine only, git-ignored) — the composition root loads optional `appsettings.{Environment}.user.json`
overrides, so the IIS box needs no hosting-panel variables:

```json
{
  "Auth": {
    "Issuer": "http://moaz-alian.runasp.net",
    "JwtSecret": "<generate once: openssl rand -hex 32>"
  },
  "Cors": { "AllowVercelOrigins": true }
}
```

Regenerating it is just re-running the file with a new secret — every previous issued token
stops validating, which is what you want on rotation. A hosting-panel `Auth__JwtSecret` variable
would outrank nothing: filling the user file is enough; both rank below explicitly configured
environment variables (`ASPNETCORE_ENVIRONMENT` ordering — see configuration precedence, the
user file sits last).

Frontend side (Vercel): set **`VITE_API_URL`** and **`API_URL`** to
`https://moaz-alian.runasp.net` in Project Settings → Environment Variables, then redeploy —
the built browser bundle and the SSR server both bake the base URL at build time.

CORS: `Cors:AllowVercelOrigins=true` (the default in `appsettings.Production.json`) accepts the
platform's per-deployment `*.vercel.app` subdomains. When the frontend has a final custom
domain, pin it exactly in `Cors:AllowedOrigins__0` (user or panel config) and set the flag to
`false`.

Startup failures (HTTP 500.30) mean configuration, not code, 99% of the time. Order of checks:

1. Missing/short `Auth:JwtSecret` — the options validator refuses to boot and says so.
2. Database reachability — the connection-string guard refuses to boot when empty.
3. Still unclear → turn on stdout logs in the published `web.config`
   (`stdoutLogEnabled="true"`, `stdoutLogFile=".\logs\stdout"`), redeploy, read
   `logs\stdout_*.log` in the site root. Keep it off afterwards.

### Deploy checklist

1. `ConnectionStrings__Postgres` → real database (migrations: `apply-supabase.sql` already applied, or `dotnet ef database update` — see Database section).
2. `Auth__JwtSecret` → a fresh 32+ character random value (`openssl rand -hex 32`).
3. `Auth__Issuer` + `Auth:Audience` match what the frontend expects (defaults are fine).
4. `Cors__AllowedOrigins__0..n` → the frontend's exact origins, scheme included.
5. Rate limiter keys off `X-Forwarded-For` behind the proxy — set
   `ForwardedHeaders:KnownProxies` to the proxy's IPs so spoofed headers cannot bypass limits.
6. `/health` must return 200 before routing traffic; consider it for your load-balancer probes.

## Tests

`dotnet test` — 45 unit tests over the real Application + Domain layers with hand-written fakes.
The database itself is exercised by the migration and the smoke files above; an integration suite
would need its own Postgres fixture and is the natural next addition.
