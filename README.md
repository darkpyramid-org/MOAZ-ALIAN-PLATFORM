# MOAZ ALIAN Platform

An Arabic knowledge platform for videos, books, articles, and research, with a team dashboard and AI assistant.

## Repository structure

```
.
├── apps/
│   ├── api/               # Backend: Express 5 + TypeScript + Prisma + PostgreSQL
│   ├── public/            # Frontend: TanStack Start public site (SSR/SEO)
│   └── dashboard/         # Frontend: TanStack Start admin dashboard
├── packages/
│   ├── api-client/        # Shared: typed API client
│   ├── shared-types/      # Shared: content types
│   └── ui/                # Shared: component library
├── docs/                  # Documentation
├── .github/               # GitHub Actions and templates
├── vercel.json            # Vercel multi-service deployment config
├── pnpm-workspace.yaml
└── README.md
```

All data flows through the Express API in `apps/api/` — content, categories, auth, users/roles,
site settings and debates — backed by a PostgreSQL `library` schema. The frontends talk to it
over HTTP via `apps/*/src/lib/api.ts`; server routes include the AI chat proxy (`/api/chat`)
and media serving.

## Quick start

```sh
# 1 — backend (http://localhost:5199)
cd apps/api
pnpm install
pnpm dev

# 2 — frontend (public site)
cd apps/public
pnpm install
pnpm dev

# 3 — frontend (dashboard)
cd apps/dashboard
pnpm install
pnpm dev
```

Set `API_URL` (SSR) in the frontends if the API is not on `http://localhost:5199`.

## Deployment

Production deployment uses **Vercel** with multi-service support. See `vercel.json`:

- `api` — Express backend (internal service)
- `public` — public site
- `dashboard` — admin dashboard
- `ui` — component library (not deployed standalone)

Environment variables are set per-service in the Vercel dashboard.

## Tech stack

- **Frontend:** pnpm, React 19, TanStack Start & Router, Tailwind CSS, Radix UI
- **Backend:** Node.js + Express 5 + TypeScript, Prisma ORM, PostgreSQL (`library` schema)
- **Database:** PostgreSQL (schema `library`; connection string via `DATABASE_URL`)
- **AI:** Lovable AI gateway (`AI_API_KEY`) via `/api/chat`

## Scripts

Backend (in `apps/api/`):

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Development server (tsx watch) |
| `pnpm build` | TypeScript compile |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm db:migrate` | `prisma migrate deploy` |

Frontend (in `apps/public/` or `apps/dashboard/`):

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm format:check` | Prettier check |
| `pnpm test` | Vitest (once) |

## Documentation

- [Backend](./apps/api/README.md)
- [Setup](./docs/SETUP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API](./docs/API.md)
- [Contributing](./CONTRIBUTING.md)

## CI

GitHub Actions (`.github/workflows/ci.yml`) installs with pnpm, lints, typechecks, tests,
builds and runs backend unit tests against an ephemeral PostgreSQL service. Frontend apps
are built as separate workspace packages.

## License

MIT — see [LICENSE](./LICENSE).
