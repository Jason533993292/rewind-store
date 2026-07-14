// ── CustomerMap — Fetches customer locations and renders the world map ──
// Shows where REWIND customers are ordering from, aggregated by city.
// No individual order data is exposed.

import React, { useState, useEffect } from 'react';
import WorldMap from './ui/world-map.jsx';

export default function CustomerMap() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <section className="rw-section rw-section-alt" style={{ padding: '60px 24px' }}>
      <div className="rw-section-head" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <span className="rw-section-tag">Our reach</span>
        <h2 style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0 4px' }}>Where our customers are</h2>
        <p style={{ fontSize: '15px', color: 'var(--muted)', maxWidth: '480px', margin: '0 auto' }}>
          Every dot represents a city where someone has ordered. We ship across Europe from our warehouse in Brussels.
        </p>
      </div>

      {loading ? (
        <div className="rw-skeleton" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', aspectRatio: '16/9', borderRadius: '12px' }} />
      ) : locations.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
          {locations.length === 0 && !loading ? 'No order data yet. Once orders come in, a map will appear here.' : ''}
        </p>
      ) : (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--line)' }}>
          <WorldMap locations={locations} />
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--muted)' }}>
            <span>📍 {locations.length} cities</span>
            <span>📦 {locations.reduce((s, l) => s + l.count, 0)} orders</span>
          </div>
        </div>
      )}
    </section>
  );
}
