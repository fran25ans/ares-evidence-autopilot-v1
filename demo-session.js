// Tab-session continuity for this prototype. Never an authoritative medical record.
(function (root) {
  const KEY = 'ares-demo-session-v1';
  const MAX_AGE = 12 * 60 * 60 * 1000;
  function read() {
    try {
      const data = JSON.parse(root.sessionStorage.getItem(KEY) || 'null');
      if (!data || data.version !== 1 || !Number.isFinite(data.updatedAt) || Date.now() - data.updatedAt > MAX_AGE || data.updatedAt > Date.now()) return { version: 1, checkin: null, receipts: [] };
      return { version: 1, checkin: data.checkin || null, receipts: Array.isArray(data.receipts) ? data.receipts.slice(-5) : [] };
    } catch { return { version: 1, checkin: null, receipts: [] }; }
  }
  function write(data) { try { root.sessionStorage.setItem(KEY, JSON.stringify({ ...data, version: 1, updatedAt: Date.now() })); return true; } catch { return false; } }
  function saveCheckin(checkin) { const data = read(); data.checkin = checkin; return write(data); }
  function clearCheckin() { const data = read(); data.checkin = null; return write(data); }
  function addReceipt(receipt) { const data = read(); data.receipts = [...data.receipts, receipt].slice(-5); return write(data); }
  root.AresDemoSession = Object.freeze({ read, saveCheckin, clearCheckin, addReceipt });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AresDemoSession;
})(typeof globalThis !== 'undefined' ? globalThis : this);
