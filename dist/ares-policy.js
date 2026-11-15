// Shared, transparent observation selector used by Scenario Lab and ARES-EVAL-1.
// This is a cue-aware heuristic, not a learned policy or formal VOI optimizer.
(function (root) {
  function select({ scores, tags, available }) {
    if (!Array.isArray(available) || !available.length) return null;
    const visibleTags = Array.isArray(tags) ? tags : [];
    const cuePriority = [
      ['sensor-discordance', 'sensor'], ['cabin-rise', 'environment'],
      ['workload', 'report'], ['symptom-change', 'report'], ['sleep-short', 'pvt'], ['attention-change', 'pvt']
    ];
    for (const [tag, test] of cuePriority) if (visibleTags.includes(tag) && available.includes(test)) return test;
    const best = ['sleep', 'environment', 'recovery'].sort((a, b) => scores[b] - scores[a])[0];
    const fallback = {
      sleep: ['pvt', 'report', 'sensor', 'environment', 'recovery'],
      environment: ['environment', 'report', 'sensor', 'pvt', 'recovery'],
      recovery: ['report', 'recovery', 'pvt', 'sensor', 'environment']
    };
    return fallback[best].find((test) => available.includes(test)) || available[0];
  }
  root.AresPolicy = Object.freeze({ select });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AresPolicy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
