# P0 Remediation — committed credentials (2026-11-14)

## What happened

The live PostgreSQL connection string — host `db77224.public.databaseasp.net`, user `db77224`,
and its real password — was committed in **two** files:

- `api-server/src/ApiServer.WebApi/appsettings.json`
- `api-server/src/ApiServer.WebApi/appsettings.Development.json`

Contrary to the README's claim, these were not placeholders. In addition, `api-server/_secrets.mjs`
was a committed helper script whose purpose was lifting Supabase JWT/DB secrets out of pasted
chat transcripts. Both are now removed from the tree.

## What was changed in this repository

| File | Change |
| --- | --- |
| `appsettings.json` / `appsettings.Development.json` | Connection string replaced with `""` (the API fails fast at startup with a clear error until a real value is supplied) |
| `api-server/_secrets.mjs` | Deleted |
| Docs (README/SETUP/API) | Updated to describe env/user-secrets configuration and the new auth behavior |

## What you must still do (cannot be done from the repo)

Committed credentials stay compromised **in git history** (and in any fork/clone made before
removal). Rotation is mandatory, not optional:

1. **Rotate the database password** in the `databaseasp.net` control panel for `db77224`.
2. If any Supabase credentials were ever pasted into sessions (the deleted `_secrets.mjs` hints
   they were), **rotate the Supabase JWT secret / DB password** from the Supabase dashboard.
3. **Rotate the production JWT secret** (`Auth:JwtSecret`) on the IIS host by regenerating
   `appsettings.Production.user.json` with a fresh `openssl rand -hex 32` value — this invalidates
   every previously issued token, which is the desired effect after a credential exposure.
4. Supply the new values through configuration precedence (see below), never as committed files.

## Correct configuration precedence (unchanged)

Highest wins:

1. Environment variables (`ConnectionStrings__Postgres`, `Auth__JwtSecret`, …)
2. `appsettings.{Environment}.user.json` (machine-local, **git-ignored**)
3. `dotnet user-secrets` (development machines)
4. Committed `appsettings*.json` — now contains **no secrets**

## Local development setup

```sh
cd api-server/src/ApiServer.WebApi
dotnet user-secrets set "ConnectionStrings:Postgres" "Server=localhost;Port=5433;Database=moaz_alian_library;Username=postgres;Password=Local.Postgres.Password_1"
dotnet user-secrets set "Auth:JwtSecret" "<openssl rand -hex 32>"
```

`docker compose up -d` in `api-server/` provides the local database matching that connection
string (the compose password is a localhost-only placeholder and is safe to commit).

## Verification

- `dotnet build ApiServer.sln` → 0 warnings / 0 errors (`TreatWarningsAsErrors`).
- `dotnet test` → 47/47 passed after the auth changes in the same commit.
