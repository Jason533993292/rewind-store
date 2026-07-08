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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <span className={displayNumber ? '' : 'rw-cc-placeholder'}>
                {displayNumber || '•••• •••• •••• ••••'}
              </span>
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
              <div className={`rw-cc-cvv-box ${focused === 'cvv' ? 'is-active' : ''}`}>
                {cvv.padEnd(cvvLen, '•')}
              </div>
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
          <input
            id="cc-name" className="rw-input" type="text" autoComplete="cc-name"
            placeholder="Jane Doe" value={name}
            onChange={(e) => setName(e.target.value.slice(0, 26))}
            onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
          />
        </div>
        <div className="rw-cc-group">
          <label htmlFor="cc-number">Card Number</label>
          <input
            id="cc-number" className="rw-input" type="text" inputMode="numeric" autoComplete="cc-number"
            placeholder="4242 4242 4242 4242" value={displayNumber} maxLength={19}
            onChange={handleNumberChange}
            onFocus={() => setFocused('number')} onBlur={() => setFocused(null)}
          />
        </div>
        <div className="rw-input-row">
          <div className="rw-cc-group">
            <label htmlFor="cc-expiry">Expiry Date</label>
            <input
              id="cc-expiry" className="rw-input" type="text" inputMode="numeric" autoComplete="cc-exp"
              placeholder="MM/YY" value={expiry} maxLength={5}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              onFocus={() => setFocused('expiry')} onBlur={() => setFocused(null)}
            />
          </div>
          <div className="rw-cc-group">
            <label htmlFor="cc-cvv">CVV</label>
            <input
              id="cc-cvv" className="rw-input" type="text" inputMode="numeric" autoComplete="cc-csc"
              placeholder={'•'.repeat(cvvLen)} value={cvv} maxLength={cvvLen}
              onChange={handleCvvChange}
              onFocus={() => setFocused('cvv')} onBlur={() => setFocused(null)}
            />
          </div>
        </div>
        {amount && <div className="rw-cc-amount"><span>Payment amount</span><b>{amount}</b></div>}
      </div>
    </div>
  );
}
