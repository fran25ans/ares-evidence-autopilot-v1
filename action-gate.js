// Final browser-side barrier. The verifier Worker must be run again immediately
// before this predicate is evaluated; this module is not flight hardware.
(function (root) {
  function canExecute({ record, verification, authority, now, consumedDecisionIds = [], expectedChainHead }) {
    if (!record || !verification?.valid || !authority?.granted) return false;
    if (record.selectedTransition !== 'REVERSIBLE ACTION' && record.selectedTransition !== 'ESCALATE') return false;
    if (verification.recomputedHash !== record.currentHash) return false;
    if (!Number.isFinite(now) || !Number.isFinite(record.issuedAt) || !Number.isFinite(record.validUntil)) return false;
    if (now < record.issuedAt || now > record.validUntil) return false;
    if (!record.decisionId || consumedDecisionIds.includes(record.decisionId)) return false;
    if (record.previousAttestation !== expectedChainHead) return false;
    if (authority.role !== record.authorityRequired) return false;
    if (record.actionBinding?.decisionId !== record.decisionId || record.actionBinding?.transition !== record.selectedTransition || record.actionBinding?.authorityRequired !== authority.role) return false;
    return true;
  }
  root.AresActionGate = Object.freeze({ canExecute });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AresActionGate;
})(typeof globalThis !== 'undefined' ? globalThis : this);
