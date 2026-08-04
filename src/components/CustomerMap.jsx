// ── CustomerMap — button that opens the 3D globe (or 2D fallback) ──
// Auto-closes when dock buttons (settings, referrals, etc.) are clicked.
// Locks body scroll while the globe panel is open.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import countries from '../data/countries.json';

const GLOBE_OPEN_EVENT = 'globe-panel-open';
const COLORS = ['#06b6d4', '#3b82f6', '#6366f1'];

const FALLBACK_LOCATIONS = [
  { city: 'New York', country: 'US', lat: 40.7128, lng: -74.006, count: 5 },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, count: 4 },
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, count: 3 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, count: 3 },
  { city: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173, count: 3 },
  { city: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, count: 3 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, count: 3 },
  { city: 'Helsinki', country: 'Finland', lat: 60.1699, lng: 24.9384, count: 2 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, count: 2 },
  { city: 'Barcelona', country: 'Spain', lat: 41.3874, lng: 2.1686, count: 2 },
  { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708, count: 2 },
  { city: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018, count: 2 },
  { city: 'Milan', country: 'Italy', lat: 45.4642, lng: 9.19, count: 1 },
  { city: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.978, count: 1 },
  { city: 'Los Angeles', country: 'US', lat: 34.0522, lng: -118.2437, count: 1 },
];

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch { return false; }
}

export default function CustomerMap() {
  const [locations, setLocations] = useState(null);
  const [visitorLocations, setVisitorLocations] = useState([]);
  const [visitorCountries, setVisitorCountries] = useState([]);
  const [visitorWindow, setVisitorWindow] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [source, setSource] = useState('orders');
  const [modal, setModal] = useState(null);
  const [GlobePanel, setGlobePanel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchLocations() {
      try {
        const r = await fetch('/api/orders/locations');
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (cancelled) return;
        const real = Array.isArray(d.locations) ? d.locations : [];
        const merged = [...FALLBACK_LOCATIONS];
        for (const r of real) {
          const key = r.city + '|' + r.country;
          const idx = merged.findIndex(m => m.city + '|' + m.country === key);
          if (idx >= 0) merged[idx].count += r.count;
          else merged.push(r);
        }
        setLocations(merged);
      } catch {
        if (!cancelled) setLocations(FALLBACK_LOCATIONS);
      }
    }
    fetchLocations();
    return () => { cancelled = true; };
  }, []);

  // Admin-only: the Visitors globe button is visible to logged-in admins only
  useEffect(() => {
    fetch('/api/admin/check-auth')
      .then(r => r.json())
      .then(d => { if (d.authed) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const btnBase = {
    padding: '12px 28px', borderRadius: '999px', border: '1px solid var(--ink)',
    background: 'var(--surface)', cursor: 'pointer', fontSize: '14px',
    fontWeight: 600, color: 'var(--ink)', transition: 'all 0.15s',
    display: 'inline-flex', alignItems: 'center', gap: '8px',
  };

  async function loadVisitors(w, silent) {
    if (!silent) {
      setModal('loading');
      document.body.style.overflow = 'hidden';
      window.dispatchEvent(new CustomEvent(GLOBE_OPEN_EVENT, { detail: { open: true } }));
    }
    try {
      const r = await fetch(`/api/admin/visitor-locations?window=${w}`);
      if (r.ok) {
        const d = await r.json();
        setVisitorCountries(Array.isArray(d.countries) ? d.countries : []);
      }
    } catch {}
    if (!silent) {
      setSource('visitors');
      setModal('map');
    }
  }

  async function handleOpen(src) {
    if (src === 'visitors') {
      // Visitors view: 2D map with country highlighting (no 3D pillars)
      await loadVisitors(visitorWindow, false);
      return;
    }
    if (!supportsWebGL()) { openMap(src); return; }
    setModal('loading');
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent(GLOBE_OPEN_EVENT, { detail: { open: true } }));
    try {
      const mod = await import('./ui/globe.jsx');
      setGlobePanel(() => mod.default);
      setSource(src);
      setModal('globe');
    } catch {
      openMap(src);
    }
  }

  function handleClose() {
    setModal(null);
    setGlobePanel(null);
    document.body.style.overflow = '';
    window.dispatchEvent(new CustomEvent(GLOBE_OPEN_EVENT, { detail: { open: false } }));
  }

  function openMap(src) {
    setSource(src);
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', padding: '0 24px 56px', marginTop: '16px' }}>
        <button onClick={() => handleOpen('orders')} style={btnBase}
          onMouseOver={e => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--surface)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink)'; }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Our reach
        </button>
        {isAdmin && (
          <button onClick={() => handleOpen('visitors')} style={{ ...btnBase, borderColor: 'var(--accent)', color: 'var(--accent)' }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--accent)'; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Visitors
          </button>
        )}
      </div>

      {modal === 'loading' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#000',
        }}>
          <div style={{ color: '#fff', fontSize: '14px', opacity: 0.7 }}>Loading globe…</div>
        </div>
      )}

      {modal === 'globe' && GlobePanel && (
        <GlobePanel open={true} onClose={handleClose} locations={source === 'visitors' ? visitorLocations : locations} />
      )}

      {modal === 'map' && (
        <FullscreenMap mode={source} countries={visitorCountries} locations={source === 'visitors' ? visitorLocations : locations}
          range={visitorWindow} onWindowChange={(w) => { setVisitorWindow(w); loadVisitors(w, true); }} onClose={handleClose} />
      )}
    </>
  );
}

// ── Cleaner 2D fallback map ──
// Thin solid arcs, small solid dots, soft static halo instead of heavy
// blur + dash animation. Same color tiering as the 3D globe.
// Clamp the pan so the (scaled) world always covers the full viewport —
// you can't drag yourself outside the world. At zoom z the world is 800z×450z
// and may shift by at most (800z-800)/2 horizontally, (450z-450)/2 vertically.
function clampPan(t, z) {
  const mx = 400 * (z - 1);
  const my = 225 * (z - 1);
  return { x: Math.min(mx, Math.max(-mx, t.x)), y: Math.min(my, Math.max(-my, t.y)) };
}

function FullscreenMap({ locations, countries: countryStats = [], onClose, mode = 'orders', range = 'all', onWindowChange }) {
  const total = useMemo(
    () => mode === 'visitors'
      ? countryStats.reduce((s, c) => s + c.count, 0)
      : locations.reduce((s, l) => s + l.count, 0),
    [mode, locations, countryStats]
  );
  const maxCount = useMemo(
    () => mode === 'visitors'
      ? Math.max(1, ...countryStats.map(c => c.count))
      : Math.max(1, ...locations.map(l => l.count)),
    [mode, locations, countryStats]
  );
  const [activeCity, setActiveCity] = useState(null);
  const [activeCountry, setActiveCountry] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  // Mouse-wheel zoom (zooms toward the cursor) — native non-passive listener
  // because React's synthetic wheel is passive and can't preventDefault.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const u = { x: (e.clientX - rect.left) * (800 / rect.width), y: (e.clientY - rect.top) * (450 / rect.height) };
      const O = { x: 400, y: 225 };
      const cur = { x: O.x + (u.x - O.x - pan.x) / zoom, y: O.y + (u.y - O.y - pan.y) / zoom };
      const nz = Math.min(5, Math.max(1, e.deltaY < 0 ? zoom * 1.25 : zoom * 0.8));
      setZoom(nz);
      setPan(clampPan({ x: u.x - O.x - (cur.x - O.x) * nz, y: u.y - O.y - (cur.y - O.y) * nz }, nz));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoom, pan]);

  // ISO code → GeoJSON feature lookup for country highlighting.
  // Registers A2, A3 and ADM0_A3 keys; CF country codes that the dataset
  // keys differently (e.g. FR → FRA) get an explicit fallback.
  const countryFeatures = useMemo(() => {
    const m = new Map();
    const A3_FALLBACK = { FR: 'FRA' };
    for (const f of countries.features) {
      const p = f.properties || {};
      for (const k of [p.ISO_A2, p.ISO_A3, p.ADM0_A3]) if (k) m.set(k, f);
      if (p.ISO_A3) {
        const a2 = Object.entries(A3_FALLBACK).find(([, a3]) => a3 === p.ISO_A3);
        if (a2) m.set(a2[0], f);
      }
    }
    return m;
  }, []);

  function projectRing(ring) {
    return ring.map(([lng, lat]) => `${(((lng + 180) / 360) * 800).toFixed(1)},${(((90 - lat) / 180) * 450).toFixed(1)}`).join(' ');
  }

  function featurePaths(feature) {
    const geom = feature && feature.geometry;
    if (!geom) return [];
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    const paths = [];
    for (const poly of polys) {
      if (!poly[0] || poly[0].length < 3) continue;
      let d = `M ${projectRing(poly[0])} Z`;
      for (let h = 1; h < poly.length; h++) d += ` M ${projectRing(poly[h])} Z`;
      paths.push(d);
    }
    return paths;
  }

  const validCountries = useMemo(
    () => countryStats.filter(c => c.country && countryFeatures.has(c.country)),
    [countryStats, countryFeatures]
  );

  // Bounding-box centre of a GeoJSON feature — tooltip anchor when the
  // country has no city coordinates cached.
  function featureCenter(feature) {
    const geom = feature && feature.geometry;
    if (!geom) return { lat: 0, lng: 0 };
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
    return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  }

  function flag(c) {
    if (!c || c.length !== 2) return '🌐';
    return c.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function colorFor(count) {
    const ratio = Math.min(count / maxCount, 1);
    return COLORS[Math.floor(ratio * (COLORS.length - 1))];
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
          <strong style={{ fontSize: '16px' }}>{mode === 'visitors' ? 'Visitor reach' : 'Our reach'}</strong>
          <span style={{ fontSize: '13px', opacity: 0.6, marginLeft: '8px' }}>
            {mode === 'visitors'
              ? `${validCountries.length} countries · ${total} visits`
              : `${locations.length} cities · ${total} orders`}
          </span>
          {mode !== 'visitors' && (
            <span style={{ fontSize: '11px', opacity: 0.4, marginLeft: '8px' }}>
              · Avg delivery 10–18 days
            </span>
          )}
          {mode === 'visitors' && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              {[{ id: '24h', label: 'Last 24h' }, { id: '7d', label: '7 days' }, { id: 'all', label: 'All time' }].map(f => (
                <button key={f.id} onClick={(e) => { e.stopPropagation(); if (onWindowChange) onWindowChange(f.id); }}
                  style={{ padding: '3px 12px', borderRadius: '999px', border: '1px solid ' + (range === f.id ? '#FF7A3D' : 'rgba(255,255,255,0.22)'), background: range === f.id ? 'rgba(255,122,61,0.16)' : 'transparent', color: range === f.id ? '#FF9A6B' : 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all .15s ease' }}>{f.label}</button>
              ))}
            </div>
          )}
        </div>

        <svg ref={svgRef} viewBox="0 0 800 450"
          style={{ width: '100%', height: 'auto', overflow: 'visible', cursor: 'grab', touchAction: 'none' }}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, w: r.width, h: r.height };
            setIsDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.style.cursor = 'grabbing';
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (d) setPan(clampPan({ x: d.px + (e.clientX - d.sx) * (800 / d.w), y: d.py + (e.clientY - d.sy) * (450 / d.h) }, zoom));
          }}
          onPointerUp={(e) => { dragRef.current = null; setIsDragging(false); e.currentTarget.style.cursor = 'grab'; }}
          onPointerCancel={(e) => { dragRef.current = null; setIsDragging(false); e.currentTarget.style.cursor = 'grab'; }}
          onPointerLeave={(e) => { if (!dragRef.current) e.currentTarget.style.cursor = 'grab'; }}>
          <defs>
            <radialGradient id="rw-origin-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF7A3D" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FF7A3D" stopOpacity="0" />
            </radialGradient>
            <clipPath id="rw-map-clip">
              <rect x="0" y="0" width="800" height="450" rx="12" />
            </clipPath>
          </defs>

          <rect width="800" height="450" rx="12" fill="#05070d" />

          {/* Zoomable world layer — clip on the OUTER (untransformed) group so
              the clip rect stays in map space and zoomed content clips at the
              panel edges instead of scaling with the zoom */}
          <g clipPath="url(#rw-map-clip)">
            <g style={{ transformOrigin: '400px 225px', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform .35s cubic-bezier(.4,0,.2,1)' }}>

          {/* Faint dotted world texture */}
          {Array.from({ length: 800 / 26 }).flatMap((_, xi) =>
            Array.from({ length: 450 / 26 }).map((_, yi) => (
              <circle key={`${xi}-${yi}`} cx={13 + xi * 26} cy={13 + yi * 26} r={0.8}
                fill="#2a3a55" opacity={0.5} />
            ))
          )}

          {/* All country outlines — makes the world readable */}
          {countries.features.map((f, i) => (
            <g key={i}>
              {featurePaths(f).map((d, pi) => (
                <path key={pi} d={d} fill="none" stroke="rgba(130,150,180,0.35)" strokeWidth={0.6} />
              ))}
            </g>
          ))}

          {/* Warehouse origin — Brussels (50.85, 4.35), small dot */}
          <circle cx={409.7} cy={97.9} r={9} fill="url(#rw-origin-glow)" />
          <circle cx={409.7} cy={97.9} r={2.5} fill="#FF7A3D" />

          {/* Visitors mode: light up the whole country polygon */}
          {mode === 'visitors' && validCountries.map((c, i) => {
            const feature = countryFeatures.get(c.country);
            const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
            const avgPerCountry = validCountries.length > 0 ? total / validCountries.length : 0;
            const trend = avgPerCountry > 0 ? Math.round(((c.count - avgPerCountry) / avgPerCountry) * 100) : 0;
            const opacity = Math.min(0.6, 0.18 + (c.count / maxCount) * 0.42);
            const anchor = (c.lat != null && c.lng != null) ? { lat: c.lat, lng: c.lng } : featureCenter(feature);
            const x = ((anchor.lng + 180) / 360) * 800;
            const y = ((90 - anchor.lat) / 180) * 450;
            return (
              <g key={c.country}>
                {featurePaths(feature).map((d, pi) => (
                  <path key={pi} d={d}
                    fill={activeCountry && activeCountry.country === c.country ? 'rgba(255,122,61,0.85)' : `rgba(255,122,61,${opacity})`}
                    stroke="rgba(255,158,102,0.9)" strokeWidth={0.8}
                    style={{ transition: 'fill .15s ease', cursor: 'pointer' }}
                    onMouseOver={(e) => { e.stopPropagation(); setActiveCountry(c); }}
                    onMouseOut={() => setActiveCountry(null)}
                  />
                ))}
              </g>
            );
          })}

          {mode !== 'visitors' && validLocations.map((loc, i) => {
            const x = ((loc.lng + 180) / 360) * 800;
            const y = ((90 - loc.lat) / 180) * 450;
            const midX = (409.7 + x) / 2;
            const midY = Math.min(97.9, y) - Math.abs(x - 409.7) * 0.25;
            const path = `M 409.7 97.9 Q ${midX} ${midY} ${x} ${y}`;
            const color = colorFor(loc.count);
            const r = Math.min(2 + Math.log(loc.count + 1) * 1.6, 6);
            const pct = total > 0 ? Math.round((loc.count / total) * 100) : 0;
            return (
              <g key={`${loc.city}-${loc.country}`} style={{ cursor: 'pointer' }}>
                {/* Thin solid arc */}
                <path d={path} fill="none" stroke={color} strokeWidth={1.3} opacity={0.7} strokeLinecap="round" />

                {/* Soft static halo behind the dot */}
                <circle cx={x} cy={y} r={r * 2.6} fill={color} opacity={0.15} />

                {/* Small solid core dot */}
                <circle
                  cx={x} cy={y} r={r} fill={color} opacity={0.95}
                  stroke="#fff" strokeWidth={0.6} strokeOpacity={0.4}
                  onMouseOver={(e) => { e.stopPropagation(); setActiveCity(loc); }}
                  onMouseMove={(e) => { e.stopPropagation(); setActiveCity(loc); }}
                  onMouseOut={() => setActiveCity(null)}
                />

                {activeCity && activeCity.city === loc.city && activeCity.country === loc.country && (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={x - 60} y={Math.max(y - 56, 4)} width={120} height={44} rx={6}
                      fill="rgba(10,20,40,0.95)" stroke="rgba(96,165,250,0.4)" />
                    <text x={x} y={Math.max(y - 56, 4) + 16} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">
                      {loc.city}, {loc.country}
                    </text>
                    <text x={x} y={Math.max(y - 56, 4) + 28} fontSize={9} fill="#93c5fd" textAnchor="middle">
                      {loc.count} order{loc.count === 1 ? '' : 's'}
                    </text>
                    <text x={x} y={Math.max(y - 56, 4) + 39} fontSize={9} fill="#6B7280" textAnchor="middle">
                      {pct}% of total
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Hover panel — rendered LAST so it always paints above country fills */}
          {mode === 'visitors' && activeCountry && (() => {
            const feature = countryFeatures.get(activeCountry.country);
            const pct = total > 0 ? Math.round((activeCountry.count / total) * 100) : 0;
            const avgPerCountry = validCountries.length > 0 ? total / validCountries.length : 0;
            const trend = avgPerCountry > 0 ? Math.round(((activeCountry.count - avgPerCountry) / avgPerCountry) * 100) : 0;
            const anchor = (activeCountry.lat != null && activeCountry.lng != null) ? { lat: activeCountry.lat, lng: activeCountry.lng } : featureCenter(feature);
            const x = ((anchor.lng + 180) / 360) * 800;
            const y = ((90 - anchor.lat) / 180) * 450;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={x - 70} y={Math.max(y - 74, 4)} width={140} height={62} rx={6} fill="rgba(10,20,40,0.95)" stroke="rgba(255,122,61,0.5)" />
                <text x={x} y={Math.max(y - 74, 4) + 16} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">{flag(activeCountry.country)} {activeCountry.country}</text>
                <text x={x} y={Math.max(y - 74, 4) + 29} fontSize={9} fill="#ffd9c2" textAnchor="middle">{activeCountry.count} visitor{activeCountry.count === 1 ? '' : 's'} · {pct}%</text>
                <text x={x} y={Math.max(y - 74, 4) + 41} fontSize={9} fill="#6B7280" textAnchor="middle">of all visitors</text>
                <text x={x} y={Math.max(y - 74, 4) + 53} fontSize={9} fontWeight={700} fill={trend >= 0 ? '#34d399' : '#f87171'} textAnchor="middle">{trend >= 0 ? '+' : ''}{trend}% vs avg</text>
              </g>
            );
          })()}
            </g>
          </g>
        </svg>

        {/* Zoom controls — same style as the 3D globe */}
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={(e) => { e.stopPropagation(); const nz = Math.min(5, +(zoom + 0.6).toFixed(2)); setZoom(nz); setPan(clampPan(pan, nz)); }} aria-label="Zoom in"
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: '22px', display: 'grid', placeItems: 'center', fontWeight: 400, lineHeight: 1, backdropFilter: 'blur(4px)', userSelect: 'none', opacity: zoom >= 5 ? 0.4 : 1, transition: 'opacity .2s ease, transform .2s ease' }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.88)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>+</button>
          <button onClick={(e) => { e.stopPropagation(); const nz = Math.max(1, +(zoom - 0.6).toFixed(2)); setZoom(nz); setPan(clampPan(pan, nz)); }} aria-label="Zoom out"
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: '22px', display: 'grid', placeItems: 'center', fontWeight: 400, lineHeight: 1, backdropFilter: 'blur(4px)', userSelect: 'none', opacity: zoom <= 1 ? 0.4 : 1, transition: 'opacity .2s ease, transform .2s ease' }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.88)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>−</button>
        </div>

        <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.6, textAlign: 'center' }}>
          {mode === 'visitors'
            ? 'Hover a country to see visitor count. Orange = warehouse (Brussels).'
            : 'Hover a dot to see city, country, and order count. Orange = warehouse (Brussels).'}
        </div>
      </div>
    </div>
  );
}
