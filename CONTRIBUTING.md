# Contributing to MOAZ ALIAN Platform

Thank you for contributing.

## Setup

```sh
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
cd apps/api && pnpm install   # backend
cd ../public && pnpm install  # public site
cd ../dashboard && pnpm install  # dashboard
```

Full environment notes: [docs/SETUP.md](./docs/SETUP.md).

## Workflow

1. Branch from `main`: `git checkout -b fix/your-change`
2. Make changes under the relevant app (`apps/public`, `apps/dashboard`, `apps/api`, or `packages/*`)
3. Before opening a PR:

```sh
pnpm -r --if-present test
pnpm -r --if-present typecheck
pnpm -r --if-present lint
pnpm -r --if-present format:check
```

## Project layout

```
apps/
├── api/              Express 5 backend (TypeScript + Prisma + PostgreSQL)
├── public/           TanStack Start public site
└── dashboard/        TanStack Start admin dashboard
packages/
├── api-client/       Typed API client
├── shared-types/     Shared content types
└── ui/               Shared component library
```

The API client is the only module that talks to the backend (`apps/*/src/lib/api.ts`);
shape translation lives in `apps/*/src/lib/api-mapping.ts`.

## Commit style

- `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`

## Pull requests

- Link issues (`Closes #n`)
- Keep CI green (lint, format, test, build)
- Prefer small, focused PRs

## Code of conduct

Be respectful and constructive in reviews and discussions.
