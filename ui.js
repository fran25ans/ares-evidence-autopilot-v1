(function () {
  const $ = (selector) => document.querySelector(selector);
  const names = { ares: 'ARES · adaptive', fixed: 'Fixed checklist', all: 'Acquire all', greedy: 'Greedy gain / cost' };
  const notes = { ares: 'Cue-aware, open-world, resource-bounded', fixed: 'PVT → report → environment', all: 'Collect until frontier', greedy: 'Static gain per scalar cost' };
  const pct = (value) => `${value}%`;
  let cached = null;

  function chart(report) {
    const entries = Object.entries(report.policies);
    const maxRisk = Math.max(10, ...entries.map(([, value]) => value.wrongCommittedPct));
    const labels = { ares: [10, -12], fixed: [10, 17], all: [-81, -12], greedy: [10, -12] };
    const circles = entries.map(([key, value]) => {
      const x = 62 + value.meanBudget / 6 * 590;
      const y = 187 - value.wrongCommittedPct / maxRisk * 150;
      const [dx, dy] = labels[key];
      return `<g class="${key === 'ares' ? 'ares' : 'baseline'}"><circle cx="${x}" cy="${y}" r="${key === 'ares' ? 8 : 6}"/><text x="${x + dx}" y="${Math.max(18, y + dy)}">${names[key]}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 720 238" role="img" aria-label="Wrong committed class versus mean scalar budget, twenty synthetic cases"><line x1="62" y1="187" x2="652" y2="187"/><line x1="62" y1="37" x2="62" y2="187"/><text x="320" y="225">MEAN BUDGET USED →</text><text x="16" y="135" transform="rotate(-90 16 135)">WRONG COMMITTED CLASS →</text><text x="58" y="205">0</text><text x="350" y="205">3</text><text x="645" y="205">6</text><text x="30" y="190">0%</text><text x="24" y="42">${maxRisk}%</text>${circles}</svg><small>Lower left is preferable, but this tiny authored set cannot establish statistical or clinical superiority.</small>`;
  }

  function traceCard(result, label) {
    const steps = result.trace.slice(1).map((step) => `<li><b>${step.observation}</b> → ${step.decision} <small>budget ${step.budget}/6 · U_MODEL ${step.scores.unknown}</small></li>`).join('') || '<li>No observation requested</li>';
    return `<div class="paired-trace"><span>${label}</span><b>${result.output}</b><small>${result.budgetSpent}/6 budget · ${result.timeSpent} min · ${result.observations} observations</small><ol>${steps}</ol></div>`;
  }

  function showCase(report, caseId) {
    const paired = report.pairedRuns.find((item) => item.caseId === caseId);
    if (!paired) return;
    $('#benchmarkCaseTrace').innerHTML = `<p>Sealed truth revealed for audit: <b>${paired.truth.toUpperCase()}</b>. A wrong committed class is counted as a proxy error, not as a real operational action.</p><div class="paired-traces">${traceCard(paired.results.ares, 'ARES')}${traceCard(paired.results.fixed, 'FIXED CHECKLIST')}${traceCard(paired.results.greedy, 'GREEDY')}</div>`;
  }

  async function run() {
    const modal = $('#benchmarkModal');
    modal.hidden = false; document.body.style.overflow = 'hidden';
    $('#benchmarkResults').innerHTML = '<p class="benchmark-loading">Loading the published, reproducible report…</p>';
    try {
      if (!cached) {
        const response = await fetch('bench/report.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Report unavailable (${response.status})`);
        cached = await response.json();
        if (cached.schema !== 'ARES-EVAL-1' || cached.caseCount !== 20 || !cached.synthetic) throw new Error('Unexpected report version');
      }
      const report = cached;
      $('#riskResourceChart').innerHTML = chart(report);
      $('#benchmarkResults').innerHTML = `<div class="benchmark-row header"><span>POLICY</span><span>WRONG COMMIT</span><span>MEAN BUDGET</span><span>UNKNOWN ABSTAIN</span></div>${Object.entries(report.policies).map(([key, result]) => `<div class="benchmark-row ${key === 'ares' ? 'ares' : ''}"><span><b>${names[key]}</b><small>${notes[key]}</small></span><span class="benchmark-metric"><b>${pct(result.wrongCommittedPct)}</b><small>${Math.round(result.wrongCommittedPct / 100 * result.count)} / ${result.count} cases</small></span><span class="benchmark-metric"><b>${result.meanBudget}</b><small>of 6 units</small></span><span class="benchmark-metric"><b>${pct(result.correctUnknownAbstainPct)}</b><small>of 5 unknown cases</small></span></div>`).join('')}<p class="benchmark-caveat">All four policies face the same case fixtures. ARES uses fewer resources than the fixed checklist here, but Greedy and Acquire-all make fewer wrong commitments. ${report.policies.ares.falseAbstainPct}% of known cases end in ARES abstention. These are synthetic support-index rules, not calibrated medical probabilities.</p>`;
      const a = report.policies.ares, b = report.ablations;
      $('#ablationResults').innerHTML = `<div class="ablation-title"><b>CALCULATED ABLATIONS</b><small>Same 20 cases; one mechanism changed at a time</small></div><div class="ablation-grid"><div class="ablation-case full"><span>FULL ARES</span><b>${a.meanBudget}/6 mean budget · ${pct(a.wrongCommittedPct)} wrong commit</b><small>${pct(a.correctUnknownAbstainPct)} appropriate abstention on unknown cases.</small></div><div class="ablation-case removed"><span>NO ADAPTIVE SELECTION</span><b>${b.no_adaptive.meanBudget}/6 mean budget</b><small>Fixed order costs ${Number((b.no_adaptive.meanBudget - a.meanBudget).toFixed(2))} more units per case on average here.</small></div><div class="ablation-case removed"><span>NO U_MODEL ABSTENTION</span><b>${pct(b.no_unknown.wrongCommittedPct)} wrong commit</b><small>Unknown-case appropriate abstention falls to ${pct(b.no_unknown.correctUnknownAbstainPct)}.</small></div><div class="ablation-case removed"><span>SCALAR BUDGET ONLY</span><b>${pct(b.scalar_only.resourceViolationPct)} resource violations</b><small>One case spends beyond a physical resource even though scalar budget remains.</small></div><div class="ablation-case removed"><span>NO SENSOR CROSS-CHECK</span><b>${b.no_sensor.meanBudget}/6 mean budget</b><small>No safety gain from the sensor check is established in this small fixture set; this ablation is inconclusive.</small></div></div>`;
      const select = $('#benchmarkCaseSelect');
      select.innerHTML = report.pairedRuns.map((item) => `<option value="${item.caseId}">${item.caseId} · ${item.truth}</option>`).join('');
      select.value = 'E01'; showCase(report, select.value);
      setTimeout(() => $('.close', modal)?.focus(), 10);
      return { schema: report.schema, cases: report.caseCount, synthetic: true, policies: report.policies, ablations: report.ablations, reportUrl: new URL('bench/report.json', location.href).href };
    } catch (error) {
      $('#benchmarkResults').innerHTML = `<p class="benchmark-error">Evaluation report unavailable. Run <code>node dist/bench/run.mjs</code> from the project and check the published artifact.</p>`;
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  $('#benchmarkCaseSelect').addEventListener('change', (event) => { if (cached) showCase(cached, event.target.value); });
  window.AresBenchmarkUI = Object.freeze({ run });
})();
