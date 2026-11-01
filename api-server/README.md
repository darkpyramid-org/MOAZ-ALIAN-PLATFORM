# api-server — the platform's read/write API

ASP.NET Core (.NET 9) minimal APIs over **Supabase-hosted PostgreSQL**, verifying the Supabase
access tokens the frontend already holds. The TanStack Start app in `../moaz-alian` talks to this
API instead of touching the database directly; the response contracts mirror
`../moaz-alian/src/types/content.ts` (camelCase, stringified enums) so the frontend consumes
them with no translation layer.

## Architecture

```
src/
  ApiServer.Domain          entities, value objects, enums, invariants — zero dependencies
  ApiServer.Application     use cases + ports (readers, repositories, cache, clock, identity)
  ApiServer.Infrastructure  adapters: EF Core/Npgsql, Supabase JWT, memory cache, clock
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

- `public` already holds the frontend's Drizzle tables (`content_items` as a jsonb blob,
  `categories`, chat, debates). `library.*` coexists without name collisions.
- PostgREST exposes `public` only, so the API's normalized tables are not accidentally queryable
  with the anon key.
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

## Supabase auth

The API is a pure resource server: Supabase signs tokens, this verifies them. No passwords, no
sessions, no user table of its own.

Two validation modes, selected by configuration:

- **`SupabaseAuth:JwtSecret` set** — HMAC-SHA256 (legacy Supabase projects; `jhdahdzlzhtgzebldmmz`
  is one). One shared secret, zero network calls. Get the value from
  Dashboard → Settings → API → JWT Secret.
- **`JwtSecret` unset** — asymmetric mode: fetches `{issuer}/.well-known/jwks.json`, matches the
  token's `kid`, caches keys, serves stale keys during short outages. Switches over automatically
  when the project is upgraded to the new JWT signing.

Issuers `"{ProjectUrl}/auth/v1"` and the literal `"supabase"` are both accepted (GoTrue has used
each historically); pin `SupabaseAuth:Issuer` to narrow it. `MapInboundClaims = false` keeps
`sub`, `role`, `app_metadata` byte-for-byte.

Authorization: `ContentEditor` policy accepts `app_metadata.roles` containing `admin` or `editor`;
`SiteAdmin` accepts `admin` (or the `service_role` token role). **Roles are read from the signed
token only.** The frontend's `user_roles` table must therefore be mirrored into the user's
`app_metadata` on Supabase — a database trigger or an edge function on role changes is the usual
mechanism. Without mirroring, editors get 403.

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

Errors are RFC 7807 Problem Details everywhere, including the 401/403 from middleware
(`{title, status, traceId}`, plus `errors` field-wise for validation). Slugs and ids are Arabic —
URL-encode them (standard client behavior).

Caching is a read-through memory cache keyed by a version token: any successful write bumps the
version and every listing/detail/counts key is instantly cold. Single instance only — a second
API instance would need the version token in a shared store (trivial port).

## Running locally

```bash
cd api-server
docker compose up -d                      # local Postgres 17 on host port 5433
dotnet user-secrets init -p src/ApiServer.WebApi   # once per machine
```

Point the API at your real Supabase project with **user-secrets** (stored outside the repo):

```bash
cd src/ApiServer.WebApi
dotnet user-secrets set "ConnectionStrings:Postgres" "<see the two forms below>"
dotnet user-secrets set "SupabaseAuth:ProjectUrl" "https://<ref>.supabase.co"
dotnet user-secrets set "SupabaseAuth:JwtSecret" "<Dashboard → Settings → API → JWT Secret>"
```

### Connection string: session pooler vs direct

Supabase's .NET snippet uses the **session pooler**, and that is the right choice for this API
at runtime. Use the key-value form, not the `postgres://` URI, because the pooler's certificate
is not issued for its hostname — `Trust Server Certificate=true` is what makes `SSL Mode=Require`
work instead of failing the handshake:

```
Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<ref>;Password=<db-password>;SSL Mode=Require;Trust Server Certificate=true
```

Two pooler facts that actually bite, both already handled here:

The session pooler is IPv4-proxied, so a host on an IPv6-only network cannot reach it — use the
direct (`db.<ref>.supabase.co:5432`) connection from IPv6 networks instead. And EF Core's prepared
statements are unsafe behind a *transaction*-mode pooler; this project targets session mode, and
`EnableRetryOnFailure(3, 5s)` absorbs the transient resets.

Migrations are the exception: `dotnet ef database update` must not go through a pooler, so point
it at the direct connection for that one command, or skip EF entirely and run
[`supabase-schema.sql`](supabase-schema.sql) in the Dashboard SQL editor (idempotent, and the
recommended path).

No new packages are needed for either form — `Npgsql` and the JSON configuration provider already
arrive transitively with `Npgsql.EntityFrameworkCore.PostgreSQL` and the ASP.NET Core shared
framework. Supabase's `dotnet add package Npgsql` step exists for plain console apps.

Apply the schema to Supabase — either from here:

```bash
dotnet ef database update --project src/ApiServer.Infrastructure --startup-project src/ApiServer.WebApi
```

or paste [`supabase-schema.sql`](supabase-schema.sql) into the Dashboard SQL editor (idempotent;
safer than routing the pooler through EF). Then:

```bash
dotnet run --project src/ApiServer.WebApi    # Scalar UI at /scalar, OpenAPI at /openapi/v1.json
```

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
`ConnectionStrings__Postgres`, `SupabaseAuth__ProjectUrl`, `SupabaseAuth__JwtSecret`,
`SupabaseAuth__Issuer` (optional pin), `Cors__AllowedOrigins__0`. The API refuses to start with an
empty connection string and refuses cross-origin writes when no origins are configured.

Never commit database passwords, JWT secrets, or the service-role key. `appsettings*.json` carry
placeholders only. If credentials were ever pasted into a chat, issue, or ticket: rotate the
database password, the JWT secret, and the publishable/secret API keys in the Supabase dashboard
first, then update user-secrets/env.

## Tests

`dotnet test` — 45 unit tests over the real Application + Domain layers with hand-written fakes.
The database itself is exercised by the migration and the smoke files above; an integration suite
would need its own Postgres fixture and is the natural next addition.
