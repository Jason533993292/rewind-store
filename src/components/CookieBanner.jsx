import React, { useState } from 'react';

export default function CookieBanner() {
  const [accepted, setAccepted] = useState(() => {
    try { return localStorage.getItem('rw_cookie_consent') === 'true'; } catch { return false; }
  });

  if (accepted) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100001,
      background: 'var(--surface)', borderTop: '1px solid var(--line)',
      padding: '14px 20px', display: 'flex', gap: '12px', alignItems: 'center',
      justifyContent: 'center', flexWrap: 'wrap', fontSize: '13px', color: 'var(--muted)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      <span>
        We use essential cookies to process your orders.{' '}
        <a href="#" onClick={e => { e.preventDefault(); window.location.hash = '#?info=cookies'; }}
          style={{ color: 'var(--accent)', fontWeight: 600 }}>Cookie Policy</a>
      </span>
      <button onClick={() => { localStorage.setItem('rw_cookie_consent', 'true'); setAccepted(true); }}
        style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
        OK
      </button>
    </div>
  );
}
