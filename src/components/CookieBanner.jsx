import React, { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('rw_cookie_notice')) return;
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem('rw_cookie_notice', 'true');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: 100001,
      background: 'var(--ink)', color: '#fff', padding: '16px 24px',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      gap: '16px', flexWrap: 'wrap', fontSize: '13px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    }}>
      <span style={{ opacity: 0.85, textAlign: 'center' }}>
        REWIND uses essential cookies for payments (Stripe), order emails (Resend), and store functions. No advertising or tracking cookies.
        <br />
        <a onClick={() => { nav('/privacy'); setShow(false); }} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
          Read our Privacy Policy →
        </a>
      </span>
      <button onClick={dismiss}
        style={{
          padding: '8px 20px', borderRadius: '999px', border: 'none',
          background: 'var(--accent)', color: '#fff', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
        onMouseOver={e => { e.target.style.opacity = '0.85'; }}
        onMouseOut={e => { e.target.style.opacity = '1'; }}>
        Got it
      </button>
    </div>
  );
}
