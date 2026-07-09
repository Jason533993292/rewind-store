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
    <div className="rw-ref-page">
      <div className="rw-ref-page-header">
        <button className="rw-btn rw-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="arrow" size={16} /> Back
        </button>
      </div>
      <div className="rw-ref-page-body">
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '80px 32px' }}>
            <div className="rw-spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            <p style={{ color: 'var(--muted)' }}>Loading your referral info…</p>
          </div>
        )}

        {step === 'generate' && (
          <div style={{ textAlign: 'center', padding: '60px 32px', maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎁</div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '12px' }}>Give {REFERRAL_DISCOUNT}% off, get {REFERRAL_DISCOUNT}% off</h2>
            <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: '1.7', marginBottom: '28px', maxWidth: '420px', margin: '0 auto 28px' }}>
              Share your personal referral code with friends. They get <strong>{REFERRAL_DISCOUNT}% off</strong> their first order,
              and you get <strong>{REFERRAL_DISCOUNT}% off</strong> your next order for every friend who buys.
            </p>
            {!userEmail ? (
              <p style={{ color: 'var(--accent)', fontSize: '14px' }}>
                Sign up with your email to get a referral code.
              </p>
            ) : (
              <button className="rw-btn rw-btn-pri" onClick={handleGenerate} disabled={generateLoading}
                style={{ minWidth: '220px', padding: '16px 32px', fontSize: '16px' }}>
                {generateLoading ? <><i className="rw-spinner" /> Generating…</> : 'Generate my referral code'}
              </button>
            )}
            {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
          </div>
        )}

        {step === 'ready' && (
          <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
              <div style={{ fontSize: '36px' }}>🎁</div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Your referral program</h2>
                <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
                  Give {REFERRAL_DISCOUNT}% off &bull; Earn {REFERRAL_DISCOUNT}% off
                </p>
              </div>
            </div>

            {/* Code display */}
            <div className="rw-ref-code-box" style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--line)' }}>
              <div className="rw-ref-code-label">Your code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="rw-ref-code" style={{ flex: 1, fontSize: '26px' }}>{code}</div>
                <button className="rw-ref-copy-btn" onClick={() => handleCopy(code, 'Code copied!')}
                  aria-label="Copy referral code" style={{ width: '38px', height: '38px' }}>
                  {copyFeedback === 'Code copied!' ? '✓' : <Icon name="plus" size={16} />}
                </button>
              </div>
            </div>

            {/* Share link */}
            <button className="rw-btn rw-btn-pri rw-btn-full" style={{ marginTop: '14px', padding: '14px', fontSize: '15px' }}
              onClick={() => handleCopy(shareUrl, 'Link copied!')}>
              {copyFeedback === 'Link copied!' ? '✓ Link copied!' : '📋 Copy share link'}
            </button>

            {/* Stats summary */}
            <div className="rw-ref-stats" style={{ marginTop: '28px' }}>
              <div className="rw-ref-stat">
                <span className="rw-ref-stat-num">{usedCount}/{maxUses}</span>
                <span className="rw-ref-stat-label">Referred</span>
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
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
                  Your rewards ({unclaimedRewards.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {unclaimedRewards.map(r => (
                    <div key={r.id} className="rw-ref-reward-card" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '12px', background: 'var(--surface)',
                      border: '1px solid var(--line)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', letterSpacing: '2px' }}>
                          {r.promoCode}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                          {r.rewardValue}% off &bull; Expires {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : 'in 90 days'}
                        </div>
                      </div>
                      <button className="rw-ref-copy-btn" onClick={() => handleCopy(r.promoCode, 'Promo copied!')}
                        aria-label="Copy promo code" style={{ width: '36px', height: '36px' }}>
                        {copyFeedback === 'Promo copied!' ? '✓' : <Icon name="plus" size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent activity */}
            {redemptions.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
                  Recent activity ({redemptions.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {redemptions.slice(0, 5).map(r => (
                    <div key={r.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', borderRadius: '10px', background: 'var(--surface)',
                      border: '1px solid var(--line)', fontSize: '13px',
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
            <div style={{ marginTop: '36px', padding: '20px', background: 'var(--bg)', borderRadius: '14px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.7' }}>
              <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: '8px' }}>How it works</strong>
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
