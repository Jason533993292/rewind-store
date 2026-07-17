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

  useEffect(() => { if (open) setError(''); }, [open]);

  if (!open) return null;

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
          padding: '40px 24px', textAlign: 'center', margin: '40px auto', maxWidth: '480px',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px', lineHeight: 1 }}>🚧</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>
            Coming soon
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.6, margin: '0' }}>
            Referrals aren't ready yet. We'll let you know when they launch.
          </p>
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
        🚧 The referral system is currently under construction. Check back soon!
      </p>
    </div>
  );
}
