# Setup Guide

## Prerequisites

- [Bun](https://bun.sh) (frontend package manager; CI uses it)
- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) (backend)
- Git
- A PostgreSQL database — none is committed; use `docker compose up -d` (api-server) or your own instance
- Optional: AI gateway key for `/api/chat`

## Install

```sh
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM

# backend — serves PostgreSQL data on http://localhost:5199
cd api-server
dotnet run --project src/ApiServer.WebApi

# frontend
cd ../moaz-alian
bun install
```

## Develop

```sh
bun run dev        # frontend
# api-server: dotnet run --project src/ApiServer.WebApi  (Swagger at /swagger)
```

## Quality checks

```sh
bun run lint
bun run format:check
bun run test
bun run build
```

Backend: `dotnet build` and `dotnet test` inside `api-server/` (47 unit tests).

## Environment variables

### Frontend (`moaz-alian/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes (browser) | API base, e.g. `http://localhost:5199` |
| `API_URL` | Yes (SSR) | Same for server-side calls |
| `AI_API_KEY` | For chat | AI gateway key |

### Backend (`api-server/src/ApiServer.WebApi`)

No credentials are committed. Configure through user-secrets (dev) or environment variables:

```sh
cd api-server/src/ApiServer.WebApi
dotnet user-secrets set "ConnectionStrings:Postgres" "Server=localhost;Port=5433;Database=moaz_alian_library;Username=postgres;Password=Local.Postgres.Password_1"
dotnet user-secrets set "Auth:JwtSecret" "<openssl rand -hex 32>"
```

| Key | Description |
|-----|-------------|
| `ConnectionStrings:Postgres` | PostgreSQL connection string (or `ConnectionStrings__Postgres` in prod) |
| `Auth:JwtSecret` | HMAC secret the API signs its JWTs with (≥ 32 chars) |
| `Auth:Issuer` | Expected `iss` (default `http://localhost:5199`) |
| `Auth:AdminEmails` | Admin allowlist — the only way an account becomes admin. JSON array (`"AdminEmails": ["a@x.com"]`) or indexed env keys `Auth__AdminEmails__0`, `Auth__AdminEmails__1`, … |
| `Cors:AllowedOrigins` | Explicit frontend origins in production |

**Never** commit real database passwords or JWT secrets — see
[`migration/P0-REMEDIATION.md`](./migration/P0-REMEDIATION.md) for why and how to rotate.

## Admin bootstrap

Accounts receive the `admin` role **only** when their email is in `Auth:AdminEmails`
(comma-separated, case-insensitive). Everyone else registers as `editor` and stays invisible to
the dashboard until an admin toggles their roles in `المستخدمون والصلاحيات` (dashboard users
page). The previous "first registered account becomes admin" rule was removed as a takeover
vector.
