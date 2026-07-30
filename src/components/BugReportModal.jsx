import React, { useState } from 'react';
import { Icon } from './Shell';

export default function BugReportModal({ email: prefilledEmail, onClose, showToast }) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(prefilledEmail || '');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const page = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  const browser = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : '';

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 10) {
      showToast('Please describe the bug in at least 10 characters');
      return;
    }
    setSending(true);
    try {
      const r = await fetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), email: email.trim() || null, page, browser }),
      });
      if (!r.ok) throw new Error('Failed to submit');
      setDone(true);
      showToast('Thanks! Bug report submitted.');
      setTimeout(() => onClose(), 1200);
    } catch {
      showToast('Could not submit — please try again or email phil@rewind-stores.com');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rw-modal-wrap" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', padding: '32px', display: 'block' }}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 20px', color: 'var(--ink)' }}>
          Report a Bug
        </h2>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <p style={{ fontSize: '15px', color: 'var(--muted)' }}>Thanks for the report — we'll look into it.</p>
          </div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              What happened? <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe what went wrong, what you expected, and any steps to reproduce..."
              rows={4}
              className="rw-input"
              style={{ width: '100%', resize: 'vertical', minHeight: '80px', marginBottom: '16px', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.5' }}
              autoFocus
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Your email <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional — if you want a reply)</span>
            </label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rw-input"
              style={{ width: '100%', marginBottom: '16px', fontSize: '14px' }}
            />

            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '20px', lineHeight: '1.6' }}>
              <div>Page: <span style={{ color: 'var(--ink)' }}>{page || '/'}</span></div>
              <div style={{ wordBreak: 'break-all' }}>Browser: <span style={{ color: 'var(--ink)' }}>{browser.slice(0, 80)}</span></div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="rw-btn" onClick={onClose}
                style={{ padding: '10px 20px', fontSize: '14px' }}>Cancel</button>
              <button className="rw-btn rw-btn-pri" onClick={handleSubmit} disabled={sending || message.trim().length < 10}
                style={{ padding: '10px 20px', fontSize: '14px', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
