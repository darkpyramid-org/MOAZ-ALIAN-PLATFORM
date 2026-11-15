# Testing guide

## API test suites

The API uses Vitest:

- Unit tests: `apps/api/tests/unit/**` — no database required.
- PostgreSQL integration tests: `apps/api/tests/integration/**` — require an isolated PostgreSQL database.
- CI provisions a disposable PostgreSQL 17 service, sets `DATABASE_URL` and `TEST_DATABASE_URL`, applies Prisma migrations, and runs the complete API test command. Integration tests are skipped locally when `TEST_DATABASE_URL` is not set.

## Run API tests from a clean checkout

Prerequisites: Node.js 22+, pnpm (the version pinned by the repository), and Docker Desktop / Docker Engine.

1. Install the monorepo dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

2. Start the isolated API PostgreSQL container:

   ```sh
   pnpm --filter @moaz/api db:up
   ```

   The API compose file publishes PostgreSQL on host port `5434`, separate from a local PostgreSQL installation.

3. Configure both connection variables to the disposable test database.

   **PowerShell:**

   ```powershell
   $env:DATABASE_URL = "postgresql://moaz:moaz_dev@localhost:5434/moaz_alian?schema=library"
   $env:TEST_DATABASE_URL = "postgresql://moaz:moaz_dev@localhost:5434/moaz_alian?schema=library"
   ```

   **Bash:**

   ```sh
   export DATABASE_URL='postgresql://moaz:moaz_dev@localhost:5434/moaz_alian?schema=library'
   export TEST_DATABASE_URL='postgresql://moaz:moaz_dev@localhost:5434/moaz_alian?schema=library'
   ```

4. Generate Prisma Client, apply the checked-in migrations, and run the API suite:

   ```sh
   pnpm --filter @moaz/api prisma:generate
   pnpm --filter @moaz/api db:migrate
   pnpm --filter @moaz/api test
   ```

5. Stop the disposable database when finished:

   ```sh
   pnpm --filter @moaz/api db:down
   ```

## Safety requirements

- Never point `TEST_DATABASE_URL` at production, staging, or a developer database containing valuable data. The integration suite creates and deletes test users.
- Tests use unique `example.test` email addresses and clean up only the users they create.
- The test global setup uses `prisma migrate deploy`; do not use `prisma migrate dev` against the shared `library` schema.
- If `TEST_DATABASE_URL` is unset, integration tests are skipped. A green unit-only run is not evidence that PostgreSQL integration coverage passed.
- CI must keep the PostgreSQL service and both database variables configured; failures in integration tests are required-check failures.
