# Local Development Setup

Follow these steps to set up the development environment for the MOAZ ALIAN platform.

---

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** 12.x (`npm install -g pnpm`)
- **PostgreSQL** 16+ (Local instance or Docker container)

---

## 1. Clone & Install Dependencies

Clone the monorepo and install all workspace packages from the root:

```bash
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
pnpm install
```

---

## 2. Database & Backend Configuration

Start a PostgreSQL database instance (if not running already):

```bash
docker run -d --name moaz-postgres -p 5432:5432 -e POSTGRES_PASSWORD=moaz_dev postgres:17-alpine
```

Set up the backend environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Ensure `apps/api/.env` contains valid configuration:

```env
DATABASE_URL=postgresql://postgres:moaz_dev@localhost:5432/moaz_alian?schema=library
AUTH_JWT_SECRET=super-secret-random-32-characters-minimum
AUTH_ADMIN_EMAILS=["admin@moazalian.com"]
CORS_ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:5174"]
PORT=5199
```

Generate the Prisma client and apply database migrations:

```bash
pnpm --filter @moaz/api prisma:generate
pnpm --filter @moaz/api db:migrate
```

---

## 3. Starting the Applications

From the root directory:

```bash
# Start backend API (http://localhost:5199)
pnpm dev:api

# Start public frontend (http://localhost:5173)
pnpm dev:public

# Start admin dashboard (http://localhost:5174)
pnpm dev:dashboard
```

Verify backend health:
```bash
curl http://localhost:5199/health
# Output: Healthy
```

---

## 4. Admin Account Setup

1. Register a new user via the dashboard or API endpoint `POST /api/auth/register`.
2. Ensure the registration email matches one of the emails defined in `AUTH_ADMIN_EMAILS` (e.g. `["admin@moazalian.com"]`).
3. The user will automatically receive administrative access upon sign-in.

---

## 5. Useful Monorepo Commands

| Command | Action |
|---|---|
| `pnpm build` | Compiles all workspaces (`apps` and `packages`) |
| `pnpm typecheck` | Validates TypeScript in all workspaces |
| `pnpm lint` | Runs ESLint |
| `pnpm test` | Runs the Vitest test suites |

---

## Troubleshooting

- **Database Connection Refused:** Check that PostgreSQL is running and that the `DATABASE_URL` port and credentials match.
- **Port Conflict (5199 in use):** Change `PORT=5200` in `apps/api/.env`.
- **401/403 Unauthorized in Dashboard:** Make sure `AUTH_ADMIN_EMAILS` is a valid JSON array matching your sign-in email.
- **CORS Blocked in Browser:** Ensure your frontend URL is listed in `CORS_ALLOWED_ORIGINS` in `apps/api/.env`.
