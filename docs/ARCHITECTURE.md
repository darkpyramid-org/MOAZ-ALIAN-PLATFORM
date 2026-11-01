# Architecture Overview

## System shape

Two packages, one clean-architecture backend:

- **Frontend:** `moaz-alian/` — React 19 + TanStack Start/Router + Tailwind + Radix
- **Backend:** `api-server/` — ASP.NET Core (.NET 9) minimal APIs, layered
  Domain → Application → Infrastructure → WebApi, EF Core 9 + Npgsql
- **Database:** PostgreSQL (`library` schema); the API owns all reads and writes
- **Package manager:** Bun (CI uses `bun install --frozen-lockfile`)

## Request flow

1. Browser loads the TanStack Start app.
2. Public content hydrates from `GET /api/content/snapshot` (see `src/lib/api.ts`, the only API client).
3. Dashboard writes carry the API-issued JWT (`Authorization: Bearer`, from `src/lib/auth.ts`).
4. The API validates the JWT locally, applies role policies (`ContentEditor`, `SiteAdmin`),
   and serves Problem Details errors the frontend parses in one place.
5. `/api/chat` proxies to the AI gateway on the server.
6. `/api/media/$` serves validated media paths.

## Auth and roles

- The backend is its own identity provider: `POST /api/auth/register` / `login` issue 7-day JWTs.
- Roles live in `library.users`; the first account ever registered is seeded admin+editor.
- First-user auto-admin behavior is a known risk tracked in issue #6; prefer controlled bootstrap.

## Frontend structure

```
moaz-alian/src/
  components/
  routes/            # pages + api/ (chat, media)
  lib/               # api.ts = the only API client; api-mapping.ts = the only shape translation
  hooks/
  test/
```

Backend layering and endpoints: see `api-server/README.md`.

## CI

`.github/workflows/ci.yml`: frontend Bun install, lint, format check, test, build; Trivy security
scan. The backend gates on `dotnet build` / `dotnet test` locally or in an additional job.
