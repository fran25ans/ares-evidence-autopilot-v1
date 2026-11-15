(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const costs = { pvt: 2, report: 1, environment: 1, recovery: 2, sensor: 2 };
  const initialResources = { time: 25, attention: 10, energy: 8, sensor: 3 };
  const resourceCosts = {
    pvt: { time: 3, attention: 2, energy: 1, sensor: 1 },
    report: { time: 1, attention: 1, energy: 0, sensor: 0 },
    environment: { time: 2, attention: 0, energy: 1, sensor: 1 },
    recovery: { time: 20, attention: 0, energy: 1, sensor: 0 },
    sensor: { time: 4, attention: 1, energy: 2, sensor: 1 }
  };
  const modelVersion = 'crew-state-0.5.0';
  const policyVersion = 'ares-policy-0.8.0';
  let signingKeyPair = null; let signingKeyId = null; let signingPublicKeyRaw = null;
  const verifierWorker = new Worker('verifier-worker.js?v=ares-v02-20261018');
  const verifierRequests = new Map(); let verifierRequestId = 0;
  verifierWorker.addEventListener('message', (event) => {
    const pending = verifierRequests.get(event.data.id); if (!pending) return;
    verifierRequests.delete(event.data.id); event.data.error ? pending.reject(new Error(event.data.error)) : pending.resolve(event.data.result);
  });
  const names = { pvt: 'Vigilance check', report: 'Crew report', environment: 'Environment sweep', recovery: 'Recovery observation', sensor: 'Sensor validation' };
  const scenarios = [
    {
      cause: 'Accumulated sleep restriction', class: 'MODELED · H1', tags: ['sleep-short'], initial: [['Sleep duration', '5 h 11 min', '−24% vs personal baseline'], ['HRV feature', '−2.2 MAD', 'personal deviation'], ['Cabin CO₂', '3.3 mmHg', 'above scenario baseline']], scores: { sleep: 48, environment: 37, recovery: 30, unknown: 28 },
      outcomes: { pvt: ['Latency +21% with 5 lapses', { sleep: 30, environment: -5, recovery: -3, unknown: -8 }], report: ['No headache; concentration difficulty', { sleep: 10, environment: -12, recovery: 2, unknown: -2 }], environment: ['CO₂ elevated; no acute correlation established', { sleep: 1, environment: 8, recovery: 0, unknown: 2 }], recovery: ['Deviation persists after recovery interval', { sleep: 9, environment: -2, recovery: -7, unknown: 0 }], sensor: ['Wearable signal independently confirmed', { sleep: 3, environment: 0, recovery: 0, unknown: -10 }] }
    },
    {
      cause: 'Environmental contribution', class: 'MODELED · H2', tags: ['cabin-rise'], initial: [['Sleep duration', '5 h 42 min', '−14% vs personal baseline'], ['HRV feature', '−1.5 MAD', 'personal deviation'], ['Cabin CO₂', '3.8 mmHg', 'above scenario baseline']], scores: { sleep: 41, environment: 46, recovery: 25, unknown: 26 },
      outcomes: { pvt: ['Response within personal baseline', { sleep: -20, environment: 7, recovery: -2, unknown: 4 }], report: ['Headache reported; onset follows cabin rise', { sleep: -4, environment: 24, recovery: -2, unknown: -5 }], environment: ['Independent cabin sensor confirms sustained elevation', { sleep: -3, environment: 31, recovery: -4, unknown: -9 }], recovery: ['Symptoms persist during passive recovery', { sleep: -2, environment: 9, recovery: -10, unknown: 1 }], sensor: ['Wearable signal independently confirmed', { sleep: 0, environment: 4, recovery: 0, unknown: -8 }] }
    },
    {
      cause: 'Workload / recovery mismatch', class: 'MODELED · H3', tags: ['workload'], initial: [['Sleep duration', '6 h 03 min', '−9% vs personal baseline'], ['HRV feature', '−2.4 MAD', 'personal deviation'], ['Cabin CO₂', '3.1 mmHg', 'within scenario band'], ['Recent task load', 'Extended EVA preparation', 'crew schedule observation']], scores: { sleep: 36, environment: 24, recovery: 47, unknown: 29 },
      outcomes: { pvt: ['Latency +7%; accuracy preserved', { sleep: 4, environment: -5, recovery: 10, unknown: 0 }], report: ['Symptoms began after extended EVA workload', { sleep: 0, environment: -7, recovery: 24, unknown: -4 }], environment: ['Cabin telemetry nominal across redundant sensors', { sleep: 1, environment: -22, recovery: 5, unknown: -2 }], recovery: ['HRV feature moves toward baseline after 20 minutes', { sleep: -4, environment: -2, recovery: 31, unknown: -8 }], sensor: ['Wearable signal independently confirmed', { sleep: 0, environment: 0, recovery: 5, unknown: -9 }] }
    },
    {
      cause: 'Wearable sensor drift', class: 'UNMODELED CONTRIBUTOR', tags: ['sensor-discordance'], initial: [['Sleep duration', '6 h 01 min', '−10% vs personal baseline'], ['HRV feature', '−3.1 MAD', 'abrupt cross-channel deviation'], ['Cabin CO₂', '3.4 mmHg', 'above scenario baseline']], scores: { sleep: 39, environment: 36, recovery: 34, unknown: 31 },
      outcomes: { pvt: ['Response within personal baseline', { sleep: -18, environment: -3, recovery: -4, unknown: 14 }], report: ['No subjective symptoms reported', { sleep: -7, environment: -8, recovery: -6, unknown: 12 }], environment: ['Cabin sensors agree; wearable channels remain discordant', { sleep: -3, environment: -13, recovery: -2, unknown: 22 }], recovery: ['Deviation changes discontinuously without physiologic pattern', { sleep: -5, environment: -3, recovery: -12, unknown: 17 }], sensor: ['Independent reference detects wearable calibration drift', { sleep: -16, environment: -12, recovery: -13, unknown: 44 }] }
    }
  ];

  const lab = { active: false, scenario: null, id: null, budget: 6, resources: { ...initialResources }, scores: {}, used: [], ledger: [], decision: null, attestation: null, verification: null, authority: null, chainHead: 'GENESIS', consumedDecisionIds: [], executed: false, reveal: false, lastIndex: -1 };
  const clamp = (value) => Math.max(0, Math.min(100, value));
  const topKnown = () => ['sleep', 'environment', 'recovery'].sort((a, b) => lab.scores[b] - lab.scores[a])[0];
  const canAffordAt = (test, budget, resources) => costs[test] <= budget && Object.entries(resourceCosts[test]).every(([key, value]) => resources[key] >= value);
  const canAfford = (test) => costs[test] <= lab.budget && Object.entries(resourceCosts[test]).every(([key, value]) => lab.resources[key] >= value);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const measurementSignal = () => {
    const visibleEvidence = [...(lab.scenario?.initial || []).map((item) => item.join(' ')), ...lab.ledger].join(' ').toLowerCase();
    return /cross-channel|discordant|discontinuously|calibration drift|quality loss|timestamp/.test(visibleEvidence);
  };

  function verifyInWorker(record, overrides = {}) {
    return new Promise((resolve, reject) => {
      const id = ++verifierRequestId; verifierRequests.set(id, { resolve, reject });
      verifierWorker.postMessage({ id, record: clone(record), publicKeyRaw: signingPublicKeyRaw, chainHead: lab.chainHead, consumedDecisionIds: lab.consumedDecisionIds, now: Date.now(), ...overrides });
    });
  }

  let labReturnView = 'mission';
  function showLab() { if (window.AresUrgentActive) return false; labReturnView = $('#dailyView')?.hidden ? 'mission' : 'daily'; $('#dailyView').hidden = true; $('#missionView').hidden = true; $('#labView').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' }); return true; }
  function hideLab() { $('#labView').hidden = true; $('#dailyView').hidden = labReturnView !== 'daily'; $('#missionView').hidden = labReturnView !== 'mission'; $('#dailyNav').classList.toggle('active', labReturnView === 'daily'); if (labReturnView === 'daily') $('#dailyNav').setAttribute('aria-current', 'page'); else $('#dailyNav').removeAttribute('aria-current'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function nextScenarioIndex() { const pool = scenarios.map((_, i) => i).filter((i) => i !== lab.lastIndex); return pool[Math.floor(Math.random() * pool.length)]; }

  function generateScenario() {
    if (window.AresUrgentActive) throw new Error('Emergency protocol active; synthetic lab paused');
    $('#certificateModal').hidden = true; document.body.style.overflow = '';
    const index = nextScenarioIndex(); lab.lastIndex = index; lab.active = true; lab.scenario = scenarios[index]; lab.id = `BLIND-${Math.floor(1000 + Math.random() * 9000)}`; lab.budget = 6; lab.resources = { ...initialResources }; lab.scores = { ...lab.scenario.scores }; lab.used = []; lab.ledger = ['Scenario telemetry ingested; hidden cause sealed']; lab.decision = null; lab.attestation = null; lab.verification = null; lab.authority = null; lab.chainHead = 'GENESIS'; lab.executed = false; lab.reveal = false;
    $('#labScenarioId').textContent = lab.id; $('#labScenarioStatus').textContent = 'Cause sealed · open-world evaluation'; $('#labNew span').textContent = 'REGENERATE'; $('#labGrid').classList.remove('lab-idle');
    $('#labInitial').innerHTML = lab.scenario.initial.map(([label, value, note]) => `<div class="lab-observation"><span>${label}<em>OBSERVED</em></span><b>${value}</b><small>${note}</small></div>`).join('');
    updateLab();
  }

  function recommend() {
    const leader = topKnown();
    if (lab.scores.unknown >= 58 || (lab.scores[leader] >= 72 && lab.scores.unknown <= 36) || lab.budget === 0) return null;
    const available = Object.keys(costs).filter((test) => !lab.used.includes(test) && canAfford(test));
    const tags = [...(lab.scenario?.tags || [])];
    if (measurementSignal() && !tags.includes('sensor-discordance')) tags.push('sensor-discordance');
    return window.AresPolicy.select({ scores: lab.scores, tags, available });
  }

  function decisionFromState(scores, budget, resources, observations) {
    const leader = ['sleep', 'environment', 'recovery'].sort((a, b) => scores[b] - scores[a])[0]; const knownValue = scores[leader];
    if (scores.unknown >= 58) return { type: 'ABSTAIN + ESCALATE', class: 'abstain', reason: 'Known-model residual exceeds the safe action threshold.', leader };
    if (knownValue >= 72 && scores.unknown <= 36) return { type: 'ACT · REVERSIBLE POLICY', class: 'act', reason: 'Evidence crosses the simulated action threshold with bounded model residual.', leader };
    if (budget === 0) return { type: 'ABSTAIN + ESCALATE', class: 'abstain', reason: 'Evidence budget exhausted without sufficient explanatory fit.', leader };
    if (!Object.keys(costs).some((test) => !observations.includes(test) && canAffordAt(test, budget, resources))) return { type: 'ABSTAIN + ESCALATE', class: 'abstain', reason: 'Mission resource frontier reached without sufficient explanatory fit.', leader };
    return { type: 'REASSESS', class: 'abstain', reason: 'More evidence is available and its expected decision-loss reduction exceeds its cost.', leader };
  }
  function decisionState() { return decisionFromState(lab.scores, lab.budget, lab.resources, lab.used); }

  function updateLab() {
    ['sleep', 'environment', 'recovery', 'unknown'].forEach((key) => {
      const row = $(`[data-lab-h="${key}"]`); $('u', row).style.width = `${lab.scores[key]}%`; $('strong', row).textContent = lab.scores[key];
    });
    $('#budgetValue').textContent = `${lab.budget} / 6`; $('#budgetBar').style.width = `${(lab.budget / 6) * 100}%`; $('#budgetBar').style.background = lab.budget <= 2 ? 'var(--amber)' : 'var(--lime)';
    const resourceLabels = { time: 'TIME', attention: 'ATTN', energy: 'ENERGY', sensor: 'SENSOR' };
    $('#resourceVector').innerHTML = Object.entries(lab.resources).map(([key, value]) => `<span><b>${resourceLabels[key]}</b><strong>${key === 'time' ? `${value}m` : value}</strong></span>`).join('');
    $('#labLedger').innerHTML = lab.ledger.map((entry) => `<li>${entry}</li>`).join('');
    const recommended = recommend(); const status = decisionState();
    $('#coverageWarning').textContent = lab.scores.unknown >= 42 ? `U_MODEL HIGH · Residual index ${lab.scores.unknown}; known explanations may be insufficient.` : `KNOWN-MODEL FIT ACTIVE · Residual index ${lab.scores.unknown}. Synthetic scale, not confidence.`;
    const measurement = measurementSignal(); const decisionLabel = status.type === 'REASSESS' ? 'OPEN' : status.type.startsWith('ACT') ? 'BOUNDED' : 'INSUFFICIENT';
    const uncertainty = [
      ['U_MODEL', lab.scores.unknown >= 42 ? 'HIGH' : 'BOUNDED', lab.scores.unknown >= 42 ? 'warning' : 'resolved'],
      ['U_MEASUREMENT', measurement ? 'CHECK REQUIRED' : 'QUALIFIED', measurement ? 'warning' : 'resolved'],
      ['U_DECISION', decisionLabel, decisionLabel === 'INSUFFICIENT' ? 'warning' : 'resolved']
    ];
    $('#labUncertainty').innerHTML = uncertainty.map(([label, value, tone]) => `<span class="${tone}"><b>${label}</b><strong>${value}</strong></span>`).join('');
    const policy = $('#policyRecommendation');
    if (recommended) policy.innerHTML = `<span>AUTOPILOT · RECOMMENDED</span><p><b>${names[recommended]}</b><br>${costs[recommended]} budget units · highest discriminative value under current constraints.</p>`;
    else policy.innerHTML = `<span>STOP RULE</span><p><b>${status.type}</b><br>${status.reason}</p>`;
    const stopped = status.type !== 'REASSESS';
    $$('#labTests button').forEach((button) => { const test = button.dataset.labTest; button.disabled = !lab.active || stopped || lab.used.includes(test) || !canAfford(test); button.classList.toggle('recommended', test === recommended); });
    $('#certificateButton').disabled = lab.used.length === 0; $('#certificateButton small').textContent = `${status.type} · ${lab.used.length} evidence actions recorded`;
    updateActionGate();
  }

  function updateActionGate() {
    const gate = $('#actionGate'); const button = $('#gateAction');
    gate.className = 'action-gate';
    if (lab.executed) { gate.classList.add('executed'); $('strong', gate).textContent = 'SIMULATED EXECUTION'; $('small', gate).textContent = 'Verified demo transition appended to the in-memory hash chain'; button.textContent = 'TRANSITION RECORDED'; button.disabled = true; return; }
    if (lab.authority && lab.verification?.valid) { gate.classList.add('unlocked'); $('strong', gate).textContent = 'UNLOCKED · DEMO'; $('small', gate).textContent = `${lab.authority.role} role simulated · attestation ${lab.attestation.currentHash.slice(0, 10)}`; button.textContent = `SIMULATE ${lab.attestation.selectedTransition}`; button.disabled = false; return; }
    if (lab.verification?.valid) { gate.classList.add('verified'); $('strong', gate).textContent = 'VERIFIED'; $('small', gate).textContent = lab.attestation.selectedTransition === 'REASSESS' ? 'No operational transition requested' : `${lab.attestation.authorityRequired} authority still required`; button.textContent = 'AWAITING HUMAN AUTHORITY'; button.disabled = true; return; }
    $('strong', gate).textContent = 'LOCKED'; $('small', gate).textContent = lab.attestation ? 'Attestation not independently verified' : 'No verified attestation'; button.textContent = 'OPERATIONAL ACTION UNAVAILABLE'; button.disabled = true;
  }

  function runObservation(test) {
    if (window.AresUrgentActive) throw new Error('Emergency protocol active; synthetic lab paused');
    if (!lab.active || lab.used.includes(test) || !canAfford(test)) throw new Error('Observation unavailable under current mission resource vector');
    lab.budget -= costs[test]; Object.entries(resourceCosts[test]).forEach(([key, value]) => { lab.resources[key] -= value; }); lab.used.push(test); const [result, deltas] = lab.scenario.outcomes[test];
    Object.entries(deltas).forEach(([key, delta]) => { lab.scores[key] = clamp(lab.scores[key] + delta); });
    lab.ledger.push(`${names[test]} [−${costs[test]} · T${resourceCosts[test].time}/A${resourceCosts[test].attention}/E${resourceCosts[test].energy}/S${resourceCosts[test].sensor}] → ${result}`); lab.attestation = null; lab.verification = null; lab.authority = null; lab.executed = false; updateLab();
    return { test, result, budgetRemaining: lab.budget, resourcesRemaining: clone(lab.resources), unknownCoverage: lab.scores.unknown, recommendation: recommend() };
  }

  async function certificateHash(text) {
    if (crypto?.subtle) { const bytes = new TextEncoder().encode(text); const hash = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
    return 'local-prototype-hash-unavailable';
  }

  const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  async function ensureSigningKey() {
    if (signingKeyPair) return;
    if (!crypto?.subtle) throw new Error('WebCrypto is required for signed attestations');
    signingKeyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKey = await crypto.subtle.exportKey('raw', signingKeyPair.publicKey); signingPublicKeyRaw = bytesToBase64(publicKey);
    signingKeyId = `ARES-DEMO-P256-${(await certificateHash(signingPublicKeyRaw)).slice(0, 16).toUpperCase()}`;
  }
  async function signDigest(digest) {
    await ensureSigningKey();
    return bytesToBase64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKeyPair.privateKey, new TextEncoder().encode(digest)));
  }
  async function verifySignature(signature, digest, keyId) {
    if (!signingKeyPair || keyId !== signingKeyId) return false;
    try { return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signingKeyPair.publicKey, base64ToBytes(signature), new TextEncoder().encode(digest)); } catch { return false; }
  }

  async function issueCertificate() {
    if (window.AresUrgentActive) throw new Error('Emergency protocol active; synthetic lab paused');
    if (!lab.active || !lab.used.length) throw new Error('At least one evidence action is required');
    await ensureSigningKey();
    lab.decision = decisionState(); const leaderLabels = { sleep: 'Accumulated sleep restriction', environment: 'Environmental contribution', recovery: 'Workload / recovery mismatch' };
    const transition = lab.decision.type === 'ACT · REVERSIBLE POLICY' ? 'REVERSIBLE ACTION' : lab.decision.type === 'ABSTAIN + ESCALATE' ? 'ESCALATE' : 'REASSESS';
    const authorityRequired = transition === 'REVERSIBLE ACTION' ? 'CREW COMMANDER' : transition === 'ESCALATE' ? 'CMO / FLIGHT SURGEON' : 'NONE';
    const evidenceRoot = await certificateHash(JSON.stringify(lab.ledger));
    const record = {
      schema: 'ARES-EDA-1', event: lab.id, revision: lab.used.length + 1, modelVersion, policyVersion,
      evidenceRoot, scores: clone(lab.scores), ledger: clone(lab.ledger), observations: clone(lab.used),
      budgetBefore: { scalar: 6, ...initialResources }, budgetAfter: { scalar: lab.budget, ...lab.resources },
      optionsEvaluated: Object.keys(costs).map((id) => ({ id, acquired: lab.used.includes(id), scalarCost: costs[id], resourceCost: resourceCosts[id] })),
      decisionId: `${lab.id}-R${lab.used.length + 1}`, issuedAt: Date.now(), validUntil: Date.now() + 60 * 60 * 1000,
      selectedTransition: transition, stopReason: lab.decision.reason, authorityRequired, signingKeyId,
      actionBinding: { decisionId: `${lab.id}-R${lab.used.length + 1}`, transition, authorityRequired },
      whyAcquired: 'The adaptive policy selected each observation for discriminative value under the remaining mission resource vector.',
      whatRemainedUnknown: `Known-model residual index ${lab.scores.unknown}; synthetic score, not a clinical probability.`,
      whatWouldChangeDecision: transition === 'REVERSIBLE ACTION' ? 'Contradictory performance evidence or a model-residual index above the action threshold would revoke this transition.' : 'Additional independently qualified evidence that reduces model residual could trigger reassessment.',
      reversibility: transition === 'REVERSIBLE ACTION' ? { class: 'OPERATIONALLY REVERSIBLE', reviewHorizonMinutes: 45, maxPreReviewEffect: 'NON-CRITICAL EVA PREPARATION DEFERRED' } : { class: 'OPTION-PRESERVING', reviewHorizonMinutes: null, maxPreReviewEffect: 'NO DIAGNOSIS OR TREATMENT ASSERTED' },
      previousAttestation: lab.chainHead, limitations: 'Synthetic decision support; not a diagnosis or clinical probability.'
    };
    record.currentHash = await certificateHash(JSON.stringify(record)); record.signature = await signDigest(record.currentHash); lab.attestation = record; lab.verification = null; lab.authority = null; lab.executed = false;
    $('#certificateContent').innerHTML = `<div class="attestation-banner"><span>ARES-EDA-1 · SIGNED EPISTEMIC HANDOFF</span><b>${transition}</b><small>No valid attestation = no operational action</small></div><div class="certificate-grid"><div class="certificate-field"><span>EVENT / DECISION ID</span><b>${lab.id}<br>${record.decisionId}</b></div><div class="certificate-field"><span>PROPOSED TRANSITION</span><b class="${lab.decision.class}">${transition}</b></div><div class="certificate-field"><span>MODEL / POLICY</span><b>${modelVersion}<br>${policyVersion}</b></div><div class="certificate-field"><span>REQUIRED AUTHORITY</span><b>${authorityRequired}</b></div><div class="certificate-field"><span>LEADING MODELED EXPLANATION</span><b>${leaderLabels[lab.decision.leader]} · support index ${lab.scores[lab.decision.leader]}</b></div><div class="certificate-field"><span>U_MODEL RESIDUAL</span><b>Synthetic index ${lab.scores.unknown}</b></div><div class="certificate-field wide"><span>MISSION RESOURCES AFTER ACQUISITION</span><p>Scalar ${lab.budget}/6 · Time ${lab.resources.time}m · Attention ${lab.resources.attention} · Energy ${lab.resources.energy} · Sensor cycles ${lab.resources.sensor}</p></div><div class="certificate-field wide"><span>WHY ACQUISITION STOPPED</span><p>${lab.decision.reason}</p></div><div class="certificate-field wide"><span>WHAT WOULD CHANGE THE DECISION</span><p>${record.whatWouldChangeDecision}</p></div><div class="certificate-field wide"><span>REVERSIBILITY CONTRACT</span><p>${record.reversibility.class} · Review ${record.reversibility.reviewHorizonMinutes ?? 'at next authority contact'}${record.reversibility.reviewHorizonMinutes ? ' min' : ''} · Maximum pre-review effect: ${record.reversibility.maxPreReviewEffect}</p></div><div class="certificate-field wide"><span>OBSERVATIONS ACQUIRED</span><p>${lab.ledger.slice(1).join('<br>')}</p></div></div><div class="trust-root"><span>EXTERNAL VERIFIER TRUST ANCHOR · PROTOTYPE</span><b>${record.signingKeyId}</b><small>ECDSA P-256 protects integrity and provenance; correctness is recomputed separately.</small></div><div class="hash-chain"><span>PREVIOUS · ${record.previousAttestation}</span><span>EVIDENCE ROOT · ${record.evidenceRoot}</span><strong>CURRENT · ${record.currentHash}</strong><span>SIGNATURE · ${record.signature}</span></div><div class="verifier-panel" id="verifierPanel"><span>ISOLATED VERIFIER WORKER</span><p>Not run. The worker receives only ARES-EDA-1 plus an external trust anchor; the action gate remains locked.</p></div><div id="causeReveal"></div>`;
    $('#verifyAttestation').disabled = false; $('#verifyAttestation').textContent = 'RUN ISOLATED VERIFIER'; $('#tamperTest').disabled = true; $('#tamperTest').textContent = 'RUN FAULT-INJECTION SUITE'; $('#approveTransition').disabled = true; $('#approveTransition').textContent = 'AUTHORITY LOCKED'; updateActionGate();
    $('#revealCause').textContent = 'Reveal hidden cause'; $('#revealCause').disabled = false; $('#certificateModal').hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('.close', $('#certificateModal'))?.focus(), 10);
    return { event: lab.id, transition, authorityRequired, leader: lab.decision.leader, unknownCoverage: lab.scores.unknown, budgetRemaining: lab.budget, resourcesRemaining: clone(lab.resources), hash: record.currentHash, verified: false, actionGate: 'LOCKED' };
  }

  async function verifyRecord(record = lab.attestation) {
    if (!record) throw new Error('Build an attestation first');
    return verifyInWorker(record);
  }

  function renderVerification(result, mode = 'verify') {
    const panel = $('#verifierPanel');
    panel.className = `verifier-panel ${result.valid ? 'pass' : 'fail'}`;
    panel.innerHTML = `<span>${mode === 'verify' ? 'ISOLATED SEMANTIC VERIFIER' : 'FAULT-INJECTION RESULT'} · ${result.valid ? 'PASS' : 'REJECTED'}</span><p>${mode === 'verify' ? `${result.verifier} recomputed the signed decision without access to autopilot state.` : 'The injected record was blocked before authority or execution.'}</p><div>${result.domains.map((domain) => `<p class="verify-row ${domain.pass ? 'pass' : 'fail'}"><b>${domain.pass ? '✓' : '×'}</b>${domain.label}<strong>${domain.pass ? 'PASS' : 'FAIL'}</strong></p>`).join('')}</div><small>Expand the exported record for sub-check evidence. A valid signature alone cannot produce VERIFIED.</small>`;
  }

  async function verifyAttestation() {
    const result = await verifyRecord(); lab.verification = result; lab.authority = null; renderVerification(result); $('#tamperTest').disabled = !result.valid;
    const actionable = lab.attestation.selectedTransition !== 'REASSESS';
    $('#approveTransition').disabled = !result.valid || !actionable; $('#approveTransition').textContent = result.valid ? (actionable ? `SIMULATE ${lab.attestation.authorityRequired} APPROVAL` : 'NO AUTHORITY NEEDED · REASSESS') : 'AUTHORITY LOCKED';
    $('#verifyAttestation').textContent = result.valid ? 'VERIFIER PASSED' : 'VERIFIER REJECTED'; updateActionGate();
    return { valid: result.valid, domains: Object.fromEntries(result.domains.map((domain) => [domain.label, domain.pass])), actionGate: result.valid ? 'VERIFIED · AUTHORITY REQUIRED' : 'LOCKED' };
  }

  async function resignRecord(record) {
    const unsigned = clone(record); delete unsigned.currentHash; delete unsigned.signature;
    record.currentHash = await certificateHash(JSON.stringify(unsigned)); record.signature = await signDigest(record.currentHash); return record;
  }

  async function runTamperTest() {
    if (!lab.attestation) throw new Error('Build an attestation first');
    const cases = [
      ['INVALID SIGNATURE', async () => { const record = clone(lab.attestation); record.budgetAfter.time += 1; return { record }; }],
      ['SIGNED RESOURCE INCONSISTENCY', async () => { const record = clone(lab.attestation); record.budgetAfter.time += 1; return { record: await resignRecord(record) }; }],
      ['STALE SIGNED RECORD', async () => { const record = clone(lab.attestation); record.validUntil = record.issuedAt - 1; return { record: await resignRecord(record), overrides: { now: record.issuedAt + 1 } }; }],
      ['UNAUTHORIZED POLICY VERSION', async () => { const record = clone(lab.attestation); record.policyVersion = 'ares-policy-retired'; return { record: await resignRecord(record) }; }],
      ['ACTION / AUTHORITY MISMATCH', async () => { const record = clone(lab.attestation); record.authorityRequired = 'AUTOPILOT'; record.actionBinding.authorityRequired = 'AUTOPILOT'; return { record: await resignRecord(record) }; }],
      ['REPLAYED DECISION ID', async () => ({ record: clone(lab.attestation), overrides: { consumedDecisionIds: [lab.attestation.decisionId] } })]
    ];
    const results = [];
    for (const [label, build] of cases) { const { record, overrides = {} } = await build(); const result = await verifyInWorker(record, overrides); results.push({ label, rejected: !result.valid, failed: result.domains.filter((domain) => !domain.pass).map((domain) => domain.label) }); }
    const allRejected = results.every((item) => item.rejected); const panel = $('#verifierPanel'); panel.className = `verifier-panel ${allRejected ? 'pass' : 'fail'}`;
    panel.innerHTML = `<span>FAULT-INJECTION SUITE · ${allRejected ? '6 / 6 BLOCKED' : 'FAILURE DETECTED'}</span><p>Includes validly signed but semantically false records—not only broken signatures.</p><div class="fault-grid">${results.map((item) => `<p class="verify-row ${item.rejected ? 'pass' : 'fail'}"><b>${item.rejected ? '✓' : '×'}</b>${item.label}<strong>${item.rejected ? 'BLOCKED' : 'MISSED'}</strong></p>`).join('')}</div><small>${allRejected ? 'All defined faults failed safe. This is test-suite coverage, not a claim of absolute security.' : 'At least one injected fault escaped the verifier.'}</small>`;
    $('#tamperTest').textContent = allRejected ? '6 / 6 FAULTS BLOCKED' : 'FAULT SUITE FAILED';
    return { trials: results.length, allRejected, results };
  }

  function approveTransition() {
    if (!lab.verification?.valid || !lab.attestation || lab.attestation.selectedTransition === 'REASSESS') throw new Error('A verified actionable attestation is required');
    lab.authority = { role: lab.attestation.authorityRequired, granted: true, simulated: true }; $('#approveTransition').textContent = 'SIMULATED ROLE APPROVED'; $('#approveTransition').disabled = true; updateActionGate();
  }

  async function executeTransition() {
    if (lab.executing || !lab.attestation || !lab.authority) return { executed: false, reason: 'Action gate locked' };
    lab.executing = true; $('#gateAction').disabled = true;
    try {
      const record = lab.attestation;
      // The cached UI badge is never sufficient: re-run the isolated verifier at execution time.
      const freshVerification = await verifyRecord(record);
      const allowed = record === lab.attestation && window.AresActionGate.canExecute({ record, verification: freshVerification, authority: lab.authority, now: Date.now(), consumedDecisionIds: lab.consumedDecisionIds, expectedChainHead: lab.chainHead });
      if (!allowed) {
        lab.verification = null; lab.authority = null; renderVerification(freshVerification);
        return { executed: false, reason: 'Fresh verification or authority failed' };
      }
      lab.verification = freshVerification; lab.executed = true; lab.consumedDecisionIds.push(record.decisionId); lab.chainHead = record.currentHash;
      lab.ledger.push(`${record.selectedTransition} simulated under ${lab.authority.role} role · attestation ${record.currentHash.slice(0, 12)}`);
      $('#labLedger').innerHTML = lab.ledger.map((entry) => `<li>${entry}</li>`).join('');
      window.AresDemoSession.addReceipt({ kind: 'lab', event: lab.id, transition: record.selectedTransition, hash: record.currentHash, at: Date.now() }); renderLabSessionReceipt();
      return { executed: true, decisionId: record.decisionId };
    } catch (error) {
      lab.verification = null; lab.authority = null;
      const panel = $('#verifierPanel'); panel.className = 'verifier-panel fail'; panel.innerHTML = '<span>ACTION GATE · REJECTED</span><p>Verification could not complete. No transition was executed.</p>';
      return { executed: false, reason: error instanceof Error ? error.message : String(error) };
    } finally { lab.executing = false; updateActionGate(); }
  }

  function exportAttestation() {
    if (!lab.attestation) throw new Error('Build an attestation first');
    const artifact = { ...lab.attestation, verification: lab.verification ? { valid: lab.verification.valid, verifier: lab.verification.verifier, domains: lab.verification.domains } : { valid: false, reason: 'not run' }, authority: lab.authority, executed: lab.executed };
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${lab.id}-ARES-EDA-1.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function revealCause() { if (!lab.scenario) return; lab.reveal = true; $('#causeReveal').innerHTML = `<div class="cause-reveal">SEALED CAUSE REVEALED · ${lab.scenario.class} · ${lab.scenario.cause}</div>`; $('#revealCause').textContent = 'Cause revealed'; $('#revealCause').disabled = true; }

  function renderLabSessionReceipt() {
    const receipt = window.AresDemoSession.read().receipts.filter((item) => item?.kind === 'lab').at(-1);
    const panel = $('#labSessionReceipt'); panel.hidden = !receipt;
    if (receipt) panel.textContent = `TAB-SESSION HISTORY · ${receipt.transition} · ${receipt.event} · attestation ${String(receipt.hash).slice(0, 12)} · ${new Date(receipt.at).toLocaleString()}. Read-only reminder; stored browser data is not a trusted verifier anchor. Fresh Action Gate starts locked after reload.`;
  }
  renderLabSessionReceipt();


  const runBenchmark = () => window.AresBenchmarkUI.run();
  $('#labLaunch').addEventListener('click', showLab); $('#labBack').addEventListener('click', hideLab); $('#labNew').addEventListener('click', generateScenario); $('#benchmarkLaunch').addEventListener('click', runBenchmark);
  $$('#labTests button').forEach((button) => button.addEventListener('click', () => runObservation(button.dataset.labTest)));
  $('#certificateButton').addEventListener('click', issueCertificate); $('#revealCause').addEventListener('click', revealCause);
  $('#verifyAttestation').addEventListener('click', verifyAttestation); $('#tamperTest').addEventListener('click', runTamperTest); $('#approveTransition').addEventListener('click', approveTransition); $('#gateAction').addEventListener('click', executeTransition); $('#exportAttestation').addEventListener('click', exportAttestation);
  $('#newFromCertificate').addEventListener('click', () => { $('#certificateModal').hidden = true; document.body.style.overflow = ''; generateScenario(); });

  const context = document.modelContext;
  if (context?.registerTool) {
    const register = (tool) => { try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch {} };
    register({ name: 'generate_blind_ares_scenario', title: 'Generate blind ARES scenario', description: 'Start a new hidden-cause scenario in the visible ARES Scenario Lab.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { showLab(); generateScenario(); return { scenarioId: lab.id, budget: lab.budget, causeHidden: true }; } });
    register({ name: 'read_ares_lab_state', title: 'Read ARES lab state', description: 'Read the current blind scenario scores, mission resource vector, ledger, recommendation, and action-gate state without revealing the hidden cause.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ active: lab.active, scenarioId: lab.id, budget: lab.budget, resources: clone(lab.resources), scores: lab.scores, usedObservations: lab.used, recommendation: recommend(), attestationBuilt: Boolean(lab.attestation), verified: Boolean(lab.verification?.valid), authorityGranted: Boolean(lab.authority), actionGate: lab.executed ? 'EXECUTED' : lab.authority ? 'UNLOCKED' : lab.verification?.valid ? 'VERIFIED' : 'LOCKED', causeHidden: !lab.reveal }) });
    register({ name: 'run_ares_lab_observation', title: 'Run ARES lab observation', description: 'Spend evidence budget on one available observation in the active blind scenario.', inputSchema: { type: 'object', properties: { observation: { type: 'string', enum: ['pvt', 'report', 'environment', 'recovery', 'sensor'] } }, required: ['observation'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { if (!Object.hasOwn(costs, input?.observation)) throw new Error('Unsupported observation'); return runObservation(input.observation); } });
    register({ name: 'build_ares_decision_attestation', title: 'Build ARES decision attestation', description: 'Build a hash-chained Epistemic Decision Attestation. This does not unlock operational action.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: issueCertificate });
    register({ name: 'verify_ares_decision_attestation', title: 'Verify ARES decision attestation', description: 'Independently reproduce integrity, budget, policy, stop-rule and chain checks. Human authority is still required after a pass.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: verifyAttestation });
    register({ name: 'read_ares_reproducible_evaluation', title: 'Read ARES reproducible evaluation', description: 'Display the published ARES-EVAL-1 report for 20 hand-authored synthetic cases, including paired traces and calculated ablations.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: runBenchmark });
  }
})();
