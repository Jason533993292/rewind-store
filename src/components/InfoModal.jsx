import React from 'react';

const PAGES = {
  shipping: {
    title: 'Shipping',
    sections: [
      { heading: 'Delivery time', text: 'All orders are processed within 24 hours. Standard EU delivery takes 2–4 business days. Express delivery is available at checkout (1–2 business days).' },
      { heading: 'Shipping costs', text: 'Standard shipping within Belgium: €5. Standard shipping within EU: €10. Free standard shipping on orders over €150. Express shipping: €15.' },
      { heading: 'International', text: 'We currently ship to all EU countries. International shipping outside the EU is not yet available.' },
      { heading: 'Order tracking', text: 'Once your order ships, you will receive a confirmation email with a tracking number. You can also track your order on our Track Order page.' },
    ]
  },
  returns: {
    title: 'Returns & Exchanges',
    sections: [
      { heading: 'Return policy', text: 'You have 14 days from delivery to return any unused item in its original condition. All items are inspected upon return.' },
      { heading: 'How to return', text: 'Email us at philippekojoanaman@gmail.com with your order number and the items you wish to return. We will send you a return label. Pack the items securely and drop them off at your nearest post office.' },
      { heading: 'Refunds', text: 'Refunds are processed within 5 business days after we receive the returned items. The refund will be issued to your original payment method.' },
      { heading: 'Exchanges', text: 'We do not offer direct exchanges. If you need a different size, please return your item and place a new order. This ensures the fastest delivery.' },
      { heading: 'Non-returnable', text: 'For hygiene reasons, we cannot accept returns on underwear, swimwear, or face masks. Vintage items may show signs of wear — please check the product description carefully before purchasing.' },
    ]
  },
  tracking: {
    title: 'Track Your Order',
    sections: [
      { heading: 'Where is my order?', text: 'Once your order is shipped, you will receive an email with a tracking link. You can use that link to follow your package in real time.' },
      { heading: 'Not received a tracking email?', text: 'Check your spam/junk folder. If you still cannot find it, email us at philippekojoanaman@gmail.com with your order number and we will look it up for you.' },
      { heading: 'Delivery issues', text: 'If your package is marked as delivered but you haven\'t received it, check with your neighbours or your local post office. If it\'s been more than 5 business days past the estimated delivery date, contact us and we will investigate.' },
    ]
  }
};

export default function InfoModal({ page, onClose }) {
  const info = PAGES[page];
  if (!info) return null;

  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', padding: '32px' }}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>{info.title}</h2>

        {info.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: '#16130F' }}>{s.heading}</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#6E665A', margin: 0 }}>{s.text}</p>
          </div>
        ))}

        <p style={{ fontSize: '12px', color: '#aaa', marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
          Questions? Email <a href="mailto:philippekojoanaman@gmail.com" style={{ color: '#FF4D14' }}>philippekojoanaman@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
