import React, { useState } from 'react';

export default function OrderTracking({ onClose }) {
  const [email, setEmail] = useState('');
  const [orderNum, setOrderNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleLookup(e) {
    e.preventDefault();
    if (!email.trim() || !orderNum.trim()) {
      setError('Please enter both your email and order number');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/lookup-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), orderNum: orderNum.trim() }),
      });
      const d = await r.json();
      if (d.found) {
        setResult(d.order);
      } else {
        setError('No order found with that email and order number');
      }
    } catch {
      setError('Could not look up order — please try again');
    }
    setLoading(false);
  }

  const statusLabels = {
    pending: '[PENDING]',
    ordered: '[ORDERED]',
    shipped: '[SHIPPED]',
    delivered: '[DELIVERED]',
    cancelled: '[CANCELLED]',
  };

  return (
    <div className="rw-checkout" style={{ minHeight: '100vh' }}>
      <div className="rw-checkout-bar">
        <div className="rw-logo" style={{ cursor: 'pointer' }}
          onClick={() => { nav('/'); if (onClose) onClose(); }}>REWIND<span>.</span></div>
        <button className="rw-btn rw-btn-ghost" onClick={() => { nav('/'); if (onClose) onClose(); }}>Back</button>
      </div>
      <div style={{ maxWidth: '500px', margin: '40px auto', padding: '0 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>Track your order</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
          Enter your email and order number to check the status.
        </p>

        {!result && (
          <form onSubmit={handleLookup}>
            <input className="rw-input" type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} style={{ marginBottom: '10px' }} />
            <input className="rw-input" type="text" placeholder="Order number (e.g. RW-12345678)" value={orderNum}
              onChange={e => setOrderNum(e.target.value)} style={{ marginBottom: '14px' }} />
            {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
            <button className="rw-btn rw-btn-pri rw-btn-full" disabled={loading} type="submit">
              {loading ? 'Looking up...' : 'Track order'}
            </button>
          </form>
        )}

        {result && (
          <div style={{ background: 'var(--surface)', borderRadius: '14px', padding: '28px', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>Order</p>
                <p style={{ fontSize: '18px', fontWeight: 700 }}>{result.order_num}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={async () => {
                  setLoading(true);
                  try {
                    const r = await fetch('/api/lookup-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), orderNum: orderNum.trim() }) });
                    const d = await r.json();
                    if (d.found) setResult(d.order);
                    else setError('Order no longer found');
                  } catch { setError('Refresh failed'); }
                  setLoading(false);
                }}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}
                  onMouseOver={e => { e.target.style.color = 'var(--ink)'; e.target.style.borderColor = 'var(--ink)'; }}
                  onMouseOut={e => { e.target.style.color = 'var(--muted)'; e.target.style.borderColor = 'var(--line-2)'; }}>
                  {loading ? '...' : '🔄'}
                </button>
                <span style={{
                  padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  background: result.status === 'shipped' || result.status === 'delivered' ? '#d1fae5' :
                              result.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                  color: result.status === 'shipped' || result.status === 'delivered' ? '#065f46' :
                         result.status === 'cancelled' ? '#991b1b' : '#92400e',
                }}>
                  {statusLabels[result.status] || result.status}
                </span>
              </div>
            </div>

            {result.items && Array.isArray(result.items) && result.items.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Items</p>
                {result.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
                    <span>{it.name || it.id} {it.qty > 1 ? `×${it.qty}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>€{it.price * (it.qty || 1)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Total</span>
                <span style={{ fontWeight: 700 }}>€{result.total}</span>
              </div>
              {result.shipping > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--muted)' }}>Shipping</span>
                  <span>€{result.shipping}</span>
                </div>
              )}
            </div>

            {result.created_at && (
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '16px' }}>
                Ordered on {new Date(result.created_at).toLocaleDateString()}
              </p>
            )}

            {result.status === 'shipped' && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--line)', borderRadius: '8px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: '1.6' }}>
                  Your order has been shipped and is on its way. Estimated delivery: <b>10\u201330 days</b> depending on your location.
                </p>
              </div>
            )}

            {/* ── Progress steps ── */}
            {['shipped','handed_courier','cleared_customs','local_courier','delivered'].includes(result.status) && (
              <div style={{ marginTop: '16px' }}>
                {[
                  { key: 'shipped', label: 'Shipped from warehouse' },
                  { key: 'handed_courier', label: 'Handed to international courier' },
                  { key: 'cleared_customs', label: 'Cleared customs' },
                  { key: 'local_courier', label: 'With local courier' },
                  { key: 'delivered', label: 'Delivered' },
                ].map((step, i) => {
                  const done = ['shipped','handed_courier','cleared_customs','local_courier','delivered'].indexOf(result.status) >= i;
                  const current = ['shipped','handed_courier','cleared_customs','local_courier','delivered'].indexOf(result.status) === i;
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', opacity: done ? 1 : 0.3 }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: done ? (current ? 'var(--accent)' : '#d1fae5') : 'var(--line-2)',
                        display: 'grid', placeItems: 'center',
                        color: done ? (current ? '#fff' : '#065f46') : 'var(--muted)',
                        fontSize: '10px', fontWeight: 700, flexShrink: 0,
                      }}>
                        {done ? (current ? '●' : '✓') : i + 1}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: current ? 600 : 400, color: done ? 'var(--ink)' : 'var(--muted)' }}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <button className="rw-btn rw-btn-pri rw-btn-full" style={{ marginTop: '20px' }}
              onClick={() => setResult(null)}>
              Track another order
            </button>
          </div>
        )}

        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '24px' }}>
          Questions? Email <a href="mailto:orders@rewind-stores.com" style={{ color: 'var(--accent)' }}>orders@rewind-stores.com</a>
        </p>
      </div>
    </div>
  );
}
