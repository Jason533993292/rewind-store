import React, { useState } from 'react';

const btnStyle = {
  padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)',
  cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s',
};

export default function CreatePromoCode({ showToast }) {
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState(10);
  const [maxUses, setMaxUses] = useState(50);
  const [expiresIn, setExpiresIn] = useState(90);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const generateCode = () => {
    const prefix = 'RW';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    setCode(prefix + rand);
  };

  const handleCreate = async () => {
    if (!code.trim()) { setMsg('Enter a code'); return; }
    setLoading(true); setMsg('');
    try {
      const r = await fetch('/api/admin/create-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), discount: Number(discount), label: `${Number(discount)}% off`, max_uses: Number(maxUses) || null, expires_at: Number(expiresIn) > 0 ? new Date(Date.now() + Number(expiresIn) * 86400000).toISOString() : null }),
      });
      const d = await r.json();
      if (d.code) {
        setMsg('✅ Promo code ' + d.code + ' created!');
        setCode('');
        if (showToast) showToast('Promo code created');
      } else {
        setMsg(d.error || 'Failed to create');
      }
    } catch { setMsg('Network error'); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Code</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input className="rw-input" placeholder="e.g. SUMMER20" value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ flex: 1 }} />
            <button onClick={generateCode}
              style={{ ...btnStyle, padding: '6px 12px', fontSize: '12px' }}
              onMouseOver={e => { e.target.style.color = 'var(--ink)'; e.target.style.borderColor = 'var(--ink)'; }}
              onMouseOut={e => { e.target.style.color = 'var(--muted)'; e.target.style.borderColor = 'var(--line-2)'; }}>
              🎲 Random
            </button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Discount</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[10, 15, 20, 25, 30, 50].map(pct => (
              <button key={pct} onClick={() => setDiscount(pct)}
                style={{ ...btnStyle, background: discount === pct ? 'var(--ink)' : 'var(--surface)', color: discount === pct ? '#fff' : 'var(--muted)', borderColor: discount === pct ? 'var(--ink)' : 'var(--line-2)' }}>
                {pct}%
              </button>
            ))}
            <input className="rw-input" type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={1} max={100}
              style={{ width: '60px', padding: '4px 8px', fontSize: '11px' }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max uses</label>
          <input className="rw-input" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} min={1} style={{ width: '100%', maxWidth: '200px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Expires</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[1, 2, 7, 14, 30, 90].map(days => (
              <button key={days} onClick={() => setExpiresIn(days)}
                style={{ ...btnStyle, background: expiresIn === days ? 'var(--ink)' : 'var(--surface)', color: expiresIn === days ? '#fff' : 'var(--muted)', borderColor: expiresIn === days ? 'var(--ink)' : 'var(--line-2)' }}>
                {days}d
              </button>
            ))}
            <input className="rw-input" type="number" value={expiresIn} onChange={e => setExpiresIn(e.target.value)} min={1}
              style={{ width: '60px', padding: '4px 8px', fontSize: '11px' }} />
          </div>
        </div>
        <button className="rw-btn rw-btn-pri" onClick={handleCreate} disabled={loading}
          onMouseOver={e => { if (!e.target.disabled) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 12px rgba(255,77,20,0.3)'; } }}
          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
          style={{ padding: '12px', fontSize: '14px', transition: 'all 0.15s' }}>
          {loading ? 'Creating...' : 'Create promo code'}
        </button>
        {msg && <p style={{ fontSize: '13px', margin: 0 }}>{msg}</p>}
      </div>
    </div>
  );
}
