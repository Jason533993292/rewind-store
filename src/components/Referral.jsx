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
  // WIP — referrals are temporarily disabled
  const [referralsEnabled, setReferralsEnabled] = useState(() => {
    try { return localStorage.getItem('rw_referrals_enabled') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('rw_referrals_enabled', referralsEnabled ? 'true' : 'false'); } catch {}
  }, [referralsEnabled]);

  const [step, setStep] = useState('generate');
  const [code, setCode] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [usedCount, setUsedCount] = useState(0);
  const [maxUses, setMaxUses] = useState(10);
  const [status, setStatus] = useState('active');
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setCopyFeedback('');
      if (userEmail && referralsEnabled) {
        setStep('loading');
        loadStats();
      } else {
        setStep('generate');
      }
    }
  }, [open, userEmail, referralsEnabled]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await fetch(`/api/referral/stats?email=${encodeURIComponent(userEmail)}`);
      const d = await r.json();
      if (d.code) {
        setCode(d.code); setShareUrl(d.shareUrl || `https://rewind-stores.com?ref=${d.code}`);
        setUsedCount(d.usedCount || 0); setMaxUses(d.maxUses || 10);
        setStatus(d.status || 'active'); setRewards(d.rewards || []); setRedemptions(d.redemptions || []);
        setStep('ready');
      } else { setStep('generate'); }
    } catch { setError('Could not load referral data'); setStep('generate'); }
    setStatsLoading(false);
  }, [userEmail]);

  if (!open) return null;

  return (
    <div className="rw-ref-page">
      <div className="rw-ref-page-header">
        <button className="rw-btn rw-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="arrow" size={16} /> Back
        </button>
      </div>
      <div className="rw-ref-page-body">
        {/* WIP Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #ffb347, #ff6b35)', borderRadius: '16px',
          padding: '32px 24px', textAlign: 'center', margin: '20px auto', maxWidth: '500px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚧</div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
            Work in Progress
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px' }}>
            The referral system is currently under construction. Stay tuned — we're building something great!
          </p>

          {/* Enable/Disable toggle */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: 'rgba(255,255,255,0.2)', borderRadius: '999px', padding: '6px 14px',
          }}>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>Enable referrals</span>
            <button onClick={() => setReferralsEnabled(v => !v)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                background: referralsEnabled ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.3)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
              }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                position: 'absolute', top: '3px', left: referralsEnabled ? '23px' : '3px',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
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
        🚧 The referral system is currently under construction. Check back soon!
      </p>
    </div>
  );
}
