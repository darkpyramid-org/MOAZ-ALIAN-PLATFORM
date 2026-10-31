# MOAZ ALIAN Platform

مساحة معرفية عربية للبحث والقراءة: فيديوهات، كتب، مقالات وأبحاث، مع لوحة تحكم للفريق ومساعد ذكي.

An Arabic knowledge platform for videos, books, articles, and research, with a team dashboard and AI assistant.

## Repository structure

```
.
├── moaz-alian/          # Full app (TanStack Start + React 19 + Supabase + Bun)
├── docs/                # Documentation
├── .github/             # GitHub Actions and templates
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

There is **no** separate `api-server/` package. Server routes live under `moaz-alian/src/routes/api/` (for example `/api/chat` and `/api/media/$`).

## Quick start

```sh
cd moaz-alian
bun install
cp .env.example .env.local   # fill in real values
bun run dev
```

App runs at `http://localhost:5173` (or the port Vite prints).

## Tech stack

- **Runtime / package manager:** Bun
- **UI:** React 19, TanStack Start & Router, Tailwind CSS, Radix UI
- **Data / auth:** Supabase (Postgres + Auth + RLS)
- **ORM / migrations:** Drizzle
- **AI:** Lovable AI gateway (`LOVABLE_API_KEY`) via `/api/chat`

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

- [Setup](./docs/SETUP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API](./docs/API.md) — real routes only
- [Contributing](./CONTRIBUTING.md)
- [Roadmap](./docs/ROADMAP.md)

## Environment

See `moaz-alian/.env.example` for client (`VITE_*`) and server variables.  
**Never** expose `SUPABASE_SERVICE_ROLE_KEY` under a `VITE_` prefix.

## CI

GitHub Actions (`.github/workflows/ci.yml`) uses **Bun** only: install, lint, format check, test, and build. There is no backend job.

## License

MIT — see [LICENSE](./LICENSE).
