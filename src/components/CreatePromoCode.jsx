import React, { useState } from 'react';

export default function CreatePromoCode({ showToast }) {
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState(10);
  const [maxUses, setMaxUses] = useState(50);
  const [expiresIn, setExpiresIn] = useState(90);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleCreate = async () => {
    if (!code.trim()) { setMsg('Enter a code'); return; }
    setLoading(true); setMsg('');
    try {
      const r = await fetch('/api/admin/create-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), discount: Number(discount), label: `${Number(discount)}% off` }),
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Code</label>
          <input className="rw-input" placeholder="e.g. SUMMER20" value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Discount %</label>
            <input className="rw-input" type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={1} max={100} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max uses</label>
            <input className="rw-input" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} min={1} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Expires (days)</label>
            <input className="rw-input" type="number" value={expiresIn} onChange={e => setExpiresIn(e.target.value)} min={1} style={{ width: '100%' }} />
          </div>
        </div>
        <button className="rw-btn rw-btn-pri" onClick={handleCreate} disabled={loading} style={{ padding: '12px', fontSize: '14px' }}>
          {loading ? 'Creating...' : 'Create promo code'}
        </button>
        {msg && <p style={{ fontSize: '13px', margin: 0 }}>{msg}</p>}
      </div>
    </div>
  );
}
