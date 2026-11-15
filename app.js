const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = { option: 'pvt', outcome: null, resultKind: null, revision: 1, timers: [], missionGate: 'locked' };
const details = {
  sleep: { title: 'Sleep duration', role: 'Observed variable', value: '5 h 18 min', source: 'SYNTHETIC MISSION REPLAY', basis: 'NASA HERA sleep-performance research', used: 'Difference from Morgan’s 21-day personal baseline', not: 'Clinical diagnosis' },
  co2: { title: 'Cabin CO₂', role: 'Environmental context', value: '3.4 mmHg', source: 'SYNTHETIC MISSION REPLAY', basis: 'Spacecraft environmental monitoring literature', used: 'Environmental-contribution hypothesis', not: 'Causal cognitive prediction' },
  hrv: { title: 'HRV-derived feature', role: 'Physiological state signal', value: '−2.1 robust deviations', source: 'ARES MODEL OUTPUT', basis: 'Morgan’s 21-day operational baseline', used: 'Unexplained deviation detection', not: 'Disease or autonomic dysfunction' },
  'sleep-h': { title: 'Accumulated sleep restriction', role: 'Operational explanation · H1', value: 'Evidence support: HIGH', source: 'LITERATURE-DERIVED RELATION', basis: 'Sleep restriction ↔ vigilance performance', used: 'Competing explanation in this event', not: 'Diagnosis or clinical probability' },
  environment: { title: 'Environmental contribution', role: 'Operational explanation · H2', value: 'Evidence support: MODERATE', source: 'LITERATURE-DERIVED RELATION', basis: 'Cabin environment monitored as mission context', used: 'Competing explanation in this event', not: 'Established cause' },
  recovery: { title: 'Workload / recovery mismatch', role: 'Operational explanation · H3', value: 'Evidence support: LOW', source: 'SYNTHETIC SCENARIO MODEL', basis: 'Post-EVA recovery interval', used: 'Competing explanation in this event', not: 'Validated medical model' },
  unknown: { title: 'Known-model residual', role: 'Model insufficiency safeguard · U_MODEL', value: 'Residual: PRESENT', source: 'ARES MODEL OUTPUT', basis: 'Observations not fully covered by known explanations', used: 'Prevents forced selection from a closed catalog', not: 'A diagnosis, sensor-fault probability or clinical probability' }
};
const optionCopy = {
  pvt: ['Its possible outcomes separate the leading explanations more than the alternatives in the current scenario model.', 'Vigilance check'],
  symptom: ['A symptom report is faster, but its expected ability to discriminate between the leading explanations is lower.', 'Symptom check'],
  observe: ['Passive observation adds no crew burden, but delays resolution during a scheduled high-attention work block.', 'Passive recovery']
};

function selectOption(name) {
  state.option = name;
  $$('.test-option').forEach((button) => {
    const selected = button.dataset.option === name;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
  $('#whyText').textContent = optionCopy[name][0];
  $('#approveButton span').textContent = name === 'pvt' ? 'APPROVE OBSERVATION' : `APPROVE ${optionCopy[name][1].toUpperCase()}`;
}
function openModal(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('.close', $(id))?.focus(), 10); }
function closeOverlays() { $$('.modal').forEach((modal) => { modal.hidden = true; }); $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
function setTimeline(step) { $$('.timeline span').forEach((item, index) => { item.classList.toggle('done', index < step); item.classList.toggle('active', index === step); }); }
function schedule(callback, delay) { const timer = setTimeout(callback, delay); state.timers.push(timer); return timer; }
function clearSequence() { state.timers.forEach(clearTimeout); state.timers = []; }
function animateNumber(element, from, to, suffix = '') {
  const start = performance.now(); const duration = 720;
  const tick = (now) => { const progress = Math.min(1, (now - start) / duration); const eased = 1 - ((1 - progress) ** 3); element.textContent = `${Math.round(from + (to - from) * eased)}${suffix}`; if (progress < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function setHypothesis(key, value) { $(`#${key}Meter`).style.setProperty('--w', `${value}%`); animateNumber($(`#${key}Value`), Number($(`#${key}Value`).textContent) || value, value); }
function renderGateChecks(status = 'pass') {
  const labels = ['Integrity & freshness', 'Evidence & resources', 'Policy & stop rule', 'Action & authority binding'];
  $('#gateChecks').innerHTML = labels.map((label, index) => `<div class="${status === 'fail' && [0, 1].includes(index) ? 'fail' : 'pass'}"><span>${label}</span><b>${status === 'fail' && [0, 1].includes(index) ? 'FAIL' : 'PASS'}</b></div>`).join('');
}
function setGateProgress(step) { $$('#gateProgress span').forEach((item, index) => { item.classList.toggle('done', index < step); item.classList.toggle('active', index === step); item.classList.toggle('failed', step === 0 && state.missionGate === 'tampered' && index === 0); }); }
function setSensorIntegrity(mode = 'nominal') {
  const sensor = $('#sensorIntegrity');
  sensor.classList.toggle('review', mode === 'review');
  $('#sensorIntegrityState').textContent = mode === 'review' ? 'DISCORDANCE DETECTED · VALIDATION REQUIRED' : 'NO FAULT INDICATORS · CROSS-CHECK AVAILABLE';
}
function setUncertaintyVector({ model, measurement, decision }) {
  const values = { uModel: model, uMeasurement: measurement, uDecision: decision };
  Object.entries(values).forEach(([id, value]) => { const node = $(`#${id}`); $('strong', node).textContent = value.label; $('small', node).textContent = value.note; node.className = value.tone || ''; });
}
function setEarthHandover(mode = 'queued') {
  const handover = $('#earthHandover');
  handover.hidden = false;
  handover.classList.toggle('held', mode === 'held');
  $('#earthHandoverState').textContent = mode === 'held' ? 'SIMULATED HOLD · PROOF REJECTED' : 'SIMULATED QUEUE · RTT 41:12';
  $('#earthHandoverCopy').textContent = mode === 'held' ? 'TAMPERED REPLAY RECORD NOT SENT · REBUILD REQUIRED' : 'ILLUSTRATIVE ONBOARD DECISION · NO MESSAGE SENT TO EARTH';
}
function renderMissionSessionReceipt() {
  const receipt = window.AresDemoSession.read().receipts.filter((item) => item?.kind === 'mission').at(-1);
  const panel = $('#missionSessionReceipt');
  panel.hidden = !receipt;
  if (!receipt) return;
  panel.textContent = `TAB-SESSION HISTORY · ${receipt.transition} recorded at ${new Date(receipt.at).toLocaleString()} · replay ${receipt.event}. Read-only reminder after reload; not a verified operational record. Action Gate starts locked.`;
}

function prepareResult({ title, banner, tone, body, coverage, unknown, ledger, kind }) {
  state.resultKind = kind; state.revision += 1;
  $('#resultTitle').textContent = title; $('#resultBanner').className = `result-banner ${tone}`; $('#resultBanner').textContent = banner; $('#resultBody').innerHTML = body;
  $('#coverageBar').style.width = `${coverage}%`; $('#coverageText').textContent = coverage; $('#unknownLevel').textContent = unknown; $('#ledgerCount').textContent = ledger;
  $('#auditStamp').textContent = `MRG-184-07 · evidence revision ${String(state.revision).padStart(2, '0')}`;
  setTimeline(5); openModal('#resultModal');
}

function renderSecondaryObservation(kind) {
  const stage = $('#mapStage'); stage.classList.remove('updated', 'contradicted', 'flash'); void stage.offsetWidth; stage.classList.add('flash');
  if (kind === 'symptom') {
    prepareResult({ kind: 'secondary', title: 'Crew report added to the map.', banner: 'NEW EVIDENCE · No headache · Mild concentration difficulty', tone: 'supported', coverage: 69, unknown: '33', ledger: '4 observations · 1 active gap', body: '<p>The report weakens a simple CO₂-headache explanation, but it does not discriminate strongly enough between accumulated sleep restriction and recovery mismatch.</p><ul><li><strong>Environmental contribution:</strong> conflict added</li><li><strong>Sleep restriction:</strong> remains possible</li><li><strong>U_MODEL:</strong> residual remains present</li></ul><p><strong>ARES recommendation</strong><br>Proceed with the 3-minute vigilance check. It remains the highest-value available observation.</p>' });
  } else {
    prepareResult({ kind: 'secondary', title: 'Recovery interval observed.', banner: 'NEW EVIDENCE · Deviation persists after 20 minutes', tone: 'supported', coverage: 67, unknown: '35', ledger: '4 observations · 1 active gap', body: '<p>Persistence reduces the likelihood of a brief transient deviation, but does not isolate the leading explanation.</p><ul><li><strong>Recovery mismatch:</strong> conflict added</li><li><strong>Sleep restriction:</strong> remains possible</li><li><strong>U_MODEL:</strong> residual remains present</li></ul><p><strong>ARES recommendation</strong><br>Proceed with the 3-minute vigilance check before issuing an operational conclusion.</p>' });
  }
  $('#alternateButton').textContent = 'Continue with recommended PVT';
}

function renderOutcome(outcome) {
  if (window.AresUrgentActive) throw new Error('Emergency protocol active; synthetic replay paused');
  clearSequence(); state.outcome = outcome; state.resultKind = 'pvt'; state.revision += 1; state.missionGate = 'locked';
  $('#testModal').hidden = true; document.body.style.overflow = ''; $('#approveButton').disabled = true;
  const process = $('#evidenceProcess'); process.hidden = false; process.className = 'evidence-process acquiring';
  $('#processStep').textContent = 'ACQUIRING EVIDENCE'; $('#processValue').textContent = 'VIGILANCE TEST RUNNING…'; setTimeline(3);
  schedule(() => { process.className = 'evidence-process received'; $('#processStep').textContent = 'NEW EVIDENCE RECEIVED'; $('#processValue').textContent = outcome === 'slowed' ? 'PVT LATENCY +18% VS PERSONAL BASELINE' : 'PVT RESPONSE WITHIN PERSONAL BASELINE'; }, 650);
  schedule(() => {
    const stage = $('#mapStage'); stage.classList.remove('updated', 'contradicted', 'coverage-degrading', 'flash'); void stage.offsetWidth; stage.classList.add(outcome === 'slowed' ? 'updated' : 'contradicted', 'flash');
    $('#pvtEvidenceNode').classList.add('acquired'); $('#pvtEvidenceNode span').textContent = outcome === 'slowed' ? 'PVT latency +18%' : 'PVT latency ±2%'; $('#pvtEvidenceNode small').textContent = 'Observed · personal baseline comparison'; $('#evidenceColumnLabel').textContent = 'EVIDENCE STATUS';
    if (outcome === 'slowed') { setSensorIntegrity('nominal'); setUncertaintyVector({ model: { label: 'REDUCED', note: 'Known explanation fits better', tone: 'resolved' }, measurement: { label: 'QUALIFIED', note: 'No fault indicators', tone: 'resolved' }, decision: { label: 'BOUNDED', note: 'Reversible policy available', tone: 'resolved' } }); $('[data-detail="sleep-h"]').classList.add('active'); setHypothesis('h1', 92); setHypothesis('h2', 31); setHypothesis('h3', 12); $('#unknownMeter').style.setProperty('--w', '22%'); animateNumber($('#unknownLevel'), 36, 22); animateNumber($('#coverageText'), 64, 81); $('#coverageBar').style.width = '81%'; $('#ledgerCount').textContent = '4 observations · known-model residual reduced'; }
    else { setSensorIntegrity('nominal'); setUncertaintyVector({ model: { label: 'HIGH', note: 'Known explanations insufficient', tone: 'warning' }, measurement: { label: 'QUALIFIED', note: 'No sensor fault evidence', tone: 'resolved' }, decision: { label: 'INSUFFICIENT', note: 'Abstention required', tone: 'warning' } }); stage.classList.add('coverage-degrading'); $('[data-detail="sleep-h"]').classList.remove('active'); setHypothesis('h1', 24); setHypothesis('h2', 28); setHypothesis('h3', 18); $('#unknownMeter').style.setProperty('--w', '74%'); animateNumber($('#unknownLevel'), 36, 74); animateNumber($('#coverageText'), 64, 41); $('#coverageBar').style.width = '41%'; $('#ledgerCount').textContent = '4 observations · known-model residual high'; }
    setTimeline(4); process.className = 'evidence-process evaluating'; $('#processStep').textContent = outcome === 'slowed' ? 'EVIDENCE MAP UPDATED' : 'KNOWN-MODEL FIT DEGRADING'; $('#processValue').textContent = 'POLICY RE-EVALUATING…';
  }, 1150);
  schedule(() => showMissionDecision(outcome), 2250);
}

function showMissionDecision(outcome) {
  $('#evidenceProcess').hidden = true; $('.autopilot').classList.add('decision-mode'); $('#missionDecision').hidden = false; $('#approveButton').hidden = true; state.missionGate = 'verified';
  const abstain = outcome === 'normal'; $('#missionDecision').classList.toggle('abstain', abstain);
  $('#missionDecisionTitle').textContent = abstain ? 'I DON’T KNOW · ABSTAIN + ESCALATE' : 'ACT · REVERSIBLE POLICY';
  $('#missionDecisionCopy').textContent = abstain ? 'Known explanations no longer cover the evidence. Measurement integrity remains qualified; ARES refuses to force a cause and proposes escalation.' : 'Postpone non-critical EVA preparation, begin a short recovery interval and reassess readiness in 45 minutes.';
  $('#reversibilityClass').textContent = abstain ? 'OPTION-PRESERVING ESCALATION' : 'OPERATIONALLY REVERSIBLE'; $('#reversibilityTime').textContent = abstain ? 'NEXT AUTHORITY CONTACT' : '45 MIN'; $('#reversibilityEffect').textContent = abstain ? 'NO DIAGNOSIS OR TREATMENT ASSERTED' : 'NON-CRITICAL EVA PREP DEFERRED';
  $('.status-pill').textContent = 'POLICY RE-EVALUATED'; renderGateChecks(); $('#gateState').textContent = 'DEMO VERIFIED · LOCKED'; $('#authorityRole').textContent = abstain ? 'CMO / Flight Surgeon role required' : 'Crew Commander role required'; $('#authorityState b').textContent = 'PENDING';
  $('#missionAuthorize').textContent = abstain ? 'SIMULATE CMO APPROVAL' : 'SIMULATE CREW COMMANDER APPROVAL'; $('#missionAuthorize').disabled = false; $('#missionExecute').disabled = true; $('#missionExecute').textContent = abstain ? 'ESCALATION UNAVAILABLE' : 'OPERATIONAL ACTION UNAVAILABLE'; $('#missionTamper').disabled = true; $('#earthHandover').hidden = true; $('#tamperImpact').hidden = true; setGateProgress(1); setTimeline(5);
  $('#missionDecision').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetReplay() {
  clearSequence(); Object.assign(state, { option: 'pvt', outcome: null, resultKind: null, revision: 1, missionGate: 'locked' }); closeOverlays(); selectOption('pvt');
  $('#evidenceProcess').hidden = true; $('.autopilot').classList.remove('decision-mode'); $('#missionDecision').hidden = true; $('#approveButton').hidden = false; $('#approveButton').disabled = false; $('.status-pill').textContent = 'AUTOPILOT READY'; $('#authorityState').classList.remove('approved'); $('#missionGate').classList.remove('executed', 'rejected'); setSensorIntegrity('nominal'); $('#earthHandover').hidden = true; $('#earthHandover').classList.remove('held');
  $('#mapStage').classList.remove('updated', 'contradicted', 'coverage-degrading', 'flash'); $('[data-detail="sleep-h"]').classList.add('active'); $('#coverageBar').style.width = '64%'; $('#coverageText').textContent = '64'; $('#unknownMeter').style.setProperty('--w', '36%'); $('#unknownLevel').textContent = '36'; setUncertaintyVector({ model: { label: 'PRESENT', note: 'Known explanations incomplete' }, measurement: { label: 'QUALIFIED', note: 'No sensor fault indicators', tone: 'resolved' }, decision: { label: 'OPEN', note: 'More evidence has value' } }); [['h1', 78], ['h2', 52], ['h3', 31]].forEach(([key, value]) => { $(`#${key}Meter`).style.setProperty('--w', `${value}%`); $(`#${key}Value`).textContent = value; }); $('#pvtEvidenceNode').classList.remove('acquired'); $('#pvtEvidenceNode span').textContent = 'Vigilance result'; $('#pvtEvidenceNode small').textContent = 'Available · 3 min'; $('#evidenceColumnLabel').textContent = 'MISSING EVIDENCE'; $('#ledgerCount').textContent = '3 observations · 1 active gap'; setTimeline(2); $('#resetButton').blur();
}
function authorizeMissionTransition() {
  if (state.missionGate !== 'verified') return; state.missionGate = 'authorized'; setGateProgress(2); $('#gateState').textContent = 'SIMULATED AUTHORIZATION'; $('#authorityState b').textContent = 'SIMULATED APPROVAL'; $('#authorityRole').textContent = state.outcome === 'normal' ? 'CMO / Flight Surgeon role selected · identity not verified' : 'Crew Commander role selected · identity not verified'; $('#authorityState').classList.add('approved'); $('#missionAuthorize').disabled = true; $('#missionAuthorize').textContent = state.outcome === 'normal' ? 'CMO ROLE · SIMULATED' : 'COMMANDER ROLE · SIMULATED'; $('#missionExecute').disabled = false; $('#missionExecute').textContent = state.outcome === 'normal' ? 'SIMULATE ESCALATION' : 'SIMULATE REVERSIBLE ACTION'; $('#missionTamper').disabled = false;
}
function executeMissionTransition() {
  if (state.missionGate !== 'authorized') return; state.missionGate = 'executable'; setGateProgress(3); $('#gateState').textContent = 'SIMULATED EXECUTION'; $('#missionExecute').textContent = state.outcome === 'normal' ? 'ESCALATION RECORDED' : 'ACTION RECORDED'; $('#missionExecute').disabled = true; $('#missionGate').classList.add('executed'); setEarthHandover('queued');
  window.AresDemoSession.addReceipt({ kind: 'mission', event: 'MRG-184-07', transition: state.outcome === 'normal' ? 'ESCALATE' : 'REVERSIBLE ACTION', at: Date.now() }); renderMissionSessionReceipt();
}
function tamperMissionEvidence() {
  if (!['authorized', 'executable'].includes(state.missionGate)) return; const wasExecuted = state.missionGate === 'executable'; state.missionGate = 'tampered'; renderGateChecks('fail'); setGateProgress(0); $('#gateState').textContent = 'ATTESTATION REJECTED'; $('#missionGate').classList.remove('executed'); $('#missionGate').classList.add('rejected'); $('#missionExecute').disabled = true; $('#missionExecute').textContent = '🔒 ACTION LOCKED'; $('#missionAuthorize').disabled = true; $('#missionTamper').disabled = true; if (wasExecuted) setEarthHandover('held'); const impact = $('#tamperImpact'); impact.hidden = false; impact.innerHTML = `<span>ADVERSARIAL CHANGE DETECTED</span><div><small>Remaining time</small><b><s>41 min</s> → 42 min</b></div><strong>SIMULATED SIGNATURE INVALID · RESOURCE CONSERVATION FAILED · REPLAY ATTESTATION REJECTED</strong><section class="recovery-guidance"><span>CAUSE</span><b>Declared resource state no longer matches the replay record.</b><span>RECOVERY ACTION</span><b>Restore the authentic attestation or rebuild proof from the current state.</b></section><p>The recommendation didn’t change.<br><b>Its permission to act did.</b></p>${wasExecuted ? '<p>Previously simulated execution is not undone; only further use of this record is blocked.</p>' : ''}`;
}
function showDetail(key) {
  const detail = details[key]; if (!detail) return;
  $('#drawerContent').innerHTML = `<h2>${detail.title}</h2><p>${detail.role}</p><h3>CURRENT RECORD</h3><dl><dt>Scenario value</dt><dd>${detail.value}</dd><dt>Source class</dt><dd><span class="source-tag">${detail.source}</span></dd></dl><h3>SCIENTIFIC BASIS</h3><p>${detail.basis}</p><h3>USED BY ARES AS</h3><p>${detail.used}</p><h3>NOT USED AS</h3><p>${detail.not}</p>`;
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}

$$('.test-option').forEach((button) => button.addEventListener('click', () => selectOption(button.dataset.option)));
$$('[data-test]').forEach((button) => button.addEventListener('click', () => selectOption(button.dataset.test === 'recovery' ? 'observe' : button.dataset.test)));
$$('[data-close]').forEach((button) => button.addEventListener('click', closeOverlays));
$$('[data-outcome]').forEach((button) => button.addEventListener('click', () => renderOutcome(button.dataset.outcome)));
$$('[data-detail]').forEach((button) => button.addEventListener('click', () => showDetail(button.dataset.detail)));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOverlays(); });
$('#approveButton').addEventListener('click', () => state.option === 'pvt' ? openModal('#testModal') : renderSecondaryObservation(state.option));
$('#alternateButton').addEventListener('click', () => { if (state.resultKind === 'secondary') { closeOverlays(); selectOption('pvt'); openModal('#testModal'); } else renderOutcome(state.outcome === 'slowed' ? 'normal' : 'slowed'); });
$('#completeButton').addEventListener('click', closeOverlays); $('#resetButton').addEventListener('click', resetReplay); $('#provenanceButton').addEventListener('click', () => showDetail('sleep'));
$('#missionAuthorize').addEventListener('click', authorizeMissionTransition); $('#missionExecute').addEventListener('click', executeMissionTransition); $('#missionTamper').addEventListener('click', tamperMissionEvidence);
$('#infoButton').addEventListener('click', () => {
  $('#drawerContent').innerHTML = '<h2>Model boundaries</h2><p>ARES is a decision-support prototype for non-emergent uncertainty. A separate safety gate routes red-flag events to fixed protocols and escalation.</p><h3>THREE UNCERTAINTIES</h3><p><b>U_MODEL</b>: known explanations do not fit. <b>U_MEASUREMENT</b>: evidence quality or consistency is degraded. <b>U_DECISION</b>: no policy satisfies the current risk boundary. None is a diagnosis.</p><h3>SYNTHETIC INDICES</h3><p>H1–H3 support, U_MODEL residual and Known-model fit are reproducible demonstration indices on an arbitrary 0–100 scale. They are not probabilities, calibrated confidence or clinical coverage.</p><h3>DESIGN RULE</h3><p>Observation ≠ interpretation. Interpretation ≠ cause. Valid signature ≠ correct decision. Reversible ≠ safe. Simulation ≠ clinical validation.</p><h3>REFERENCE FRAME</h3><p><a href="https://www.nasa.gov/general/nasas-integrated-medical-model-imm/" target="_blank" rel="noreferrer">NASA Integrated Medical Model ↗</a><br><a href="https://osdr.nasa.gov/" target="_blank" rel="noreferrer">NASA Open Science Data Repository ↗</a></p>';
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
});

function registerWebMCP() {
  const context = document.modelContext; if (!context?.registerTool) return;
  const safeRegister = (tool) => { try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch {} };
  safeRegister({ name: 'read_ares_event_state', title: 'Read ARES event state', description: 'Read the current ARES evidence event, selected observation, and replay outcome without changing the interface.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ event: 'MRG-184-07', selectedObservation: state.option, outcome: state.outcome, knownModelFitIndex: $('#coverageText').textContent, modelResidualIndex: $('#unknownLevel').textContent, revision: state.revision }) });
  safeRegister({ name: 'select_ares_observation', title: 'Select next observation', description: 'Select one available ARES observation in the visible Evidence Autopilot.', inputSchema: { type: 'object', properties: { observation: { type: 'string', enum: ['pvt', 'symptom', 'observe'] } }, required: ['observation'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { if (!['pvt', 'symptom', 'observe'].includes(input?.observation)) throw new Error('Unsupported observation'); selectOption(input.observation); return { selected: state.option }; } });
  safeRegister({ name: 'run_ares_replay_outcome', title: 'Run evidence replay outcome', description: 'Apply a vigilance replay outcome and update the visible evidence model.', inputSchema: { type: 'object', properties: { outcome: { type: 'string', enum: ['slowed', 'normal'] } }, required: ['outcome'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { if (!['slowed', 'normal'].includes(input?.outcome)) throw new Error('Unsupported outcome'); renderOutcome(input.outcome); return { outcome: state.outcome, knownModelFitIndex: $('#coverageText').textContent, modelResidualIndex: $('#unknownLevel').textContent, revision: state.revision }; } });
  safeRegister({ name: 'reset_ares_replay', title: 'Reset ARES replay', description: 'Reset the visible ARES mission replay to its initial unresolved evidence state.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { resetReplay(); return { reset: true, knownModelFitIndex: 64, revision: state.revision }; } });
}
registerWebMCP();
renderMissionSessionReceipt();
