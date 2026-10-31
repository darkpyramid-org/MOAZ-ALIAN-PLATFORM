# Setup Guide

## Prerequisites

- [Bun](https://bun.sh) (primary package manager used by CI)
- Git
- A Supabase project (Auth + Postgres)
- Optional: Lovable AI API key for `/api/chat`

## Install

```sh
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM/moaz-alian
bun install
cp .env.example .env.local
```

Edit `.env.local` using the names in `.env.example`. **Never** put service-role keys in `VITE_*` variables.

## Develop

```sh
bun run dev
```

## Quality checks

```sh
bun run lint
bun run format:check
bun run test
bun run build
```

## Environment variables

### Client (browser)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key |

### Server only

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Same project URL for SSR/server routes |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key for user-scoped server clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Service role for privileged server operations |
| `LOVABLE_API_KEY` | For chat | Lovable AI gateway |
| `LOVABLE_DB_MIGRATION_URL` | Optional | Postgres URL for Drizzle migrations |
| `LOVABLE_CRON_SECRET` | Optional | Cron authentication |

\*Required for routes/integrations that use the service-role client.

## Notes

- There is **no** `api-server/` package. HTTP handlers live under `src/routes/api/`.
- Database schema and migrations live under `moaz-alian/drizzle/`.
