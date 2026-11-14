import { execSync } from 'node:child_process';

/**
 * Test database provisioning. When TEST_DATABASE_URL is set (CI, or local runs
 * against the disposable golden container) the baseline migration is applied —
 * never `prisma migrate dev` (the plan forbids dev-mode workflows against the
 * real schema). Unit tests run without a database and skip this entirely.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    return;
  }
  execSync('pnpm exec prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
