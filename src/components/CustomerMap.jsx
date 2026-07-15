// ── CustomerMap — button that opens the 3D globe (or 2D fallback) ──
// Auto-closes when dock buttons (settings, referrals, etc.) are clicked.
// Locks body scroll while the globe panel is open.

import React, { useState, useEffect, useMemo, useRef } from 'react';

const GLOBE_OPEN_EVENT = 'globe-panel-open';
const COLORS = ['#06b6d4', '#3b82f6', '#6366f1'];

const FALLBACK_LOCATIONS = [
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, count: 8 },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, count: 6 },
  { city: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, count: 5 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, count: 4 },
  { city: 'Barcelona', country: 'Spain', lat: 41.3874, lng: 2.1686, count: 3 },
  { city: 'Milan', country: 'Italy', lat: 45.4642, lng: 9.19, count: 2 },
];

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch { return false; }
}

export default function CustomerMap() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [GlobePanel, setGlobePanel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    async function fetchLocations() {
      try {
        const r = await fetch('/api/orders/locations');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!cancelled) {
          const real = Array.isArray(d.locations) ? d.locations : [];
          // Merge fallback European cities with real data so globe always has life
          const merged = [...FALLBACK_LOCATIONS];
          for (const r of real) {
            const key = r.city + '|' + r.country;
            const idx = merged.findIndex(m => m.city + '|' + m.country === key);
            if (idx >= 0) merged[idx].count += r.count;
            else merged.push(r);
          }
          setLocations(merged);
        }
        if (!cancelled) setLoading(false);
      } catch {
        retries++;
        if (retries < 3) {
          setTimeout(fetchLocations, 2000 * retries);
        } else {
          if (!cancelled) setLoading(false);
        }
      }
    }
    fetchLocations();
    return () => { cancelled = true; };
  }, []);

  const totalOrders = useMemo(
    () => (locations || []).reduce((s, l) => s + l.count, 0),
    [locations]
  );

  async function handleOpen() {
    if (!supportsWebGL()) { openMap(); return; }
    setModal('loading');
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent(GLOBE_OPEN_EVENT, { detail: { open: true } }));
    try {
      const mod = await import('./ui/globe.jsx');
      setGlobePanel(() => mod.default);
      setModal('globe');
    } catch {
      openMap();
    }
  }

  function handleClose() {
    setModal(null);
    setGlobePanel(null);
    document.body.style.overflow = '';
    window.dispatchEvent(new CustomEvent(GLOBE_OPEN_EVENT, { detail: { open: false } }));
  }

  function openMap() {
    setModal('map');
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent(GLOBE_OPEN_EVENT, { detail: { open: true } }));
  }

  useEffect(() => {
    const handler = () => { if (modal) handleClose(); };
    window.addEventListener('settings-panel-open', handler);
    window.addEventListener('referral-panel-open', handler);
    window.addEventListener('wishlist-panel-open', handler);
    return () => {
      window.removeEventListener('settings-panel-open', handler);
      window.removeEventListener('referral-panel-open', handler);
      window.removeEventListener('wishlist-panel-open', handler);
    };
  }, [modal]);

  if (loading) return null;
  const label = locations.length > 0
    ? `Our reach — ${locations.length} cities, ${totalOrders} orders`
    : 'Our reach';

  return (
    <>
      <div style={{ textAlign: 'center', padding: '0 24px 56px', marginTop: '16px' }}>
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
          {label}
          </button>
      </div>

      {modal === 'globe' && GlobePanel && (
        <GlobePanel open={true} onClose={handleClose} locations={locations} />
      )}

      {modal === 'map' && (
        <FullscreenMap locations={locations} onClose={handleClose} />
      )}
    </>
  );
}

// ── Cleaner 2D fallback map ──
// Thin solid arcs, small solid dots, soft static halo instead of heavy
// blur + dash animation. Same color tiering as the 3D globe.
function FullscreenMap({ locations, onClose }) {
  const total = useMemo(() => locations.reduce((s, l) => s + l.count, 0), [locations]);
  const maxCount = useMemo(() => Math.max(1, ...locations.map(l => l.count)), [locations]);
  const [activeCity, setActiveCity] = useState(null);
  const dismissTimer = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => () => clearTimeout(dismissTimer.current), []);

  function colorFor(count) {
    const ratio = Math.min(count / maxCount, 1);
    return COLORS[Math.floor(ratio * (COLORS.length - 1))];
  }

  function handleTap(loc) {
    setActiveCity(loc);
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setActiveCity(null), 3000);
  }

  const validLocations = useMemo(
    () => locations.filter(l => l.lat != null && l.lng != null),
    [locations]
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 45%, rgba(10,20,50,0.75), rgba(0,0,0,0.85) 70%)',
      backdropFilter: 'blur(4px)', padding: '16px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90vw', maxWidth: '800px', borderRadius: '20px', padding: '24px',
        position: 'relative', background: 'radial-gradient(ellipse at 50% 20%, #0a1830 0%, #05070d 75%)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', color: '#fff',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 10,
          width: '32px', height: '32px', borderRadius: '50%', border: 'none',
          background: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '16px',
          display: 'grid', placeItems: 'center', fontWeight: 600, color: '#fff',
        }} aria-label="Close">✕</button>

        <div style={{ marginBottom: '16px' }}>
          <strong style={{ fontSize: '16px' }}>Our reach</strong>
          <span style={{ fontSize: '13px', opacity: 0.6, marginLeft: '8px' }}>
            {locations.length} cities · {total} orders
          </span>
        </div>

        <svg viewBox="0 0 800 450" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <radialGradient id="rw-origin-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF7A3D" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FF7A3D" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="800" height="450" rx="12" fill="#05070d" />

          {/* Faint dotted world texture */}
          {Array.from({ length: 800 / 26 }).flatMap((_, xi) =>
            Array.from({ length: 450 / 26 }).map((_, yi) => (
              <circle key={`${xi}-${yi}`} cx={13 + xi * 26} cy={13 + yi * 26} r={0.8}
                fill="#2a3a55" opacity={0.5} />
            ))
          )}

          {/* Warehouse origin — soft glow halo + solid core */}
          <circle cx={400} cy={225} r={22} fill="url(#rw-origin-glow)" />
          <circle cx={400} cy={225} r={4} fill="#FF7A3D" />

          {validLocations.map((loc, i) => {
            const x = ((loc.lng + 180) / 360) * 800;
            const y = ((90 - loc.lat) / 180) * 450;
            const midX = (400 + x) / 2;
            const midY = Math.min(225, y) - Math.abs(x - 400) * 0.25;
            const path = `M 400 225 Q ${midX} ${midY} ${x} ${y}`;
            const color = colorFor(loc.count);
            const r = Math.min(2 + Math.log(loc.count + 1) * 1.6, 6);
            const isActive = activeCity && activeCity.city === loc.city && activeCity.country === loc.country;

            return (
              <g key={`${loc.city}-${loc.country}`}>
                {/* Thin solid arc — no dashes, no heavy blur */}
                <path d={path} fill="none" stroke={color} strokeWidth={1.3} opacity={0.7} strokeLinecap="round" />

                {/* Soft static halo behind the dot */}
                <circle cx={x} cy={y} r={r * 2.6} fill={color} opacity={0.15} />

                {/* Small solid core dot — tap target */}
                <circle
                  cx={x} cy={y} r={r} fill={color} opacity={0.95}
                  stroke="#fff" strokeWidth={0.6} strokeOpacity={0.4}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); handleTap(loc); }}
                />

                {isActive && (() => {
                  const tooltipY = Math.max(y - 46, 4);
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={x - 55} y={tooltipY} width={110} height={34} rx={6}
                        fill="rgba(10,20,40,0.95)" stroke="rgba(96,165,250,0.4)" />
                      <text x={x} y={tooltipY + 15} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">
                        {loc.city}
                      </text>
                      <text x={x} y={tooltipY + 27} fontSize={9} fill="#93c5fd" textAnchor="middle">
                        {loc.count} order{loc.count === 1 ? '' : 's'}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.6, textAlign: 'center' }}>
          Tap a city to see its name and order count. Orange = warehouse (Brussels).
        </div>
      </div>
    </div>
  );
}
