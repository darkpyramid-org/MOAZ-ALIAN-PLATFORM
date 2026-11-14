'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyIssue, LABEL_DEFINITIONS } = require('./issue-triage.cjs');

const asSet = (labels) => new Set(labels);

test('classifies security bugs, explicit priority, and API paths', () => {
  const labels = asSet(classifyIssue({
    title: 'OAuth security bug in API',
    body: 'priority: high\napps/api/src/modules/oauth.ts',
  }, 'opened'));

  for (const expected of ['needs-triage', 'bug', 'security', 'priority: high', 'area:api']) {
    assert.equal(labels.has(expected), true, 'expected ' + expected);
  }
  assert.equal(labels.has('priority: critical'), false);
});

test('classifies docs, enhancements, and low priority', () => {
  const labels = asSet(classifyIssue({
    title: 'Improve setup documentation',
    body: 'priority: low\nSee docs/DEPLOY.md',
  }, 'opened'));

  for (const expected of ['needs-triage', 'enhancement', 'documentation', 'priority: low', 'area:docs']) {
    assert.equal(labels.has(expected), true, 'expected ' + expected);
  }
});

test('classifies every application and automation area', () => {
  const labels = asSet(classifyIssue({
    title: 'Frontend dashboard and packages build pipeline',
    body: 'apps/public, apps/dashboard, packages/shared-types, .github/workflows/ci.yml',
  }, 'edited'));

  for (const expected of ['area:public', 'area:dashboard', 'area:packages', 'area:ci']) {
    assert.equal(labels.has(expected), true, 'expected ' + expected);
  }
  assert.equal(labels.has('needs-triage'), false);
});

test('supports P-level aliases and explicit priority takes precedence', () => {
  assert.equal(asSet(classifyIssue({ title: 'Fix P0 blocker' }, 'opened')).has('priority: critical'), true);
  const explicit = asSet(classifyIssue({ title: 'priority: low P0 blocker' }, 'opened'));
  assert.equal(explicit.has('priority: low'), true);
  assert.equal(explicit.has('priority: critical'), false);
});

test('does not label unrelated edits and handles malformed payloads safely', () => {
  assert.deepEqual(classifyIssue({ title: 'Hello', body: 'World' }, 'edited'), []);
  assert.deepEqual(classifyIssue(null, 'edited'), []);
  assert.deepEqual(classifyIssue({ title: null, body: 42 }, 'opened'), ['needs-triage']);
});

test('every possible classifier label has a provisionable definition', () => {
  const labels = classifyIssue({
    title: 'bug feature docs security priority: critical api public dashboard package workflow',
    body: 'apps/api apps/public apps/dashboard packages/ docs/ .github/',
  }, 'opened');
  for (const label of labels) assert.ok(LABEL_DEFINITIONS[label], 'missing definition for ' + label);
});
