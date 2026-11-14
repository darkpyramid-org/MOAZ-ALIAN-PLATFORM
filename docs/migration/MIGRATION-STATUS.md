# MIGRATION STATUS

Legend: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `COMPLETED` (evidence required) · `VERIFIED` (completed + re-checked)

| Phase | Scope | Status | Evidence / notes |
| --- | --- | --- | --- |
| 0 — Baseline & audit | Full repo audit, contract inventory, BASELINE.md | **COMPLETED** | Backend (all 4 .NET projects, endpoints, infra, tests), frontend (161 files inventoried), database state, docs drift — all claims source-cited in `docs/migration/BASELINE.md`. Security decisions below still pending owner input |
| 1 — Monorepo foundation | pnpm workspaces, Turborepo, shared configs, lockfile consolidation | NOT STARTED | Blocked on: choose pnpm as sole PM (docs/CI updated accordingly) |
| 2 — Backend foundation | Express 5 app skeleton: env validation, logging, errors, security headers, health, OpenAPI | NOT STARTED | |
| 3 — Database compatibility | Prisma schema from live `library` schema, migration strategy, disposable-DB validation | NOT STARTED | Destructive ops gated behind explicit approval |
| 4 — Module migration | auth → content → categories → users → settings → debates → media/chat, each with unit+integration+contract tests | NOT STARTED | |
| 5 — Backend cutover | Full endpoint validation, traffic switch, rollback plan | NOT STARTED | .NET backend retained until verified |
| 6 — Frontend separation | apps/public + apps/dashboard, shared packages, routing/proxy, SSR/SEO/RTL validation | NOT STARTED | Includes fixing the settings-disconnect bug (BASELINE P1 #10) and replacing the dead media route |
| 7 — Legacy removal | .NET projects, EF/Drizzle artifacts, stale docs/configs, dep pruning | NOT STARTED | Only after cutover; includes 22 unused UI components + unused deps list in BASELINE §5 |
| 8 — Final review | SOLID/boundary audit, dependency rules, docs, DX, report | NOT STARTED | |

## Open decisions (owner)

| # | Decision | Impact | Status |
| --- | --- | --- | --- |
| 1 | Rotate committed DB credentials (`db77224…databaseasp.net`) | P0 security | **Repo scrubbed** (2026-11-14; see `P0-REMEDIATION.md`) — host-side rotation is an owner action |
| 2 | Confirm `library` schema (EF) as Prisma source of truth | DB phase | PENDING |
| 3 | Password-reset flow without token disclosure | Auth module | **DONE** — token stored server-side only; mailer required for end-user delivery |
| 4 | Remove first-user auto-admin; bootstrap via `Auth:AdminEmails` | Auth module | **DONE** — verified by build + 47/47 tests |
| 5 | Chat persistence: implement in API (Prisma, with ownership) | Debates/chat scope | **DECIDED: implement server persistence** (Phase 4) |
| 6 | pnpm as sole package manager (replaces bun + npm lockfiles) | Monorepo | **DECIDED: pnpm** (Phase 1) |
| 7 | Fix settings-disconnect bug so public site reads real settings | Public site correctness | PENDING (Phase 6) |

## Verification log

- 2026-11-14 — Phase 0 audit: source of every claim cited in `BASELINE.md`; frontend inventory
  completed via workspace scan (routes, components, data flow, configs, tests, env).
- 2026-11-14 — P0 remediation: `appsettings*.json` credentials blanked, `_secrets.mjs` deleted,
  forgot-password no longer returns/logs the reset token, first-user auto-admin removed
  (`Auth:AdminEmails` allowlist is the sole admin grant path). Frontend token-display branch
  removed. **Validated: `dotnet build` 0 warnings/0 errors; `dotnet test` 47/47 passed.**
  Frontend test run pending (bun install in progress at time of edit) — will be appended.
