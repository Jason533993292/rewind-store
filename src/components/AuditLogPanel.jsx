import React, { useState, useEffect } from 'react';

export default function AuditLogPanel() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/admin/audit-log');
      const d = await r.json();
      setEntries(Array.isArray(d.entries) ? d.entries : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const actionLabels = {
    block_email: '🚫 Blocked email',
    unblock_email: '✅ Unblocked email',
    block_ip: '🚫 Blocked IP',
    unblock_ip: '✅ Unblocked IP',
    cancel_order: '✕ Cancelled order',
    create_promo: '🎁 Created promo code',
  };

  async function blockEmail(email) {
    if (!window.confirm(`Block ${email} from the store?`)) return;
    await fetch('/api/admin/block-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setMsg(`🚫 ${email} blocked`);
    setTimeout(() => setMsg(''), 3000);
    await load();
  }

  async function unblockEmail(email) {
    if (!window.confirm(`Unblock ${email}?`)) return;
    await fetch('/api/admin/unblock-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setMsg(`✅ ${email} unblocked`);
    setTimeout(() => setMsg(''), 3000);
    await load();
  }

  async function blockIp(ip) {
    if (!window.confirm(`Block IP ${ip}?`)) return;
    await fetch('/api/admin/block-ip', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    setMsg(`🚫 IP ${ip} blocked`);
    setTimeout(() => setMsg(''), 3000);
    await load();
  }

  function isEmail(v) { return /^\S+@\S+\.\S+$/.test(v); }
  function isIp(v) { return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v); }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📜 Admin audit trail</h3>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{entries.length} entries</span>
      </div>
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, background: 'color-mix(in oklab, var(--ink) 12%, transparent)', color: 'var(--ink)' }}>
          {msg}
        </div>
      )}
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p>
      ) : entries.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No audit entries yet.</p>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map((e, i) => (
            <div key={e.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--line)', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{actionLabels[e.action] || e.action}</span>
                {e.details && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{e.details}</span>}
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {e.admin_email}{e.ip ? ` · ${e.ip}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '8px' }}>
                  {e.created_at ? new Date(e.created_at).toLocaleString() : ''}
                </span>
                {isEmail(e.details) && (
                  <button onClick={() => blockEmail(e.details)}
                    onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}
                    style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}>
                    🚫
                  </button>
                )}
                {isIp(e.details) && (
                  <button onClick={() => blockIp(e.details)}
                    onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}
                    style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}>
                    🚫
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
