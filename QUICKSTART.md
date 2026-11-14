# Quick Start Guide

Get the MOAZ ALIAN platform up and running locally in under 5 minutes.

---

## 1. Prerequisites

- **Node.js**: `v22+`
- **pnpm**: `12.x` (`npm install -g pnpm`)
- **PostgreSQL**: 16+ running locally or in Docker:
  ```bash
  docker run -d --name moaz-postgres -p 5432:5432 -e POSTGRES_PASSWORD=moaz_dev postgres:17-alpine
  ```

---

## 2. Installation

Clone and install workspace dependencies from the root directory:

```bash
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
pnpm install
```

---

## 3. Configure Backend Environment

Copy the example environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL=postgresql://moaz:moaz_dev@localhost:5432/moaz_alian?schema=library
AUTH_JWT_SECRET=super-secret-random-32-characters-minimum
AUTH_ADMIN_EMAILS=["admin@moazalian.com"]
```

Run Prisma schema generation and apply the database migrations:

```bash
pnpm --filter @moaz/api prisma:generate
pnpm --filter @moaz/api db:migrate
```

---

## 4. Run Locally

From the root of the repository, run whichever service you need:

### Start Backend API
```bash
pnpm dev:api
# API runs at http://localhost:5199
# Test health: curl http://localhost:5199/health
```

### Start Public Site
```bash
pnpm dev:public
# Public site runs at http://localhost:5173
```

### Start Editorial Dashboard
```bash
pnpm dev:dashboard
# Dashboard runs at http://localhost:5174
```

---

## 5. Key Workspace Commands

| Command | Action |
|---|---|
| `pnpm build` | Builds all applications and packages |
| `pnpm typecheck` | Validates TypeScript types across the monorepo |
| `pnpm lint` | Runs ESLint across all projects |
| `pnpm test` | Executes unit tests |
| `pnpm db:up` | Boots local PostgreSQL via Docker Compose |
| `pnpm db:down` | Stops local PostgreSQL Docker container |

---

## Next Steps

- Consult the [System Architecture](./docs/ARCHITECTURE.md) for data flow and services.
- Read [Deployment Guide](./docs/DEPLOY.md) before pushing to production or staging.
- Check the [API Documentation](./docs/API.md) for REST endpoint specifications.
