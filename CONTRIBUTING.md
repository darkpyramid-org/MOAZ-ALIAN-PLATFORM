# Contributing to MOAZ ALIAN Platform

Thank you for contributing.

## Setup

```sh
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM/moaz-alian
bun install
cp .env.example .env.local
# edit .env.local with real values (never commit secrets)
bun run dev
```

Full environment notes: [docs/SETUP.md](./docs/SETUP.md).

## Workflow

1. Branch from `main`: `git checkout -b fix/your-change`
2. Make changes under `moaz-alian/`
3. Before opening a PR:

```sh
cd moaz-alian
bun run format
bun run lint
bun run test
bun run build
```

## Project layout (app)

```
moaz-alian/src/
├── components/       # UI and domain components
├── routes/           # TanStack file routes (pages + api/)
│   └── api/          # Server routes: chat, media, …
├── integrations/     # Supabase client / auth middleware
├── lib/              # Shared helpers and server logic
└── test/             # Vitest suites
```

There is **no** `api-server/` directory and no `pages/` tree — routing is file-based under `src/routes/`.

## Commit style

- `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`

## Pull requests

- Link issues (`Closes #n`)
- Keep CI green (lint, format, test, build)
- Prefer small, focused PRs

## Code of conduct

Be respectful and constructive in reviews and discussions.
