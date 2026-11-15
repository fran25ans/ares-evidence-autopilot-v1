const COSTS = { pvt: 2, report: 1, environment: 1, recovery: 2, sensor: 2 };
const RESOURCE_COSTS = {
  pvt: { time: 3, attention: 2, energy: 1, sensor: 1 },
  report: { time: 1, attention: 1, energy: 0, sensor: 0 },
  environment: { time: 2, attention: 0, energy: 1, sensor: 1 },
  recovery: { time: 20, attention: 0, energy: 1, sensor: 0 },
  sensor: { time: 4, attention: 1, energy: 2, sensor: 1 }
};
const INITIAL_RESOURCES = { time: 25, attention: 10, energy: 8, sensor: 3 };
const AUTHORIZED_MODEL = 'crew-state-0.5.0';
const AUTHORIZED_POLICY = 'ares-policy-0.8.0';
const ALLOWED_TRANSITIONS = ['REVERSIBLE ACTION', 'ESCALATE', 'REASSESS'];

const clone = (value) => JSON.parse(JSON.stringify(value));
const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const hex = (bytes) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function decisionFromState(scores, budget, resources, observations) {
  const leader = ['sleep', 'environment', 'recovery'].sort((a, b) => scores[b] - scores[a])[0];
  const knownValue = scores[leader];
  if (scores.unknown >= 58) return { type: 'ABSTAIN + ESCALATE', reason: 'Known-model residual exceeds the safe action threshold.', leader };
  if (knownValue >= 72 && scores.unknown <= 36) return { type: 'ACT · REVERSIBLE POLICY', reason: 'Evidence crosses the simulated action threshold with bounded model residual.', leader };
  if (budget === 0) return { type: 'ABSTAIN + ESCALATE', reason: 'Evidence budget exhausted without sufficient explanatory fit.', leader };
  const feasible = Object.keys(COSTS).some((test) => !observations.includes(test) && COSTS[test] <= budget && Object.entries(RESOURCE_COSTS[test]).every(([key, value]) => resources[key] >= value));
  if (!feasible) return { type: 'ABSTAIN + ESCALATE', reason: 'Mission resource frontier reached without sufficient explanatory fit.', leader };
  return { type: 'REASSESS', reason: 'More evidence is available and its expected decision-loss reduction exceeds its cost.', leader };
}

async function verify(payload) {
  const { record, publicKeyRaw, chainHead, consumedDecisionIds = [], now } = payload;
  const unsigned = clone(record); delete unsigned.currentHash; delete unsigned.signature;
  const recomputedHash = await sha256(JSON.stringify(unsigned));
  const recomputedEvidenceRoot = await sha256(JSON.stringify(record.ledger));
  let signatureValid = false;
  try {
    const publicKey = await crypto.subtle.importKey('raw', base64ToBytes(publicKeyRaw), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    signatureValid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, base64ToBytes(record.signature), new TextEncoder().encode(recomputedHash));
  } catch {}

  const expectedResources = { ...INITIAL_RESOURCES }; let expectedScalar = 6; let observationsValid = Array.isArray(record.observations);
  for (const test of record.observations || []) {
    if (!Object.hasOwn(COSTS, test)) { observationsValid = false; continue; }
    expectedScalar -= COSTS[test];
    Object.entries(RESOURCE_COSTS[test]).forEach(([key, value]) => { expectedResources[key] -= value; });
  }
  const recordResources = { time: record.budgetAfter?.time, attention: record.budgetAfter?.attention, energy: record.budgetAfter?.energy, sensor: record.budgetAfter?.sensor };
  const currentDecision = decisionFromState(record.scores, record.budgetAfter?.scalar, recordResources, record.observations || []);
  const expectedTransition = currentDecision.type === 'ACT · REVERSIBLE POLICY' ? 'REVERSIBLE ACTION' : currentDecision.type === 'ABSTAIN + ESCALATE' ? 'ESCALATE' : 'REASSESS';
  const expectedAuthority = expectedTransition === 'REVERSIBLE ACTION' ? 'CREW COMMANDER' : expectedTransition === 'ESCALATE' ? 'CMO / FLIGHT SURGEON' : 'NONE';
  const budgetValid = observationsValid && expectedScalar === record.budgetAfter?.scalar && Object.keys(expectedResources).every((key) => expectedResources[key] === record.budgetAfter?.[key] && expectedResources[key] >= 0);
  const freshnessValid = Number.isFinite(record.issuedAt) && Number.isFinite(record.validUntil) && record.issuedAt <= now && now <= record.validUntil;
  const actionBindingValid = record.actionBinding?.decisionId === record.decisionId && record.actionBinding?.transition === record.selectedTransition && record.actionBinding?.authorityRequired === record.authorityRequired;
  const reversibilityValid = record.selectedTransition === 'REVERSIBLE ACTION'
    ? record.reversibility?.class === 'OPERATIONALLY REVERSIBLE' && record.reversibility?.reviewHorizonMinutes === 45 && record.reversibility?.maxPreReviewEffect === 'NON-CRITICAL EVA PREPARATION DEFERRED'
    : record.reversibility?.class === 'OPTION-PRESERVING';

  const domains = [
    {
      label: 'INTEGRITY & FRESHNESS',
      details: [
        ['Record digest', recomputedHash === record.currentHash],
        ['External trust-anchor signature', signatureValid],
        ['Freshness window', freshnessValid],
        ['Replay protection', Boolean(record.decisionId) && !consumedDecisionIds.includes(record.decisionId)]
      ]
    },
    {
      label: 'EVIDENCE & RESOURCES',
      details: [
        ['Evidence root', recomputedEvidenceRoot === record.evidenceRoot],
        ['Observation identifiers', observationsValid],
        ['Resource conservation', budgetValid],
        ['Ledger completeness', Array.isArray(record.ledger) && record.ledger.length === (record.observations?.length || 0) + 1]
      ]
    },
    {
      label: 'POLICY & STOP RULE',
      details: [
        ['Authorized versions', record.modelVersion === AUTHORIZED_MODEL && record.policyVersion === AUTHORIZED_POLICY],
        ['Stop rule reproduced', record.selectedTransition === expectedTransition && record.stopReason === currentDecision.reason],
        ['Chain continuity', record.previousAttestation === chainHead]
      ]
    },
    {
      label: 'ACTION & AUTHORITY BINDING',
      details: [
        ['Allowed transition', ALLOWED_TRANSITIONS.includes(record.selectedTransition)],
        ['Authority declaration', record.authorityRequired === expectedAuthority],
        ['Decision/action binding', actionBindingValid],
        ['Reversibility contract', reversibilityValid]
      ]
    }
  ].map((domain) => ({ ...domain, pass: domain.details.every(([, pass]) => pass) }));

  return { valid: domains.every((domain) => domain.pass), domains, recomputedHash, verifier: 'ares-verifier-worker-1.0.0' };
}

self.addEventListener('message', async (event) => {
  try {
    const result = await verify(event.data);
    self.postMessage({ id: event.data.id, result });
  } catch (error) {
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) });
  }
});
