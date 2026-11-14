# Code Review Remediation Plan

**Review baseline:** `main` at `565bd599b26490e7c845a86578ceb06f83014188` (2026-11-14)  
**Tracking branch:** `chore/review-remediation-backlog`  
**Status:** Issues opened; fixes are not represented as completed until merged and verified.

This plan converts the source-level review into independently actionable issues. Each issue contains affected code, scope, acceptance criteria, and a review comment. Do not close an item solely because a code change was committed; close it after the acceptance criteria pass.

## Priority order

### P0 — Release blocker

- [ ] [#39 — Require a production-safe JWT signing secret](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/39). Production must fail startup if the secret is absent or equals the repository-known fallback.

### P1 — Security and delivery integrity

- [ ] [#45 — Prevent shell injection through release workflow_dispatch input](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/45).
- [ ] [#43 — Bind OAuth state to the initiating browser session and consume it once](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/43).
- [ ] [#44 — Verify provider identity before OAuth email account linking](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/44).
- [ ] [#41 — Trust forwarded client IP metadata only from configured proxies](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/41).
- [ ] [#46 — Make CRITICAL/HIGH Trivy findings fail the required CI gate](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/46).
- [ ] [#40 — Repair issue-triage workflow and provision labels safely](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/40).
- [ ] [#47 — Add PostgreSQL-backed API integration coverage](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/47).

### P2 — Operational resilience and functional completeness

- [ ] [#42 — Share rate-limit counters across API instances](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/42).
- [ ] [#48 — Complete password recovery with secure one-time email delivery](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/48).

## Execution sequence

1. Fix the production JWT secret and release-workflow input handling before production release activity.
2. Close OAuth identity validation and state correlation gaps before enabling OAuth in production.
3. Harden rate-limit identity derivation, then move counters to shared storage for multi-instance deployments.
4. Make the security scanner a real merge gate and repair issue automation.
5. Add database-backed API integration tests so future auth, authorization, and ownership changes have regression protection.
6. Complete the password recovery delivery path and token lifecycle.

## Definition of done

- The issue's acceptance criteria are checked off with reproducible evidence.
- Regression tests cover both valid and adversarial paths.
- CI is green, including the relevant security and database-backed test jobs.
- Environment variables, deployment assumptions, and operational behavior are documented.
- No secret, token, personal data, or production credential is added to the repository.
- Related issues and this checklist are updated only after the fix is merged and verified.

## Label taxonomy

The issue-triage workflow is being updated to provision and apply these labels idempotently:

- `needs-triage`
- `security`
- `priority: critical`, `priority: high`, `priority: medium`, `priority: low`
- `area:api`, `area:public`, `area:dashboard`, `area:packages`, `area:ci`, `area:docs`

Existing type labels (`bug`, `enhancement`, `documentation`) remain in use.
