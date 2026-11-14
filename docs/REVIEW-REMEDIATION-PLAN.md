# Code Review Remediation Plan

**Review baseline:** `main` at `565bd599b26490e7c845a86578ceb06f83014188` (2026-11-14)  
**Tracking branch:** `chore/review-remediation-backlog`  
**Status:** Issues opened; fixes are not represented as completed until merged and verified.

This plan converts the source-level review into independently actionable issues. Each issue contains affected code, scope, acceptance criteria, and a review comment. Do not close an item solely because a code change was committed; close it after the acceptance criteria pass.

## Priority order

### P0 — Release blockers

- [ ] [#51 — Prevent public self-registration from granting editor/admin roles](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/51). Public signup must not grant editorial write access or unverified admin access. Implementation is in draft [PR #55](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/55); keep open until checks pass and it is merged.
- [ ] [#39 — Require a production-safe JWT signing secret](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/39). Production must fail startup if the secret is absent, weak, or equals the repository-known fallback. Implementation is in draft [PR #56](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/56); keep open until checks pass and it is merged.

### P1 — Security and delivery integrity

- [ ] [#45 — Prevent shell injection through release workflow_dispatch input](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/45). Implementation is in draft [PR #57](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/57); keep open until checks pass and it is merged.
- [ ] [#43 — Bind OAuth state to the initiating browser session and consume it once](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/43). Implementation is in draft [PR #58](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/58); keep open until checks pass and it is merged.
- [ ] [#44 — Verify provider identity before OAuth email account linking](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/44). Implementation is in draft [PR #60](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/60), stacked on PR #58; retarget after #58 merges and keep open until checks/review pass.
- [ ] [#41 — Trust forwarded client IP metadata only from configured proxies](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/41). Implementation is in draft [PR #59](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/59); keep open until checks pass and it is merged.
- [ ] [#46 — Make CRITICAL/HIGH Trivy findings fail the required CI gate](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/46).
- [ ] [#40 — Repair issue-triage workflow and provision labels safely](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/40).
- [ ] [#47 — Add PostgreSQL-backed API integration coverage](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/47).
- [ ] [#50 — Revoke existing JWT sessions after role changes or account deletion](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/50). Implementation is in draft [PR #61](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/61); keep open until checks and review pass.
- [ ] [#52 — Move password hashing off the event loop and harden login timing](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/52). Implementation is in draft [PR #62](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/pull/62); keep open until CI and security review pass.

### P2 — Operational resilience and functional completeness

- [ ] [#42 — Share rate-limit counters across API instances](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/42).
- [ ] [#48 — Complete password recovery with secure one-time email delivery](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues/48).

## Execution sequence

1. Remove editor/admin privileges from public self-registration and fail closed on a missing/default production JWT secret.
2. Eliminate shell injection in release dispatch before running privileged release workflows.
3. Close OAuth provider-identity verification and state correlation/replay gaps before enabling OAuth in production.
4. Enforce session revocation after role changes/account deletion, and harden trusted client-IP resolution.
5. Move password derivation off the event loop and establish shared rate-limit storage for multi-instance deployments.
6. Make CRITICAL/HIGH security findings fail the required CI gate and repair issue-triage automation.
7. Add PostgreSQL-backed API integration tests for auth, authorization, content, and chat ownership.
8. Complete password recovery delivery and its one-time token lifecycle.

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
