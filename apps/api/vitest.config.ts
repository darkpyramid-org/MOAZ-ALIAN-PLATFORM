import { defineConfig } from 'vitest/config';

/**
 * Vitest runs two suites:
 *  - tests/unit/**: pure logic, no database, fast.
 *  - tests/integration/**: HTTP contract tests against a disposable PostgreSQL
 *    (provisioned by tests/globalSetup.ts via Docker, or TEST_DATABASE_URL in CI).
 */
export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: {
      forks: {
        // One process only: integration tests share one database and the cache
        // versioning must be deterministic within a run.
        singleFork: true,
      },
    },
  },
});
