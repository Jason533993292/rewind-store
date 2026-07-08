# REWIND Store — Full Codebase for Claude Fix

**Site:** rewind-stores.com (React/Vite + Express + Supabase + Stripe + Resend)
**Version:** V10.2.0
**Bug:** Checkout page shows blank screen with JS errors

---

## Known Errors (from browser console)

1. `Uncaught ReferenceError: formFields is not defined` — FIXED in V10.2.0 (added useState)
2. CSP blocked Supabase — FIXED in V10.1.0 (helmet CSP directives)
3. RLS blocking anon reads — FIXED (GRANT SELECT to anon)
4. Still seeing blank checkout — possibly PaymentCard component crash or CSS issue

---

## PROMPT FOR CLAUDE

I run a vintage streetwear store at **rewind-stores.com**. React/Vite frontend, Express backend, Supabase, Stripe.

**The checkout page shows blank when I select "Card" payment.** Here's what's been tried:
- Added missing `useState` for `formFields`, `promoData`, `payError`, `orderNum`, `saveInfo`
- Fixed CSP (helmet content security policy now allows Supabase, Stripe, Resend)
- Fixed RLS (GRANT SELECT ON custom_products, wishlists TO anon)
- Still blank when clicking checkout and selecting Card payment

**The PaymentCard component** I added is at `src/components/PaymentCard.jsx`. It uses CSS classes like `rw-cc-wrap`, `rw-cc-scene`, `rw-cc` defined in `src/App.css`. It's rendered in the Checkout component in `src/components/Shop.jsx` at line ~585 when `payment === 'card'`.

**Files attached below.** Please:
1. Find why the checkout is blank (suspect PaymentCard rendering error)
2. Fix any remaining undefined variables
3. Make the card preview work properly
4. Give me exact code fixes in a patch format

---

## SOURCE FILES

### File 1: src/components/Shop.jsx — Checkout function (lines 380-700)

```jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { money, discountPct } from '../hooks/useCountdown';
import { Icon, Photo } from './Shell';
import { REWIND_PAYMENTS, REWIND_PRODUCTS } from '../data';
import { deleteCustomProduct } from '../lib/supabase';
import PaymentCard from './PaymentCard';

// ... ProductCard, ProductGrid, QuickView, CartDrawer above ...

/* ---------- Checkout ---------- */
export function Checkout({ open, items, onClose, onPlaced, userEmail, showToast, orderNumber: orderNumberProp }) {
  const [payment, setPayment] = useState('card');
  const [placed, setPlaced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cardValid, setCardValid] = useState(false);
  const [promoData, setPromoData] = useState(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promo, setPromo] = useState('');
  const [payError, setPayError] = useState('');
  const [orderNum, setOrderNum] = useState('');
  const [saveInfo, setSaveInfo] = useState(false);
  const [formFields, setFormFields] = useState({ email: '', name: '', address: '', postal: '', city: '', country: '' });

  if (!open) return null;
  if (placed) {
    return (
      <div className="rw-checkout">
        <div className="rw-checkout-bar">
          <div className="rw-logo" onClick={() => { window.location.hash = ''; onPlaced(); }}>REWIND<span>.</span></div>
          <button className="rw-btn rw-btn-ghost" onClick={onPlaced}>Close</button>
        </div>
        <div className="rw-confirm">
          <div className="rw-confirm-mark"><Icon name="check" size={36} /></div>
          <h2>Order confirmed</h2>
          <p>Thanks for your order! We'll send you an email confirmation shortly.</p>
          <div className="rw-confirm-num">{orderNum}</div>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipping = subtotal >= 150 ? 0 : 8;
  let discountPrice = subtotal;
  let discountShipping = shipping;
  let discountLabel = null;
  if (promoData?.valid) {
    if (promoData.type === 'percent') {
      discountPrice = Math.round(subtotal * (100 - promoData.value)) / 100;
      discountLabel = `${promoData.value}% off`;
    } else if (promoData.type === 'free_shipping') {
      discountShipping = 0;
      discountLabel = 'Free shipping';
    }
  }
  const finalTotal = discountPrice + discountShipping;

  async function handlePay() {
    setProcessing(true);
    setPayError('');
    const missing = [];
    if (!formFields.email?.trim()) missing.push('Email');
    else if (!/^\S+@\S+\.\S+$/.test(formFields.email.trim())) {
      setPayError('Please enter a valid email address');
      setProcessing(false);
      return;
    }
    if (!formFields.name?.trim()) missing.push('Full name');
    if (!formFields.address?.trim()) missing.push('Address');
    if (!formFields.postal?.trim()) missing.push('Postal code');
    if (!formFields.city?.trim()) missing.push('City');
    if (!formFields.country?.trim()) missing.push('Country');
    if (missing.length) { setPayError('Please fill in: ' + missing.join(', ')); setProcessing(false); return; }
    // ... Stripe checkout session creation ...
  }

  return (
    <div className="rw-checkout">
      <div className="rw-checkout-bar">
        <div className="rw-logo" onClick={() => { if (!processing) onPlaced(); }}>REWIND<span>.</span></div>
        <button className="rw-btn rw-btn-ghost" onClick={() => { if (!processing) onPlaced(); }}>← Back to cart</button>
      </div>
      <div className="rw-checkout-grid">
        <div className="rw-checkout-main">
          {/* Contact & Shipping fields */}
          <div className="rw-co-sec">
            <h3>Contact</h3>
            <input className="rw-input" placeholder="Email" value={formFields.email} onChange={e => setFormFields(prev => ({ ...prev, email: e.target.value }))} />
          </div>
          <div className="rw-co-sec">
            <h3>Shipping</h3>
            <input className="rw-input" placeholder="Full name" value={formFields.name} onChange={e => setFormFields(prev => ({ ...prev, name: e.target.value }))} />
            <input className="rw-input" placeholder="Address" value={formFields.address} onChange={e => setFormFields(prev => ({ ...prev, address: e.target.value }))} />
            <div className="rw-input-row">
              <input className="rw-input" placeholder="Postal code" value={formFields.postal} onChange={e => setFormFields(prev => ({ ...prev, postal: e.target.value }))} />
              <input className="rw-input" placeholder="City" value={formFields.city} onChange={e => setFormFields(prev => ({ ...prev, city: e.target.value }))} />
            </div>
            <input className="rw-input" placeholder="Country" value={formFields.country} onChange={e => setFormFields(prev => ({ ...prev, country: e.target.value }))} />
          </div>
          {/* Payment method selection */}
          <div className="rw-co-sec">
            <h3>Payment</h3>
            <div className="rw-pay-grid">
              {REWIND_PAYMENTS.map((pm) => (
                <button key={pm.id} className={`rw-pay${payment === pm.id ? ' is-on' : ''}`} onClick={() => setPayment(pm.id)}>
                  <div className="rw-pay-radio">{payment === pm.id && <Icon name="check" size={12} />}</div>
                  <div className="rw-pay-label">
                    {pm.label}
                    <small>{pm.sub}</small>
                  </div>
                </button>
              ))}
            </div>
            {payment === 'card' && (
              <div className="rw-card-fields">
                <PaymentCard amount={money(finalTotal)} onChange={({ valid }) => setCardValid(valid)} />
              </div>
            )}
            <div className="rw-co-config">
              {payment === 'payconiq' && 'Scan the QR code with Payconiq to complete payment.'}
              {payment === 'applepay' && 'Complete payment with Face ID or Touch ID.'}
              {payment === 'klarna' && 'Pay in 3 interest-free instalments.'}
              {payment === 'bancontact' && 'You will be redirected to your bank to confirm.'}
              {payment === 'paypal' && 'You will be redirected to PayPal to complete your purchase.'}
            </div>
            <label className="rw-check">
              <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} /> Save my info for next time
            </label>
          </div>
        </div>
        <div className="rw-checkout-summary">
          <h3>Order summary</h3>
          {items.map((it) => (
            <div key={it.key} className="rw-sum-line">
              <div className="rw-sum-media"><Photo id={it.id + "-sum"} hue={it.hue} label="" h={52} img={it.img} /></div>
              <div className="rw-sum-info">
                <h4>{it.name}</h4>
                <span>Qty: {it.qty}</span>
              </div>
              <div className="rw-sum-price">{money(it.price * it.qty)}</div>
            </div>
          ))}
          <div className="rw-sum-rows">
            <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
            {promoData?.valid && promoData.type === 'percent' && (
              <div><span>Discount ({discountLabel})</span><span>-{money(subtotal - discountPrice)}</span></div>
            )}
            <div><span>Shipping</span><span>{discountShipping === 0 ? (promoData?.valid && promoData.type === 'free_shipping' ? 'Free 🎉' : 'Free') : money(discountShipping)}</span></div>
          </div>
          <div className="rw-sum-total">
            <span>Total</span><b>{money(finalTotal)}</b>
          </div>
          {promoData && !promoData.valid && promo.trim() && !promoValidating && (
            <div style={{ color: 'var(--accent)', fontSize: '13px', marginTop: '6px' }}>Invalid promo code</div>
          )}
          {payError && (
            <div style={{ fontSize: '13px', color: 'var(--accent)', marginTop: '8px' }}>{payError}</div>
          )}
          <button className="rw-btn rw-btn-pri rw-btn-full" disabled={processing || (payment === 'card' && !cardValid)}
            onClick={handlePay}>
            {processing ? 'Processing...' : `Pay ${money(finalTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### File 2: src/components/PaymentCard.jsx (full, 194 lines)

```jsx
import React, { useEffect, useMemo, useState } from 'react';

/* ---------- card brand detection & formatting ---------- */
const CARD_BRANDS = {
  visa:       { label: 'VISA',       digits: 16, cvvLen: 3, test: (d) => /^4/.test(d) },
  mastercard: { label: 'mastercard', digits: 16, cvvLen: 3, test: (d) => /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(d) },
  amex:       { label: 'AMEX',       digits: 15, cvvLen: 4, test: (d) => /^3[47]/.test(d) },
  discover:   { label: 'DISCOVER',   digits: 16, cvvLen: 3, test: (d) => /^(6011|65|64[4-9])/.test(d) },
  generic:    { label: '',           digits: 16, cvvLen: 3, test: () => true },
};

function detectBrand(digits) {
  return Object.keys(CARD_BRANDS).find((k) => k !== 'generic' && CARD_BRANDS[k].test(digits)) || 'generic';
}

function formatCardNumber(digits, brand) {
  if (brand === 'amex') {
    return digits.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*$/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(raw) {
  let digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 1 && Number(digits) > 1) digits = '0' + digits;
  if (digits.length >= 2) {
    let mm = Number(digits.slice(0, 2));
    if (mm === 0) mm = 1;
    if (mm > 12) mm = 12;
    digits = String(mm).padStart(2, '0') + digits.slice(2);
  }
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function isExpiryValid(expiry) {
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return false;
  const [mm, yy] = expiry.split('/').map(Number);
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const curYY = now.getFullYear() % 100;
  const curMM = now.getMonth() + 1;
  if (yy < curYY) return false;
  if (yy === curYY && mm < curMM) return false;
  return true;
}

/* ---------- BrandMark ---------- */
function BrandMark({ brand }) {
  if (brand === 'mastercard') {
    return (
      <span className="rw-cc-brand rw-cc-brand-mc" aria-label="Mastercard">
        <span className="rw-cc-mc-circle rw-cc-mc-circle-a" />
        <span className="rw-cc-mc-circle rw-cc-mc-circle-b" />
      </span>
    );
  }
  if (brand === 'generic') {
    return <span className="rw-cc-brand rw-cc-brand-generic">REWIND</span>;
  }
  return <span className={`rw-cc-brand rw-cc-brand-${brand}`}>{CARD_BRANDS[brand].label}</span>;
}

/* ---------- PaymentCard ---------- */
export default function PaymentCard({ amount, onChange }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [focused, setFocused] = useState(null);

  const brand = useMemo(() => detectBrand(number), [number]);
  const cvvLen = CARD_BRANDS[brand].cvvLen;
  const displayNumber = useMemo(() => formatCardNumber(number, brand), [number, brand]);

  const valid = useMemo(() => (
    name.trim().length > 1 &&
    number.length === CARD_BRANDS[brand].digits &&
    isExpiryValid(expiry) &&
    cvv.length === cvvLen
  ), [name, number, brand, expiry, cvv, cvvLen]);

  useEffect(() => {
    onChange?.({ name, number, expiry, cvv, brand, valid });
  }, [name, number, expiry, cvv, brand, valid]);

  const handleNumberChange = (e) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const nextBrand = detectBrand(rawDigits);
    setNumber(rawDigits.slice(0, CARD_BRANDS[nextBrand].digits));
  };

  const handleCvvChange = (e) => {
    setCvv(e.target.value.replace(/\D/g, '').slice(0, cvvLen));
  };

  return (
    <div className="rw-cc-wrap">
      <div className="rw-cc-scene">
        <div className={`rw-cc ${focused === 'cvv' ? 'is-flipped' : ''}`}>
          <div className="rw-cc-face rw-cc-front">
            <div className="rw-cc-bg" />
            <div className={`rw-cc-tint rw-cc-tint-${brand} ${brand !== 'generic' ? 'is-on' : ''}`} />
            <div className="rw-cc-gloss" />
            <div className="rw-cc-row rw-cc-row-top">
              <div className="rw-cc-chip"><span /><span /></div>
              <svg className="rw-cc-wave" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 16.5a6 6 0 0 1 0-9" /><path d="M11 19a10 10 0 0 1 0-14" /><path d="M14 21.5a14 14 0 0 1 0-19" />
              </svg>
              <BrandMark brand={brand} />
            </div>
            <div className={`rw-cc-number ${focused === 'number' ? 'is-active' : ''}`}>
              <span className={displayNumber ? '' : 'rw-cc-placeholder'}>{displayNumber || '•••• •••• •••• ••••'}</span>
            </div>
            <div className="rw-cc-row rw-cc-row-bottom">
              <div className={`rw-cc-field ${focused === 'name' ? 'is-active' : ''}`}>
                <small>Card Holder</small>
                <span>{name || 'YOUR NAME'}</span>
              </div>
              <div className={`rw-cc-field rw-cc-field-exp ${focused === 'expiry' ? 'is-active' : ''}`}>
                <small>Expires</small>
                <span>{expiry || 'MM/YY'}</span>
              </div>
            </div>
          </div>
          <div className="rw-cc-face rw-cc-back">
            <div className="rw-cc-bg" />
            <div className={`rw-cc-tint rw-cc-tint-${brand} ${brand !== 'generic' ? 'is-on' : ''}`} />
            <div className="rw-cc-stripe" />
            <div className="rw-cc-signature">
              <div className="rw-cc-signature-line" />
              <div className={`rw-cc-cvv-box ${focused === 'cvv' ? 'is-active' : ''}`}>{cvv.padEnd(cvvLen, '•')}</div>
            </div>
            <div className="rw-cc-row rw-cc-row-back-bottom">
              <span className="rw-cc-back-note">Authorized Signature</span>
              <BrandMark brand={brand} />
            </div>
          </div>
        </div>
      </div>
      <div className="rw-cc-form">
        <div className="rw-cc-group">
          <label htmlFor="cc-name">Cardholder Name</label>
          <input id="cc-name" className="rw-input" type="text" placeholder="Jane Doe" value={name}
            onChange={(e) => setName(e.target.value.slice(0, 26))}
            onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />
        </div>
        <div className="rw-cc-group">
          <label htmlFor="cc-number">Card Number</label>
          <input id="cc-number" className="rw-input" type="text" inputMode="numeric" placeholder="4242 4242 4242 4242"
            value={displayNumber} onChange={handleNumberChange} maxLength={23}
            onFocus={() => setFocused('number')} onBlur={() => setFocused(null)} />
        </div>
        <div className="rw-cc-row">
          <div className="rw-cc-group">
            <label htmlFor="cc-expiry">Expiry</label>
            <input id="cc-expiry" className="rw-input" type="text" inputMode="numeric" placeholder="MM/YY"
              value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} maxLength={5}
              onFocus={() => setFocused('expiry')} onBlur={() => setFocused(null)} />
          </div>
          <div className="rw-cc-group">
            <label htmlFor="cc-cvv">CVV</label>
            <input id="cc-cvv" className="rw-input" type="text" inputMode="numeric" placeholder="***"
              value={cvv} onChange={handleCvvChange} maxLength={cvvLen}
              onFocus={() => setFocused('cvv')} onBlur={() => setFocused(null)} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### File 3: src/App.css — Card styles (the rw-cc section)

```css
/* ── Payment Card Preview ── */
.rw-card-fields { margin-top: 12px; }
.rw-cc-wrap { display: grid; grid-template-columns: 300px 1fr; gap: 28px; align-items: start; margin-top: 14px; }
.rw-cc-scene { perspective: 1200px; width: 100%; }
.rw-cc {
  position: relative; width: 100%; aspect-ratio: 1.586; border-radius: 16px;
  transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
}
.rw-cc.is-flipped { transform: rotateY(180deg); }
.rw-cc-face {
  position: absolute; inset: 0; border-radius: 16px; backface-visibility: hidden;
  -webkit-backface-visibility: hidden; padding: 20px 22px;
  display: flex; flex-direction: column; justify-content: space-between;
  overflow: hidden;
}
.rw-cc-back { transform: rotateY(180deg); }
.rw-cc-bg {
  position: absolute; inset: 0; background: linear-gradient(135deg, #1a1510 0%, #2d2620 100%);
  z-index: 0;
}
.rw-cc-tint { position: absolute; inset: 0; z-index: 1; opacity: 0; transition: opacity 0.3s; }
.rw-cc-tint.is-on { opacity: 1; }
.rw-cc-tint-visa { background: linear-gradient(135deg, rgba(26,65,158,0.3), rgba(26,65,158,0.15)); }
.rw-cc-tint-mastercard { background: linear-gradient(135deg, rgba(235,0,27,0.2), rgba(247,158,27,0.2)); }
.rw-cc-tint-amex { background: linear-gradient(135deg, rgba(46,102,182,0.3), rgba(142,226,248,0.1)); }
.rw-cc-tint-discover { background: linear-gradient(135deg, rgba(246,130,31,0.25), rgba(246,130,31,0.1)); }
.rw-cc-gloss {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%);
}
.rw-cc-row { display: flex; align-items: center; justify-content: space-between; z-index: 3; }
.rw-cc-row-top { margin-bottom: auto; }
.rw-cc-row-bottom { margin-top: auto; }
.rw-cc-chip {
  display: flex; gap: 2px; padding: 2px; border-radius: 8px;
  background: linear-gradient(135deg, rgba(212,175,55,0.9), rgba(245,217,126,0.9));
}
.rw-cc-chip span { width: 4px; height: 18px; border-radius: 2px; background: rgba(139,115,40,0.6); }
.rw-cc-wave { color: rgba(255,255,255,0.5); margin-left: auto; margin-right: 10px; }
.rw-cc-brand { z-index: 3; font-size: 20px; font-weight: 800; color: rgba(255,255,255,0.85); font-family: var(--font-head); letter-spacing: -0.5px; }
.rw-cc-brand-generic { font-size: 16px; color: rgba(255,255,255,0.6); }
.rw-cc-brand-mc { display: flex; gap: -6px; align-items: center; }
.rw-cc-mc-circle { width: 24px; height: 24px; border-radius: 50%; }
.rw-cc-mc-circle-a { background: rgba(235,0,27,0.9); }
.rw-cc-mc-circle-b { background: rgba(247,158,27,0.9); margin-left: -8px; }
.rw-cc-number {
  font-family: 'Courier New', monospace; font-size: 20px; letter-spacing: 2.5px; color: #fff; z-index: 3;
  margin-top: 10px; transition: all 0.2s;
}
.rw-cc-number.is-active { letter-spacing: 3px; }
.rw-cc-placeholder { color: rgba(255,255,255,0.3); }
.rw-cc-field { z-index: 3; transition: all 0.2s; }
.rw-cc-field small { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); margin-bottom: 2px; }
.rw-cc-field span { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 0.5px; }
.rw-cc-field.is-active span { color: #fff; }
.rw-cc-field-exp { text-align: right; }
.rw-cc-stripe { position: relative; z-index: 3; width: 100%; height: 38px; background: rgba(0,0,0,0.3); margin-top: 6px; }
.rw-cc-signature { position: relative; z-index: 3; display: flex; align-items: center; justify-content: space-between; padding: 8px 14px 0; }
.rw-cc-signature-line { flex: 1; height: 28px; background: rgba(255,255,255,0.1); border-radius: 4px; }
.rw-cc-cvv-box {
  width: 52px; padding: 4px 8px; background: #fff; color: #16130F; border-radius: 4px;
  font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; text-align: center; letter-spacing: 1px;
  margin-left: 12px; transition: all 0.2s;
}
.rw-cc-cvv-box.is-active { background: #FF4D14; color: #fff; }
.rw-cc-row-back-bottom { padding: 0 14px; margin-top: auto; display: flex; align-items: center; justify-content: space-between; z-index: 3; }
.rw-cc-back-note { font-size: 9px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.5px; }
.rw-cc-form { display: flex; flex-direction: column; gap: 12px; }
.rw-cc-group { display: flex; flex-direction: column; gap: 4px; }
.rw-cc-group label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.rw-cc-group .rw-input { width: 100%; padding: 12px 14px; }
.rw-cc-row { display: flex; gap: 10px; }
.rw-cc-row .rw-cc-group { flex: 1; }
@media (max-width: 720px) {
  .rw-cc-wrap { grid-template-columns: 1fr; }
  .rw-cc-scene { max-width: 340px; margin: 0 auto; }
}
```

---

## AI REVIEW PROMPT

Review all files above. The checkout page shows **blank** when "Card" payment method is selected. Find ALL remaining bugs and fix them. Give me exact patch diffs for each fix.

Focus on:
- Missing state variables
- CSS issues causing components to not render
- PaymentCard integration with the Checkout component
- Any import errors or component mismatch
