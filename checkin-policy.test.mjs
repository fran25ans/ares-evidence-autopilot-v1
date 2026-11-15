import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/ares-policy.js';
import '../dist/checkin-policy.js';

const review = globalThis.AresCheckinPolicy.review;

test('urgent report stops adaptive acquisition and keeps the gate locked', () => {
  assert.deepEqual(review({ hours: 7.2, mood: 'steady', symptom: 'urgent' }), {
    route: 'EMERGENCY_PROTOCOL', nextObservation: null, cues: ['severe or rapidly worsening symptoms'], gate: 'LOCKED'
  });
});

test('new symptom routes to human review rather than a fabricated diagnosis', () => {
  const result = review({ hours: 5.1, mood: 'strained', symptom: 'headache' });
  assert.equal(result.route, 'CREW_MEDICAL_REVIEW');
  assert.equal(result.nextObservation, null);
});

test('short sleep and changed readiness use the shared observation selector', () => {
  assert.equal(review({ hours: 5.2, mood: 'steady', symptom: 'none' }).nextObservation, 'pvt');
  assert.equal(review({ hours: 7.2, mood: 'strained', symptom: 'none' }).nextObservation, 'pvt');
});

test('normal check-in does not invent a new test or operational clearance', () => {
  const result = review({ hours: 7.2, mood: 'steady', symptom: 'none' });
  assert.equal(result.route, 'ROUTINE_OBSERVATION');
  assert.equal(result.nextObservation, null);
  assert.equal(result.gate, 'LOCKED');
});

test('reject invalid check-ins before routing', () => {
  assert.throws(() => review({ hours: 25, mood: 'steady', symptom: 'none' }));
  assert.throws(() => review({ hours: 7, mood: 'other', symptom: 'none' }));
});
