(() => {
  const $ = (selector) => document.querySelector(selector);
  const days = ['D−6', 'D−5', 'D−4', 'D−3', 'D−2', 'D−1', 'TODAY'];
  const sleepValues = [6.9, 6.7, 6.5, 6.2, 5.9, 5.6, 5.3];
  const baseline = 6.8;
  let todayIsCrewEntry = false;
  let urgentReportActive = false;
  window.AresUrgentActive = false;

  function renderChart() {
    const barWidth = 39;
    const bars = sleepValues.map((value, index) => {
      const x = 48 + index * 75;
      const y = 195 - value / 8 * 155;
      const height = 195 - y;
      return `<rect class="bar ${index === 6 ? 'last' : ''}" x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="2"/><text x="${x + barWidth / 2}" y="${Math.max(13, y - 9)}" text-anchor="middle" class="value">${value.toFixed(1)}</text><text x="${x + barWidth / 2}" y="215" text-anchor="middle">${days[index]}</text>`;
    }).join('');
    const referenceY = 195 - baseline / 8 * 155;
    $('#dailyChart').innerHTML = `<svg viewBox="0 0 570 225" aria-hidden="true"><line class="grid" x1="23" y1="195" x2="559" y2="195"/><line class="reference" x1="23" y1="${referenceY}" x2="559" y2="${referenceY}"/>${bars}</svg>`;
    $('#dailyChart').setAttribute('aria-label', `Sleep duration: ${sleepValues.map((value, index) => `${days[index]} ${value.toFixed(1)} hours${index === 6 && todayIsCrewEntry ? ' entered in this browser tab' : ' synthetic'}`).join(', ')}. Synthetic personal reference: 6.8 hours.`);
  }

  function show(view) {
    $('#dailyView').hidden = view !== 'daily';
    $('#missionView').hidden = view !== 'mission';
    $('#labView').hidden = view !== 'lab';
    $('#dailyNav').classList.toggle('active', view === 'daily');
    if (view === 'daily') $('#dailyNav').setAttribute('aria-current', 'page');
    else $('#dailyNav').removeAttribute('aria-current');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openIncident() { if (!urgentReportActive) show('mission'); }
  $('#dailyNav').addEventListener('click', () => show('daily'));
  $('#missionBack').addEventListener('click', () => show('daily'));
  $('#dailyOpenEvent').addEventListener('click', openIncident);
  $('#dailyExploreEvidence').addEventListener('click', openIncident);
  $('#dailyNextEvent').addEventListener('click', openIncident);
  $('#dailyCheckinJump').addEventListener('click', () => $('#dailyCheckin').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  $('#routineCheckinJump').addEventListener('click', () => $('#dailyCheckin').scrollIntoView({ behavior: 'smooth', block: 'center' }));

  function renderCheckin({ hours, mood, symptom }, restored = false) {
    const review = window.AresCheckinPolicy.review({ hours, mood, symptom });
    urgentReportActive = review.route === 'EMERGENCY_PROTOCOL';
    window.AresUrgentActive = urgentReportActive;
    sleepValues[6] = hours;
    todayIsCrewEntry = true;
    $('#dailyTrendCopy').textContent = 'Previous six days are synthetic scenario values; today is your entry in this tab. The dashed personal reference is synthetic, not a clinical threshold.';
    renderChart();
    const roundedHours = Math.floor(hours);
    const minutes = Math.round((hours - roundedHours) * 60);
    $('#dailySleepValue').textContent = `${roundedHours} h ${String(minutes).padStart(2, '0')} m`;
    const delta = Math.round((hours / baseline - 1) * 100);
    $('#dailySleepDelta').textContent = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}% vs synthetic personal reference`;
    const result = $('#dailyCheckinResult');
    $('#routineStatus').textContent = symptom === 'urgent' ? 'RECORDED · ESCALATE NOW' : 'CREW CHECK-IN RECORDED';
    $('#routineStatus').classList.toggle('needs-escalation', symptom === 'urgent');
    $('#routineStatus').classList.toggle('completed', symptom !== 'urgent');
    result.hidden = false;
    result.classList.toggle('urgent', symptom === 'urgent');
    const sessionNote = restored ? ' · RESTORED IN THIS TAB SESSION' : ' · THIS TAB SESSION ONLY';
    if (symptom === 'urgent') {
      result.innerHTML = `<strong>IMMEDIATE CREW ATTENTION</strong><p>Use the mission emergency protocol and contact the designated crew medical authority now. This check-in cannot assess the cause or clear an urgent condition.</p><small>CREW REPORT RECORDED${sessionNote} · NO AUTOMATED TREATMENT</small>`;
    } else if (symptom === 'headache' || mood !== 'steady') {
      result.innerHTML = `<strong>CREW REVIEW RECOMMENDED</strong><p>Share the symptom or readiness change with the designated crew medical authority. Record its onset and context. The synthetic incident remains a separate fixed example.</p><small>CREW REPORT RECORDED${sessionNote} · NO DIAGNOSIS</small>`;
    } else if (hours < baseline * .8) {
      result.innerHTML = `<strong>PERSONAL BASELINE CHANGE RECORDED</strong><p>Sleep is below this scenario’s personal reference. Review readiness with the crew and consider a vigilance observation before a demanding task.</p><small>CREW REPORT RECORDED${sessionNote} · NOT A CLINICAL THRESHOLD</small>`;
    } else {
      result.innerHTML = `<strong>CHECK-IN RECORDED</strong><p>Continue routine observation and review any new change with the crew. A single check-in does not establish medical readiness or clear an operational task.</p><small>CREW REPORT RECORDED${sessionNote} · NO DIAGNOSIS</small>`;
    }
    $('#crewPolicyTrace').hidden = false;
    const labels = { EMERGENCY_PROTOCOL: 'STOP · MISSION EMERGENCY PROTOCOL', CREW_MEDICAL_REVIEW: 'CREW MEDICAL REVIEW · NO AUTOMATED TEST', MEASURE_FIRST: 'NEXT OBSERVATION · VIGILANCE CHECK', ROUTINE_OBSERVATION: 'ROUTINE OBSERVATION · NO NEW TEST REQUESTED' };
    $('#crewPolicyNext').textContent = labels[review.route];
    $('#crewPolicyWhy').textContent = `Visible cues: ${review.cues.join('; ')}. ${review.route === 'MEASURE_FIRST' ? 'Selected by the same transparent observation policy used in Scenario Lab and ARES-EVAL-1. No test result has been acquired.' : 'No diagnosis or fitness-for-duty decision is made.'}`;
    $('#dailyInterpretationCopy').innerHTML = urgentReportActive ? '<b>Urgent report takes priority</b><br>The crew report overrides the synthetic signal review. Follow the mission emergency protocol; do not wait for the sample vigilance replay.' : review.route === 'CREW_MEDICAL_REVIEW' ? '<b>New symptom reported</b><br>Ask the designated crew medical authority to review it. The fixed incident below does not evaluate this report.' : review.route === 'MEASURE_FIRST' ? '<b>Your report changed the next step</b><br>The shared policy selected a vigilance observation. No result or operational clearance has been inferred.' : '<b>Routine check-in</b><br>This report adds no new cue to the prototype policy. The fixed synthetic incident remains a separate educational replay.';
    $('#clearCheckin').hidden = false;
    $('#urgentStop').hidden = !urgentReportActive;
    $('#dailyNext').classList.toggle('urgent-route', urgentReportActive);
    for (const id of ['dailyOpenEvent', 'dailyExploreEvidence', 'dailyNextEvent', 'labLaunch']) $(`#${id}`).disabled = urgentReportActive;
    if (urgentReportActive) {
      $('#dailyNextTitle').textContent = 'Stop this flow. Escalate now.';
      $('#dailyNextCopy').textContent = 'The reported symptom takes precedence over adaptive evidence acquisition. Use the mission emergency protocol and designated medical authority; do not wait for the synthetic replay.';
      $('#dailyNextSteps').innerHTML = '<li>Stop the non-emergency review.</li><li>Follow the mission emergency protocol.</li><li>Contact the designated medical authority.</li>';
    } else if (review.route === 'CREW_MEDICAL_REVIEW') {
      $('#dailyNextTitle').textContent = 'Discuss the new symptom with the crew medical authority.';
      $('#dailyNextCopy').textContent = 'Record onset and context. The fixed synthetic replay below is educational and does not evaluate your report.';
      $('#dailyNextSteps').innerHTML = '<li>Record symptom onset and context.</li><li>Contact the designated crew medical authority.</li><li>Explore the separate replay only as a demonstration.</li>';
    } else if (review.route === 'MEASURE_FIRST') {
      $('#dailyNextTitle').textContent = 'The shared policy selects a vigilance observation.';
      $('#dailyNextCopy').textContent = 'Your report changed the next-observation decision. No operational action is available until an observation is actually measured, evaluated and authorized. The button opens a separate fixed synthetic replay.';
      $('#dailyNextSteps').innerHTML = '<li>Review your recorded cue.</li><li>Perform an approved vigilance check if appropriate.</li><li>Use the separate replay to see how a sample result changes a model.</li>';
    } else {
      $('#dailyNextTitle').textContent = 'Continue routine observation.';
      $('#dailyNextCopy').textContent = 'This check-in does not add a new cue to the demonstration policy. The separate incident remains available as an educational replay.';
      $('#dailyNextSteps').innerHTML = '<li>Continue routine observation.</li><li>Report any new or worsening symptom.</li><li>Explore the separate synthetic replay if useful.</li>';
    }
    return review;
  }

  $('#dailyCheckinForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const report = { hours: Number(form.elements.sleep.value), mood: form.elements.mood.value, symptom: form.elements.symptom.value };
    try { window.AresCheckinPolicy.review(report); } catch { return; }
    window.AresDemoSession.saveCheckin(report);
    renderCheckin(report);
  });

  $('#clearCheckin').addEventListener('click', () => {
    window.AresDemoSession.clearCheckin(); urgentReportActive = false; window.AresUrgentActive = false; todayIsCrewEntry = false; sleepValues[6] = 5.3;
    $('#dailyCheckinForm').reset(); $('#dailySleepValue').textContent = '5 h 18 m'; $('#dailySleepDelta').textContent = '−22% vs 21-day reference';
    $('#dailyTrendCopy').textContent = 'Scenario values in hours. The dashed line is Morgan’s synthetic personal reference, not a clinical threshold.';
    $('#dailyInterpretationCopy').innerHTML = '<b>What this means</b><br>A change is present, but these signals alone do not establish its cause. ARES recommends a short vigilance observation in the synthetic incident to distinguish competing explanations.';
    $('#dailyCheckinResult').hidden = true; $('#crewPolicyTrace').hidden = true; $('#clearCheckin').hidden = true; $('#urgentStop').hidden = true; $('#dailyNext').classList.remove('urgent-route');
    $('#routineStatus').textContent = 'CREW CHECK-IN DUE'; $('#routineStatus').classList.remove('needs-escalation', 'completed');
    for (const id of ['dailyOpenEvent', 'dailyExploreEvidence', 'dailyNextEvent', 'labLaunch']) $(`#${id}`).disabled = false;
    $('#dailyNextTitle').textContent = 'Measure what helps resolve the uncertainty.';
    $('#dailyNextCopy').textContent = 'In this demonstration, a three-minute vigilance replay tests whether performance has shifted relative to Morgan’s own baseline. ARES then updates its explanation and checks the action policy.';
    $('#dailyNextSteps').innerHTML = '<li>Review the signals and crew report.</li><li>Open the synthetic incident and approve the recommended observation.</li><li>Select an observed or counterfactual result to see the decision change.</li>';
    renderChart();
  });

  renderChart();
  const saved = window.AresDemoSession.read().checkin;
  if (saved) {
    try { window.AresCheckinPolicy.review(saved); $('#checkinSleep').value = saved.hours; $('#checkinMood').value = saved.mood; $('#checkinSymptom').value = saved.symptom; renderCheckin(saved, true); }
    catch { window.AresDemoSession.clearCheckin(); }
  }
  if (location.hash === '#replay' && !urgentReportActive) show('mission');
})();
