# Accessibility

MOAZ ALIAN is an Arabic knowledge platform. People who use it — readers, researchers, editors, and administrators — should be able to access content and contribute regardless of disability, assistive technology, or input method. This document describes our accessibility commitments, what we expect from contributors, and how to report barriers.

## Priorities

We aim for experiences that work with:

- Keyboard-only navigation
- Screen readers and other assistive technologies
- Adequate color contrast and resizable text
- Clear focus indicators and meaningful structure (headings, landmarks, labels)
- Right-to-left (RTL) layout for Arabic content, without breaking assistive technology support

We treat **WCAG 2.2 Level AA** as an aspirational target for user-facing surfaces (`apps/public` and `apps/dashboard`). That is a goal, not a verified conformance claim. Formal evaluation scope, date, method, and results will be published when available.

## Contributor expectations

When you change user-facing UI:

- Prefer semantic HTML and accessible component patterns from the shared UI package when available.
- Ensure interactive controls are reachable and operable by keyboard.
- Provide accessible names (visible labels or appropriate `aria-*` / accessible name APIs).
- Do not rely on color alone to convey meaning.
- Preserve or improve RTL behavior for Arabic strings and layout.
- Include brief notes in the PR when a change affects keyboard flow, focus management, or screen-reader announcements.

Automated checks (lint, unit tests, CI) do not fully replace manual accessibility testing. For substantial UI work, test with keyboard and at least one screen reader or accessibility inspector where practical.

## Reporting accessibility issues

Please open a GitHub issue with the label related to accessibility (or `area:public` / `area:dashboard` as appropriate).

Useful context (optional but helpful):

- What you were trying to do (task / URL)
- What happened instead
- Browser, OS, and assistive technology if relevant
- Screenshots or short recordings if they help (not required)

You do **not** need to disclose a disability. Severity will be assessed by maintainers during triage.

### Severity (guidance for maintainers)

| Level | Example impact |
| ----- | -------------- |
| Critical | Cannot complete a core task (e.g. log in, read an article, publish content) with a primary assistive technology |
| High | Major barrier with a reasonable workaround |
| Medium | Partial impairment or inconsistent experience |
| Low | Minor polish or edge-case improvement |

### How we respond

We aim to acknowledge accessibility reports and triage them into the backlog. Critical barriers affecting core flows are prioritized alongside other high-severity work. When a fix ships, we welcome verification from the reporter if they choose to help.

## Ownership and maintenance

Maintainers of the public site and dashboard workspaces are responsible for accessibility of those surfaces. This document is reviewed when major UI systems change or when community feedback indicates gaps.

## Supported environments

We primarily target modern evergreen browsers (latest Chrome, Firefox, Safari, Edge) on desktop and common mobile browsers. Assistive technology combinations are tested opportunistically; reported issues on widely used combinations are treated as first-class bugs.

## Known limitations

Document known barriers here as they are identified, with links to tracking issues and any available workarounds. If none are listed, that means none are currently documented — not that none exist.

## Feedback and improvements

Suggestions to improve this statement or our practices are welcome via issue or PR. Active barriers should use the reporting process above.
