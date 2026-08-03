import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from './Shell';

/*
 * ── REWIND Referral System ──
 *
 * Components:
 * - ReferralButton: small "Invite friends" button for header/checkout
 * - ReferralDialog: full modal for generating/sharing referral code + viewing stats
 * - ReferralInput: inline input in checkout for entering a referral code
 * - AdminReferralPanel: admin view of all referrals
 */

const REFERRAL_DISCOUNT = 10;

/* ── Referral modal dialog ── */
export function ReferralDialog({ open, onClose, userEmail, showToast }) {
  const [error, setError] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subState, setSubState] = useState('idle'); // idle | loading | ok | err
  const [subMsg, setSubMsg] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setSubEmail(userEmail || '');
      setSubState('idle');
      setSubMsg('');
    }
  }, [open, userEmail]);

  if (!open) return null;

  const subscribe = async () => {
    const email = subEmail.trim();
    if (!email) { setSubState('err'); setSubMsg('Enter your email first'); return; }
    setSubState('loading');
    setSubMsg('');
    try {
      const r = await fetch('/api/referral-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) { setSubState('err'); setSubMsg(d.error || 'Something went wrong'); return; }
      setSubState('ok');
      setSubMsg("You're on the list — we'll email you when referrals launch.");
    } catch {
      setSubState('err');
      setSubMsg('Network error — try again');
    }
  };

  return (
    <div className="rw-ref-page">
      <div className="rw-ref-page-header">
        <button className="rw-btn rw-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="arrow" size={16} /> Back
        </button>
      </div>
      <div className="rw-ref-page-body">
        <div style={{
          background: '#16130F', borderRadius: '16px',
          padding: '40px 24px', textAlign: 'center', margin: '40px auto 0', maxWidth: '480px',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
            Coming soon
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.6, margin: '0' }}>
            Referrals aren't ready yet. We'll let you know when they launch.
          </p>
        </div>

        <div style={{
          position: 'relative', overflow: 'hidden', maxWidth: '480px', margin: '16px auto 40px',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none', mixBlendMode: 'overlay',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: 'var(--ink)' }}>Get notified</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Subscribe to be updated when the referral system updates.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="rw-input" type="email" placeholder="your@email.com"
                value={subEmail}
                onChange={e => setSubEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') subscribe(); }}
                style={{ flex: 1 }}
                aria-label="Email for referral updates"
              />
              <button
                className="rw-btn"
                onClick={subscribe}
                disabled={subState === 'loading'}
                style={{ padding: '10px 18px', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {subState === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </div>
            {subMsg && (
              <p style={{ fontSize: '12px', margin: '10px 0 0', color: subState === 'ok' ? 'var(--ink)' : '#dc2626' }}>
                {subMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Inline referral input (for checkout) — WIP, disabled ── */
export function ReferralInput({ onApply, appliedReferral, referralDiscount, referralLoading, referralError }) {
  return (
    <div className="rw-co-sec">
      <h3>Referral code</h3>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '6px 0', lineHeight: '1.4' }}>
        The referral system is currently under construction. Check back soon!
      </p>
    </div>
  );
}
