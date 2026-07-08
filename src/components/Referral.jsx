import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from './Shell';
import { money } from '../hooks/useCountdown';

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
  const [step, setStep] = useState('generate'); // generate | ready | loading
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

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setError('');
      setCopyFeedback('');
      if (userEmail) {
        setStep('loading');
        loadStats();
      } else {
        setStep('generate');
      }
    }
  }, [open, userEmail]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await fetch(`/api/referral/stats?email=${encodeURIComponent(userEmail)}`);
      const d = await r.json();
      if (d.code) {
        setCode(d.code);
        setShareUrl(d.shareUrl || `https://rewind-stores.com?ref=${d.code}`);
        setUsedCount(d.usedCount || 0);
        setMaxUses(d.maxUses || 10);
        setStatus(d.status || 'active');
        setRewards(d.rewards || []);
        setRedemptions(d.redemptions || []);
        setStep('ready');
      } else {
        setStep('generate');
      }
    } catch {
      setError('Could not load referral data');
      setStep('generate');
    }
    setStatsLoading(false);
  }, [userEmail]);

  const handleGenerate = useCallback(async () => {
    if (!userEmail) return;
    setGenerateLoading(true);
    setError('');
    try {
      const r = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const d = await r.json();
      if (d.code) {
        setCode(d.code);
        setShareUrl(d.shareUrl || `https://rewind-stores.com?ref=${d.code}`);
        setStep('ready');
        setUsedCount(d.usedCount || 0);
        if (showToast) showToast('🎉 Your referral code is ready! Check your email.');
      } else {
        setError(d.error || 'Failed to generate code');
      }
    } catch (e) {
      setError('Network error: ' + e.message);
    }
    setGenerateLoading(false);
  }, [userEmail, showToast]);

  const handleCopy = useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label || 'Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  }, []);

  const unclaimedRewards = rewards.filter(r => r.status === 'issued');
  const pendingRedemptions = redemptions.filter(r => r.status === 'pending');
  const qualifiedRedemptions = redemptions.filter(r => r.status === 'qualified');

  if (!open) return null;

  const activeRewardCount = unclaimedRewards.length;

  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal rw-modal--referral" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', gridTemplateColumns: '1fr' }}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>

        {step === 'loading' && (
          <div className="rw-modal-info" style={{ textAlign: 'center', padding: '60px 32px' }}>
            <div className="rw-spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            <p style={{ color: 'var(--muted)' }}>Loading your referral info…</p>
          </div>
        )}

        {step === 'generate' && (
          <div className="rw-modal-info" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎁</div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Give {REFERRAL_DISCOUNT}% off, get {REFERRAL_DISCOUNT}% off</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px', maxWidth: '380px', margin: '0 auto 20px' }}>
              Share your personal referral code with friends. They get <strong>{REFERRAL_DISCOUNT}% off</strong> their first order,
              and you get <strong>{REFERRAL_DISCOUNT}% off</strong> your next order for every friend who buys.
            </p>
            {!userEmail ? (
              <p style={{ color: 'var(--accent)', fontSize: '13px' }}>
                Sign up with your email to get a referral code.
              </p>
            ) : (
              <button className="rw-btn rw-btn-pri" onClick={handleGenerate} disabled={generateLoading}
                style={{ minWidth: '200px' }}>
                {generateLoading ? <><i className="rw-spinner" /> Generating…</> : 'Generate my referral code'}
              </button>
            )}
            {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
          </div>
        )}

        {step === 'ready' && (
          <div className="rw-modal-info" style={{ padding: '36px 32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ fontSize: '28px' }}>🎁</div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Your referral program</h2>
                <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '2px 0 0' }}>
                  Give {REFERRAL_DISCOUNT}% off &bull; Earn {REFERRAL_DISCOUNT}% off
                </p>
              </div>
            </div>

            {/* Code display */}
            <div className="rw-ref-code-box">
              <div className="rw-ref-code-label">Your code</div>
              <div className="rw-ref-code">{code}</div>
              <button className="rw-ref-copy-btn" onClick={() => handleCopy(code, 'Code copied!')}
                aria-label="Copy referral code">
                {copyFeedback === 'Code copied!' ? '✓' : <Icon name="plus" size={14} />}
              </button>
            </div>

            {/* Share button */}
            <button className="rw-btn rw-btn-pri rw-btn-full" style={{ marginTop: '12px' }}
              onClick={() => handleCopy(shareUrl, 'Link copied!')}>
              {copyFeedback === 'Link copied!' ? '✓ Link copied!' : '📋 Copy share link'}
            </button>

            {/* Stats summary */}
            <div className="rw-ref-stats">
              <div className="rw-ref-stat">
                <span className="rw-ref-stat-num">{usedCount}/{maxUses}</span>
                <span className="rw-ref-stat-label">Used</span>
              </div>
              <div className="rw-ref-stat">
                <span className="rw-ref-stat-num">{qualifiedRedemptions.length}</span>
                <span className="rw-ref-stat-label">Converted</span>
              </div>
              <div className="rw-ref-stat">
                <span className="rw-ref-stat-num">{activeRewardCount}</span>
                <span className="rw-ref-stat-label">Rewards</span>
              </div>
              <div className="rw-ref-stat">
                <span className="rw-ref-stat-num" style={{ color: status === 'active' ? 'var(--ink)' : 'var(--accent)' }}>
                  {status === 'active' ? '✓' : 'Disabled'}
                </span>
                <span className="rw-ref-stat-label">Status</span>
              </div>
            </div>

            {/* Rewards section */}
            {unclaimedRewards.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
                  Your rewards ({unclaimedRewards.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {unclaimedRewards.map(r => (
                    <div key={r.id} className="rw-ref-reward-card">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '15px', letterSpacing: '2px' }}>
                          {r.promoCode}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          {r.rewardValue}% off &bull; Expires {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : 'in 90 days'}
                        </div>
                      </div>
                      <button className="rw-ref-copy-btn" onClick={() => handleCopy(r.promoCode, 'Promo copied!')}
                        aria-label="Copy promo code">
                        {copyFeedback === 'Promo copied!' ? '✓' : <Icon name="plus" size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent activity */}
            {redemptions.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
                  Recent activity ({redemptions.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {redemptions.slice(0, 5).map(r => (
                    <div key={r.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', borderRadius: '8px', background: 'var(--bg)',
                      fontSize: '12px',
                    }}>
                      <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                        {r.refereeEmail?.split('@')[0]}…@{r.refereeEmail?.split('@')[1]}
                      </span>
                      <span style={{
                        fontWeight: 600,
                        color: r.flagged ? 'var(--accent)' : r.status === 'qualified' ? '#0E9F6E' : 'var(--muted)',
                      }}>
                        {r.status === 'qualified' ? '✓ Rewarded' : r.flagged ? '🚫 Flagged' : r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How it works */}
            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg)', borderRadius: '12px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: '1.6' }}>
              <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>How it works</strong>
              1. Share your code with a friend<br />
              2. They get {REFERRAL_DISCOUNT}% off their first order<br />
              3. After their order ships, you get {REFERRAL_DISCOUNT}% off your next order<br />
              4. Stack rewards — refer more friends, save more!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Inline referral input (for checkout) ── */
export function ReferralInput({ onApply, appliedReferral, referralDiscount, referralLoading, referralError }) {
  const [code, setCode] = useState('');

  useEffect(() => {
    if (appliedReferral) setCode('');
  }, [appliedReferral]);

  const handleApply = () => {
    if (!code.trim() || referralLoading) return;
    onApply(code.trim());
  };

  return (
    <div className="rw-co-sec">
      <h3>Referral code</h3>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <input className="rw-input" placeholder="Enter referral code"
          value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          disabled={!!appliedReferral}
          style={{ marginBottom: 0, flex: 1 }} />
        {!appliedReferral ? (
          <button className="rw-btn rw-btn-ghost" onClick={handleApply}
            disabled={!code.trim() || referralLoading}
            style={{ padding: '13px 18px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {referralLoading ? '…' : 'Apply'}
          </button>
        ) : (
          <button className="rw-btn rw-btn-ghost" onClick={() => onApply('')}
            style={{ padding: '13px 18px', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--accent)' }}>
            Remove
          </button>
        )}
      </div>
      {referralLoading && (
        <span style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '6px', display: 'block', fontWeight: 500 }}>
          ⏳ Checking…
        </span>
      )}
      {appliedReferral && (
        <span style={{ color: '#0E9F6E', fontSize: '13px', marginTop: '6px', display: 'block', fontWeight: 600 }}>
          ✓ Referral applied — {referralDiscount}% off!
        </span>
      )}
      {referralError && !appliedReferral && (
        <span style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px', display: 'block' }}>
          {referralError}
        </span>
      )}
      <p style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '6px', lineHeight: '1.4' }}>
        Have a referral code? Enter it above to get {REFERRAL_DISCOUNT}% off your order.
      </p>
    </div>
  );
}
