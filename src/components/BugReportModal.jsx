import React, { useState } from 'react';
import { Icon } from './Shell';

function detectDevice() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android phone/tablet';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown device';
}

function detectBrowser() {
  const ua = navigator.userAgent;
  let name = 'Unknown browser';
  if (/Edg\//.test(ua)) name = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) name = 'Opera';
  else if (/SamsungBrowser/.test(ua)) name = 'Samsung Internet';
  else if (/CriOS\//.test(ua)) name = 'Chrome (iOS)';
  else if (/FxiOS\//.test(ua)) name = 'Firefox (iOS)';
  else if (/Chrome\//.test(ua)) name = 'Chrome';
  else if (/Firefox\//.test(ua)) name = 'Firefox';
  else if (/Version\/[\d.]+.*Safari\//.test(ua)) name = 'Safari';
  const ver = (ua.match(/(?:Chrome|Firefox|Edg|OPR|Version)\/([\d.]+)/) || [])[1];
  return ver ? `${name} ${ver.split('.')[0]}` : name;
}

export default function BugReportModal({ email: prefilledEmail, onClose, showToast }) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(prefilledEmail || '');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const page = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  const device = typeof navigator !== 'undefined' ? detectDevice() : '';
  const browser = typeof navigator !== 'undefined' ? detectBrowser() : '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const submittedAt = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

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
        body: JSON.stringify({ message: message.trim(), email: email.trim() || null, page, device, browser, submittedAt, ua }),
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
            <label htmlFor="bug-message" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              What happened? <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <textarea
              id="bug-message"
              name="bug-message"
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 20))}
              placeholder="Describe what went wrong (max 20 characters)..."
              rows={4}
              maxLength={20}
              className="rw-input"
              style={{ width: '100%', resize: 'vertical', minHeight: '80px', marginBottom: '2px', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.5' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', marginBottom: '16px', color: 20 - message.length <= 3 ? '#e5484d' : 'var(--muted)' }}>
              {Math.max(0, 20 - message.length)} {Math.max(0, 20 - message.length) === 1 ? 'character' : 'characters'} left
            </div>

            <label htmlFor="bug-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Your email <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional — if you want a reply)</span>
            </label>
            <input
              id="bug-email"
              name="bug-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rw-input"
              autoComplete="email"
              style={{ width: '100%', marginBottom: '16px', fontSize: '14px' }}
            />

            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '20px', lineHeight: '1.7' }}>
              <div>Page: <span style={{ color: 'var(--ink)' }}>{page || '/'}</span></div>
              <div>Device: <span style={{ color: 'var(--ink)' }}>{device}</span></div>
              <div>Browser: <span style={{ color: 'var(--ink)' }}>{browser}</span></div>
              <div>Sent: <span style={{ color: 'var(--ink)' }}>{submittedAt}</span></div>
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
