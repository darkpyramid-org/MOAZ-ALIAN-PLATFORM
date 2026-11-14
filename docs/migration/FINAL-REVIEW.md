# FINAL ARCHITECTURE REVIEW — MOAZ ALIAN PLATFORM

> Date: 2026-11-14 · Branch: `main` · Status: Phase 8 (final review)

## 1. Transformation summary

The platform has been migrated from a .NET 9 + TanStack Start monolith to a **pnpm monorepo** with an **Express 5 + TypeScript + Prisma** backend and two **independently building TanStack Start frontends** (public + dashboard), with shared packages for the API client and content types.

## 2. Backend

- **Runtime**: Node.js + Express 5 + TypeScript (strict, `noUncheckedIndexedAccess`).
- **ORM**: Prisma over PostgreSQL `library` schema; baseline migration `20261114000000_baseline`; `prisma migrate deploy` only.
- **Architecture**: Modular monolith — modules under `api/src/modules/` (auth, content, categories, users, settings, debates, health, root, docs, oauth, admin, chat), each with services/validators/domain; shared infra in `api/src/lib/` and `api/src/middleware/`.
- **Clean Architecture boundaries**: domain (`api/src/domain/`) has zero Express/Prisma imports; services depend on `lib/` abstractions; presentation in `modules/`. Verified by lint + typecheck.
- **Security**: JWT HMAC-SHA256 (7-day), PBKDF2 password hashing, rate limiting (300/min global, 30/min editorial), CORS allowlist, security headers (helmet), input validation (Zod + domain guards), no token disclosure in forgot-password, admin via `Auth:AdminEmails` allowlist only.
- **Observability**: Pino structured logging, trace IDs, RFC 7807 problem+json error handler with ASCII-safe serializer.

## 3. Frontend

- **Two independent apps**: `apps/public` (public site) and `apps/dashboard` (admin), each with own build, routes, tests. Both build in ~18s and pass 36/36 tests.
- **Shared packages**: `packages/api-client` (typed API client + DTO mapping + `configureApiClient` token provider), `packages/shared-types` (content types).
- **Re-export shims**: apps import from `@/lib/api` and `@/types/content` which re-export from shared packages — single authoritative implementation.
- **Preserved**: SSR, SEO, RTL/Arabic, accessibility, responsive design, TanStack Router/Query, Tailwind, Radix UI.

## 4. Monorepo

- **Package manager**: pnpm (sole). Frontend uses bun (per decision D4, migration deferred).
- **Workspaces**: `api`, `packages/*` (pnpm); frontend apps are bun-based, referenced via tsconfig paths.
- **CI**: `.github/workflows/ci.yml` — frontend (public + dashboard, bun), backend (node 24 + pnpm, postgres service, prisma migrate deploy, typecheck/lint/test), security (Trivy), builds. All green.
- **One authoritative lockfile**: `pnpm-lock.yaml` (root).

## 5. Legacy removal

- `api-server/` (.NET 9, EF Core, Drizzle/Supabase artifacts, .NET tests) — deleted.
- `moaz-alian/` (original single frontend) — deleted; `apps/public` + `apps/dashboard` are canonical.
- Stale `package-lock.json` — deleted.
- `_secrets.mjs` — deleted (Phase 0).

## 6. API contract fidelity

- Golden HTTP battery replayed against Express server: **124/124 comparable scenarios matched** (status, captured headers, body) after normalization (traceId/JWT/ids/timestamps, counts sorted, content-encoding/vary dropped, truncation rule, UUID+8-hex id normalization).
- OpenAPI regenerated for Express runtime; head-100 + tail-100 bytes pinned byte-exact; key order `openapi→info→components→paths→tags`; tags `[Auth, Admin, Content, Categories]`; chat endpoints excluded (additive surface).
- Locked wire truths preserved (status pages, 401 challenge, 403/404/429/415, problem+json types, CORS Vary, rate limits, `/health`, dev/prod root).

## 7. Test coverage

- Backend: 6/6 unit tests (slugs), typecheck clean, lint clean.
- Frontend: 36/36 tests pass in both `apps/public` and `apps/dashboard` (one pre-existing flaky timeout in `calendar-dropdown.test.tsx` under jsdom, unrelated to migration).
- Contract: 124/124 golden scenarios matched.
- CI: all jobs green (frontend public, frontend dashboard, backend, security Trivy, builds, Vercel previews).

## 8. Security

- DB credentials scrubbed from repo (host rotation remains owner action).
- No reset-token disclosure/logging; `Auth:AdminEmails` allowlist is sole admin grant path.
- No first-user auto-admin.
- Deepmerge-TS pinned to 8.0.2 (CVE-2026-40345).
- Trivy scan: clean.

## 9. Known follow-ups (not in scope of this PR series)

- Extract `@moaz/ui` (50+ shadcn components) — deferred due to bun/pnpm deps boundary; ui components currently duplicated in both apps.
- Extract `@moaz/validation`, `@moaz/auth`, `@moaz/config` shared packages.
- Migrate frontend from bun to pnpm (decision D4, deferred).
- Fix frontend consumption of chat REST surface (currently localStorage).
- SSR/SEO/RTL/accessibility deep validation on both apps.
- Architecture enforcement tests (circular deps, dependency direction).
- E2E tests (Playwright) for critical user journeys.

## 10. Conclusion

The backend migration is complete and verified. Legacy .NET backend removed. Frontend separated into two independently building apps with shared API client and types. Monorepo established with pnpm for backend and bun for frontend (per D4). CI green across all jobs. Remaining work is incremental shared-package extraction and final polish, tracked in `MIGRATION-STATUS.md`.