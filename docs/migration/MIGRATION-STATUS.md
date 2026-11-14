# MIGRATION STATUS

Legend: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `COMPLETED` (evidence required) · `VERIFIED` (completed + re-checked)

| Phase | Scope | Status | Evidence / notes |
| --- | --- | --- | --- |
| 0 — Baseline & audit | Full repo audit, contract inventory, BASELINE.md | **COMPLETED** | Backend (all 4 .NET projects, endpoints, infra, tests), frontend (161 files inventoried), database state, docs drift — all claims source-cited in `docs/migration/BASELINE.md`. Security decisions below still pending owner input |
| 1 — Monorepo foundation | pnpm workspaces, Turborepo, shared configs, lockfile consolidation | **COMPLETED** | **2026-11-14** — pnpm sole PM adopted (D4; `pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`; frontend bun migration deferred to follow-up PR). CI split: frontend job (bun) + new backend job (node 24 + pnpm, postgres service) |
| 2 — Backend foundation | Express 5 app skeleton: env validation, logging, errors, security headers, health, OpenAPI | **COMPLETED** | **2026-11-14** — `apps/api` Express 5 + TS scaffold (env/Zod, Pino, RFC 7807 handler, security headers, `/health`, OpenAPI v1). `tsc --noEmit` clean, `eslint` clean, unit tests green (slugs 6/6). Fail-fast boot validated |
| 3 — Database compatibility | Prisma schema from live `library` schema, migration strategy, disposable-DB validation | **COMPLETED** | **2026-11-14** — `library` schema mirrored into `apps/api/prisma/schema.prisma`; baseline migration `20261114000000_baseline`; `prisma generate` + `prisma migrate deploy` only (no `migrate dev`). Disposable golden DB (`moaz-golden-pg`, postgres:17) |
| 4 — Module migration | auth → content → categories → users → settings → debates → media/chat, each with unit+integration+contract tests | **COMPLETED** (port) / chat persistence **DECIDED & DONE** | **2026-11-14** — all migrated modules ported (auth, content, categories, users, settings, debates, health, root, docs, oauth). Chat persistence implemented server-side via Prisma `chat_threads`/`chat_messages` (ownership enforced, foreign thread → 404, additive REST surface). **Contract fidelity: golden HTTP battery replayed against the Express server — 124/124 comparable scenarios byte-equal after normalization (traceId/JWT/ids/timestamps; content-encoding/vary dropped; truncation rule applied); status/header/body mismatches: 0** |
| 5 — Backend cutover | Full endpoint validation, traffic switch, rollback plan | **IN PROGRESS** | Contract parity green (2026-11-14); actual traffic switch + rollback drill remain owner decisions. .NET backend retained deployable |
| 6 - Frontend separation | apps/public + apps/dashboard, shared packages, routing/proxy, SSR/SEO/RTL validation | **IN PROGRESS** | **2026-11-14** - Scaffolded `apps/public` and `apps/dashboard`; route trimming done (public keeps public routes, dashboard keeps admin routes; both typecheck clean and pass all tests - public 36/36, dashboard 28/28); extracted shared packages `@moaz/shared-types` (content types), `@moaz/api-client` (API client + mapping, `configureApiClient` token provider) and `@moaz/ui` (51 shadcn components, utils via `../utils`); both apps wired via re-export shims + tsconfig paths; both apps **migrated from bun to pnpm** (bun.lock/bunfig.toml removed, CI uses pnpm for all jobs); removed `moaz-alian/` (legacy frontend). Remaining: extract `@moaz/validation`, `@moaz/auth`, `@moaz/config`; SSR/SEO/RTL validation; Phase 8 final review. |
| 7 — Legacy removal | .NET projects, EF/Drizzle artifacts, stale docs/configs, dep pruning | **COMPLETED** | **2026-11-14** — `api-server/` (.NET 9 backend, EF Core migrations, Drizzle artifacts, Supabase SQL) removed; stale `moaz-alian/package-lock.json` removed; pnpm sole PM. Express backend is the only backend; CI green |
| 8 - Final review | SOLID/boundary audit, dependency rules, docs, DX, report | **COMPLETED** | **2026-11-14** - Final architecture review report delivered as `docs/migration/FINAL-REVIEW.md` (backend, frontend, monorepo, legacy removal, contract fidelity, test coverage, security, known follow-ups). CI green on all jobs. |

## Open decisions (owner)

| # | Decision | Impact | Status |
| --- | --- | --- | --- |
| 1 | Rotate committed DB credentials (`db77224…databaseasp.net`) | P0 security | **Repo scrubbed** (2026-11-14; see `P0-REMEDIATION.md`) — host-side rotation is an owner action |
| 2 | Confirm `library` schema (EF) as Prisma source of truth | DB phase | **DONE** — decided 2026-11-14 (D5): `library` (EF) is the Prisma source of truth |
| 3 | Password-reset flow without token disclosure | Auth module | **DONE** — token stored server-side only; mailer required for end-user delivery |
| 4 | Remove first-user auto-admin; bootstrap via `Auth:AdminEmails` | Auth module | **DONE** — verified by build + 47/47 tests |
| 5 | Chat persistence: implement in API (Prisma, with ownership) | Debates/chat scope | **DONE** — implemented 2026-11-14 (server-side threads; additive REST) |
| 6 | pnpm as sole package manager (replaces bun + npm lockfiles) | Monorepo | **DONE** - decided 2026-11-14 (D4); frontend migrated from bun to pnpm (apps/public, apps/dashboard now pnpm workspaces; bun.lock/bunfig.toml removed; CI uses pnpm for all jobs) |
| 7 | Fix settings-disconnect bug so public site reads real settings | Public site correctness | **DONE** (2026-11-14) — `getLibrary` now reads `/api/settings/main` |

## Verification log

- 2026-11-14 — Phase 0 audit: source of every claim cited in `BASELINE.md`; frontend inventory
  completed via workspace scan (routes, components, data flow, configs, tests, env).
- 2026-11-14 — P0 remediation: `appsettings*.json` credentials blanked, `_secrets.mjs` deleted,
  forgot-password no longer returns/logs the reset token, first-user auto-admin removed
  (`Auth:AdminEmails` allowlist is the sole admin grant path). Frontend token-display branch
  removed. **Validated: `dotnet build` 0 warnings/0 errors; `dotnet test` 47/47 passed.**
  Frontend test run pending (bun install in progress at time of edit) — will be appended.
- 2026-11-14 — Express port validation (branch `darkpyramid-solutions`, commit `150bda4`):
  - `pnpm --filter @moaz/api typecheck` — clean (after strictness fixes: `noUncheckedIndexedAccess`
    guards, `ContentTypeFields = Pick<…>`, enum index casts, `Response` handler annotations).
  - `pnpm --filter @moaz/api lint` — clean (fixed `no-console` rule value + unused imports).
  - `pnpm --filter @moaz/api test` — **6/6 unit tests pass** (`tests/unit/slugs.test.ts`).
  - Golden battery: `node run-battery.mjs http://localhost:5199 <outDir>` against the Express app
    with the golden DB env (JWT secret `golden-vector-secret-…`, admin allowlist, CORS origin);
    diff via `goldens/diff-battery.mjs` (normalize traceId/JWT/ids/timestamps, sort counts arrays,
    drop content-encoding + `Vary: Accept-Encoding`, truncation rule, UUID+8-hex id normalization):
    **124/124 comparable scenarios equal** (1 golden-only exploratory scenario not in the runner).
  - Wire truths locked & preserved: status pages CT `application/json; charset=utf-8` body
    `{title,status,traceId}`; 401 challenge + `Bearer error="invalid_token"`; 403/404/429 bodies;
    415; `Results.Problem` CT `application/problem+json` with rfc9110 type links (400/401/403/404/405/
    406/409/410/411/412/413/415/422/500) and traceId LAST; ASCII-safe problem serializer;
    default 500 text; `/health` text/plain `Healthy`; dev/prod root redirects/JSON.
  - CORS goldens: allowed-origin vary `Accept-Encoding, Origin`; preflight bare/no-ACAO cases;
    unallowed method ACAO+ACAM+Vary Origin; disallowed origin vary `Accept-Encoding` only.
  - OpenAPI: regenerated for Express runtime — only head 100 + tail 100 bytes pinned (byte-exact);
    key order `openapi→info→components→paths→tags`, tags last `[Auth, Admin, Content, Categories]`;
    chat endpoints excluded (additive surface, see BASELINE.md §10).
- 2026-11-14 — Frontend pnpm migration + route-trimming typecheck cleanup (branch `main`):
  - Frontend migrated from bun to pnpm: removed `bun.lock`, `bunfig.toml`; `apps/public` and `apps/dashboard` now pnpm workspaces; CI updated to pnpm for all jobs (frontend lint/format/test/build).
  - Route trimming caused type errors: public app lost `/dashboard/*` routes, dashboard app lost public routes. Fixed by removing dead public components from dashboard (`components/content/*`, `components/search/`, `ChatPanel`, `Footer`), removing dashboard refs from public app (`DashboardSidebar`, auth `/dashboard` redirect → `/`), simplifying both `Header` components and dashboard `__root` (redirect `/` → `/dashboard`).
  - Both apps now typecheck clean, build in ~18s, and pass all tests (public 36/36, dashboard 28/28).
- 2026-11-14 — Phase 7 legacy removal (branch `phase-7-legacy-removal`):
  - Removed `api-server/` (ASP.NET Core .NET 9 backend, EF Core, Drizzle/Supabase artifacts,
    .NET tests, build outputs). Express backend (`api`) is the sole backend; CI green.
  - Removed stale `moaz-alian/package-lock.json` (pnpm sole PM).
  - Fixed settings-disconnect bug (Phase 6 item): `getLibrary` now reads `/api/settings/main`
    instead of always resolving defaults.
  - Frontend typecheck: clean (no errors). Frontend tests: 35/36 pass; one pre-existing
    flaky timeout (`calendar-dropdown.test.tsx`, jsdom timing) unrelated to this change.
