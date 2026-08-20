// Lightweight A/B testing for REWIND.
// Assigns each visitor a random variant (persisted), and logs impression/conversion
// events to the server, which stores them in the `ab_events` table (see sql/create-ab-events.sql).

function sessionId() {
  try {
    let s = localStorage.getItem('rw_ab_sid');
    if (!s) { s = 's_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('rw_ab_sid', s); }
    return s;
  } catch { return ''; }
}

// Get the (stable) variant for an experiment, assigning on first visit.
export function getVariant(experiment, variants = ['control', 'variant']) {
  try {
    const key = 'rw_ab_' + experiment;
    let v = localStorage.getItem(key);
    if (!v) {
      v = variants[Math.random() < 0.5 ? 0 : 1];
      localStorage.setItem(key, v);
    }
    return v;
  } catch { return variants[0]; }
}

// Fire-and-forget event log.
export function logAb(experiment, variant, eventType) {
  try {
    fetch('/api/ab/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment, variant, event_type: eventType, session_id: sessionId() }),
    }).catch(() => {});
  } catch {}
}
