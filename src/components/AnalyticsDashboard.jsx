// ── Analytics Dashboard (admin) ──
// No extra dependencies — pure inline styles, fetches stats from our own API.

import { useState, useEffect } from 'react';

export default function AnalyticsDashboard({ adminFetch }) {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    if (!adminFetch) return;
    adminFetch(`/api/admin/analytics?period=${period}`)
      .then(r => {
        if (r.ok && r.data) setData(r.data);
        else setData({ error: r.error || 'Could not load' });
      })
      .catch(() => setData({ error: 'Could not load' }));
  }, [period, adminFetch]);

  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading analytics...</div>;
  if (data.error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>{data.error}</div>;

  const s = data.stats || {};
  const topPages = data.topPages || [];
  const byCountry = data.byCountry || [];
  const byBrowser = data.byBrowser || [];
  const byOs = data.byOs || [];
  const byDevice = data.byDevice || [];

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>📈 Analytics</h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['24h', '7d', '30d', 'all'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--line-2)',
                background: period === p ? 'var(--ink)' : 'transparent',
                color: period === p ? 'var(--surface)' : 'var(--ink)',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <Card label="Visitors" value={s.unique_visitors ?? '—'} />
        <Card label="Pageviews" value={s.total_visits ?? '—'} />
        <Card label="Avg / visitor" value={s.avg_per_visitor != null ? s.avg_per_visitor.toFixed(1) : '—'} />
        <Card label="Today" value={s.today_visits ?? '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Top Pages */}
        <Section title="📄 Top Pages">
          {topPages.map((p, i) => (
            <Row key={i} label={p.page} value={p.count} max={topPages[0]?.count || 1} />
          ))}
          {topPages.length === 0 && <Empty />}
        </Section>

        {/* By Country */}
        <Section title="🌍 Countries">
          {byCountry.map((p, i) => (
            <Row key={i} label={p.country || 'Unknown'} value={p.count} max={byCountry[0]?.count || 1} />
          ))}
          {byCountry.length === 0 && <Empty />}
        </Section>

        {/* Browsers */}
        <Section title="🌐 Browsers">
          {byBrowser.map((p, i) => (
            <Row key={i} label={p.browser || 'Unknown'} value={p.count} max={byBrowser[0]?.count || 1} />
          ))}
          {byBrowser.length === 0 && <Empty />}
        </Section>

        {/* Operating Systems */}
        <Section title="💻 Operating Systems">
          {byOs.map((p, i) => (
            <Row key={i} label={p.os || 'Unknown'} value={p.count} max={byOs[0]?.count || 1} />
          ))}
          {byOs.length === 0 && <Empty />}
        </Section>

        {/* Devices */}
        <Section title="📱 Devices">
          {byDevice.map((p, i) => (
            <Row key={i} label={p.device || 'Unknown'} value={p.count} max={byDevice[0]?.count || 1} />
          ))}
          {byDevice.length === 0 && <Empty />}
        </Section>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, max }) {
  const pct = max > 0 ? (value / max * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ width: '60px', height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, width: '30px', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Empty() {
  return <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>No data yet. Visit the site to see analytics.</p>;
}
