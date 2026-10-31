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
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Service role for privileged server operations; server-only |
| `LOVABLE_API_KEY` | For chat | Lovable AI gateway |
| `LOVABLE_DB_MIGRATION_URL` | Optional | Postgres URL for Drizzle migrations |
| `LOVABLE_CRON_SECRET` | Optional | Current secret for cron endpoint authentication |
| `LOVABLE_CRON_SECRET_PREVIOUS` | Optional | Previous cron secret during a controlled rotation window |

*Required only for routes/integrations that instantiate the service-role client. Never expose this key to browser code or commit its value.

## Notes

- There is **no** `api-server/` package. HTTP handlers live under `src/routes/api/`.
- Database schema and migrations live under `moaz-alian/drizzle/`.
- Keep real credentials in an untracked local environment file or the deployment secret store. The example file must contain placeholders only.

## Admin bootstrap

New signups create a `profiles` row but are **not** auto-promoted to admin (migration `0012_remove_first_user_auto_admin`).

To grant the first admin after deploy, run as a trusted privileged operator (for example, through the Supabase SQL editor):

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin');
```

Use the UUID of the intended account, verify the account owner independently, and do not expose this operation through public signup or client-controlled metadata.
