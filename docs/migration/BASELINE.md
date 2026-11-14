# BASELINE — Phase 0 Architecture Audit

> Date: 2026-11-14 · Scope: full repository audit before any transformation.
> Every claim below was verified by reading the actual source; where documentation disagrees
> with code, the code is cited and the doc drift is listed in §7.

---

## 1. System overview (verified)

### 1.1 Backend — `api-server/`

| Aspect | Verified state |
| --- | --- |
| Framework | ASP.NET Core **.NET 9**, Minimal APIs (no MVC controllers) |
| Layering | 4 projects: `ApiServer.Domain` → `ApiServer.Application` → `ApiServer.Infrastructure` → `ApiServer.WebApi` (sln: `ApiServer.sln`) |
| Dependency rule | Enforced by project references + `TreatWarningsAsErrors` (`Directory.Build.props`); composition root is `Program.cs` only |
| ORM | EF Core 9 + Npgsql, dedicated `library` schema, `__EFMigrationsHistory` inside `library` |
| Database | PostgreSQL — **live target is `db77224.public.databaseasp.net`** (hosted) |
| Identity | API is its own IdP: HMAC-SHA256 JWTs, 7-day expiry, `roles` claim; PBKDF2 via `PasswordHasher` (Identity), 8-char password floor |
| Authorization | Policies `ContentEditor` (admin‖editor), `SiteAdmin` (admin) via `ICurrentUser` handlers; services re-check roles (`RequireEditor`) |
| Validation | FluentValidation 11 (validators registered in `Application/DependencyInjection.cs`) |
| Caching | Read-through `IMemoryCache` + in-process version counter (`InProcessContentCacheVersion.Bump()` on every write); single-instance only |
| Errors | RFC 7807 `application/problem+json` via `GlobalExceptionHandler` (validation → 400 with `errors`, domain → 422, conflict → 409, not-found → 404, forbidden → 403, default → 500) |
| Cross-cutting | Response compression (br/gz), forwarded headers, fixed-window rate limits (300/min global, 30/min editorial), CORS allowlist, OpenAPI + Swagger (dev/staging), `/health` with DB readiness check |
| Tests | **45 unit tests, 3 files** (`ContentItemTests`, `ContentServiceTests`, hand-written `TestFakes`). No integration, contract, or E2E tests. No tests for auth, categories, validators, or any endpoint |
| Deploys | Dockerfile, docker-compose (local postgres:17 `library` shape), IIS WebDeploy publish profile (`site103859-WebDeploy.pubxml`, win-x86, `moaz-alian.runasp.net`) |

The .NET backend is of **genuinely high quality** in its inner layers: real DDD aggregate
(`ContentItem` with type-block clearing, ISBN normalization, guard clauses), read/write port
split (`IContentReader` untracked projections vs `IContentRepository` tracked aggregates), and
a disciplined composition root. The problems are concentrated at the edges (see §5).

### 1.2 Frontend — `moaz-alian/`

| Aspect | Verified state |
| --- | --- |
| Framework | TanStack Start 1.168 + React 19 + Tailwind 4 + Radix/shadcn UI |
| Build | Vite 8 + `nitro` **beta**, wrapped in `@lovable.dev/vite-tanstack-config` (opaque Lovable wrapper) |
| Package manager | **Bun** (`bun.lock`, `bunfig.toml`, CI) — but a stale **`package-lock.json` also sits next to it** (two lockfiles) |
| App shape | **One** application containing both the public site and the dashboard (`src/routes/_authenticated/dashboard.*`, dashboard is client-only via `ssr: false`) |
| API access | `src/lib/api.ts` is the declared single fetch client; DTO→UI translation isolated in `src/lib/api-mapping.ts` (dependency-free, test-covered) — **but the base-URL block is duplicated 7×** (api.ts, auth.ts, chat.server.ts, dashboard.users/pages/debates raw `fetch`) and `proxy-api.$.tsx` hardcodes the backend |
| Auth | `src/lib/auth.ts` — token + user in `localStorage`, Bearer header writes, `onAuthStateChange` subscriber registry (retains a Supabase-shaped `{data:{subscription}}` API) |
| Data flow | Root loader hydrates a **module-level mutable store** (`src/lib/content.ts`: `allItems`, plus the mutable `categories` array from `src/data/categories.ts`) via `splice`; pages read synchronously from that store |
| Server routes | `/proxy-api/$` (hardcoded `http://moaz-alian.runasp.net` passthrough), `/api/chat` (OpenAI SDK streaming; auth via `/api/auth/me` re-check; persistence = stubs; threads live in `localStorage`), `/api/media/$` (**dead stub — every request 404s**), `/sitemap.xml` (generated from the in-memory store) |
| Settings | `src/data/site-settings.ts` holds a Zod schema + defaults; `lib/library.functions.ts` `getLibrary()` returns `resolveSiteSettings(undefined)` ⇒ **the public site always renders default settings**; dashboard `dashboard.pages.tsx` GET/PUTs `/api/settings/main` but nothing public reads it back |
| Tests | 10 Vitest files under `src/test/` (routing, mappings, settings parsing, media path validation, Arabic search, skeletons, calendar) |
| Env | `.env.example` exists (documents `VITE_API_URL`, `API_URL`, commented `AI_API_KEY`/`AI_GATEWAY_URL`; omits `AI_MODEL`, `OPENAI_API_KEY`). `API_URL`/`VITE_API_URL` are read in 7 files with divergent fallbacks |
| Size | 161 files / ~18.9k lines in `src/`; components 79 files (51 shadcn `ui/` of which **22 unused**, 4 `ai-elements/`, rest feature components); **no `features/` organization** |

### 1.3 Data origins (three competing copies of the corpus)

1. `moaz-alian/src/data/library/*.ts` — TypeScript seed (the dataset's declared origin).
2. `api-server/db/seed-library.sql` **and** `api-server/seed-library.sql` (root) — generated SQL
   seed; `tools/generate-seed.mjs` regenerates it from (1).
3. The live database (`library` schema) — fed by the SQL seed or EF migration.

Additionally `api-server/apply-supabase.sql`, `api-server/supabase-schema.sql`, and
`api-server/db/drizzle/` (schema + 12 migrations) target **Supabase**, a second hosted database
that no runtime code depends on any more.

---

## 2. API contract inventory (verified against endpoint sources)

Response envelope: camelCase JSON, enums as lower-case strings (`JsonStringEnumConverter`).
Errors: RFC 7807 `problem+json` `{title, status, traceId, errors?}` — **except** several inline
responses noted below that return ad-hoc `{title, status}` objects.

### Auth (`AuthEndpoints.cs`, `OAuthEndpoints.cs`)

| Method | Route | Auth | Success | Failure | Notes |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | anon | 200 `{token, user: AuthUserDto}` | 400 inline `{title,status}` · 401 problem | email lower-cased client & server |
| POST | `/api/auth/register` | anon | 200 `{token, user}` | 400 inline · 409 problem | **first account on empty table ⇒ admin+editor**; `Auth:AdminEmails` OR-rule |
| GET | `/api/auth/me` | Bearer | 200 `AuthUserDto` | 401 | re-reads DB (role changes apply) |
| PUT | `/api/auth/me` | Bearer | 200 `AuthUserDto` | 400 inline · 401 | displayName / avatarUrl |
| POST | `/api/auth/change-password` | Bearer | 204 | 400 inline · 401 | |
| POST | `/api/auth/forgot-password` | anon | 200 `{message, token}` | — | **reset token returned in body and logged** (dev convenience; no mailer) |
| POST | `/api/auth/reset-password` | anon | 204 | 400 problem | 1h token TTL |
| GET | `/api/auth/oauth/{google\|facebook}` | anon | 302 → provider | 501 problem if unconfigured | HMAC-signed state, 10-min TTL |
| GET | `/api/auth/oauth/{p}/callback` | anon | 302 → `{FrontendUrl}/auth?token=…` | redirect w/ `oauth_error` | |

`AuthUserDto`: `{id, email, roles[], isAdmin, canEditContent, displayName?, avatarUrl?}`.

### Content (`ContentEndpoints.cs`)

| Method | Route | Auth | Success | Failure | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/content` | anon | 200 `PagedResult<ContentSummaryDto>` `{items, page, pageSize, totalCount, totalPages, hasNextPage}` | 400 validation problem | query `type, categoryId, series, featured, demo, search, sort(page defaults 1, size clamped 1..100), sort: newest\|oldest\|title\|relevance`; ILIKE search, wildcards escaped; deterministic tiebreak on Id |
| GET | `/api/content/counts` | anon | 200 `{type, count}[]` | — | per-type totals |
| GET | `/api/content/snapshot` | anon | 200 `ContentItemDto[]` | — | whole corpus, newest first; the frontend's hydration pool |
| GET | `/api/content/{type}/{slug}` | anon | 200 `ContentItemDto` | 404 problem | `type` accepts singular + plural (`videos`, `books`, `articles`, `research`) |
| POST | `/api/content` | editor | 201 + `Location` | 400/409/422 | server-generated id (`slug-8hex`) |
| PUT | `/api/content/{id}` | editor | 200 `ContentItemDto` | 400/404/409/422 | **full replacement** semantics |
| DELETE | `/api/content/{id}` | editor | 204 | 404 | |

### Categories (`CategoryEndpoints.cs`)

| Method | Route | Auth | Success | Failure | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/categories` | anon | 200 `CategoryDto[]` (incl. `contentCount`) | — | display order |
| GET | `/api/categories/{id}` | anon | 200 `CategoryDto` | 404 | |
| POST | `/api/categories` | editor | 201 | 400 | |
| PUT | `/api/categories/{id}` | editor | 200 | 400/404 | id immutable |
| DELETE | `/api/categories/{id}` | editor | 204 | 409 while content references | |

### Users / Settings / Debates (`AdminEndpoints.cs` — raw ADO.NET, not Clean Architecture)

| Method | Route | Auth | Success | Failure | Notes |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/users` | **SiteAdmin** | 200 `[{id, email, display_name, created_at, roles}]` | 403 | **snake_case** body |
| POST | `/api/users/{id}/roles` | SiteAdmin | 200 `{success, roles}` | 404 | body `{role, has}` — **`has:true` REMOVES the role** (inverted semantics) |
| GET | `/api/settings/{id?}` | **anon** | 200 `{data: object\|null, version: updatedAt\|"default"}` | — | raw json from `library.site_settings` (Data column is `text`) |
| PUT | `/api/settings/{id?}` | editor | 200 `{success}` | — | body stored verbatim as text, no schema validation |
| GET | `/api/debates` | editor | 200 `[{id, guest_name, guest_background, topic, reply_summary, outcome, debate_date, video_url, tags, notes, created_at}]` | 403 | **snake_case**; `debate_date` is `text` in DB |
| POST | `/api/debates` | editor | 200 `{id, success}` | — | server GUID |
| PUT | `/api/debates/{id}` | editor | 200 `{id, success}` | 404 | |
| DELETE | `/api/debates/{id}` | editor | 204 | 404 | |

### Infrastructure

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | anon | liveness + DB readiness tag |
| GET | `/` | anon | status doc (prod) or Swagger redirect (dev) |
| GET | `/swagger`, `/openapi/v1.json` | anon | dev/staging only (`Swagger:Enabled`) |

### Frontend-owned server routes (`moaz-alian/src/routes/`)

| Route | Notes |
| --- | --- |
| `/proxy-api/$` | SSR passthrough proxy to the backend; **backend URL hardcoded** to `http://moaz-alian.runasp.net`; OPTIONS responds with permissive `Access-Control-Allow-*: *` |
| `/api/chat` | POST, streaming AI chat (OpenAI SDK `responses` call); auth re-checked against `/api/auth/me`; thread ownership + message persistence are **stubs**; threads stored client-side in `localStorage` (`hooks/use-chat-threads.ts`) |
| `/api/media/$` | **Dead stub: validates the object path, then returns 404 in both branches — nothing is ever served** |
| `/sitemap.xml` | SSR sitemap generated from the in-memory store (categories + non-demo items) |

---

## 3. Database state

**Live schema (`library`, EF Core — migration `20261031233722_InitialCreate`):**
`content_items` (single-table, type-specific columns NULL-cleaned by the aggregate; `tags`,
`references`, `authorized_links` jsonb; unique `(Type, Slug)`; indices on `(Type, PublishedAt)`,
`PublishedAt`, `Featured`, `SeriesName`), `content_category` join table, `categories`,
`users` (roles `text[]`, `AvatarUrl varchar(500000)`!), `site_settings` (`Data` is `text`),
`debates` (`DebateDate` is `text`), `library.__EFMigrationsHistory`.

**Legacy / competing schema artifacts (no runtime readers):**
`public.content_items` (jsonb blob, Supabase era), `public.categories`, and the Drizzle
stack `db/drizzle/{schema.ts,migrations 0000–0012}` targeting Supabase
(`auth.users`, `profiles`, `user_roles`, `site_settings` jsonb, `debates` with `date`,
`chat_threads`, `chat_messages`). The chat tables are referenced by **no runtime code** —
chat persistence is stubbed in `src/lib/chat/chat.server.ts`.

**Second hosting target:** SQL bundles assume Supabase; EF assumes `databaseasp.net`.

---

## 4. Audit table

| Area | Current State | Problem | Proposed Solution | Priority |
| --- | --- | --- | --- | --- |
| Backend | .NET 9 clean-architecture API, high-quality inner layers | Platform decision mandates Express 5 + TS target; Admin endpoints bypass layering with raw ADO.NET | Re-implement as modular monolith in `apps/api` preserving contracts; port users/settings/debates into proper modules | P1 |
| Frontend | Single TanStack Start app (public + dashboard), Bun | Public site and admin share one build/deploy/route tree; lockfile duplication | Split into `apps/public` + `apps/dashboard` micro frontends, shared packages, pnpm-only | P1 |
| Database | EF Core `library` schema live; Drizzle/Supabase artifacts + legacy `public` tables coexist | Two competing persistence stacks with divergent types (debate_date text vs date; site_settings text vs jsonb; two auth models) | Prisma schema generated from the **live** `library` schema; archive + drop Drizzle artifacts and legacy tables after export | P1 |
| Authentication | API-issued HMAC JWTs, PBKDF2 hashes, role claim, 7-day TTL | First-user auto-admin; reset token returned in HTTP body and written to logs; tokens in localStorage (XSS exposure); open registration | Controlled admin bootstrap (`Auth:AdminEmails` only), server-side reset delivery or removal, keep Bearer contract, document threat model | P0 |
| API | Contracts documented in api-server README + docs/API.md | Inline `{title,status}` errors vs Problem Details; snake_case in users/debates; `has` toggle inverted; undocumented endpoints (profile, change/forgot/reset password, OAuth) | Normalize to Problem Details + camelCase during module migration; publish complete OpenAPI; add contract tests | P1 |
| Architecture | Clean layering enforced in .NET; violated by `AdminEndpoints` and by startup DDL in `Program.cs` | Raw `DbCommand` in WebApi layer; `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` at boot; module-level mutable store on the SSR server | Move persistence behind services; migrations as deploy step only; request-scoped loading via TanStack Query/loader context | P1 |
| Dependencies | Frontend carries 60+ deps incl. `@lovable.dev/vite-tanstack-config`, `nitro` beta; both npm+bun lockfiles; unused UI deps (verify list §6) | Opaque build config, prerelease runtime, mixed lockfiles | Standard TanStack Start config, pnpm workspace, prune unused deps | P1 |
| Testing | 45 unit tests (.NET, content only) + 10 frontend unit files | No backend integration/contract tests, no CI backend job, no E2E, dashboard flows untested | Vitest+Supertest integration/contract suite per module in new API; Playwright E2E for critical journeys; CI gates | P1 |
| Deployment | Vercel (frontend) + IIS WebDeploy (backend) + Docker assets; root `vercel.json` references a root `package.json` that does not exist | Broken/stale deploy config; hardcoded backend URL; HTTP target for `/proxy-api`; no rollback story documented | Per-app deploy configs; env-driven `API_URL`; HTTPS edge; documented rollback | P1 |
| Security | Committed live DB credentials; `_secrets.mjs` helper; `AvatarUrl varchar(500000)` (base64 in DB); permissive proxy CORS | Secrets in VCS; data-URL avatars; open CORS on proxy preflight | **Rotate credentials now**, purge + gitignore, replace with object URLs; restrict proxy CORS | P0 |
| Documentation | READMEs are largely accurate and refreshingly honest; ROADMAP.md is aspirational boilerplate | Doc drift (CI claims, 45 vs 47 tests, missing endpoints, "no Supabase" vs drizzle remnants, `.env.example` omits two AI vars) | Rewrite docs as part of each phase; keep ADRs for decisions | P2 |

---

## 5. Findings by priority

### P0 — critical security / production-breaking

1. **Committed production database credentials** — `api-server/src/ApiServer.WebApi/appsettings.json`
   and `appsettings.Development.json` both contained the live connection string with password for
   `db77224.public.databaseasp.net`. The api-server README claims "appsettings.json carries
   placeholders" — it did not. **Status: remediated in-repo** (connection strings blanked,
   README corrected, `docs/migration/P0-REMEDIATION.md` written); password rotation at the host
   remains an owner action.
2. **Password reset token disclosed over the API and logs** — `AuthService.ForgotPasswordAsync`
   returned the token in the response body and logged it at Information level. **Status: remediated
   and verified** (token stored server-side only, response carries no token, log line has no token;
   frontend toast branch removed). A mailer is required before the flow is end-user functional.
3. **First-registered-user auto-admin** — `AuthService.RegisterAsync` granted `admin+editor` to the
   first account on an empty `users` table (plus an `Auth:AdminEmails` OR-rule). **Status:
   remediated and verified** (allowlist is now the only grant path; documented in README/SETUP/API).
4. **`_secrets.mjs`** at `api-server/` root — a helper that lifts Supabase JWT secret and Postgres
   URL out of pasted transcripts. Dead tooling that normalizes secrets-in-repo. **Status: deleted.**
5. **`AvatarUrl varchar(500000)`** and matching startup DDL — implies data-URL (base64) avatars
   stored in the DB row. Unbounded request/row sizes; replace with real object URLs and a sane limit.
   **Status: open — addressed in Phase 3 (schema) / Phase 6 (frontend avatar flow).**

### P1 — architectural blockers for the migration

6. **`AdminEndpoints.cs` bypasses the architecture**: direct `DbCommand` SQL for users, settings,
   debates; snake_case contracts; no validation; `DebateDto` reused as request record; inverted
   `has` role-toggle semantics. This is the part that must be redesigned first for a faithful port.
7. **Schema DDL at startup** in `Program.cs` (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE`,
   `TYPE varchar(500000)`). Masks missing migrations; forbidden in the target architecture.
8. **Two persistence stacks**: EF Core (live) vs Drizzle (Supabase, 12 migrations) with divergent
   types and two identity models. Must be collapsed to one (Prisma over `library`).
9. **Hardcoded backend URL duplicated 7×** (`http://moaz-alian.runasp.net` in `proxy-api.$.tsx`;
   the 8-line base-URL block in `lib/api.ts`, `lib/auth.ts`, `lib/chat/chat.server.ts`,
   `dashboard.users.tsx`, `dashboard.pages.tsx`, `dashboard.debates.tsx`) with divergent env
   semantics; proxy issues permissive CORS preflights. Violates `lib/api.ts`'s own contract comment.
10. **Site settings are disconnected from the public site**: dashboard writes
    `/api/settings/main`, but `lib/library.functions.ts getLibrary()` feeds the root loader
    `resolveSiteSettings(undefined)` — always defaults. Edits never reach production pages.
    (Functional regression already present in the current system; the migration must fix it.)
11. **CI has no backend job** despite docs claiming `dotnet build/test` runs; no contract tests;
    no E2E; dashboard flows untested. Migration safety net must be built in Phase 1–2.

### P2 — maintainability / duplication

11. Frontend monolith (public + dashboard in one app); generic package name `tanstack_start_ts`;
    opaque `@lovable.dev` build wrapper; `bunfig.toml` excludes `@lovable.dev` packages that are
    not installed; two lockfiles; no `features/` organization (79 files of flat components).
12. **22 of 51 shadcn UI components unused** and their deps with them:
    `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `recharts`, `vaul`,
    `react-hook-form`, `@hookform/resolvers` (+ the radix packages backing unused components).
13. Module-level mutable SSR store (`src/lib/content.ts`) shared across concurrent requests;
    it also mutates the *data-module* `categories` array in place; snapshot hydration has no
    revalidation path.
14. Chat persistence stubs (`verifyThreadOwnership` → true, persist → true) while orphan
    `chat_threads`/`chat_messages` tables exist in the Drizzle schema; threads live in
    `localStorage` with client-generated ids and no ownership enforcement.
15. Dead route: `/api/media/$` 404s unconditionally (17 lines); `lib/media/object-path.ts`
    validation code is exercised only by tests.
16. Three copies of the corpus (TS seed, SQL seed ×2 locations, DB) + generated Supabase bundles;
    seed TS (~700 lines) is **test-only** — never bundled at runtime (verified via imports).
17. Doc drift: 45 vs 47 tests; backend CI claim; "no Supabase anywhere" alongside drizzle
    remnants and `LOVABLE_DB_MIGRATION_URL` instructions; `.env.example` omits `AI_MODEL` /
    `OPENAI_API_KEY`; API.md omits profile/password/OAuth endpoints; root `vercel.json` broken
    (no root package.json, no rewrites).
18. Duplicate `LICENSE` in `moaz-alian/`; `eslint` has `no-unused-vars: off` (dead code blind spot);
    `lib/auth.ts` retains a Supabase-shaped subscription API after Supabase removal.

### P3 — post-migration improvements

19. Search upgrade path: `pg_trgm`/`tsvector` indexes when the corpus grows (documented in code).
20. Redis cache/version-token only when a second API instance is real (port exists in design).
21. Rate-limit keys behind proxies need `ForwardedHeaders:KnownProxies` config (documented).
22. `users.display_name` is synthesized from email (`email.Split('@')[0]`) — derive properly.
23. Normalize legacy Arabic search behavior between SQL ILIKE and the frontend's
    `normalizeArabic` scoring (different results by design today).

---

## 6. Frontend inventory (verified)

**Size:** 161 files / ~18,937 lines in `src/`. No `features/` organization; flat directories.

**Routes (32 files):**
- Public SSR: `/` (477-line homepage), `/about`, `/search`, `/articles{,$slug}`, `/books{,$slug}`,
  `/videos{,$slug}`, `/research{,$slug}`, `/categories{,$id}`, `/chat{,$threadId}`, `/auth`,
  `/reset-password`, `/sitemap[.]xml`.
- Dashboard (client-only, `ssr: false` under `_authenticated/route.tsx`): `/dashboard{,/index,
  /content,/categories,/debates,/users,/pages,/profile}` — `dashboard.pages.tsx` is the largest
  (536 lines), `dashboard.debates.tsx` (415) uses raw `fetch` with its own BASE copy.
- Server routes: `/proxy-api/$`, `/api/chat`, `/api/media/$` (dead), `/sitemap.xml`.

**Components (79 files / 10,200 lines):** `ui/` 51 shadcn-new-york primitives (4,353 lines) —
**22 with zero importers** (aspect-ratio, badge, breadcrumb, card, carousel, chart, collapsible,
context-menu, drawer, form, input-otp, menubar, navigation-menu, pagination, progress,
radio-group, resizable, scroll-area, separator, slider, toggle, toggle-group); `ai-elements/` 4
(1,559 lines); feature components: `content/` 8, `dashboard/` 4, `chat/` 4, `layout/` 4,
`feedback/`, `media/`, `search/`, root `skeletons.tsx`.

**Lib/hooks/data:** `lib/` 17 files (api client, mapping, content store, auth, admin-data,
library.functions, chat server helpers, media, error capture/reporting); `hooks/` 5
(use-site-settings, use-staff, use-overlay, use-mobile, use-chat-threads); `data/` 11 files —
seed chain (`seed.ts` → `library/*`, ~700 lines) is **test-only** (verified: no runtime import
path), while `data/categories.ts`, `data/site-settings.ts`, `data/faq.ts`, `data/detail-content.ts`
are runtime-imported.

**Types (`types/content.ts`, 70 lines):** `ContentType`/`RightsStatus` unions, `Category`,
`BaseItem` + per-type `VideoItem/BookItem/ArticleItem/ResearchItem` forming the `ContentItem`
union, `TYPE_LABELS`/`TYPE_ROUTES`. Mirrors the API DTO shape via `api-mapping.ts`.

**Configs:** `components.json` (shadcn new-york, slate, lucide), strict `tsconfig.json`
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint flat config
(`no-unused-vars: off` — a dead-code blind spot), `vitest.config.ts` (jsdom, globals),
`vite.config.ts` = thin wrapper over `@lovable.dev/vite-tanstack-config`, `bunfig.toml`
(24-h supply-chain guard + excludes for uninstalled `@lovable.dev` packages).

**Tests (10 files / ~424 lines):** routing smoke, DTO↔ContentItem mapping round-trips vs seed,
Arabic normalization/search scoring, settings parsing + slider merge, media path validation,
date value, calendar dropdown exclusivity, skeleton a11y smoke.

**Env:** `.env.example` documents `VITE_API_URL`, `API_URL` (localhost:5199) and commented
`AI_API_KEY`/`AI_GATEWAY_URL`; code also reads `OPENAI_API_KEY`, `AI_MODEL` (undocumented).

**No Supabase/drizzle/Lovable imports in `src/`** — the Lovable footprint is confined to build
tooling (`@lovable.dev/vite-tanstack-config`, `bunfig.toml` excludes) and one historical comment.

---

## 7. Documentation drift ledger

| Claim | Where | Reality |
| --- | --- | --- |
| "appsettings.json carries placeholders" | api-server/README.md | Live credentials committed (P0 #1) |
| Backend gates on `dotnet build/test` in CI | README.md, ARCHITECTURE.md | No backend job in `ci.yml` |
| 45 unit tests (README) vs 47 (SETUP.md) | api-server/README, SETUP.md | 3 test files; count drifts per PR |
| "there is no Supabase anywhere in the stack" | moaz-alian/README.md | No Supabase in `src/` (verified), but drizzle schema/migrations + SQL bundles + `LOVABLE_DB_MIGRATION_URL` instructions remain in the repo |
| `.env.example` missing | Earlier audit note (superseded) | File exists; it just omits `AI_MODEL`/`OPENAI_API_KEY` |
| "`vercel.json` on the frontend rewrites `/proxy-api`" | api-server/README.md | Only a broken root `vercel.json` exists (no rewrites; no root package.json) |
| `GET /api/debates` public | docs/API.md table implies reads are public | Route requires ContentEditor (dashboard-only feature) |
| Complete API reference | docs/API.md | Missing PUT /api/auth/me, change-password, forgot/reset, OAuth, users/roles semantics |

---

## 8. Risks & required decisions (need owner approval)

1. **Secrets rotation** (P0 #1): rotate the `databaseasp.net` password and any Supabase secrets
   referenced by `_secrets.mjs` history. Required before repo cleanup is meaningful.
2. **Database of record**: proceed with the **live `library` schema** (EF) as the Prisma source of
   truth; archive Supabase artifacts. Any destructive SQL against legacy tables needs explicit approval.
3. **Password reset**: keep the endpoint but stop returning/logging tokens (require a mailer or
   disable the flow in production) — confirm desired UX.
4. **Admin bootstrap**: drop first-user auto-admin; confirm `Auth:AdminEmails` + CLI seeding is
   the accepted mechanism.
5. **Chat persistence**: implement thread storage in the new API (reuse the table design) or
   formally scope chat as ephemeral client-side (drop orphan tables). Needs a product decision.
6. **Cutover order**: backend stays authoritative until contract tests pass; keep the .NET API
   deployable until Phase 5 verification completes.

---

## 9. Target architecture (proposed, adapted to findings)

```text
moaz-alian-platform/            (pnpm monorepo, Turborepo)
├── apps/
│   ├── api/          Express 5 + TS: modules auth, users, content, categories,
│   │                 settings, debates, media, chat; Prisma over `library`; Zod; Pino
│   ├── public/       TanStack Start public site (SSR/SEO, RTL)
│   └── dashboard/    TanStack Start admin app (own auth entry, own routing)
├── packages/
│   ├── ui/           shared design primitives (from existing shadcn set)
│   ├── api-client/   the ONE typed client (successor of lib/api.ts + api-mapping.ts)
│   ├── shared-types/ DTOs/contracts mirrored from the API (Zod-first)
│   ├── validation/   shared schemas (forms + request bodies)
│   ├── auth/         session contracts, role helpers (token storage stays app-owned)
│   └── config/       tsconfig/eslint/prettier bases
├── infrastructure/   docker, deploy profiles, scripts
└── docs/             architecture/, decisions/ (ADRs), migration/, api/
```

Contract policy: **preserve routes, shapes, statuses, pagination, error parsing**; the known
inconsistencies (snake_case users/debates, inline error objects, `has` inversion) are fixed
*inside* the migrated modules and covered by contract tests so the frontend keeps working via
the updated `@moaz/api-client`.

Migration strategy: contract tests first (recorded against the .NET API), then module-by-module
Express port (auth → content → categories → users → settings → debates → media/chat), Prisma
schema introspected from the live DB, destructive operations gated behind explicit approval.

---

## 10. Express migration contract-fidelity addendum (2026-11-14, branch `darkpyramid-solutions`)

> Recorded as the port of `api-server/` landed in this branch; supersedes nothing above, it
> *constrains* the Express implementation to the wire truths locked here.

### 10.1 Regenerated OpenAPI (decision: regenerate, do not hand-rewrite)

No full request/response capture of the .NET API existed, so the OpenAPI document was
**regenerated from the Express implementation** under `api/src/modules/docs.ts` and pinned
only where byte-parity is knowable:

- Only the **head 100** and **tail 100** bytes of `/openapi/v1.json` were captured from the .NET
  runtime and matched byte-exactly against the regenerated serialization
  (`JSON.stringify(doc, null, 2)`): head pin `{\n  "openapi": "3.0.1",\n  "info": {\n    "title":
  "ApiServer.WebApi | v1",\n    "version": "1.0.0"\n  }`; tail pin ends with the `Content`/`Categories`
  tag blocks.
- Key order is pinned: `openapi → info → components → paths → tags`; tags last, in order
  `[Auth, Admin, Content, Categories]`.
- Chat endpoints are **excluded** from the generated document (additive surface; see 10.2) and are
  recorded here instead.

### 10.2 Chat persistence (decision: implement server-side, additive)

Chat threads/messages now persist via Prisma (`chat_threads`, `chat_messages`) with ownership
enforced; a foreign thread id yields **404** (not 403/400). The REST surface is **additive** — it is
not part of the recorded baseline contract and the frontend keeps its localStorage threading
until a follow-up PR consumes the new endpoints.

### 10.3 Locked wire truths preserved by the Express port

- Status pages: `content-type: application/json; charset=utf-8`, body `{title, status, traceId}`.
- 401: `Authentication required.` + `www-authenticate: Bearer`; bad token →
  `Bearer error="invalid_token"`.
- 403: `Not allowed.` · 404: `Not found.` · 429: `Too many requests.` · 415:
  `Request failed with status 415.`
- `Results.Problem` (RFC 9110 `type` links for 400/401/403/404/405/406/409/410/411/412/413/415/422/500
  only; 501/502 intentionally bare) with `traceId` extension LAST; handler problems use
  `https://httpstatuses.com/{status}` type, `instance` = decoded request path, ASCII-safe serializer.
- Default 500: `An unexpected error occurred.` / `The error has been logged. Please try again later.`
- `/health` → `Healthy` (text/plain, no charset); dev root → 302 to `/swagger`; prod root →
  `{status:"online", service:"MOAZ ALIAN API", health:"/health"}`.
- CORS: allowed origin ⇒ `Vary: Accept-Encoding, Origin`; preflight bare/no-ACAO; unallowed method ⇒
  ACAO+ACAM+Vary Origin (no ACAH); disallowed origin ⇒ vary `Accept-Encoding` only.
- Rate limits: global 300/min per user-or-IP, editorial 30/min per user else IP; 429 bodies identical.

### 10.4 Contract-fidelity evidence

The shared golden battery (`goldens/run-battery.mjs`) was replayed against the running Express
server (`http://localhost:5199`) with the golden DB env and the .NET golden captures
(`goldens/dotnet/*.json`). Normalized diff (`goldens/diff-battery.mjs`) — traceId/JWT/ids/timestamps
normalized, counts arrays sorted, `content-encoding` + `Vary: Accept-Encoding` dropped,
truncation rule applied, UUID + 8-hex ids normalized — **124/124 comparable scenarios matched**
(status, captured headers, body). Zero contract drift.

### 10.5 Known non-goals (carried into follow-ups)

- Full integration/E2E suite for every module (current backend suite is unit-only).
- Frontend consumption changes (chat surface, settings disconnect) → follow-up PRs.
