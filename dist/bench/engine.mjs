// ARES-EVAL-1: deliberately small, inspectable synthetic policy evaluator.
// The oracle alone owns case.truth and case.outcomes. Policies receive only state.
import sharedAresPolicy from '../ares-policy.js';
export const COSTS = Object.freeze({ pvt: 2, report: 1, environment: 1, recovery: 2, sensor: 2 });
export const RESOURCE_COSTS = Object.freeze({
  pvt: { time: 3, attention: 2, energy: 1, sensor: 1 },
  report: { time: 1, attention: 1, energy: 0, sensor: 0 },
  environment: { time: 2, attention: 0, energy: 1, sensor: 1 },
  recovery: { time: 20, attention: 0, energy: 1, sensor: 0 },
  sensor: { time: 4, attention: 1, energy: 2, sensor: 1 }
});
export const INITIAL_RESOURCES = Object.freeze({ time: 25, attention: 10, energy: 8, sensor: 3 });
export const POLICIES = Object.freeze(['ares', 'fixed', 'all', 'greedy']);
export const ABLATIONS = Object.freeze(['no_adaptive', 'no_unknown', 'no_sensor', 'scalar_only']);
const SCORE_KEYS = ['sleep', 'environment', 'recovery', 'unknown'];
const TESTS = Object.keys(COSTS);
const clamp = (value) => Math.max(0, Math.min(100, value));

export function validateCases(cases) {
  if (!Array.isArray(cases) || cases.length === 0) throw new Error('No evaluation cases');
  const ids = new Set();
  for (const item of cases) {
    if (!item.id || ids.has(item.id)) throw new Error(`Missing or duplicate case ID: ${item.id}`);
    ids.add(item.id);
    if (![...SCORE_KEYS].includes(item.truth)) throw new Error(`Invalid truth in ${item.id}`);
    if (!Array.isArray(item.scores) || item.scores.length !== 4 || item.scores.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) throw new Error(`Invalid scores in ${item.id}`);
    if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string')) throw new Error(`Invalid tags in ${item.id}`);
    for (const [test, delta] of Object.entries(item.outcomes || {})) {
      if (!TESTS.includes(test) || !Array.isArray(delta) || delta.length !== 4 || delta.some((value) => !Number.isFinite(value))) throw new Error(`Invalid outcome in ${item.id}: ${test}`);
    }
    for (const [resource, value] of Object.entries(item.resources || {})) {
      if (!Object.hasOwn(INITIAL_RESOURCES, resource) || !Number.isFinite(value) || value < 0) throw new Error(`Invalid resource in ${item.id}: ${resource}`);
    }
  }
}

function visibleState(item) {
  return {
    scores: Object.fromEntries(SCORE_KEYS.map((key, index) => [key, item.scores[index]])),
    tags: [...item.tags], budget: 6, resources: { ...INITIAL_RESOURCES, ...(item.resources || {}) },
    used: []
  };
}

function leader(scores) {
  return ['sleep', 'environment', 'recovery'].sort((a, b) => scores[b] - scores[a])[0];
}

function affordable(state, variant) {
  return TESTS.filter((test) => !state.used.includes(test) && !(variant === 'no_sensor' && test === 'sensor') && COSTS[test] <= state.budget &&
    (variant === 'scalar_only' || Object.entries(RESOURCE_COSTS[test]).every(([resource, cost]) => state.resources[resource] >= cost)));
}

function status(state, variant) {
  const best = leader(state.scores);
  if (variant !== 'no_unknown' && state.scores.unknown >= 58) return 'ABSTAIN';
  if (state.scores[best] >= 72 && (variant === 'no_unknown' || state.scores.unknown <= 36)) return best;
  if (state.budget === 0 || affordable(state, variant).length === 0) return variant === 'no_unknown' ? best : 'ABSTAIN';
  return 'CONTINUE';
}

function choose(state, variant) {
  const available = affordable(state, variant);
  if (!available.length) return null;
  if (variant === 'fixed') return ['pvt', 'report', 'environment'].find((test) => available.includes(test)) || null;
  if (variant === 'no_adaptive') return ['pvt', 'report', 'environment', 'sensor', 'recovery'].find((test) => available.includes(test)) || null;
  if (variant === 'all') return ['report', 'environment', 'pvt', 'sensor', 'recovery'].find((test) => available.includes(test)) || null;
  if (variant === 'greedy') {
    const gain = { pvt: 13, report: 9, environment: 16, recovery: 14, sensor: 18 };
    return [...available].sort((a, b) => gain[b] / COSTS[b] - gain[a] / COSTS[a] || a.localeCompare(b))[0];
  }
  return sharedAresPolicy.select({ scores: state.scores, tags: state.tags, available });
}

export function runCase(item, variant = 'ares') {
  if (![...POLICIES, ...ABLATIONS].includes(variant)) throw new Error(`Unknown policy: ${variant}`);
  const state = visibleState(item);
  const trace = [{ step: 0, decision: 'CONTINUE', scores: { ...state.scores }, budget: state.budget, resources: { ...state.resources } }];
  while (state.used.length < TESTS.length) {
    const current = status(state, variant);
    if (variant !== 'all' && current !== 'CONTINUE') break;
    const test = choose(state, variant);
    if (!test) break;
    // Sealed oracle: only the requested observation is revealed to the policy.
    const delta = item.outcomes?.[test] || [0, 0, 0, 0];
    state.used.push(test); state.budget -= COSTS[test];
    for (const [resource, cost] of Object.entries(RESOURCE_COSTS[test])) state.resources[resource] -= cost;
    SCORE_KEYS.forEach((key, index) => { state.scores[key] = clamp(state.scores[key] + delta[index]); });
    trace.push({ step: state.used.length, observation: test, observedDelta: [...delta], decision: status(state, variant), scores: { ...state.scores }, budget: state.budget, resources: { ...state.resources } });
  }
  const decision = status(state, variant);
  const output = decision === 'CONTINUE' ? (variant === 'no_unknown' ? leader(state.scores) : 'ABSTAIN') : decision;
  return {
    caseId: item.id, truth: item.truth, policy: variant, output,
    correct: output === item.truth || (item.truth === 'unknown' && output === 'ABSTAIN'), wrongCommitted: output !== 'ABSTAIN' && output !== item.truth,
    falseAbstain: item.truth !== 'unknown' && output === 'ABSTAIN',
    correctUnknownAbstain: item.truth === 'unknown' && output === 'ABSTAIN',
    budgetSpent: 6 - state.budget, timeSpent: (item.resources?.time ?? INITIAL_RESOURCES.time) - state.resources.time,
    resourceViolation: Object.values(state.resources).some((value) => value < 0),
    observations: state.used.length, trace
  };
}

function round(value) { return Number(value.toFixed(2)); }
export function summarize(runs) {
  const count = runs.length;
  const rate = (name) => round(runs.filter((run) => run[name]).length / count * 100);
  const mean = (name) => round(runs.reduce((sum, run) => sum + run[name], 0) / count);
  const known = runs.filter((run) => run.truth !== 'unknown');
  const unknown = runs.filter((run) => run.truth === 'unknown');
  return {
    count, correctPct: rate('correct'), wrongCommittedPct: rate('wrongCommitted'),
    falseAbstainPct: known.length ? round(known.filter((run) => run.falseAbstain).length / known.length * 100) : null,
    correctUnknownAbstainPct: unknown.length ? round(unknown.filter((run) => run.correctUnknownAbstain).length / unknown.length * 100) : null,
    resourceViolationPct: rate('resourceViolation'), meanBudget: mean('budgetSpent'),
    meanTimeMinutes: mean('timeSpent'), meanObservations: mean('observations')
  };
}

export function evaluate(cases) {
  validateCases(cases);
  const variants = [...POLICIES, ...ABLATIONS];
  const runs = Object.fromEntries(variants.map((name) => [name, cases.map((item) => runCase(item, name))]));
  const policies = Object.fromEntries(POLICIES.map((name) => [name, summarize(runs[name])]));
  const ablations = Object.fromEntries(ABLATIONS.map((name) => [name, summarize(runs[name])]));
  const byTruth = Object.fromEntries(SCORE_KEYS.map((truth) => [truth, Object.fromEntries(POLICIES.map((name) => [name, summarize(runs[name].filter((run) => run.truth === truth))]))]));
  return {
    schema: 'ARES-EVAL-1', synthetic: true, caseCount: cases.length, caseIds: cases.map((item) => item.id),
    interpretation: 'Exploratory hand-authored synthetic fixture comparison. Wrong committed class is a proxy error, not a measured unsafe clinical action. No clinical or operational validity is implied.',
    policies, ablations, byTruth,
    pairedRuns: cases.map((item, index) => ({ caseId: item.id, truth: item.truth, results: Object.fromEntries(variants.map((name) => [name, runs[name][index]])) }))
  };
}
