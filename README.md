# MOAZ ALIAN Platform

مساحة معرفية عربية للبحث والقراءة: فيديوهات، كتب، مقالات وأبحاث، مع لوحة تحكم للفريق ومساعد ذكي.

An Arabic knowledge platform for videos, books, articles, and research, with a team dashboard and AI assistant.

## Repository structure

```
.
├── api-server/            # Backend: ASP.NET Core (.NET 9) minimal APIs + EF Core + PostgreSQL
├── moaz-alian/            # Frontend: TanStack Start + React 19 (the public site & dashboard)
├── docs/                  # Documentation
├── .github/               # GitHub Actions and templates
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

Everything passes through the API in `api-server/` — content, categories, auth (its own JWTs),
users/roles, site settings and debates — backed by a PostgreSQL `library` schema. The frontend
talks to it over HTTP via `moaz-alian/src/lib/api.ts`; the only remaining server route in the
frontend itself is the AI chat proxy (`/api/chat`) and media serving.

## Quick start

```sh
# 1 — backend (http://localhost:5199)
cd api-server
dotnet run --project src/ApiServer.WebApi

# 2 — frontend
cd moaz-alian
bun install
bun run dev
```

App runs at the port Vite prints; set `API_URL` (SSR) if the API is not on
`http://localhost:5199`. Browser calls don't need a variable in production:
they stay same-origin under `/proxy-api`, which `vercel.json` rewrites to the
backend — an HTTPS page must never fetch an HTTP API directly (mixed content).

## Tech stack

- **Frontend:** Bun, React 19, TanStack Start & Router, Tailwind CSS, Radix UI
- **Backend:** ASP.NET Core (.NET 9) minimal APIs, clean-architecture layering
  (Domain → Application → Infrastructure → WebApi), EF Core 9 + Npgsql
- **Database:** PostgreSQL (schema `library`; connection string in `api-server/src/ApiServer.WebApi/appsettings*.json`)
- **AI:** Lovable AI gateway (`AI_API_KEY`) via `/api/chat`

## Scripts (`moaz-alian/`)

| Command | Purpose |
|---------|---------|
| `bun run dev` | Development server |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier write |
| `bun run format:check` | Prettier check |
| `bun run test` | Vitest (once) |

## Documentation

- [Backend](./api-server/README.md) — architecture, auth, database, endpoints
- [Setup](./docs/SETUP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API](./docs/API.md) — real routes only
- [Contributing](./CONTRIBUTING.md)

## Environment

See `moaz-alian/.env.example` for the frontend variables (`VITE_API_URL`, `API_URL`, optional AI
keys) and `api-server/src/ApiServer.WebApi/appsettings.json` for the database and JWT secret.
**Never** commit real passwords or secrets — use user-secrets / environment variables in production.

## CI

GitHub Actions (`.github/workflows/ci.yml`) uses **Bun** only: install, lint, format check, test,
and build for the frontend. The backend builds and tests with `dotnet build` / `dotnet test`
inside `api-server/`.

## License

MIT — see [LICENSE](./LICENSE).
