# REWIND Store — Full Codebase + AI Review Prompt

**Site:** rewind-stores.com (React/Vite + Express + Supabase + Stripe Elements + Resend + Gemini)
**Version:** V11.3.0 live on Railway
**Repo:** Jason533993292/rewind-store (public, main branch)

---

## PROMPT FOR CLAUDE

Review the REWIND vintage streetwear store. V11.3.0 live at rewind-stores.com. Stack: React/Vite frontend, Express backend, Supabase DB, Stripe Elements for inline payments (no redirect), Resend for emails, Gemini for AI chat replies.

### Priority bugs/issues to fix:

1. **Bottom dock animation** — A floating pill dock at the bottom with Home/Referrals/Settings. Currently uses width + opacity transitions. The collapse/expand animation could be smoother. Make it look premium (like macOS dock or iOS home bar).

2. **Referral system fraud prevention** — Already built: same-IP blocks, IP rate limiting, shipping address comparison missing. Add an address comparison check (compare referee's shipping address against referrer's past orders, block if >80% match).

3. **Admin token security** — Admin token is stored in localStorage with no rotation/expiry. Anyone who gets the shared token has permanent admin access. Implement session-based auth or at least token expiry.

4. **Bundle size** — 550KB+ single JS bundle including entire admin panel shipped to every anonymous visitor. Code-split the admin panel behind `/#admin` route.

5. **Upload image** — 1MB global body limit kills phone photo uploads. Override to 10MB on the upload route (already in code but verify).

6. **Checkout UX** — After payment succeeds via Stripe Elements, the order confirmation shows confetti. But the `payment_intent.succeeded` webhook handler needs to trigger the confirmation email too (currently only saves order to DB).

7. **Privacy policy** — Updated with GDPR: controller (1800 Vilvoorde, Belgium), retention (7 years orders, 24 months inactive), IP collection for fraud, international transfers disclosure (Stripe/Resend/Gemini US-based under SCCs). Verify compliance.

### Files included below (full source):

1. `src/components/PaymentCard.jsx` — Stripe Elements + animated card preview
2. `src/components/Referral.jsx` — Referral dialog with stats/rewards/activity  
3. `src/components/Shop.jsx` — CartDrawer, Checkout, privacy policy text
4. `src/App.jsx` — Main app with state, admin panel, dock
5. `api/server.js` — Express server with all routes
6. `api/referral-routes.js` — Referral API with fraud checks
7. `api/chat-routes.js` — Chat API with AI auto-reply
8. `src/App.css` — All styles
9. `supabase-referral.sql` — Referral tables migration

---

## FULL SOURCE FILES

### File: src/components/PaymentCard.jsx
```jsx
import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const CARD_BRANDS = {
  visa:       { label: 'VISA',       digits: 16, cvvLen: 3, test: (d) => /^4/.test(d) },
  mastercard: { label: 'mastercard', digits: 16, cvvLen: 3, test: (d) => /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(d) },
  amex:       { label: 'AMEX',       digits: 15, cvvLen: 4, test: (d) => /^3[47]/.test(d) },
  discover:   { label: 'DISCOVER',   digits: 16, cvvLen: 3, test: (d) => /^(6011|65|64[4-9])/.test(d) },
  generic:    { label: '',           digits: 16, cvvLen: 3, test: () => true },
};

function detectBrand(digits) { return Object.keys(CARD_BRANDS).find((k) => k !== 'generic' && CARD_BRANDS[k].test(digits)) || 'generic'; }
function formatCardNumber(digits, brand) {
  if (brand === 'amex') return digits.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*$/, (_, a, b, c) => [a,b,c].filter(Boolean).join(' '));
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}
function formatExpiry(raw) {
  let digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 1 && Number(digits) > 1) digits = '0' + digits;
  if (digits.length >= 2) { let mm = Number(digits.slice(0,2)); if(mm===0)mm=1; if(mm>12)mm=12; digits = String(mm).padStart(2,'0')+digits.slice(2); }
  return digits.length > 2 ? `${digits.slice(0,2)}/${digits.slice(2)}` : digits;
}
function isExpiryValid(expiry) {
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return false;
  const [mm, yy] = expiry.split('/').map(Number);
  if(mm<1||mm>12)return false;
  const now = new Date(); const curYY = now.getFullYear()%100; const curMM = now.getMonth()+1;
  if(yy<curYY)return false; if(yy===curYY&&mm<curMM)return false;
  return true;
}

function BrandMark({ brand }) {
  if(brand==='mastercard') return (<span className="rw-cc-brand rw-cc-brand-mc"><span className="rw-cc-mc-circle rw-cc-mc-circle-a"/><span className="rw-cc-mc-circle rw-cc-mc-circle-b"/></span>);
  if(brand==='generic') return <span className="rw-cc-brand rw-cc-brand-generic">REWIND</span>;
  return <span className={`rw-cc-brand rw-cc-brand-${brand}`}>{CARD_BRANDS[brand].label}</span>;
}

const ELEMENT_OPTIONS = {
  style: { base: { fontSize: '15px', color: '#16130F', fontFamily: 'var(--font-body)', '::placeholder': { color: '#A69B8E' } }, invalid: { color: '#FF4D14' } },
};

function CardFormInner({ clientSecret, amount, onValidChange, onError, onPayReady, onFocusChange }) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [firstDigits, setFirstDigits] = useState('');
  const brand = useMemo(() => detectBrand(firstDigits), [firstDigits]);
  const cvvLen = CARD_BRANDS[brand].cvvLen;

  useEffect(() => { onPayReady?.({ pay: handlePay }); }, [stripe, elements, name, clientSecret]);

  const handleCardNumberChange = useCallback((event) => {
    if (event.brand && event.brand !== 'unknown') setFirstDigits(event.brand === 'visa' ? '4' : event.brand === 'mastercard' ? '5' : event.brand === 'amex' ? '3' : '');
  }, []);

  async function handlePay() {
    if(!stripe||!elements) return { error: 'Stripe not ready' };
    setProcessing(true); setError('');
    try {
      const cardEl = elements.getElement(CardNumberElement);
      const {error: submitError, paymentIntent} = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardEl, billing_details: { name: name || undefined } },
      });
      if(submitError) { setError(submitError.message); setProcessing(false); return { error: submitError.message }; }
      if(paymentIntent?.status==='succeeded') { setProcessing(false); return { success: true, paymentIntent }; }
      setProcessing(false); return { error: 'Payment not completed' };
    } catch(e) { setError(e.message); setProcessing(false); return { error: e.message }; }
  }

  return (
    <div className="rw-cc-form">
      <div className="rw-cc-group">
        <label>Card Number</label>
        <div className="rw-stripe-input"><CardNumberElement options={{...ELEMENT_OPTIONS,showIcon:true}} onChange={handleCardNumberChange} onFocus={()=>onFocusChange?.('number')} onBlur={()=>onFocusChange?.(null)} onReady={()=>setReady(true)}/></div>
      </div>
      <div className="rw-input-row">
        <div className="rw-cc-group">
          <label>Expiry Date</label>
          <div className="rw-stripe-input"><CardExpiryElement options={ELEMENT_OPTIONS} onFocus={()=>onFocusChange?.('expiry')} onBlur={()=>onFocusChange?.(null)}/></div>
        </div>
        <div className="rw-cc-group">
          <label>CVV</label>
          <div className="rw-stripe-input"><CardCvcElement options={{...ELEMENT_OPTIONS,placeholder:'•'.repeat(cvvLen)}} onFocus={()=>onFocusChange?.('cvv')} onBlur={()=>onFocusChange?.(null)}/></div>
        </div>
      </div>
      {amount && <div className="rw-cc-amount"><span>Payment amount</span><b>{amount}</b></div>}
      {processing && <div className="rw-cc-processing">Processing…</div>}
      {error && <div className="rw-cc-error">{error}</div>}
    </div>
  );
}

const PaymentCard = forwardRef(function PaymentCard({ amount, onChange, stripeKey, orderNum, email, name, items, promoCode: promoProp }, ref) {
  const [clientSecret, setClientSecret] = useState(null);
  const [cardValid, setCardValid] = useState(false);
  const [focused, setFocused] = useState(null);
  const [firstDigits, setFirstDigits] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardSceneRef = useRef(null);

  const handleMouseMove = (e) => {
    const el = cardSceneRef.current; if(!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * -8, y: y * 8 });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  const brand = useMemo(() => detectBrand(firstDigits), [firstDigits]);
  
  const stripePromise = useMemo(() => {
    const key = stripeKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if(!key) { console.warn('No Stripe publishable key'); return null; }
    return loadStripe(key);
  }, [stripeKey]);

  useEffect(() => {
    if(!amount) return;
    const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.,]/g,'').replace(',','.')) : amount;
    if(!numAmount || numAmount <= 0) return;
    const currentEmail = email || 'checkout@rewind-stores.com';
    const cleanItems = (items || []).map(it => ({ id: it.id || it.product_id, qty: it.qty }));
    fetch('/api/create-payment-intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cleanItems, orderNum, email: currentEmail, name: name || '', promoCode: promoProp || '' }),
    }).then(r=>r.json()).then(data=>{ if(data.clientSecret) setClientSecret(data.clientSecret); else console.warn('PaymentIntent failed:', data.error); }).catch(e=>console.warn('PaymentIntent error:', e));
  }, [amount, orderNum, email, name, items, promoProp]);

  const [payFn, setPayFn] = useState(null);
  useImperativeHandle(ref, () => ({ pay: async (overrideDetails) => { if(!payFn) return { error: 'Payment not ready yet' }; return payFn.pay(overrideDetails); }, clientSecret, isValid: cardValid }));

  return (
    <div className="rw-cc-wrap">
      <div className="rw-cc-scene" ref={cardSceneRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}>
        <div className={`rw-cc ${focused === 'cvv' ? 'is-flipped' : ''}`}>
          <div className="rw-cc-face rw-cc-front">
            <div className="rw-cc-bg"/>
            <div className={`rw-cc-tint rw-cc-tint-${brand} ${brand!=='generic'?'is-on':''}`}/>
            <div className="rw-cc-gloss"/>
            <div className="rw-cc-row rw-cc-row-top">
              <div className="rw-cc-chip"><span/><span/></div>
              <svg className="rw-cc-wave" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 16.5a6 6 0 0 1 0-9"/><path d="M11 19a10 10 0 0 1 0-14"/><path d="M14 21.5a14 14 0 0 1 0-19"/></svg>
              <BrandMark brand={brand}/>
            </div>
            <div className={`rw-cc-number ${focused==='number'?'is-active':''}`}><span className={firstDigits?'':'rw-cc-placeholder'}>{firstDigits ? formatCardNumber(firstDigits.padEnd(16,'•'), brand) : '•••• •••• •••• ••••'}</span></div>
            <div className="rw-cc-row rw-cc-row-bottom">
              <div className={`rw-cc-field ${focused==='name'?'is-active':''}`}><small>Card Holder</small><span>{name || 'YOUR NAME'}</span></div>
              <div className={`rw-cc-field rw-cc-field-exp ${focused==='expiry'?'is-active':''}`}><small>Expires</small><span>{expiry || 'MM/YY'}</span></div>
            </div>
          </div>
          <div className="rw-cc-face rw-cc-back">
            <div className="rw-cc-bg"/>
            <div className={`rw-cc-tint rw-cc-tint-${brand} ${brand!=='generic'?'is-on':''}`}/>
            <div className="rw-cc-stripe"/>
            <div className="rw-cc-signature"><div className="rw-cc-signature-line"/><div className={`rw-cc-cvv-box ${focused==='cvv'?'is-active':''}`}>{'•••'}</div></div>
            <div className="rw-cc-row rw-cc-row-back-bottom"><span className="rw-cc-back-note">Authorized Signature</span><BrandMark brand={brand}/></div>
          </div>
        </div>
      </div>
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CardFormInner clientSecret={clientSecret} amount={amount} onValidChange={({valid})=>setCardValid(valid)} onError={(err)=>console.warn(err)} onPayReady={({pay})=>setPayFn(()=>pay)} onFocusChange={setFocused}/>
        </Elements>
      ) : (
        <div className="rw-cc-form"><div className="rw-cc-loading">Loading payment form…</div>{amount&&<div className="rw-cc-amount"><span>Payment amount</span><b>{amount}</b></div>}</div>
      )}
    </div>
  );
});

export default PaymentCard;
```

### File: src/App.jsx (key parts — dock, state, referral integration)

[Main React component with all state management at top, admin panel, cart, checkout, chat, and dock at bottom. Key sections:]

**State declarations (lines ~48-100):**
```jsx
const VERSION = 'V11.3.0';
// ... tweaks, cat, query, brand, cart, checkout, toast, infoPage, showReferral, dockHover, promo*, wishlist, customProducts, sortBy, orderNumber, userEmail, adminAuthed, adminToken
```

**Bottom dock (lines ~953-999):**
```jsx
<div onMouseEnter={()=>setDockHover(true)} onMouseLeave={()=>setDockHover(false)}
  style={{ position:'fixed', bottom:'28px', left:'50%', zIndex:9999,
    display:'flex', justifyContent:'center', alignItems:'center', gap:'0',
    background:'rgba(255,255,255,0.6)', backdropFilter:'blur(24px)',
    borderRadius:'24px', boxShadow: dockHover ? '0 4px 24px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.08)',
    padding:'7px', transform:'translateX(-50%)',
    transition:'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
    width: dockHover ? 'auto' : '44px', overflow:'hidden', whiteSpace:'nowrap' }}>
  {/* Referrals | Home | Settings buttons */}
  <button onClick={()=>setShowReferral(true)} style={{...}}>...</button>
  <button onClick={()=>{window.location.hash='';window.scrollTo({top:0,behavior:'smooth'});setDockHover(false);}} style={{...}}>...</button>
  <button style={{...}}>...</button>
</div>
```

**ReferralDialog (line ~896):**
```jsx
<ReferralDialog open={showReferral} onClose={()=>setShowReferral(false)} userEmail={userEmail} showToast={showToast} />
```

### File: api/server.js (key endpoints)

**create-payment-intent (lines ~466-482):**
```js
app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'STRIPE_SECRET_KEY not configured' });
  const { items, orderNum, email, name, promoCode } = req.body;
  if (!items || !items.length || !orderNum || !email) return res.status(400).json({ error: 'Missing required fields' });
  const { subtotal, discountPrice } = await computeOrder(items, promoCode);
  const finalTotal = Math.round(discountPrice * 100);
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalTotal, currency: 'eur',
      metadata: { orderNum, email, name: name || '', itemsJson: JSON.stringify(items.map(i=>({id:i.id,qty:i.qty,price:i.price}))), promoCode: promoCode || '' },
      payment_method_types: ['card'],
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) { console.error('PaymentIntent error:', e); res.status(500).json({ error: 'Could not create payment: ' + e.message }); }
});
```

**computeOrder (lines ~429-461):**
```js
async function computeOrder(items, promoCode) {
  let subtotal = 0;
  for (const it of (items || [])) {
    const pid = it.id || it.product_id;
    const realPrice = pid ? await lookupProductPrice(pid) : null;
    subtotal += (realPrice ?? it.price ?? 0) * (it.qty || 1);
  }
  const shipping = subtotal >= 150 ? 0 : 8;
  let discountPrice = subtotal;
  let discountLabel = null;
  if (promoCode) { /* validate against DB */ }
  return { subtotal, shipping, discountPrice, discountLabel };
}
```

**Stripe webhook (lines ~514-655):**
```js
app.post('/api/stripe-webhook', async (req, res) => {
  // signature verification
  if (event.type === 'payment_intent.succeeded') { /* save order from metadata */ }
  if (event.type === 'checkout.session.completed') { /* legacy flow */ }
  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') { /* mark failed */ }
});
```

**block-customer (lines ~754-817):**
```js
app.post('/api/admin/block-customer', requireAdmin, async (req, res) => {
  // Stores email in blocked_emails, IP in blocked_ips
});
```

### File: api/referral-routes.js

Full referral system with fraud checks:
- `/api/referral/stats` — returns code, stats, rewards, activity
- `/api/referral/generate` — creates referral code (stores IP)
- `/api/referral/apply` — applies referral at checkout (checks same-IP, rate limits, monthly cap)
- Fraud: same-IP detection blocks redemption, IP rate limit (2/day), monthly cap (5/month)

### File: api/chat-routes.js

- Rate-limited chat start (stores IP in session)
- Checks blocked_emails and blocked_ips on start
- AI auto-reply via Gemini (fire-and-forget)
- Admin reply + session close

### File: src/App.css (key styles)

Grid breakpoints, card animations (ccGloss, confettiFall), Stripe Elements inputs, referral panel, admin panel, privacy policy, dock styles.

---

## Give me

1. **A prioritized list of bugs** from most to least critical, with exact code diffs
2. **Security audit** — any endpoint missing requireAdmin, any pricing hole, any CSP gap, any RLS issue
3. **Performance improvements** — bundle splitting, lazy loading, useEffect cleanup
4. **UI polish** — dock animation improvements, card preview, checkout flow
5. **Code quality** — dead code, duplicate logic, CSS consolidation

Be specific. Give me exact file paths and code snippets for each fix. Run and verify before shipping.
