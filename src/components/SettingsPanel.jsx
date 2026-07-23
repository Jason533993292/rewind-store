import React, { useState, useCallback, useEffect } from 'react';

const SP_STYLES = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'var(--bg)', overflowY: 'auto',
    animation: 'pageIn .35s ease',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '16px 24px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--line)',
  },
  body: {
    maxWidth: '560px', margin: '0 auto', padding: '32px 24px',
    display: 'flex', flexDirection: 'column', gap: '28px',
  },
  card: {
    background: 'var(--surface)', borderRadius: '14px',
    padding: '20px', border: '1px solid var(--line)',
  },
  cardTitle: {
    fontSize: '15px', fontWeight: 700, color: 'var(--ink)',
    margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px',
  },
  statRow: {
    display: 'flex', gap: '12px', marginBottom: '12px',
  },
  statBox: {
    flex: 1, background: 'var(--bg)', borderRadius: '10px',
    padding: '14px 16px', textAlign: 'center',
  },
  statValue: {
    fontSize: '22px', fontWeight: 700, color: 'var(--ink)', margin: 0,
  },
  statLabel: {
    fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0', fontWeight: 500,
  },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid var(--line)', background: 'var(--bg)',
    color: 'var(--ink)', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    padding: '9px 18px', borderRadius: '999px', border: 'none',
    background: 'var(--ink)', color: 'var(--surface)',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'opacity 0.15s',
  },
  btnSmall: {
    padding: '6px 14px', borderRadius: '999px', border: 'none',
    background: 'var(--ink)', color: 'var(--surface)',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tag: {
    display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
    fontSize: '11px', fontWeight: 600,
  },
};

function getToken() {
  try { return localStorage.getItem('rw_admin_token') || ''; } catch { return ''; }
}

async function apiGet(path) {
  const token = getToken();
  const r = await fetch(path, {
    headers: { 'x-admin-token': token },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path, body) {
  const token = getToken();
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}

/* ── Admin sub-tabs ── */
function Pulse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiGet('/api/settings/pulse')); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading pulse…</div>;
  if (error) return (
    <div>
      <div style={{ fontSize: '13px', color: '#E11D74', marginBottom: '8px' }}>Failed to load</div>
      <button onClick={load} style={SP_STYLES.btnSmall}>Retry</button>
    </div>
  );
  if (!data) return null;

  return (
    <div>
      <div style={SP_STYLES.statRow}>
        <div style={SP_STYLES.statBox}>
          <p style={SP_STYLES.statValue}>€{data.todaySales.toFixed(2)}</p>
          <p style={SP_STYLES.statLabel}>Today's Sales</p>
        </div>
        <div style={SP_STYLES.statBox}>
          <p style={SP_STYLES.statValue}>{data.todayOrders}</p>
          <p style={SP_STYLES.statLabel}>Orders</p>
        </div>
        <div style={{ ...SP_STYLES.statBox, cursor: 'pointer' }} onClick={() => { nav('/admin'); }}>
          <p style={SP_STYLES.statValue}>{data.unreadChats}</p>
          <p style={SP_STYLES.statLabel}>Unread</p>
        </div>
      </div>
      {data.lowStock.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#E11D74', margin: '0 0 8px' }}>⚠ Low stock ({data.lowStock.length})</p>
          {data.lowStock.map((p, i) => (
            <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
              <span style={{ ...SP_STYLES.tag, background: p.stock === 0 ? '#FEE2E2' : '#FEF3C7', color: p.stock === 0 ? '#991B1B' : '#92400E' }}>
                {p.stock === 0 ? 'Out' : p.stock + ' left'}
              </span>
            </div>
          ))}
        </div>
      )}
      {data.lowStock.length === 0 && <p style={{ fontSize: '13px', color: '#059669', margin: '6px 0 0' }}>✅ All items fully stocked</p>}
      <div style={{ marginTop: '10px' }}>
        <button onClick={load} style={{ ...SP_STYLES.btnSmall, background: 'none', color: 'var(--muted)', border: '1px solid var(--line)', padding: '4px 12px', fontSize: '11px' }}>↻ Refresh</button>
      </div>
    </div>
  );
}

function OrderLookup() {
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!q.trim()) return;
    setLoading(true); setSearched(true);
    try { setOrders((await apiGet('/api/settings/order-lookup?q=' + encodeURIComponent(q.trim()))).orders || []); }
    catch { setOrders([]); }
    setLoading(false);
  }, [q]);

  const statusColor = (s) => {
    const m = { paid: '#059669', confirmed: '#059669', pending: '#92400E', cancelled: '#991B1B', payment_failed: '#991B1B', shipped: '#1D4ED8' };
    return m[s] || 'var(--muted)';
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input style={SP_STYLES.input} placeholder="Order number…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} />
        <button onClick={search} disabled={loading || !q.trim()} style={SP_STYLES.btn}>{loading ? '…' : 'Search'}</button>
      </div>
      {orders.length === 0 && searched && <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px', textAlign: 'center' }}>No orders found</p>}
      {orders.map((o, i) => (
        <div key={o.order_num || i} style={{ marginTop: '12px', padding: '14px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink)' }}>{o.order_num}</span>
            <span style={{ ...SP_STYLES.tag, background: statusColor(o.status) + '18', color: statusColor(o.status) }}>{o.status}</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 4px' }}>{o.customer_name || '—'} · {o.email || '—'}</p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0' }}>{Array.isArray(o.items) ? o.items.map(it => it.name || it.product_id || 'Item').join(', ') : '—'}</p>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', margin: '6px 0 0' }}>€{parseFloat(o.total || 0).toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}

function PromoGenerator({ showToast }) {
  const [discount, setDiscount] = useState(10);
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true); setGenerated(null); setCopied(false);
    try {
      const d = await apiPost('/api/settings/generate-promo', { discount });
      setGenerated(d);
      if (showToast) showToast('Promo code generated!', null, 2000);
    } catch (e) {
      if (showToast) showToast('Failed: ' + e.message, null, 2500);
    }
    setLoading(false);
  }, [discount, showToast]);

  const handleCopy = useCallback(() => {
    if (!generated) return;
    copyToClipboard(generated.code);
    setCopied(true);
    if (showToast) showToast('Copied!', null, 1500);
    setTimeout(() => setCopied(false), 2000);
  }, [generated, showToast]);

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', minWidth: '60px' }}>{discount}%</span>
          <input type="range" min="5" max="50" step="5" value={discount} onChange={e => setDiscount(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent, #FF4D14)' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: 'var(--muted)', justifyContent: 'space-between' }}>
          <span>5%</span><span>25%</span><span>50%</span>
        </div>
      </div>
      <button onClick={generate} disabled={loading} style={SP_STYLES.btn}>{loading ? 'Generating…' : 'Generate code'}</button>
      {generated && (
        <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.5px' }}>{generated.code}</span>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0' }}>{discount}% off</p>
          </div>
          <button onClick={handleCopy} style={SP_STYLES.btnSmall}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
      )}
    </div>
  );
}

/* ── Customer sub-tabs ── */
function ThemeSettings() {
  const [cols, setCols] = useState(() => { try { return localStorage.getItem('rw_grid_cols') || '3'; } catch { return '3'; } });
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('rw_theme') || 'light'; } catch { return 'light'; } });

  useEffect(() => { localStorage.setItem('rw_grid_cols', cols); }, [cols]);
  useEffect(() => { localStorage.setItem('rw_theme', mode); }, [mode]);

  const applyTheme = (t) => {
    setMode(t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div>
    </div>
  );
}

/* ── Main Settings Panel ── */
export default function SettingsPanel({ onClose, showToast }) {
  const [adminTab, setAdminTab] = useState('admin');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [adminSection, setAdminSection] = useState('pulse');

  // Check existing auth on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rw_admin_email');
    if (savedEmail) {
      setAdminEmail(savedEmail);
      const savedToken = localStorage.getItem('rw_admin_token');
      if (savedToken) {
        fetch('/api/verify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: savedEmail, token: savedToken }),
        }).then(r => r.json()).then(d => {
          if (d.verified) {
            localStorage.setItem('rw_admin_token', d.sessionToken || savedToken);
            setAdminAuthed(true);
          }
          setAdminChecking(false);
        }).catch(() => setAdminChecking(false));
      } else {
        setAdminChecking(false);
      }
    } else {
      setAdminChecking(false);
    }
  }, []);

  return (
    <div style={SP_STYLES.overlay}>
      <div style={SP_STYLES.header}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', padding: '4px', display: 'flex' }} aria-label="Close settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
        </button>
        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>Settings</span>
      </div>

      {/* Main Admin / Customer tabs */}
      <div style={{ display: 'flex', gap: '6px', padding: '12px 24px 0', maxWidth: '560px', margin: '0 auto' }}>
        {[
          { id: 'admin', label: '🔐 Admin' },
          { id: 'customer', label: '👤 Customer' },
        ].map(t => (
          <button key={t.id} onClick={() => setAdminTab(t.id)} style={{
            flex: 1, padding: '10px 6px', borderRadius: '10px',
            border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            background: adminTab === t.id ? 'var(--ink)' : 'var(--surface)',
            color: adminTab === t.id ? 'var(--surface)' : 'var(--muted)',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={SP_STYLES.body}>

        {/* ── ADMIN TAB ── */}
        {adminTab === 'admin' && (
          <>
            {adminChecking && <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Checking access…</p>}

            {!adminChecking && !adminAuthed && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>Enter your admin credentials to access sales, orders, and promo tools.</p>
                <input style={{ ...SP_STYLES.input, marginBottom: '8px', textAlign: 'center' }} placeholder="your@email.com" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                  <input style={{ ...SP_STYLES.input, textAlign: 'center', marginBottom: 0 }} type={showToken ? 'text' : 'password'} placeholder="Secret token" value={adminToken} onChange={e => setAdminToken(e.target.value)} />
                  <button onClick={() => setShowToken(!showToken)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--muted)', padding: '4px' }}>{showToken ? '🙈' : '👁️'}</button>
                </div>
                <button onClick={async () => {
                  if (!adminEmail || !adminToken) { setAdminMsg('❌ Enter email and token'); return; }
                  setAdminMsg('');
                  try {
                    const r = await fetch('/api/verify-admin', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: adminEmail, token: adminToken }),
                    });
                    const d = await r.json();
                    if (d.verified) {
                      localStorage.setItem('rw_admin_email', adminEmail);
                      localStorage.setItem('rw_admin_token', d.sessionToken || adminToken);
                      setAdminAuthed(true);
                    } else {
                      setAdminMsg('❌ Access denied');
                    }
                  } catch { setAdminMsg('❌ Could not verify'); }
                }} style={SP_STYLES.btn}>Enter admin panel</button>
                <p style={{ fontSize: '12px', color: '#E11D74', marginTop: '8px' }}>{adminMsg}</p>
              </div>
            )}

            {adminAuthed && (
              <>
                {/* Admin sub-tabs */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  {[
                    { id: 'pulse', label: '📊 Pulse' },
                    { id: 'lookup', label: '🔍 Orders' },
                    { id: 'promo', label: '🎁 Promo' },
                  ].map(s => (
                    <button key={s.id} onClick={() => setAdminSection(s.id)} style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      background: adminSection === s.id ? 'var(--ink)' : 'var(--surface)',
                      color: adminSection === s.id ? 'var(--surface)' : 'var(--muted)',
                      transition: 'all 0.15s',
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {adminSection === 'pulse' && <div style={SP_STYLES.card}><h3 style={SP_STYLES.cardTitle}>📊 Store Pulse</h3><Pulse /></div>}
                {adminSection === 'lookup' && <div style={SP_STYLES.card}><h3 style={SP_STYLES.cardTitle}>🔍 Order Lookup</h3><OrderLookup /></div>}
                {adminSection === 'promo' && <div style={SP_STYLES.card}><h3 style={SP_STYLES.cardTitle}>🎁 Promo Generator</h3><PromoGenerator showToast={showToast} /></div>}
              </>
            )}
          </>
        )}

        {/* ── CUSTOMER TAB ── */}
        {adminTab === 'customer' && (
          <div style={SP_STYLES.card}>
            <h3 style={SP_STYLES.cardTitle}>👤 Your Preferences</h3>
            <ThemeSettings />
          </div>
        )}

      </div>
    </div>
  );
}