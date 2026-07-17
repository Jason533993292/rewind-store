import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, PaymentRequestButtonElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

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

/* ---------- Stripe Elements base styles ---------- */
const ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      fontFamily: 'var(--font-mono, "SF Mono", monospace)',
      color: '#16130F',
      '::placeholder': { color: '#6E665A' },
      padding: '10px 0',
    },
    invalid: { color: '#FF4D14' },
  },
};

/* ---------- CardFormInner — lives inside <Elements>, handles Stripe hooks ---------- */
function CardFormInner({ clientSecret, amount, onValidChange, onError, onPayReady, onFocusChange, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [firstDigits, setFirstDigits] = useState('');

  const brand = useMemo(() => detectBrand(firstDigits), [firstDigits]);
  const cvvLen = CARD_BRANDS[brand].cvvLen;

  // Notify parent when Stripe Elements are ready
  const isValid = ready && !!clientSecret;
  useEffect(() => {
    onValidChange?.({ valid: isValid, clientSecret });
  }, [isValid, clientSecret, onValidChange]);

  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  const handleCardNumberChange = useCallback((event) => {
    const elBrand = event?.brand || '';
    setFirstDigits(
      elBrand === 'visa' ? '4'
      : elBrand === 'mastercard' ? '5'
      : elBrand === 'amex' ? '3'
      : elBrand === 'discover' ? '6'
      : ''
    );
  }, []);

  // Expose pay function to parent via onPayReady
  const pay = useCallback(async (overrideDetails = {}) => {
    if (!stripe || !elements || !clientSecret) {
      const msg = 'Payment not ready — please try again';
      setError(msg);
      return { error: msg };
    }

    setProcessing(true);
    setError('');

    const details = overrideDetails || {};

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardNumberElement),
        billing_details: {
          name: details.name || '',
          email: details.email || '',
          address: details.address ? {
            line1: details.address,
            city: details.city || '',
            postal_code: details.postal || '',
            country: details.country || '',
          } : undefined,
        },
      },
    });

    setProcessing(false);

    if (confirmError) {
      setError(confirmError.message);
      return { error: confirmError.message };
    }

    if (paymentIntent.status === 'succeeded') {
      // Call the success handler directly (replaces custom event)
      if (onPaymentSuccess) onPaymentSuccess(paymentIntent);
      return { success: true, paymentIntent };
    }

    const msg = `Payment ${paymentIntent.status} — please try again`;
    setError(msg);
    return { error: msg };
  }, [stripe, elements, clientSecret, onPaymentSuccess]);

  // Register the pay function with parent
  useEffect(() => {
    onPayReady?.({ pay });
  }, [pay, onPayReady]);

  // Payment Request (Apple Pay / Google Pay) — wrapped in try-catch so it never crashes
  const [canPay, setCanPay] = useState(false);
  const [prError, setPrError] = useState(false);
  const paymentRequest = useMemo(() => {
    if (!stripe || !clientSecret) return null;
    try {
      const pr = stripe.paymentRequest({
        country: 'HK',
        currency: 'eur',
        total: { label: 'REWIND', amount: 0 },
        requestPayerName: true,
        requestPayerEmail: true,
      });
      pr.canMakePayment().then(result => { if (result) setCanPay(true); }).catch(() => setPrError(true));
      return pr;
    } catch {
      console.warn('PaymentRequest not supported');
      setPrError(true);
      return null;
    }
  }, [stripe]);

  const handlePaymentRequest = useCallback(async (event) => {
    setProcessing(true);
    try {
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: event.paymentMethod.id,
      });
      if (confirmError) {
        event.complete('fail');
        setError(confirmError.message);
        setProcessing(false);
      } else if (paymentIntent.status === 'succeeded') {
        event.complete('success');
        setProcessing(false);
        // Call success handler directly
        if (onPaymentSuccess) onPaymentSuccess(paymentIntent);
      } else {
        event.complete('fail');
        setProcessing(false);
      }
    } catch {
      event.complete('fail');
      setProcessing(false);
    }
  }, [stripe, clientSecret, onPaymentSuccess]);

  useEffect(() => {
    if (paymentRequest) {
      paymentRequest.on('paymentMethod', handlePaymentRequest);
      return () => { paymentRequest.off('paymentMethod', handlePaymentRequest); };
    }
  }, [paymentRequest, handlePaymentRequest]);

  return (
    <div className="rw-cc-form">
      {canPay && !prError && (
        <div style={{ marginBottom: '12px' }}>
          <PaymentRequestButtonElement
            options={{ paymentRequest, style: { paymentRequestButton: { type: 'buy', theme: 'dark', height: '48px' } } }}
          />
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', margin: '10px 0' }}>or pay with card</div>
        </div>
      )}
      <div className="rw-cc-group">
        <label>Card Number</label>
        <div className="rw-stripe-input">
          <CardNumberElement
            options={{ ...ELEMENT_OPTIONS, showIcon: true }}
            onChange={handleCardNumberChange}
            onFocus={() => onFocusChange?.('number')}
            onBlur={() => onFocusChange?.(null)}
            onReady={() => setReady(true)}
          />
        </div>
      </div>
      <div className="rw-input-row">
        <div className="rw-cc-group">
          <label>Expiry Date</label>
          <div className="rw-stripe-input">
            <CardExpiryElement
              options={ELEMENT_OPTIONS}
              onFocus={() => onFocusChange?.('expiry')}
              onBlur={() => onFocusChange?.(null)}
            />
          </div>
        </div>
        <div className="rw-cc-group">
          <label>CVV</label>
          <div className="rw-stripe-input">
            <CardCvcElement
              options={{ ...ELEMENT_OPTIONS, placeholder: '•'.repeat(cvvLen) }}
              onFocus={() => onFocusChange?.('cvv')}
              onBlur={() => onFocusChange?.(null)}
            />
          </div>
        </div>
      </div>
      {processing && <div className="rw-cc-processing"><i className="rw-spinner" /> Processing…</div>}
      {error && <div className="rw-cc-error">{error}</div>}
    </div>
  );
}

/* ---------- PaymentCard (main export) ---------- */
const PaymentCard = forwardRef(function PaymentCard({ amount, onChange, stripeKey, orderNum, email, name, address, items, promoCode: promoProp, paymentMethod, country, onPaymentSuccess }, ref) {
  const [clientSecret, setClientSecret] = useState(null);
  const [cardValid, setCardValid] = useState(false);
  const [focused, setFocused] = useState(null);
  const [firstDigits, setFirstDigits] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [fetchError, setFetchError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const cardSceneRef = useRef(null);

  const handleMouseMove = (e) => {
    const el = cardSceneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * -8, y: y * 8 });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  const brand = useMemo(() => detectBrand(firstDigits), [firstDigits]);

  const stripePromise = useMemo(() => {
    const key = stripeKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn('No Stripe publishable key provided. Set VITE_STRIPE_PUBLISHABLE_KEY or pass stripeKey prop.');
      return null;
    }
    return loadStripe(key);
  }, [stripeKey]);

  // Fetch PaymentIntent clientSecret when amount changes
  useEffect(() => {
    if (!amount) return;
    const numAmount = typeof amount === 'string'
      ? parseFloat(amount.replace(/[^0-9.,]/g, '').replace(',', '.'))
      : amount;
    if (!numAmount || numAmount <= 0) return;

    setFetchError('');
    setIsFetching(true);
    setClientSecret(null);

    const currentEmail = email || 'checkout@rewind-stores.com';
    const cleanItems = (items || []).map(it => ({ id: it.id || it.product_id, qty: it.qty }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cleanItems, orderNum, email: currentEmail, name: name || '', address: address || '', promoCode: promoProp || '', paymentMethod: paymentMethod || 'card', country: country || '' }),
      signal: controller.signal,
    })
      .then((r) => {
        clearTimeout(timer);
        if (!r.ok) throw new Error(`Server responded with ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setFetchError(data.error || 'Payment system unavailable');
        }
      })
      .catch((e) => {
        if (e.name === 'AbortError') {
          setFetchError('Payment server timed out. Please try again.');
        } else {
          setFetchError(e.message || 'Network error connecting to payment gateway.');
        }
      })
      .finally(() => setIsFetching(false));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [amount, orderNum, email, name, address, items, promoProp, paymentMethod, country]);

  // Store the pay function from inside Elements so the ref can call it
  const [payFn, setPayFn] = useState(null);

  useImperativeHandle(ref, () => ({
    pay: async (overrideDetails) => {
      if (!payFn) return { error: 'Payment not ready yet' };
      return payFn(overrideDetails);
    },
    isValid: cardValid && !!clientSecret,
    clientSecret,
  }), [payFn, cardValid, clientSecret]);

  if (!stripePromise) {
    return (
      <div className="rw-cc-wrap">
        <div className="rw-cc-form">
          <p className="rw-cc-error">Stripe not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your environment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rw-cc-wrap">
      {/* ── Animated card preview ── */}
      <div className="rw-cc-scene"
        ref={cardSceneRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}>
        <div className={`rw-cc ${focused === 'cvv' ? 'is-flipped' : ''}`}>
          <div className="rw-cc-face rw-cc-front">
            <div className="rw-cc-bg" />
            <div className={`rw-cc-tint rw-cc-tint-${brand} ${brand !== 'generic' ? 'is-on' : ''}`} />
            <div className="rw-cc-gloss" />
            <div className="rw-cc-row rw-cc-row-top">
              <div className="rw-cc-chip">
                <span />
                <span />
              </div>
              <svg className="rw-cc-wave" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M8 16.5a6 6 0 0 1 0-9" />
                <path d="M11 19a10 10 0 0 1 0-14" />
                <path d="M14 21.5a14 14 0 0 1 0-19" />
              </svg>
              <BrandMark brand={brand} />
            </div>
            <div className={`rw-cc-number ${focused === 'number' ? 'is-active' : ''}`}>
              <span className="rw-cc-placeholder">
                {'•••• •••• •••• ••••'}
              </span>
            </div>
            <div className="rw-cc-row rw-cc-row-bottom">
              <div className="rw-cc-field rw-cc-field-exp">
                <small>Expires</small>
                <span>MM/YY</span>
              </div>
            </div>
          </div>
          <div className="rw-cc-face rw-cc-back">
            <div className="rw-cc-bg" />
            <div className={`rw-cc-tint rw-cc-tint-${brand} ${brand !== 'generic' ? 'is-on' : ''}`} />
            <div className="rw-cc-stripe" />
            <div className="rw-cc-signature">
              <div className="rw-cc-signature-line" />
              <div className={`rw-cc-cvv-box ${focused === 'cvv' ? 'is-active' : ''}`}>
                {'•••'}
              </div>
            </div>
            <div className="rw-cc-row rw-cc-row-back-bottom">
              <span className="rw-cc-back-note">Authorized Signature</span>
              <BrandMark brand={brand} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stripe Elements form ── */}
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CardFormInner
            clientSecret={clientSecret}
            amount={amount}
            onValidChange={({ valid }) => {
              setCardValid(valid);
              onChange?.({ clientSecret, valid });
            }}
            onError={(err) => console.warn('Card error:', err)}
            onPayReady={({ pay }) => setPayFn(() => pay)}
            onFocusChange={(field) => setFocused(field)}
            onPaymentSuccess={onPaymentSuccess}
          />
        </Elements>
      ) : (
        <div className="rw-cc-form">
          {isFetching && <div className="rw-cc-loading">Loading payment form…</div>}
          {fetchError && (
            <div className="rw-cc-error">
              <p>{fetchError}</p>
              <button
                onClick={() => {
                  setFetchError('');
                  setClientSecret(null);
                }}
                style={{ marginTop: '8px', padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--line-2)', cursor: 'pointer' }}
              >Retry</button>
            </div>
          )}
          {amount && !isFetching && !fetchError && (
            <div className="rw-cc-amount"><span>Payment amount</span><b>{amount}</b></div>
          )}
        </div>
      )}
    </div>
  );
});

export default PaymentCard;
