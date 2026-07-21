import React from 'react';

export default function LegalPage({ page, onClose }) {
  const pages = {
    privacy: {
      title: 'Privacy Policy',
      sections: [
        { heading: 'Who We Are', text: 'REWIND is a vintage streetwear store operated by Philippe Anaman. For questions about your data, contact us at orders@rewind-stores.com.' },
        { heading: 'What We Collect', text: 'When you place an order, we collect your name, email address, shipping address, IP address, and payment information. When you use the chat feature, we collect your email address and IP address. We also store your wishlist to save items for later. We do not sell, rent, or share your personal data with third parties except as necessary to process your order.' },
        { heading: 'Why We Collect IP Addresses', text: 'We use IP addresses to detect and prevent fraud, block abusive users, and comply with applicable laws. Your IP address is stored securely alongside your order and any chat sessions in our database.' },
        { heading: 'How We Protect Your Data', text: 'All personal data is stored in Supabase, a GDPR-compliant database with encryption at rest and in transit. Access to your data is restricted to the store operator only — no third party has direct database access. Payment data never reaches our servers; it is handled entirely by Stripe, a PCI-DSS Level 1 certified payment processor. We implement industry-standard security measures including encrypted connections (HTTPS), HttpOnly session cookies, rate limiting, and fraud detection to protect your information.' },
        { heading: 'Who Processes Your Data', text: 'Your data is stored on Supabase (database hosting), payments are processed by Stripe, order emails are sent via Resend, and cancellation emails may be drafted with the assistance of Google\'s Gemini AI. These are our trusted service providers who are GDPR-compliant and process data under written agreements with us. Some of these providers (including Google and Stripe) may process data outside the EEA under Standard Contractual Clauses or equivalent safeguards.' },
        { heading: 'Chat Messages', text: 'Chat messages are stored on our servers to provide customer support. We review messages only when actively assisting you. Messages are automatically deleted 90 days after a chat session closes.' },
        { heading: 'Cookies', text: 'We use essential cookies to keep you logged into the admin panel and to process your cart. Stripe uses cookies for payment security. No advertising or tracking cookies are used.' },
        { heading: 'Your Rights', text: 'You have the right to access, correct, delete, or receive a portable copy of your personal data, and to object to or request restriction of certain processing. Where we rely on your consent, you may withdraw it at any time. You also have the right to lodge a complaint with your local data protection authority. Contact orders@rewind-stores.com — we will respond within 30 days as required by GDPR.' },
        { heading: 'Automated Decisions', text: 'We use automated fraud detection (such as email and IP blocklists) to identify potentially fraudulent orders. If your order is cancelled by our automated systems, you may contact us for a human review of the decision.' },
        { heading: 'Data Retention', text: 'Order data is kept for 7 years as required by tax law. Chat messages are deleted after 90 days. Wishlists are kept until you request deletion. IP addresses are retained alongside the records they are associated with.' },
        { heading: 'Contact', text: 'For privacy-related questions, contact us at orders@rewind-stores.com. You can also lodge a complaint with your local data protection authority.' },
      ],
    },
    terms: {
      title: 'Terms of Service',
      sections: [
        { heading: 'About REWIND', text: 'REWIND is a vintage streetwear store operated by Philippe Anaman. All items are pre-owned vintage pieces — minor wear and variation from product photos is normal and part of the vintage experience. Orders are fulfilled from our supplier partners in China.' },
        { heading: 'Orders', text: 'By placing an order, you agree to pay the listed price plus shipping. All prices are in Euros (€). We reserve the right to cancel orders for out-of-stock items, suspected fraud, or other valid reasons. If your order is cancelled, you will be notified with the reason.' },
        { heading: 'Shipping', text: 'Orders ship from China within 24 hours of payment confirmation. Delivery times vary by destination (see our Shipping page for estimates). We are not responsible for customs delays, duties, or import taxes.' },
        { heading: 'Right of Withdrawal', text: 'Under EU consumer law, you have the right to withdraw from your purchase within 14 days of receiving your order. This is your statutory right — you may exercise it by contacting orders@rewind-stores.com or by any clear statement. See our Returns & Refunds page for full details.' },
        { heading: 'Statutory Guarantee', text: 'This does not affect your statutory legal guarantee against defects in goods that do not conform to their description. This guarantee applies for 2 years from delivery (which may be shortened to 1 year for pre-owned goods in some EU member states with clear notice at time of purchase), separately from the 14-day withdrawal right. Nor does it limit our liability for death or personal injury caused by our negligence, or for fraud.' },
        { heading: 'Liability', text: 'Our liability for defective products is governed by mandatory consumer protection laws of your country of residence. Nothing in these terms excludes or limits our liability for death or personal injury caused by our negligence, or for fraudulent misrepresentation.' },
        { heading: 'Governing Law', text: 'These terms are governed by the laws of Belgium. If you are a consumer resident in the EU, this does not deprive you of the protection of mandatory consumer-protection laws of your country of residence, or of your right to bring proceedings before the courts of your own country under the Brussels I (Recast) Regulation.' },
        { heading: 'Changes', text: 'We may update these terms from time to time. Continued use of the store after changes constitutes acceptance of the new terms. The last update was July 2026.' },
      ],
    },
    returns: {
      title: 'Returns & Refunds',
      sections: [
        { heading: 'Your Right of Withdrawal', text: 'Under EU law, you have a statutory right to withdraw from your purchase within 14 days of delivery. To exercise this right, contact orders@rewind-stores.com with your order number. You may also use any other clear statement of your intent to withdraw — our email process is just the easiest way to get started.' },
        { heading: 'Return Shipping', text: 'Return shipping is paid by the buyer unless the item was damaged or incorrect. We recommend using a tracked shipping method — we are not responsible for lost return packages. The return address will be provided in your return confirmation email. Please note that return shipping from the EU to China may involve costs that are disproportionate to the item price — please consider this before purchasing.' },
        { heading: 'Condition Requirements', text: 'You may handle the item to inspect it as you would in a physical store (for example, trying on clothing). We may deduct from your refund for any diminished value caused by handling beyond what is necessary to establish the nature, characteristics, and functioning of the goods. Items must be returned in the condition they were received, with all tags attached.' },
        { heading: 'Refund Timeline', text: 'Refunds are processed within 14 days of us receiving the returned goods or receiving proof of return shipment (whichever is earlier). The refund is issued to the original payment method. We use the standard 14-day window to inspect and process your return — you will receive an email when the refund is initiated.' },
        { heading: 'Damaged or Incorrect Items', text: 'If you received a damaged or incorrect item, contact us within 48 hours of delivery with photos. We will provide a prepaid return label and send a replacement or full refund including your original shipping costs.' },
        { heading: 'Non-Returnable Items', text: 'Items that have been personalized or custom-altered cannot be returned. Items damaged by the customer after delivery are not eligible for return under the statutory right of withdrawal, though they may still be covered by the statutory conformity guarantee if the defect existed at delivery.' },
      ],
    },
    shipping: {
      title: 'Shipping Information',
      sections: [
        { heading: 'Where We Ship From', text: 'REWIND is based in Belgium. Orders are fulfilled from our supplier partners in China and shipped within 24 hours of payment confirmation. We use reliable international carriers with full tracking.' },
        { heading: 'Delivery Estimates', text: 'East Asia: 3-7 business days · Southeast Asia: 5-10 days · Europe & North America: 7-14 days · Middle East: 10-18 days · Oceania: 10-16 days · South America & Africa: 14-21 days.' },
        { heading: 'Customs, Duties & VAT', text: 'International orders may be subject to customs duties, import taxes, and handling fees on delivery. Since July 2021, all commercial imports into the EU include VAT regardless of value. Unless stated otherwise at checkout, these charges are the responsibility of the buyer and are not included in the price paid at REWIND. Carriers may charge an additional handling fee for processing customs clearance — typically €5–€25 depending on the carrier and country. Check your local customs office for current rates and policies.' },
        { heading: 'Tracking', text: 'All orders include tracking. You will receive a tracking number by email once your order ships. Track your package at 17track.net.' },
        { heading: 'Free Shipping', text: 'Orders over €150 qualify for free shipping worldwide. This is applied automatically at checkout.' },
      ],
    },
  };

  const content = pages[page];
  if (!content) return null;

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
