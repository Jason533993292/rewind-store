// ── CustomerMap — button that opens the 3D globe (with 2D SVG fallback) ──
// Three.js is lazy-loaded so it doesn't block initial page load.
// Falls back to 2D world-map if WebGL is unavailable or crashes.

import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import WorldMap from './ui/world-map.jsx';

const GlobePanel = lazy(() => import('./ui/globe.jsx'));

class GlobeErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(err) { console.error('Globe render failed, falling back to 2D map:', err); }
  render() {
    if (this.state.error) return <WorldMap locations={this.props.locations} />;
    return this.props.children;
  }
}

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch { return false; }
}

export default function CustomerMap() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGlobe, setShowGlobe] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

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
        <button onClick={() => {
          if (supportsWebGL()) setShowGlobe(true);
          else setShowFallback(true);
        }} style={{
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
        <GlobeErrorBoundary locations={locations}>
          <Suspense fallback={
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
              Loading globe…
            </div>
          }>
            <GlobePanel open={showGlobe} onClose={() => setShowGlobe(false)} locations={locations} />
          </Suspense>
        </GlobeErrorBoundary>
      )}

      {showFallback && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowFallback(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '90vw', maxWidth: '800px', background: 'var(--surface)', borderRadius: '20px', padding: '24px',
            position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <button onClick={() => setShowFallback(false)} style={{
              position: 'absolute', top: '12px', right: '12px', zIndex: 10,
              width: '32px', height: '32px', borderRadius: '50%', border: 'none',
              background: 'var(--line)', cursor: 'pointer', fontSize: '16px',
              display: 'grid', placeItems: 'center', fontWeight: 600, color: 'var(--muted)',
            }}>✕</button>
            <WorldMap locations={locations} />
          </div>
        </div>
      )}
    </>
  );
}
