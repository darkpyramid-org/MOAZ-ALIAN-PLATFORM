# MIGRATION PLAN — MOAZ ALIAN PLATFORM

> Basis: `docs/migration/BASELINE.md` (Phase 0 audit, 2026-11-14) and owner decisions recorded in
> `MIGRATION-STATUS.md`. Execution: phase-by-phase with a checkpoint report after each phase.

## Decisions locked in

| # | Decision |
| --- | --- |
| D1 | Committed DB credentials scrubbed from the repo; owner rotates at the host (`P0-REMEDIATION.md`) |
| D2 | Auth hardening approved: no reset-token disclosure; no first-user auto-admin (`Auth:AdminEmails` allowlist is the only admin grant path) |
| D3 | Chat becomes server-persisted in the new API (Prisma `chat_threads`/`chat_messages` + ownership enforcement) |
| D4 | pnpm is the sole package manager (bun + npm lockfiles retired) |
| D5 | `library` schema (EF Core, live DB) is the source of truth for the Prisma schema |
| D6 | Public site must read real site settings (fix the disconnect found in the baseline) |

## Target stack

- **Monorepo:** pnpm workspaces + Turborepo + TypeScript (strict) + shared ESLint/Prettier.
- **API:** Node.js LTS, Express 5, Prisma + PostgreSQL (`library` schema), Zod, Pino, OpenAPI,
  JWT auth (same HMAC semantics, same roles), Vitest + Supertest.
- **Frontend:** two independent TanStack Start apps (`apps/public`, `apps/dashboard`) +
  shared packages (`ui`, `api-client`, `shared-types`, `validation`, `auth`, `config`).

## Phases

### Phase 1 — Monorepo foundation
Root `package.json` (pnpm), `pnpm-workspace.yaml`, `turbo.json`, base tsconfig/eslint/prettier
packages, `.editorconfig`, unified scripts (`dev/build/lint/typecheck/test`).
The existing `moaz-alian/` joins the workspace in place; `api-server/` (.NET) stays outside pnpm
and keeps building via dotnet. Existing `bun.lock` + `package-lock.json` are retired; a single
`pnpm-lock.yaml` becomes authoritative. **No application code moves in this phase.**
Gate: `pnpm install` clean, `pnpm -r build/test/lint` green, CI updated.

### Phase 2 — Backend foundation (`apps/api`)
Express 5 skeleton: env validation (Zod), Pino logging, central error handler producing RFC 7807
compatible problem+json, security headers, CORS allowlist, rate limiting, `/health` + readiness,
OpenAPI endpoint, Prisma bootstrap. The app must start and serve health before any module.

### Phase 3 — Database compatibility
Introspect the live `library` schema into `schema.prisma` (content_items, categories, join table,
users, site_settings, debates; chat tables per D3). Verify mappings (jsonb, text[], smallint
enums as strings at the API edge, ICU collation notes, unique `(Type, Slug)`). Validate against a
disposable docker-compose database; **no destructive SQL without explicit approval**. Document the
`AvatarUrl varchar(500000)` anomaly and the migration plan for it (keep column, stop writing
data-URLs; frontend avatar flow switches to object URLs in Phase 6).

### Phase 4 — Module migration (one module at a time, contract tests first)
Order: **auth → users → content → categories → settings → debates → media/chat.**
Per module: record contract tests against the .NET API (statuses, shapes, errors, pagination) →
port domain/application logic (same invariants: full-replacement writes, slug resolution + 409,
category-delete 409, role re-checks, cache version bump semantics) → Express routes with Zod →
unit + integration tests green → contract tests green → module marked VERIFIED.
Contract-normalization decisions (camelCase users/debates, Problem Details everywhere,
`{role, has}` toggle documented or renamed) are applied *behind* `@moaz/api-client` so the
frontend keeps working.

### Phase 5 — Backend cutover prep
Full endpoint parity checklist (every inventory row in BASELINE §2), auth matrix validation,
deployment artifacts (Docker, health probes), rollback plan. The .NET backend stays deployable
until this checklist passes; traffic switch is an owner action.

### Phase 6 — Frontend separation
Split `moaz-alian/` into `apps/public` (all public routes + SSR/SEO + sitemap) and
`apps/dashboard` (all `_authenticated` routes, client-only); extract `@moaz/ui` (pruned to used
components), `@moaz/api-client` (successor of `lib/api.ts` + `api-mapping.ts` — one base URL,
one error type), `@moaz/shared-types`, `@moaz/validation`, `@moaz/auth` (session contracts,
role helpers). Fix: settings-disconnect (D6), dead `/api/media/$` route decision, 7× duplicated
base URL, module-level store → query/loader-context data flow (SSR-safe), proxy → env-driven
`API_URL` + restrictive CORS. Validate SSR, SEO, RTL, responsive behavior per app.

### Phase 7 — Legacy removal
After cutover: remove `api-server/` .NET projects (archived reference kept in migration docs),
EF/Drizzle artifacts (`db/drizzle/*`, `apply-supabase.sql`, `supabase-schema.sql`, legacy `public`
tables only after owner-approved export), duplicate seeds consolidation, unused deps
(BASELINE §5 P2 list), stale docs (`ROADMAP.md` rewrite), root `vercel.json` replacement with
per-app deploy configs. Every deletion preceded by reference search + build/test re-run.

### Phase 8 — Final architecture review
SOLID/boundary audit, dependency-cruiser rules (domain ⇏ express, domain ⇏ prisma,
apps ⇏ apps, packages entry-point-only), coverage report on critical modules, docs refresh,
final report.

## Quality gates (every phase)

TypeScript strict · lint · unit tests · integration tests · contract tests · build · no new
duplication · no prohibited dependency direction · no unintended data loss · docs updated.
Nothing is marked COMPLETED without executed evidence recorded in `MIGRATION-STATUS.md`.
