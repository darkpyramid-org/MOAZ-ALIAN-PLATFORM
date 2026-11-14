# Local Development Setup

## Prerequisites

- Node.js ≥ 22
- pnpm ≥ 9 (`npm install -g pnpm`)
- PostgreSQL 17 (or Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=moaz_dev postgres:17-alpine`)

## 1. Clone

```sh
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
```

## 2. Backend (apps/api/)

```sh
cd apps/api
pnpm install
cp .env.example .env
```

Edit `.env` and set at least:

```env
DATABASE_URL=postgresql://moaz:moaz_dev@localhost:5432/moaz_alian?schema=library
AUTH_JWT_SECRET=<at least 32 random characters>
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

Run Prisma generate and migrate, then start the dev server:

```sh
pnpm prisma generate
pnpm db:migrate
pnpm dev      # http://localhost:5199
```

Health check: `curl http://localhost:5199/health` should return `Healthy`.

## 3. Public frontend (apps/public/)

```sh
cd apps/public
pnpm install
pnpm dev      # http://localhost:5173
```

The public site fetches from the API at `http://localhost:5199` by default.
Override with `API_URL` (SSR) / `VITE_API_URL` (browser) if needed.

## 4. Dashboard frontend (apps/dashboard/)

```sh
cd apps/dashboard
pnpm install
pnpm dev      # http://localhost:5174
```

Login with an account whose email is in `AUTH_ADMIN_EMAILS` (set in `apps/api/.env`).
Example: `AUTH_ADMIN_EMAILS=admin@example.com`

## 5. Seeding

A seed script is not committed. Creating content via the dashboard or via
`POST /api/content` is the recommended path.

## Troubleshooting

- **Port in use**: change `PORT` in `apps/api/.env` (default 5199).
- **DB connection refused**: verify `DATABASE_URL` and that PostgreSQL is running.
- **401/403 after login**: confirm your admin email is in `AUTH_ADMIN_EMAILS`.
- **CORS errors**: confirm `CORS_ALLOWED_ORIGINS` includes the frontend origin.
