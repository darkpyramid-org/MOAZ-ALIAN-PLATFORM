'use strict';

const LABEL_DEFINITIONS = Object.freeze({
  'needs-triage': { color: 'ededed', description: 'Needs initial human review' },
  security: { color: 'd73a4a', description: 'Security-related issue' },
  'priority: critical': { color: 'b60205', description: 'Must be fixed immediately' },
  'priority: high': { color: 'd93f0b', description: 'High priority' },
  'priority: medium': { color: 'fbca04', description: 'Medium priority' },
  'priority: low': { color: '0e8a16', description: 'Low priority / nice-to-have' },
  'area:api': { color: '1d76db', description: 'Backend API (apps/api)' },
  'area:public': { color: '1d76db', description: 'Public frontend' },
  'area:dashboard': { color: '1d76db', description: 'Editorial dashboard' },
  'area:packages': { color: '1d76db', description: 'Shared packages' },
  'area:ci': { color: '1d76db', description: 'CI and GitHub Actions' },
  'area:docs': { color: '1d76db', description: 'Documentation' },
  bug: { color: 'd73a4a', description: 'Something is not working' },
  enhancement: { color: 'a2eeef', description: 'New feature or improvement' },
  documentation: { color: '0075ca', description: 'Documentation improvements' },
});

function classifyIssue(issue, action) {
  const title = typeof issue?.title === 'string' ? issue.title.toLowerCase() : '';
  const body = typeof issue?.body === 'string' ? issue.body.toLowerCase() : '';
  const text = title + '\n' + body;
  const labels = new Set();

  if (action === 'opened') labels.add('needs-triage');

  if (/\b(bug|broken|crash|error|fail|regression|fix)\b/.test(text)) labels.add('bug');
  if (/\b(feature|enhancement|request|improve|add support)\b/.test(text)) labels.add('enhancement');
  if (/\b(doc|documentation|readme|guide)\b/.test(text)) labels.add('documentation');
  if (/\b(security|vulnerab|cve|auth|jwt|xss|csrf|injection|secret|password|oauth)\b/.test(text)) {
    labels.add('security');
  }

  const explicitPriority = text.match(/\bpriority\s*[:=-]?\s*(critical|high|medium|low)\b/);
  if (explicitPriority) {
    labels.add('priority: ' + explicitPriority[1]);
  } else if (/\b(p0|sev0|blocker)\b/.test(text)) {
    labels.add('priority: critical');
  } else if (/\b(p1|sev1)\b/.test(text)) {
    labels.add('priority: high');
  } else if (/\b(p2|sev2)\b/.test(text)) {
    labels.add('priority: medium');
  } else if (/\b(p3|sev3)\b/.test(text)) {
    labels.add('priority: low');
  }

  if (/\b(api|backend|express|prisma|endpoint)\b|\/api\//.test(text) || text.includes('apps/api')) labels.add('area:api');
  if (/\b(public|frontend|ssr|tanstack start)\b/.test(text) || text.includes('apps/public')) labels.add('area:public');
  if (/\b(dashboard|editorial|admin panel)\b/.test(text) || text.includes('apps/dashboard')) labels.add('area:dashboard');
  if (/\b(package|shared|ui package|api-client|shared-types)\b/.test(text) || text.includes('packages/')) labels.add('area:packages');
  if (/\b(ci|github actions|workflow|pipeline|trivy)\b/.test(text) || text.includes('.github/')) labels.add('area:ci');
  if (/\b(docs|documentation|readme|setup guide|architecture guide)\b/.test(text) || text.includes('docs/')) labels.add('area:docs');

  return [...labels];
}

module.exports = { classifyIssue, LABEL_DEFINITIONS };
