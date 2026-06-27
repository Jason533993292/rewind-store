import React, { useState } from 'react';
import { Icon } from './Shell';

const PAGES = {
  shipping: {
    title: 'Shipping',
    sections: [
      { heading: 'Delivery Time', text: 'All orders are processed within 24 hours. Standard EU delivery takes 2–4 business days. Express delivery is available at checkout for 1–2 business days.' },
      { heading: 'Shipping Costs', text: 'Standard shipping within Belgium: €5. Standard shipping within the EU: €10. Express shipping: €15. Free standard shipping on all orders over €150.' },
      { heading: 'International', text: 'We currently ship to all EU countries. International shipping outside the European Union is not yet available.' },
      { heading: 'Order Tracking', text: 'Once your order ships, you will receive an email with a tracking number. You can also check your order status on our Track Order page.' },
    ]
  },
  returns: {
    title: 'Returns & Exchanges',
    sections: [
      { heading: 'Return Policy', text: 'You have 14 days from delivery to return any unused item in its original condition. All items are inspected upon return.' },
      { heading: 'How to Return', text: 'Email us at orders@rewind-stores.com with your order number and the items you wish to return. We will provide you with a return label. Pack the items securely and drop them off at your nearest post office.' },
      { heading: 'Refunds', text: 'Refunds are processed within 5 business days after we receive the returned items. The refund will be issued to your original payment method.' },
      { heading: 'Exchanges', text: 'We do not offer direct exchanges. If you need a different size, please return your item and place a new order for the fastest delivery.' },
      { heading: 'Non-Returnable Items', text: 'For hygiene reasons, we cannot accept returns on underwear, swimwear, or face masks. Vintage items may show signs of wear — please read the product description carefully before purchasing.' },
    ]
  },
  tracking: {
    title: 'Track Your Order',
    sections: [
      { heading: 'Where Is My Order?', text: 'Once your order ships, you will receive an email with a tracking link. Use that link to follow your package in real time.' },
      { heading: 'No Tracking Email?', text: 'Check your spam or junk folder. If you still cannot find it, email us at orders@rewind-stores.com with your order number and we will look it up for you.' },
      { heading: 'Delivery Issues', text: 'If your package is marked as delivered but you have not received it, check with your neighbours or local post office. If it has been more than 5 business days past the estimated delivery date, contact us and we will investigate.' },
    ]
  },
  payments: {
    title: 'Payment Methods',
    sections: [
      { heading: 'Accepted Payments', text: 'We accept PayPal, Payconiq, Apple Pay, Bancontact, and Klarna. All payments are processed securely through our payment partners.' },
      { heading: 'When You Are Charged', text: 'Your payment is captured at the time you place your order. For Klarna Pay Later, you will receive payment instructions from Klarna directly.' },
      { heading: 'Payment Security', text: 'All transactions are encrypted with industry-standard SSL/TLS. We never store your full card details. Your payment data is handled by our PCI-compliant payment processors.' },
      { heading: 'Currency', text: 'All prices are in Euros (€). If your bank account uses a different currency, your bank will apply their exchange rate at the time of purchase.' },
    ]
  },
  orders: {
    title: 'Your Orders',
    component: 'orders',
  }
};

export default function InfoModal({ page, onClose }) {
  const info = PAGES[page];
  const [lookupEmail, setLookupEmail] = useState('');
  const [orders, setOrders] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  if (!info) return null;

  const handleLookup = async () => {
    if (!lookupEmail) return;
    setLoadingOrders(true);
    try {
      const r = await fetch('/api/get-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: lookupEmail }) });
      const d = await r.json();
      setOrders(d.orders || []);
    } catch { setOrders([]); }
    setLoadingOrders(false);
  };

  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', padding: '36px 32px' }}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>

        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 28px 0', color: 'var(--ink)' }}>{info.title}</h2>

        {info.component === 'orders' ? (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Enter the email you used to place your order to see your order history.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input className="rw-input" placeholder="your@email.com" value={lookupEmail}
                onChange={e => setLookupEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }} />
              <button onClick={handleLookup} disabled={loadingOrders}
                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {loadingOrders ? 'Searching...' : 'Look up'}
              </button>
            </div>
            {orders !== null && orders.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No orders found for that email.</p>
            )}
            {orders && orders.length > 0 && (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {orders.map((o, i) => (
                  <div key={i} style={{ padding: '14px', marginBottom: '10px', background: 'var(--line)', borderRadius: '10px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>{o.order_num}</div>
                    <div style={{ color: 'var(--muted)' }}>{(Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size})`).join(', ')}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontWeight: 700 }}>€{o.total}</span>
                      <span style={{ color: o.status === 'shipped' ? '#4caf50' : o.status === 'ordered' ? '#2979FF' : '#cc8b00' }}>
                        {o.status === 'shipped' ? '✅ Shipped' : o.status === 'ordered' ? '📦 Ordered' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {info.sections.map((s, i) => (
              <div key={i} style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--ink)' }}>{s.heading}</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--muted)', margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </>
        )}

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '8px' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            Questions? Email <a href="mailto:orders@rewind-stores.com" style={{ color: 'var(--accent)', fontWeight: 600 }}>orders@rewind-stores.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
