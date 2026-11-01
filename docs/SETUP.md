# Setup Guide

## Prerequisites

- [Bun](https://bun.sh) (frontend package manager; CI uses it)
- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) (backend)
- Git
- A PostgreSQL database (the API's connection string already points at the hosted dev DB)
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

Configured in `appsettings*.json` / user-secrets:

| Key | Description |
|-----|-------------|
| `ConnectionStrings:Postgres` | PostgreSQL connection string |
| `Auth:JwtSecret` | HMAC secret the API signs its JWTs with |
| `Auth:Issuer` | Expected `iss` (default `http://localhost:5199`) |
| `Cors:AllowedOrigins` | Explicit frontend origins in production |

**Never** commit real database passwords or JWT secrets — use user-secrets / environment variables.

## Admin bootstrap

The first account registered via `POST /api/auth/register` (on an empty `library.users` table) is
seeded with `admin` + `editor`. Later signups get `editor` and stay invisible to the dashboard until
an admin toggles their roles in `المستخدمون والصلاحيات` (dashboard users page).
