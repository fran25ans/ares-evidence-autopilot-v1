import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import gate from '../action-gate.js';

const workerSource = await readFile(new URL('../verifier-worker.js', import.meta.url), 'utf8');
const context = { crypto: webcrypto, TextEncoder, Uint8Array, atob, self: { addEventListener() {} } };
vm.createContext(context);
vm.runInContext(workerSource, context);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

async function signedFixture() {
  const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const record = {
    schema: 'ARES-EDA-1', decisionId: 'EVAL-001', issuedAt: 1000, validUntil: 2000,
    modelVersion: 'crew-state-0.5.0', policyVersion: 'ares-policy-0.8.0',
    scores: { sleep: 78, environment: 25, recovery: 24, unknown: 20 },
    ledger: ['Initial synthetic observation', 'PVT synthetic observation'], observations: ['pvt'],
    budgetAfter: { scalar: 4, time: 22, attention: 8, energy: 7, sensor: 2 },
    selectedTransition: 'REVERSIBLE ACTION',
    stopReason: 'Evidence crosses the simulated action threshold with bounded model residual.',
    authorityRequired: 'CREW COMMANDER', previousAttestation: 'GENESIS',
    actionBinding: { decisionId: 'EVAL-001', transition: 'REVERSIBLE ACTION', authorityRequired: 'CREW COMMANDER' },
    reversibility: { class: 'OPERATIONALLY REVERSIBLE', reviewHorizonMinutes: 45, maxPreReviewEffect: 'NON-CRITICAL EVA PREPARATION DEFERRED' }
  };
  record.evidenceRoot = sha(JSON.stringify(record.ledger));
  async function resign() {
    const unsigned = { ...record }; delete unsigned.currentHash; delete unsigned.signature;
    record.currentHash = sha(JSON.stringify(unsigned));
    record.signature = b64(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(record.currentHash)));
  }
  await resign();
  return { record, resign, publicKeyRaw: b64(await webcrypto.subtle.exportKey('raw', keys.publicKey)) };
}

async function verify(fixture, overrides = {}) {
  return context.verify({ record: fixture.record, publicKeyRaw: fixture.publicKeyRaw, chainHead: 'GENESIS', consumedDecisionIds: [], now: 1500, ...overrides });
}

test('real isolated verifier and final gate require proof plus named human authority', async () => {
  const fixture = await signedFixture();
  const verification = await verify(fixture);
  assert.equal(verification.valid, true);
  const request = { record: fixture.record, verification, now: 1500, consumedDecisionIds: [], expectedChainHead: 'GENESIS' };
  assert.equal(gate.canExecute({ ...request, authority: null }), false);
  assert.equal(gate.canExecute({ ...request, authority: { role: 'CREW COMMANDER', granted: true } }), true);
  assert.equal(gate.canExecute({ ...request, authority: { role: 'AUTOPILOT', granted: true } }), false);
  assert.equal(gate.canExecute({ ...request, authority: { role: 'CREW COMMANDER', granted: true }, consumedDecisionIds: ['EVAL-001'] }), false);
  assert.equal(gate.canExecute({ ...request, authority: { role: 'CREW COMMANDER', granted: true }, now: 2001 }), false);
});

test('actual verifier rejects six defined fault classes before execution', async () => {
  const faults = [
    ['invalid signature', async (f) => { f.record.budgetAfter.time += 1; }],
    ['signed resource inconsistency', async (f) => { f.record.budgetAfter.time += 1; await f.resign(); }],
    ['stale signed record', async (f) => { f.record.validUntil = 1499; await f.resign(); }],
    ['unauthorized policy', async (f) => { f.record.policyVersion = 'retired'; await f.resign(); }],
    ['action authority mismatch', async (f) => { f.record.authorityRequired = 'AUTOPILOT'; f.record.actionBinding.authorityRequired = 'AUTOPILOT'; await f.resign(); }],
    ['replayed decision', async () => {}]
  ];
  for (const [name, mutate] of faults) {
    const fixture = await signedFixture(); await mutate(fixture);
    const overrides = name === 'replayed decision' ? { consumedDecisionIds: [fixture.record.decisionId] } : {};
    const verification = await verify(fixture, overrides);
    assert.equal(verification.valid, false, name);
    assert.equal(gate.canExecute({ record: fixture.record, verification, authority: { role: 'CREW COMMANDER', granted: true }, now: 1500, consumedDecisionIds: overrides.consumedDecisionIds || [], expectedChainHead: 'GENESIS' }), false, name);
  }
});
