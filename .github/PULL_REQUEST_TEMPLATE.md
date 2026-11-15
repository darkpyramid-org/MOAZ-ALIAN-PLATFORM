## Summary

<!-- What does this PR change and why? 1–3 short paragraphs. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Security fix / hardening
- [ ] Breaking change (describe impact below)
- [ ] Documentation only
- [ ] CI / tooling
- [ ] Tests only

## Related issues

<!-- Use Fixes #123 or Refs #123 -->

Fixes #

## Changes

<!-- Bullet list of concrete changes. Call out migrations, new env vars, and auth/security behavior. -->

-

## Testing

- [ ] Unit tests added or updated
- [ ] PostgreSQL integration tests added or updated (when API behavior changes)
- [ ] Ran locally: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -r build`
- [ ] API integration tests run with disposable Postgres per [docs/TESTING.md](../docs/TESTING.md) (if applicable)
- [ ] Frontend / dashboard checked manually (if UI change)

## Security & operations

- [ ] No secrets or production credentials committed
- [ ] New environment variables documented (name, purpose, required in production?)
- [ ] Auth, roles, tokens, rate limits, or proxy trust changes include regression tests
- [ ] Prisma migrations are additive and ordered correctly if stacked with other PRs
- [ ] Vulnerability findings: none introduced, or tracked with exception process in [docs/SECURITY-SCANNING.md](../docs/SECURITY-SCANNING.md)

## Checklist

- [ ] Branch is rebased on current `main` (or intended base) and conflicts are resolved
- [ ] CI required checks are green (or expected failures explained)
- [ ] PR is focused and single-purpose
- [ ] Breaking changes and rollout steps are documented below

## Environment variables

<!-- List any new or changed env vars. Example: AUTH_JWT_SECRET (required in production, min 32 chars) -->

| Variable | Required | Notes |
| -------- | -------- | ----- |
|          |          |       |

## Rollout / migration notes

<!-- Deploy order, feature flags, backfills, session invalidation, etc. Write "N/A" if none. -->

N/A

## Screenshots / demo

<!-- UI changes only -->

## Additional notes for reviewers

