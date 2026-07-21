import React from 'react';

export default function LegalPage({ page, onClose }) {
  const pages = {
    privacy: {
      title: 'Privacy Policy',
      sections: [
        { heading: 'What We Collect', text: 'When you place an order, we collect your name, email address, shipping address, and payment information. When you use the chat feature, we collect your email address. We do not sell, rent, or share your personal data with third parties except as necessary to process your order.' },
        { heading: 'Who Processes Your Data', text: 'Your data is stored on Supabase (database hosting), payments are processed by Stripe, and order emails are sent via Resend. These are our trusted service providers who are GDPR-compliant and process data under written agreements with us.' },
        { heading: 'Chat Messages', text: 'Chat messages are stored on our servers to provide customer support. We review messages only when actively assisting you. Messages are automatically deleted 90 days after a chat session closes.' },
        { heading: 'Cookies', text: 'We use essential cookies to keep you logged into the admin panel and to process your cart. Stripe uses cookies for payment security. No advertising or tracking cookies are used.' },
        { heading: 'Your Rights', text: 'You have the right to access, correct, or delete your personal data. You can request data export or deletion by emailing orders@rewind-stores.com. We will respond within 30 days as required by GDPR.' },
        { heading: 'Data Retention', text: 'Order data is kept for 7 years as required by tax law. Chat messages are deleted after 90 days. Wishlists are kept until you request deletion.' },
        { heading: 'Contact', text: 'For privacy-related questions, contact us at orders@rewind-stores.com. You can also lodge a complaint with your local data protection authority.' },
      ],
    },
    terms: {
      title: 'Terms of Service',
      sections: [
        { heading: 'About REWIND', text: 'REWIND is a vintage streetwear store operating from China. All items are pre-owned vintage pieces — minor wear and variation from product photos is normal and part of the vintage experience.' },
        { heading: 'Orders', text: 'By placing an order, you agree to pay the listed price plus shipping. All prices are in Euros (€). We reserve the right to cancel orders for out-of-stock items or suspected fraud.' },
        { heading: 'Shipping', text: 'Orders ship from China within 24 hours of payment confirmation. Delivery times vary by destination (see our Shipping page for estimates). We are not responsible for customs delays, duties, or import taxes.' },
        { heading: 'Returns', text: 'Returns are accepted within 14 days of delivery for a full refund (minus return shipping). Items must be unworn, unwashed, and in original condition. Contact orders@rewind-stores.com to initiate a return. Refunds are processed within 5-10 business days.' },
        { heading: 'Limitation of Liability', text: 'REWIND is not liable for any indirect, incidental, or consequential damages. Our maximum liability is limited to the purchase price of the item. Vintage items are sold "as-is" — all sales are final after the 14-day return window.' },
        { heading: 'Governing Law', text: 'These terms are governed by the laws of Belgium. Any disputes will be resolved in the courts of Brussels, Belgium.' },
        { heading: 'Changes', text: 'We may update these terms from time to time. Continued use of the store after changes constitutes acceptance of the new terms. The last update was July 2026.' },
      ],
    },
    returns: {
      title: 'Returns & Refunds',
      sections: [
        { heading: 'Return Window', text: 'You have 14 days from delivery to return any item for a full refund (excluding return shipping). Contact orders@rewind-stores.com with your order number to start a return.' },
        { heading: 'Condition Requirements', text: "Items must be unworn, unwashed, unaltered, and in the same condition you received them. All tags must be attached. Items showing wear, stains, or alterations are not eligible for return." },
        { heading: 'Return Shipping', text: 'Return shipping is paid by the buyer unless the item was damaged or incorrect. We recommend using a tracked shipping method — we are not responsible for lost return packages. Return shipping should be sent to the address provided in your return confirmation email.' },
        { heading: 'Refund Timeline', text: 'Refunds are processed within 5-10 business days after we receive and inspect the returned item. The refund is issued to the original payment method. You will receive an email confirmation when the refund is processed.' },
        { heading: 'Damaged or Incorrect Items', text: 'If you received a damaged or incorrect item, contact us within 48 hours of delivery with photos. We will provide a prepaid return label and send a replacement or full refund including shipping.' },
        { heading: 'Non-Returnable Items', text: 'Final sale items (marked as such), gift cards, and items damaged by the customer are not eligible for return. Vintage items with disclosed flaws are not eligible for return based on those specific flaws.' },
      ],
    },
    shipping: {
      title: 'Shipping Information',
      sections: [
        { heading: 'Where We Ship From', text: 'All orders ship from China within 24 hours of payment confirmation. We use reliable international carriers with full tracking.' },
        { heading: 'Delivery Estimates', text: 'East Asia: 3-7 business days · Southeast Asia: 5-10 days · Europe & North America: 7-14 days · Middle East: 10-18 days · Oceania: 10-16 days · South America & Africa: 14-21 days.' },
        { heading: 'Customs & Duties', text: 'International orders may be subject to customs duties and import taxes. These are the responsibility of the buyer and are not included in the shipping cost. Check your local customs office for rates.' },
        { heading: 'Tracking', text: 'All orders include tracking. You will receive a tracking number by email once your order ships. Track your package at 17track.net.' },
        { heading: 'Free Shipping', text: 'Orders over €150 qualify for free shipping worldwide. This is applied automatically at checkout.' },
      ],
    },
  };

  const content = pages[page];
  if (!content) return null;

  const style = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' };

  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '600px', gridTemplateColumns: '1fr', maxHeight: '80vh', overflowY: 'auto', padding: '32px', position: 'relative' }}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: '14px', right: '14px', width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: '16px', color: 'var(--muted)' }}>✕</button>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 24px' }}>{content.title}</h2>
        {content.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>{s.heading}</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--muted)', margin: 0 }}>{s.text}</p>
          </div>
        ))}
        <button onClick={onClose}
          style={{ marginTop: '8px', padding: '10px 24px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.opacity = '0.85'; }}
          onMouseOut={e => { e.target.style.opacity = '1'; }}>
          Close
        </button>
      </div>
    </div>
  );
}
