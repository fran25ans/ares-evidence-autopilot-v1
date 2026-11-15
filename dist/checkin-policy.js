// Crew intake uses the same observation selector as Scenario Lab and ARES-EVAL-1.
// These are routing cues for a prototype, not clinical thresholds or diagnoses.
(function (root) {
  const BASELINE_HOURS = 6.8;
  function review({ hours, mood, symptom }) {
    if (!Number.isFinite(hours) || hours < 0 || hours > 24 || !['steady', 'strained', 'low'].includes(mood) || !['none', 'headache', 'urgent'].includes(symptom)) throw new Error('Invalid crew check-in');
    if (symptom === 'urgent') return { route: 'EMERGENCY_PROTOCOL', nextObservation: null, cues: ['severe or rapidly worsening symptoms'], gate: 'LOCKED' };
    if (symptom === 'headache') return { route: 'CREW_MEDICAL_REVIEW', nextObservation: null, cues: ['new symptom reported'], gate: 'LOCKED' };
    const cues = [];
    const tags = [];
    if (hours < BASELINE_HOURS * .8) { cues.push('sleep below synthetic personal reference'); tags.push('sleep-short'); }
    if (mood !== 'steady') { cues.push('readiness changed by self-report'); tags.push('attention-change'); }
    if (!cues.length) return { route: 'ROUTINE_OBSERVATION', nextObservation: null, cues: ['no new cue from this check-in'], gate: 'LOCKED' };
    const scores = { sleep: tags.includes('sleep-short') ? 48 : 36, environment: 37, recovery: 30, unknown: 28 };
    const nextObservation = root.AresPolicy.select({ scores, tags, available: ['pvt', 'report', 'environment', 'recovery', 'sensor'] });
    return { route: 'MEASURE_FIRST', nextObservation, cues, gate: 'LOCKED' };
  }
  root.AresCheckinPolicy = Object.freeze({ review });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AresCheckinPolicy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
