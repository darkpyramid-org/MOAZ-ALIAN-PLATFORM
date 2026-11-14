# Contributing to MOAZ ALIAN Platform

Thank you for contributing to the MOAZ ALIAN knowledge platform.

---

## Workspace Setup

Clone the repository and install dependencies at the monorepo root:

```bash
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
pnpm install
```

Detailed setup instructions are available in [docs/SETUP.md](./docs/SETUP.md).

---

## Development Workflow

1. **Create a topic branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Make your changes:**
   Work in the relevant workspace under `apps/` (`api`, `public`, `dashboard`) or `packages/` (`ui`, `api-client`, `shared-types`).
3. **Verify checks locally before pushing:**
   ```bash
   pnpm -r build
   pnpm -r test
   pnpm -r typecheck
   pnpm -r lint
   ```

---

## Commit Guidelines

Follow conventional commit formats:
- `feat:` for new capabilities and endpoints
- `fix:` for bug fixes and patches
- `docs:` for documentation updates
- `refactor:` for internal restructuring without behavior changes
- `test:` for test additions or updates
- `chore:` for tooling and dependency maintenance

---

## Pull Requests

- Keep PRs focused and single-purpose.
- Ensure all CI workflows and Vercel preview builds pass.
- Reference related issues where applicable.

---

## Code of Conduct

Maintain a constructive, respectful, and professional environment in all interactions and reviews.
