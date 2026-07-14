// ── CustomerMap — button that opens the 3D globe (with 2D SVG fallback) ──
// Everything is dynamic — no Three.js code loads until user clicks.

import React, { useState, useEffect, useMemo } from 'react';

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch { return false; }
}

export default function CustomerMap() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'loading' | 'globe' | 'map' | 'error'
  const [GlobePanel, setGlobePanel] = useState(null);

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

  async function handleOpen() {
    if (!supportsWebGL()) { setModal('map'); return; }
    setModal('loading');
    try {
      const mod = await import('./ui/globe.jsx');
      setGlobePanel(() => mod.default);
      setModal('globe');
    } catch {
      setModal('map');
    }
  }

  if (loading || locations.length === 0) return null;

  return (
    <>
      <div style={{ textAlign: 'center', padding: '0 24px 40px' }}>
        <button onClick={handleOpen} style={{
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

      {modal === 'globe' && GlobePanel && (
        <GlobePanel open={true} onClose={() => { setModal(null); setGlobePanel(null); }} locations={locations} />
      )}

      {modal === 'map' && (
        <FullscreenMap locations={locations} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// Inline 2D map — no Three.js, no extra imports
function FullscreenMap({ locations, onClose }) {
  const total = useMemo(() => locations.reduce((s, l) => s + l.count, 0), [locations]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90vw', maxWidth: '800px', background: 'var(--surface)',
        borderRadius: '20px', padding: '24px', position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 10,
          width: '32px', height: '32px', borderRadius: '50%', border: 'none',
          background: 'var(--line)', cursor: 'pointer', fontSize: '16px',
          display: 'grid', placeItems: 'center', fontWeight: 600, color: 'var(--muted)',
        }} aria-label="Close">✕</button>
        <div style={{ marginBottom: '16px' }}>
          <strong style={{ fontSize: '16px' }}>Our reach</strong>
          <span style={{ fontSize: '13px', color: 'var(--muted)', marginLeft: '8px' }}>
            {locations.length} cities · {total} orders
          </span>
        </div>
        <svg viewBox="0 0 800 450" style={{ width: '100%', height: 'auto' }}>
          <rect width="800" height="450" fill="var(--bg)" rx="8" />
          {locations.filter(l => l.lat != null && l.lng != null).map((loc, i) => {
            const x = ((loc.lng + 180) / 360) * 800;
            const y = ((90 - loc.lat) / 180) * 450;
            const r = Math.min(3 + loc.count * 2, 12);
            return (
              <g key={i}>
                <circle cx={400} cy={225} r={3} fill="#FF4D14" />
                <line x1={400} y1={225} x2={x} y2={y} stroke="#3b82f6" strokeWidth={1.5} opacity={0.3} strokeDasharray="4 3" />
                <circle cx={x} cy={y} r={r} fill="#3b82f6" opacity={0.7} />
                {loc.count > 1 && (
                  <text x={x + r + 4} y={y + 4} fontSize={11} fontWeight={700} fill="var(--muted)">{loc.count}</text>
                )}
              </g>
            );
          })}
        </svg>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
          {locations.length} cities shown. Orange dot = warehouse (Brussels). Blue dots = customer cities.
        </div>
      </div>
    </div>
  );
}
