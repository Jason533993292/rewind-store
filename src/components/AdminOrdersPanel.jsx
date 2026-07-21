import React, { useState, useEffect } from 'react';
import { money } from '../hooks/useCountdown';
import { adminApi } from '../lib/adminApi';

export default function AdminOrdersPanel({ showToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelStep, setCancelStep] = useState(0);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewReason, setPreviewReason] = useState('');
  const [cancelledOrderNum, setCancelledOrderNum] = useState('');
  const [shipOrder, setShipOrder] = useState(null);
  const [trackingNum, setTrackingNum] = useState('');
  const [courierName, setCourierName] = useState('');
  const [shipping, setShipping] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');

  const LIMIT = 50;

  const loadOrders = async () => {
    setLoading(true);
    const r = await adminApi.getOrders(LIMIT, offset);
    if (r.ok) {
      setOrders(r.data.orders || []);
      setTotal(r.data.total || 0);
    } else {
      setOrders([]);
      showToast?.(r.error || 'Failed to load orders', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { loadOrders(); }, [offset]);

  const filtered = orders.filter(o => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = (o.order_num?.toLowerCase().includes(q)) ||
        (o.customer_name?.toLowerCase().includes(q)) ||
        (o.email?.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortBy === 'highest') return (b.total || 0) - (a.total || 0);
    if (sortBy === 'lowest') return (a.total || 0) - (b.total || 0);
    return 0;
  });

  const updateStatus = async (id, status) => {
    if (status === 'cancelled') {
      const o = orders.find(x => x.id === id);
      setConfirmAction({ type: 'cancel', id, order: o });
      setCancelReason('');
      setCustomReason('');
      return;
    }
    const r = await adminApi.updateOrderStatus(id, status);
    if (r.ok) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      showToast?.(`Status updated to "${status}"`, 'success');
    } else showToast?.(r.error, 'error');
  };

  const confirmCancel = async () => {
    if (!confirmAction || !cancelReason) return;
    setCancelling(true);
    const r = await adminApi.cancelOrder(confirmAction.id, cancelReason, customReason);
    if (r.ok) {
      setOrders(prev => prev.map(o => o.id === confirmAction.id ? { ...o, status: 'cancelled' } : o));
      setConfirmAction(null);
      setCancelReason('');
      setCustomReason('');
      showToast?.('✅ Order cancelled & email sent to customer', 'success');
    } else {
      showToast?.(r.error || 'Failed to cancel', 'error');
    }
    setCancelling(false);
  };

  const handleShip = async () => {
    if (!shipOrder || !trackingNum.trim() || !courierName.trim()) return;
    setShipping(true);
    const r = await adminApi.shipOrder(shipOrder.id, trackingNum.trim(), courierName.trim());
    if (r.ok) {
      setOrders(prev => prev.map(o => o.id === shipOrder.id ? { ...o, status: 'shipped' } : o));
      setShipOrder(null);
      showToast?.('✅ Shipped! Email sent to customer.', 'success');
    } else showToast?.(r.error || 'Failed to ship', 'error');
    setShipping(false);
  };

  const statusColors = {
    pending: 'color-mix(in oklab, var(--accent) 20%, transparent)',
    ordered: 'color-mix(in oklab, var(--accent) 40%, transparent)',
    shipped: 'color-mix(in oklab, var(--ink) 20%, transparent)',
    delivered: '#d1fae5',
    cancelled: '#fee2e2',
  };

  if (loading) return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ height: '20px', width: '120px', background: 'var(--line)', borderRadius: '4px', marginBottom: '16px', animation: 'rw-pulse 1.5s infinite' }} />
      {[1,2,3].map(i => <div key={i} style={{ height: '40px', background: 'var(--line)', borderRadius: '6px', marginBottom: '8px', opacity: 1 - i * 0.2 }} />)}
    </div>
  );

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📦 Orders ({total})</h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={async () => {
            console.log('Creating test order...');
            try {
              const r = await adminApi.createTestOrder();
              console.log('Test order response:', r);
              if (r.ok) {
                showToast?.('✅ Test order created: ' + r.data.orderNum, 'success');
                loadOrders();
              } else showToast?.(r.error || 'Failed (check console)', 'error');
            } catch (e) {
              console.error('Test order error:', e);
              showToast?.('Error: ' + e.message, 'error');
            }
          }}
            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.color = 'var(--ink)'; e.target.style.borderColor = 'var(--ink)'; }}
            onMouseOut={e => { e.target.style.color = 'var(--muted)'; e.target.style.borderColor = 'var(--line-2)'; }}>
            🧪 Create Test Order
          </button>
          <input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', width: '160px' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px' }}>
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="ordered">Ordered</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px' }}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest €</option>
            <option value="lowest">Lowest €</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
          {search || statusFilter ? 'No orders match your filters' : 'No orders yet'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line-2)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Order</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Items</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{o.order_num}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 600 }}>{o.customer_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.email}</div>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: '11px' }}>
                    {(Array.isArray(o.items) ? o.items : []).map((it, i) => (
                      <div key={i}>{typeof it === 'string' ? it : `${it.name}${it.size ? ` (${it.size})` : ''} ×${it.qty || 1}`}</div>
                    ))}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(o.total)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}
                      style={{
                        padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', fontWeight: 600,
                        background: statusColors[o.status] || 'transparent',
                      }}>
                      <option value="pending">⏳ Pending</option>
                      <option value="ordered">📦 Ordered</option>
                      <option value="shipped">🚚 Shipped</option>
                      <option value="delivered">✅ Delivered</option>
                      <option value="cancelled">❌ Cancel</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button onClick={() => {
                        const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`).join(', ');
                        navigator.clipboard.writeText(`NEW ORDER\nOrder: ${o.order_num}\nItems: ${items}\nCustomer: ${o.customer_name}\nAddress: ${o.address}\nEmail: ${o.email}`);
                        showToast?.('📋 Copied!', 'success');
                      }}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                        onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; }}
                        onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--accent)'; }}>
                        📋 Copy
                      </button>
                      {o.status !== 'cancelled' && o.status !== 'shipped' && (
                        <button onClick={() => setConfirmAction({ type: 'cancel', id: o.id, order: o })}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #dc2626', background: 'var(--surface)', color: '#dc2626', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}
                          onMouseOver={e => { e.target.style.background = '#dc2626'; e.target.style.color = '#fff'; }}
                          onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = '#dc2626'; }}>
                          ✕ Cancel
                        </button>
                      )}
                      {o.status === 'cancelled' && (
                        <button onClick={async () => {
                          const r = await adminApi.undoCancelOrder(o.id);
                          if (r.ok) {
                            setOrders(prev => prev.map(ord => ord.id === o.id ? { ...ord, status: 'pending' } : ord));
                            showToast?.('✅ Order restored to pending', 'success');
                          } else showToast?.(r.error || 'Failed to undo', 'error');
                        }}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--ink)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}
                          onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; }}
                          onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; }}>
                          ↩ Undo
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: offset === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: offset === 0 ? 0.5 : 1 }}>← Prev</button>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
          <button disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: offset + LIMIT >= total ? 0.5 : 1 }}>Next →</button>
        </div>
      )}

      {/* ── Cancel confirmation ── */}
      {confirmAction?.type === 'cancel' && (
        <div className="rw-modal-wrap" onClick={() => setConfirmAction(null)}>
          <div className="rw-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', gridTemplateColumns: '1fr', padding: '24px' }}>
            <h3 style={{ margin: '0 0 4px' }}>Cancel order {confirmAction.order?.order_num}?</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>An email will be sent to the customer. Refund must be done in Stripe.</p>
            <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Reason</label>
            {[
              { id: 'out_of_stock', label: 'Out of stock' },
              { id: 'damaged', label: 'Damaged during handling' },
              { id: 'customer_request', label: 'Customer requested cancellation' },
              { id: 'other', label: 'Other' },
            ].map(r => (
              <button key={r.id} onClick={() => { setCancelReason(r.id); if (r.id !== 'other') setCustomReason(''); }}
                style={{ display: 'block', width: '100%', padding: '8px 12px', marginBottom: '4px', borderRadius: '8px', border: cancelReason === r.id ? '2px solid var(--ink)' : '1px solid var(--line-2)', background: cancelReason === r.id ? 'var(--ink)' : 'var(--surface)', color: cancelReason === r.id ? '#fff' : 'var(--ink)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', textAlign: 'left' }}>
                {r.label}
              </button>
            ))}
            {cancelReason === 'other' && (
              <input className="rw-input" placeholder="Describe why..." value={customReason} onChange={e => setCustomReason(e.target.value)} style={{ marginBottom: '10px', width: '100%' }} />
            )}
            <input className="rw-input" placeholder="Order notes (internal)..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} style={{ marginBottom: '12px', width: '100%' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="rw-btn" onClick={() => setConfirmAction(null)} style={{ flex: 1 }}>Back</button>
              <button className="rw-btn rw-btn-pri" onClick={confirmCancel} disabled={!cancelReason || (cancelReason === 'other' && !customReason.trim()) || cancelling} style={{ flex: 1, background: '#dc2626' }}>
                {cancelling ? 'Cancelling...' : 'Send cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ship order modal ── */}
      {shipOrder && (
        <div className="rw-modal-wrap" onClick={() => { if (!shipping) setShipOrder(null); }}>
          <div className="rw-modal" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '460px', gridTemplateColumns: '1fr', background: 'var(--surface)', borderRadius: '14px', padding: '32px', position: 'relative' }}>
            <button onClick={() => setShipOrder(null)}
              style={{ position: 'absolute', top: '14px', right: '14px', width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>✕</button>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>🚚 Mark as shipped</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px' }}>Order {shipOrder.order_num} · {shipOrder.customer_name}</p>
            <input className="rw-input" type="text" placeholder="Courier name (e.g. PostNL, FedEx)"
              value={courierName} onChange={e => setCourierName(e.target.value)} style={{ marginBottom: '10px' }} />
            <input className="rw-input" type="text" placeholder="Tracking number"
              value={trackingNum} onChange={e => setTrackingNum(e.target.value)} style={{ marginBottom: '10px' }} />
            <input className="rw-input" type="text" placeholder="Order notes (internal)..."
              value={orderNotes} onChange={e => setOrderNotes(e.target.value)} style={{ marginBottom: '14px' }} />
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>
              Track at <a href="https://www.17track.net/en" target="_blank" style={{ color: 'var(--accent)' }}>17track.net</a>
            </p>
            <button className="rw-btn rw-btn-pri rw-btn-full" disabled={!trackingNum.trim() || !courierName.trim() || shipping} onClick={handleShip}>
              {shipping ? 'Shipping...' : 'Mark shipped & notify customer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
