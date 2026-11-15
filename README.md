# ARES — Evidence Autopilot

ARES is a static, interactive NASA Space Apps prototype for evidence acquisition under uncertainty, limited resources, and delayed expert support.

## Fit to the 2026 astronaut health monitoring challenge

The first screen is **Today’s health review**: synthetic sleep, HRV-derived and cabin-environment indicators appear alongside a seven-day personal trend, an on-screen mission-routine reminder, and a crew self-check for sleep, mood/readiness and symptoms. Short instructions explain how to report these measurements, why a vigilance observation is suggested, and what the readings cannot establish. The reminder is not a timed notification. A check-in updates the trend **and passes its visible cues to the same transparent observation selector used by Scenario Lab and ARES-EVAL-1**. It can request an observation, route a new symptom to crew medical review, or stop for the mission emergency protocol. No measured test outcome, diagnosis, or operational clearance is inferred from the self-report. A severe or rapidly worsening symptom pauses the standard demo route and visibly prioritizes escalation.

The **synthetic incident** remains a separate, fixed replay. Its input data and outcomes do not change when the daily check-in is edited. This separation is visible in the UI so user-entered values are never misrepresented as having been processed by the scenario model. Non-urgent crew reports can open the replay to see how a sample measured outcome changes the evidence map. The check-in is retained only in this browser tab session for reload recovery (up to 12 hours), can be cleared on screen, and is not synced to other devices or crew members. A simulated execution leaves a read-only tab-session reminder after reload; proof, identity and action authority are deliberately **not** restored, so the gate starts locked. These browser records are not a trusted medical audit log.

## The defensible novelty

ARES does not claim that active sensing, value-of-information, abstention, provenance, permit-before-action gates, or human-in-the-loop approval are individually new. It explores a **proof-gated evidence workflow for Earth-independent crew health operations**: the integration of resource-bounded evidence acquisition, explicit open-world uncertainty and reproducible stopping decisions into a machine-verifiable operational handoff.

`evidence → sensor-integrity check → open-world state → mission resource vector → evidence policy → stop rule → decision attestation → independent verification → human authority → action → asynchronous Earth handover`

The governing invariant is simple: **no valid attestation, no operational action**. Each attestation is signed with an ephemeral ECDSA P-256 mission key; the verifier holds the trust anchor outside the record, modelling a hardware-rooted flight key without claiming production key management.

Hypothesis values are synthetic evidence-support indices, never clinical probabilities. `KNOWN-MODEL FIT` is displayed without a percent sign: it is a reproducible demonstration index on an arbitrary 0–100 scale, not calibrated diagnostic confidence or statistical coverage.

ARES separates three uncertainties: `U_MODEL` (known explanations fit poorly), `U_MEASUREMENT` (the evidence channel is degraded or inconsistent) and `U_DECISION` (no policy meets the current risk boundary). A model residual does not, by itself, imply sensor failure. Sensor validation is recommended only when visible quality, redundancy or consistency evidence supports it.

The operator sees an **Action Brief**: the smallest decision-relevant summary needed under workload. The full signed **Epistemic Record (ARES-EDA-1)** remains available for semantic verification and export in Scenario Lab. The verifier runs in an isolated Worker and receives only the signed record plus an external trust anchor. It independently recomputes four assurance domains: integrity/freshness, evidence/resources, policy/stop rule and action/authority binding. The Mission Replay gate is an illustrative visual sequence, not this cryptographic verifier.

Authority is never created at runtime. In Scenario Lab the prototype gate requires a verified record and a **simulated role approval** before a simulated transition; its execution path re-verifies proof at action time. The static Site cannot authenticate a real Crew Commander or Flight Surgeon, send a message to Earth, or execute spacecraft operations. The asynchronous handover shown in Mission Replay is illustrative.

**AI can recommend. Evidence must justify. Humans authorize.**

## Judge demo — 90 seconds

1. Begin in **Today’s health review**. Enter a short-sleep report and show the shared policy selecting a vigilance observation while the gate stays locked. For an urgent report, show that the normal path pauses; clear it to continue. Open the explicitly labelled, separate synthetic incident.
2. In Mission Replay, approve the recommended vigilance observation and choose **Observed replay**. Watch the evidence path animate, the synthetic H1 support index rise from 78 to 92, Known-model fit move from 64 to 81, and the policy become `ACT · REVERSIBLE POLICY`.
3. In Scenario Lab, point out that all four assurance domains pass while the Action Gate remains locked. Simulate the Crew Commander role approval; only then does the simulated transition become executable. After reload, the tab-session history remains visible but the gate returns to locked. The Mission Replay handover animation is not a real transmission.
4. Run **Tamper with evidence**. A one-minute resource alteration invalidates the digest, signature and resource conservation while leaving the recommendation unchanged: its permission to act is revoked and the invalid handover is held.
5. Reset and choose **Counterfactual**. Watch H1–H3 lose support, `U_MODEL` grow to 74, Known-model fit fall to 41 and `U_DECISION` become insufficient while `U_MEASUREMENT` remains qualified. ARES states `I DON'T KNOW · ABSTAIN + ESCALATE` without inventing a sensor fault.
6. Open Scenario Lab and view the reproducible ARES-EVAL-1 report. Inspect case E01 to compare acquisition order, then U05 to see a wrong ARES commitment exposed rather than hidden. The risk–resource plot compares four policies on the same 20 hand-authored cases. Build ARES-EDA-1, run the isolated verifier and the six-case fault-injection suite if time allows.

The hidden cause can be revealed after the decision. All benchmark results, scores and scenarios are explicitly synthetic. They demonstrate testbench behavior only—not clinical performance, operational validation or medical advice.

## Reproducible policy evaluation

`dist/bench/cases.json` contains 20 distinct, hand-authored synthetic case fixtures (five each for sleep restriction, environmental contribution, recovery mismatch and unknown contributor). They are separate from the four interactive Scenario Lab stories, but were authored within this project and **are not an independent external holdout**. Each case seals its truth and unrequested measurement outcomes. Policies receive only visible scores, tags, remaining resources and observations they elect to acquire. The evaluator in `dist/bench/engine.mjs` runs adaptive ARES, a fixed checklist, acquire-all and static greedy gain/cost on identical cases and costs. ARES-EVAL-1 and the interactive Scenario Lab call the same transparent `dist/ares-policy.js` observation selector. The first three policies are compared at the same decision thresholds; acquire-all intentionally consumes evidence until the budget frontier. The report includes every paired trace, class-stratified results and computed ablations for fixed selection, removed unknown abstention, omitted sensor cross-check and scalar-only budgeting.

Reproduce the published report byte for byte with Node.js:

```sh
node dist/bench/run.mjs --check
node --test dist/checkin-policy.test.mjs dist/bench/*.test.mjs
```

Run `node dist/bench/run.mjs` to regenerate `dist/bench/report.json`. No external packages or network services are needed. The report records SHA-256 hashes of the fixture, evaluator and shared policy. On these 20 cases, ARES uses a mean 2.3 of six scalar budget units versus 3.1 for the fixed checklist, with the same 5% wrong committed-class rate. Greedy and acquire-all commit wrongly in 0% of these cases but consume more resources. ARES abstains appropriately in four of five unknown cases and also makes one wrong commitment; three of 15 modeled cases end in abstention. The scalar-only ablation violates a physical resource limit in one case. The no-sensor ablation shows no safety benefit in this small set, so that contribution remains unproven.

These figures are **descriptive of authored synthetic fixtures**, not estimates of clinical error, mission safety, statistical superiority or generalization. A wrong committed class is a proxy classification error; the Action Gate still separately controls execution. The appropriate next evaluation would use cases authored and adjudicated by external domain specialists, with policies frozen before they see those cases.

The final browser-side Action Gate re-runs the isolated verifier Worker at execution time and checks the decision binding, expiry, role, chain head and replay status. `dist/bench/gate.test.mjs` exercises the actual Worker and final gate against six defined faults and missing/wrong human authority. This demonstrates the **defined prototype barrier**, not flight-certified enforcement.

## Local preview

Serve `dist/` with any static server, for example:

```sh
python3 -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`.
