# Contributing to MOAZ ALIAN Platform

Thank you for contributing to the MOAZ ALIAN knowledge platform — an Arabic platform for videos, books, articles, and research, with a team dashboard and AI assistant.

Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Workspace setup

```bash
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
pnpm install
```

Detailed setup is in [docs/SETUP.md](./docs/SETUP.md). Testing (including PostgreSQL integration tests) is documented in [docs/TESTING.md](./docs/TESTING.md).

---

## Development workflow

1. **Create a topic branch from up-to-date `main`:**
   ```bash
   git fetch origin
   git checkout -b feat/your-feature-name origin/main
   ```
2. **Work in the relevant workspace:**
   - `apps/api` — backend API
   - `apps/public` — public site
   - `apps/dashboard` — team dashboard
   - `packages/` — shared UI, API client, types
3. **Verify locally before pushing:**
   ```bash
   pnpm -r typecheck
   pnpm -r lint
   pnpm -r test
   pnpm -r build
   ```
   For API integration tests, follow [docs/TESTING.md](./docs/TESTING.md) (disposable Postgres, `TEST_DATABASE_URL`).

---

## Commit guidelines

Use conventional commits:

| Prefix | Use for |
| ------ | ------- |
| `feat:` | New capabilities and endpoints |
| `fix:` | Bug fixes and patches |
| `security:` | Security fixes and hardening |
| `docs:` | Documentation |
| `refactor:` | Internal restructuring without behavior change |
| `test:` | Test additions or updates |
| `chore:` | Tooling and dependency maintenance |
| `ci:` | CI workflow changes |

---

## Pull requests

- Keep PRs focused and single-purpose.
- Rebase onto current `main` before requesting review (resolve conflicts early).
- Ensure all required CI checks pass (backend, frontends, packages, Trivy, aggregate status).
- Reference related issues (`Fixes #123` / `Refs #123`).
- For security-sensitive changes, include tests that cover the failure modes you are closing.
- Do not merge stacked PRs out of the documented order when migrations depend on each other.

### Security-related contributions

- Report vulnerabilities privately per [SECURITY.md](./SECURITY.md); do not open public issues for unfixed vulns.
- Prefer additive Prisma migrations; never rewrite already-applied migration history on shared branches.
- Production secrets (JWT, Upstash, Resend, etc.) must never be committed. CI may use documented test-only values.
- Trivy CRITICAL/HIGH findings block merge. See [docs/SECURITY-SCANNING.md](./docs/SECURITY-SCANNING.md).

---

## Code review expectations

- Be constructive and specific.
- Prefer small, reviewable diffs.
- Security and auth changes require extra scrutiny (roles, tokens, rate limits, proxy trust).

---

## Questions

Open a discussion issue or contact the maintainers. For security reports, use the process in [SECURITY.md](./SECURITY.md) only.
