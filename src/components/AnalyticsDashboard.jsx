// ── Analytics Dashboard (admin) ──
// Hand-rolled charts (pure divs, no chart library), Retro-Modern styling.

import { useState, useEffect } from 'react';

const ACCENT = 'var(--accent)';
const HEAD = 'var(--font-head)';

function friendlyPage(p) {
  if (!p) return 'Unknown';
  if (p === '/') return 'Home';
  if (p.startsWith('/product/')) {
    return p.slice(9).split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  const map = {
    '/cart': 'Cart', '/admin': 'Admin', '/track': 'Track order',
    '/order-confirmed': 'Order confirmed', '/checkout': 'Checkout',
    '/referral': 'Referrals', '/settings': 'Settings', '/info': 'Info',
    '/legal': 'Legal', '/size-guide': 'Size guide', '/survey': 'Survey',
  };
  return map[p] || p;
}

function flag(c) {
  if (!c || c.length !== 2) return '🌐';
  return c.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

export default function AnalyticsDashboard({ adminFetch }) {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!adminFetch) return;
    setData(null);
    adminFetch(`/api/admin/analytics?period=${period}`)
      .then(r => {
        if (r.ok && r.data) setData(r.data);
        else setData({ error: r.error || 'Could not load' });
      })
      .catch(() => setData({ error: 'Could not load' }));
  }, [period, tick, adminFetch]);

  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading analytics...</div>;
  if (data.error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>{data.error}</div>;

  const s = data.stats || {};
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const sales = data.sales || { orders: 0, revenue: 0 };
  const topPages = data.topPages || [];
  const byCountry = data.byCountry || [];
  const byBrowser = data.byBrowser || [];
  const byOs = data.byOs || [];
  const byDevice = data.byDevice || [];
  const conv = s.unique_visitors > 0 ? ((sales.orders / s.unique_visitors) * 100).toFixed(1) : '0';

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, fontFamily: HEAD }}>📈 Analytics</h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['24h', '7d', '30d', 'all'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--line-2)',
                background: period === p ? ACCENT : 'transparent',
                color: period === p ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontSize: '12px', fontWeight: 700,
              }}>{p}</button>
          ))}
        </div>
        <button onClick={() => setTick(t => t + 1)} title="Refresh data"
          style={{
            marginLeft: 'auto', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--line-2)',
            background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          }}>↻ Refresh</button>
      </div>

      {/* Visits over time — hand-rolled bar chart (hidden for 24h) */}
      {period !== '24h' && daily.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, fontFamily: HEAD }}>Visits · last {daily.length} days</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '90px' }}>
            {daily.map((d, i) => {
              const max = Math.max(...daily.map(x => x.n), 1);
              const h = Math.max(3, Math.round((d.n / max) * 76));
              const isToday = i === daily.length - 1;
              const dt = new Date(d.d + 'T00:00:00');
              return (
                <div key={d.d} title={`${d.d}: ${d.n} visits`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                  <div style={{
                    width: '100%', maxWidth: '26px', height: `${h}px`,
                    background: isToday ? ACCENT : 'var(--line-2)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height .3s ease',
                  }} />
                  <span style={{ fontSize: '9px', color: isToday ? ACCENT : 'var(--muted)', fontWeight: 700 }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'][dt.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <Card label="Visitors" value={s.unique_visitors ?? '—'} />
        <Card label="Pageviews" value={s.total_visits ?? '—'} />
        <Card label="Avg / visitor" value={s.avg_per_visitor != null ? s.avg_per_visitor.toFixed(1) : '—'} />
        <Card label="Orders" value={sales.orders ?? '—'} sub={`€${(sales.revenue || 0).toLocaleString()} · ${conv}% conv`} />
        <Card label="Today" value={s.today_visits ?? '—'} hot />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Section title="📄 Top Pages">
          {topPages.map((p, i) => (
            <Row key={i} label={friendlyPage(p.page)} raw={p.page} value={p.count} max={topPages[0]?.count || 1} />
          ))}
          {topPages.length === 0 && <Empty hint="Homepage visits appear here once the store gets traffic." />}
        </Section>

        <Section title="🌍 Countries">
          {byCountry.map((p, i) => (
            <Row key={i} label={`${flag(p.country)} ${p.country || 'Unknown'}`} value={p.count} max={byCountry[0]?.count || 1} />
          ))}
          {byCountry.length === 0 && <Empty hint="Visitors' countries show up here — share the store on Instagram to see where people come from." />}
        </Section>

        <Section title="🌐 Browsers">
          {byBrowser.map((p, i) => (
            <Row key={i} label={p.browser || 'Unknown'} value={p.count} max={byBrowser[0]?.count || 1} />
          ))}
          {byBrowser.length === 0 && <Empty />}
        </Section>

        <Section title="💻 Operating Systems">
          {byOs.map((p, i) => (
            <Row key={i} label={p.os || 'Unknown'} value={p.count} max={byOs[0]?.count || 1} />
          ))}
          {byOs.length === 0 && <Empty />}
        </Section>

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

function Card({ label, value, sub, hot }) {
  return (
    <div style={{
      background: hot ? ACCENT : 'var(--surface)',
      border: `1px solid ${hot ? ACCENT : 'var(--line)'}`,
      borderRadius: '12px', padding: '16px',
    }}>
      <div style={{ fontSize: '12px', color: hot ? 'rgba(255,255,255,.85)' : 'var(--muted)', marginBottom: '4px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: HEAD, fontVariantNumeric: 'tabular-nums', color: hot ? '#fff' : 'var(--ink)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: hot ? 'rgba(255,255,255,.9)' : 'var(--muted)', marginTop: '2px', fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, fontFamily: HEAD }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, raw, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <span style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={raw || label}>
        {label}
      </span>
      <div style={{ width: '70px', height: '8px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, borderRadius: '4px', minWidth: pct > 0 ? '4px' : 0 }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, width: '56px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {pct}%</span>
      </span>
    </div>
  );
}

function Empty({ hint }) {
  return (
    <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '20px 8px', lineHeight: 1.5 }}>
      {hint || 'No data yet — this fills in automatically as visitors browse the store.'}
    </p>
  );
}
