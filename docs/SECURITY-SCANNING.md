# Security scanning policy

## Required CI gate

The required GitHub Actions security job scans the repository filesystem with Trivy and evaluates findings at **CRITICAL** and **HIGH** severity.

- A completed scan with no CRITICAL/HIGH findings passes.
- A scan that reports one or more CRITICAL/HIGH findings fails the security job and the aggregate `CI All Checks Status` job.
- A scanner execution error also fails the security job. It must never be interpreted as a clean scan.
- SARIF upload is attempted after the scan, including when Trivy exits non-zero because it found policy-violating findings.
- If SARIF generation fails, the final enforcement step still fails the job; the missing report is not a pass.
- Trivy is pinned to the reviewed immutable release commit `57a97c7e7821a5776cebc9bb87c984fa69cba8f1` (release `v0.35.0`). Updates require review of the upstream release, action changes, and a CI run.

## Handling findings and exceptions

1. Open a tracked issue for each finding or coherent finding group. Include the affected package/file, Trivy ID, severity, fixed version (when available), exploitability/context, and owner.
2. Prefer upgrading or removing the vulnerable dependency or correcting the insecure configuration.
3. Do not suppress a finding solely to make CI green. An exception requires a documented security review, a named owner, a reason, compensating controls, and an expiry/revisit date.
4. Any accepted exception must be narrowly scoped to the specific Trivy ID and affected path using the repository's reviewed Trivy ignore mechanism. Broad severity-wide suppression is prohibited.
5. Re-run the scan after remediation and retain the resulting CI/SARIF evidence.

## Operational notes

The scan runs on pull requests and pushes to `main` and `develop`. GitHub Actions must have `security-events: write` permission for SARIF upload. A failed SARIF upload is itself a visible CI failure and must be investigated; it does not waive the vulnerability gate.
