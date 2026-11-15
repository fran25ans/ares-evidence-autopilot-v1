import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluate, runCase, validateCases } from './engine.mjs';

const fixture = JSON.parse(await readFile(new URL('./cases.json', import.meta.url), 'utf8'));
const cases = fixture.cases;

test('fixtures are unique, balanced, and explicitly synthetic', () => {
  validateCases(cases);
  assert.equal(cases.length, 20);
  assert.deepEqual(Object.fromEntries(['sleep', 'environment', 'recovery', 'unknown'].map((truth) => [truth, cases.filter((item) => item.truth === truth).length])), { sleep: 5, environment: 5, recovery: 5, unknown: 5 });
  assert.match(fixture.provenance, /synthetic/i);
});

test('the same sealed case is paired across every policy and run is deterministic', () => {
  const first = evaluate(cases);
  assert.deepEqual(first, evaluate(cases));
  for (const paired of first.pairedRuns) {
    assert.deepEqual(Object.keys(paired.results), ['ares', 'fixed', 'all', 'greedy', 'no_adaptive', 'no_unknown', 'no_sensor', 'scalar_only']);
    for (const result of Object.values(paired.results)) assert.equal(result.caseId, paired.caseId);
  }
});

test('policy cannot see sealed truth and unrevealed outcomes', () => {
  const original = runCase(cases[0], 'ares');
  const changedTruth = runCase({ ...cases[0], truth: 'unknown' }, 'ares');
  assert.deepEqual(original.trace, changedTruth.trace);
  const changedUnrequested = runCase({ ...cases[0], outcomes: { ...cases[0].outcomes, sensor: [99, 99, 99, 99] } }, 'ares');
  assert.deepEqual(original.trace, changedUnrequested.trace);
});

test('resource-aware policies never overspend; scalar-only ablation exposes a violation', () => {
  const report = evaluate(cases);
  for (const policy of ['ares', 'fixed', 'all', 'greedy']) assert.equal(report.policies[policy].resourceViolationPct, 0);
  assert.ok(report.ablations.scalar_only.resourceViolationPct > 0);
});

test('open-world ablation loses appropriate abstention on unknown cases', () => {
  const report = evaluate(cases);
  assert.ok(report.ablations.no_unknown.wrongCommittedPct > report.policies.ares.wrongCommittedPct);
  assert.ok(report.policies.ares.correctUnknownAbstainPct > report.ablations.no_unknown.correctUnknownAbstainPct);
});
