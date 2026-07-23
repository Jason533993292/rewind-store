import React, { useState, useEffect } from 'react';

export default function AuditLogPanel({ showToast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showClearPrompt, setShowClearPrompt] = useState(false);
  const [masterToken, setMasterToken] = useState('');

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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{entries.length} entries</span>
          {entries.length > 0 && (
            <button onClick={() => setShowClearPrompt(true)}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #dc2626', background: 'var(--surface)', color: '#dc2626', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = '#fee2e2'; }}
              onMouseOut={e => { e.target.style.background = 'var(--surface)'; }}>
              Clear
            </button>
          )}
        </div>
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
            <div key={e.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--line)', borderRadius: '8px', fontSize: '13px', wordBreak: 'break-word' }}>
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

      {/* ── Clear audit token prompt ── */}
      {showClearPrompt && (
        <div className="rw-modal-wrap" onClick={() => { setShowClearPrompt(false); setMasterToken(''); }}>
          <div className="rw-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', gridTemplateColumns: '1fr', padding: '24px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>Clear audit log?</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>This requires the master admin token.</p>
            <input className="rw-input" type="password" placeholder="Enter master admin token" value={masterToken}
              onChange={e => setMasterToken(e.target.value)} style={{ marginBottom: '14px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="rw-btn" onClick={() => { setShowClearPrompt(false); setMasterToken(''); }} style={{ flex: 1 }}>Cancel</button>
              <button className="rw-btn rw-btn-pri" onClick={async () => {
                if (!masterToken.trim()) return;
                try {
                  const r = await fetch('/api/admin/clear-audit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': masterToken.trim() },
                  });
                  const d = await r.json();
                  if (d.ok) {
                    setMsg('🧹 Audit log cleared');
                    setTimeout(() => setMsg(''), 3000);
                    await load();
                  } else alert(d.error || 'Failed');
                } catch { alert('Network error'); }
                setShowClearPrompt(false);
                setMasterToken('');
              }} disabled={!masterToken.trim()} style={{ flex: 1, background: '#dc2626' }}>
                Clear log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
