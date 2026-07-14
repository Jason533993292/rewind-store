// ── CustomerMap — shows a button that opens a 3D globe with customer arcs ──
// Fetches customer locations from /api/orders/locations.
// No individual order data is exposed.

import React, { useState, useEffect, useMemo } from 'react';
import GlobePanel from './ui/globe.jsx';

export default function CustomerMap() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGlobe, setShowGlobe] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/orders/locations');
        const d = await r.json();
        if (!cancelled) setLocations(Array.isArray(d.locations) ? d.locations : []);
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const totalOrders = useMemo(
    () => (locations || []).reduce((s, l) => s + l.count, 0),
    [locations]
  );

  if (loading || locations.length === 0) return null;

  return (
    <>
      <div style={{ textAlign: 'center', padding: '0 24px 40px' }}>
        <button onClick={() => setShowGlobe(true)}
          style={{
            padding: '12px 28px', borderRadius: '999px', border: '1px solid var(--ink)',
            background: 'var(--surface)', cursor: 'pointer', fontSize: '14px',
            fontWeight: 600, color: 'var(--ink)', transition: 'all 0.15s',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}
          onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = 'var(--surface)'; }}
          onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Our reach — {locations.length} cities, {totalOrders} orders
        </button>
      </div>

      {showGlobe && (
        <GlobePanel
          open={showGlobe}
          onClose={() => setShowGlobe(false)}
          locations={locations}
        />
      )}
    </>
  );
}
