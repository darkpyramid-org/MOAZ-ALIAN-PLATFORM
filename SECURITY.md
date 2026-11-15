# Security Policy

## Supported versions

Security updates are applied to the `main` branch and the latest released tags.

| Branch / release | Supported |
| ---------------- | --------- |
| `main`           | Yes       |
| Latest `v*.*.*`  | Yes       |
| Older releases   | Best-effort only |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately to:

- **Email:** darkpyramid.solutions@gmail.com

Include as much of the following as you can:

- Description of the issue and impact
- Steps to reproduce or a proof of concept
- Affected component (API, public site, dashboard, auth, CI, dependencies)
- Suggested remediation if known

You should receive an acknowledgement within **3 business days**. We will keep you informed of progress and will credit reporters who wish to be acknowledged once a fix is released (unless you prefer to remain anonymous).

## What to expect

| Outcome | What happens |
| ------- | ------------ |
| Accepted | We will work on a fix, coordinate disclosure timing with you when practical, and ship a patch or mitigation. |
| Declined | We will explain why (e.g. not reproducible, out of scope, accepted risk with compensating controls). |

## Security practices in this repository

This project is an Arabic knowledge platform (videos, books, articles, research) with a team dashboard and AI assistant. Recent remediation work prioritizes:

- Strong production JWT secrets and no development fallbacks in production
- Least-privilege public registration (no automatic admin/editor roles)
- OAuth state binding, replay prevention, and verified provider identity
- Session revocation after password or role changes
- Trusted-proxy handling for rate-limit identity
- Shared rate-limit stores and password-recovery throttling
- Blocking CI vulnerability scanning (Trivy CRITICAL/HIGH)

### CI security scanning

Pull requests and pushes to `main` / `develop` run a Trivy filesystem scan. **CRITICAL** and **HIGH** findings fail the required security job and the aggregate CI status. See [docs/SECURITY-SCANNING.md](./docs/SECURITY-SCANNING.md) for policy, SARIF upload behavior, exception process, and action pinning.

### Responsible disclosure

We ask that you:

- Give us reasonable time to fix before public disclosure
- Avoid accessing or modifying data that is not yours
- Do not perform denial-of-service testing against production without prior written agreement

Thank you for helping keep MOAZ ALIAN and its users safe.
