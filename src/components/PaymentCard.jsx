import React, { useState, useRef } from 'react';

const cardStyles = {
  wrapper: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start', maxWidth: '860px', margin: '0 auto' },
  cardScene: { perspective: '1000px', width: '100%', maxWidth: '380px', aspectRatio: '1.586', margin: '0 auto' },
  card: {
    width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d',
    transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
  cardFace: {
    position: 'absolute', inset: 0, borderRadius: '14px', backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden', padding: '24px 26px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    background: 'linear-gradient(135deg, #16130F 0%, #2A2520 100%)',
    boxShadow: '0 20px 60px -12px rgba(22,19,15,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  cardBack: {
    position: 'absolute', inset: 0, borderRadius: '14px', backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
    background: 'linear-gradient(135deg, #16130F 0%, #2A2520 100%)',
    boxShadow: '0 20px 60px -12px rgba(22,19,15,0.5)',
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  formGroup: { marginBottom: '18px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted, #6E665A)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    width: '100%', padding: '12px 14px', border: '1.5px solid var(--line-2, #D9D0C0)', borderRadius: '10px',
    background: 'var(--surface, #fff)', fontSize: '15px', color: 'var(--ink, #16130F)', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s', boxSizing: 'border-box',
  },
  inputFocus: { borderColor: 'var(--ink, #16130F)', boxShadow: '0 0 0 3px rgba(255,77,20,0.14)' },
  row: { display: 'flex', gap: '12px' },
  half: { flex: 1 },
  chip: {
    width: '38px', height: '28px', background: 'linear-gradient(135deg, #D4AF37 0%, #F5D97E 50%, #D4AF37 100%)',
    borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '8px', fontWeight: 800, color: '#8B7328', letterSpacing: '1px',
  },
  brandLogo: { fontSize: '22px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-head)' },
  cardNumber: { fontSize: 'clamp(16px,2.2vw,22px)', fontWeight: 700, letterSpacing: '2.5px', color: '#fff', fontFamily: 'monospace' },
  cardName: { fontSize: 'clamp(11px,1.1vw,14px)', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardExpiry: { fontSize: 'clamp(11px,1.1vw,14px)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px' },
  magneticStripe: { width: '100%', height: '42px', background: 'rgba(0,0,0,0.25)', marginTop: '24px' },
  cvvBox: {
    position: 'absolute', right: '24px', top: '50%', width: '56px', padding: '6px 8px',
    background: '#fff', color: '#16130F', borderRadius: '4px', fontSize: '15px', fontFamily: 'monospace',
    fontWeight: 700, textAlign: 'center', letterSpacing: '1px',
  },
};

function formatCardNumber(val) {
  const digits = val.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(val) {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

export default function PaymentCardPreview({ onComplete }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [focused, setFocused] = useState(null);

  const cardStyle = { ...cardStyles.card, transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' };

  const handleFocus = (field) => {
    setFocused(field);
    setFlipped(field === 'cvv');
  };

  const getInputStyle = (field) => ({
    ...cardStyles.input,
    ...(focused === field ? cardStyles.inputFocus : {}),
  });

  return (
    <div style={cardStyles.wrapper}>
      {/* Left: Card Preview */}
      <div style={cardStyles.cardScene}>
        <div style={cardStyle}>
          {/* Front */}
          <div style={cardStyles.cardFace}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={cardStyles.chip}>CV</div>
              <div style={cardStyles.brandLogo}>REWIND</div>
            </div>

            <div>
              <div style={cardStyles.cardNumber}>
                {number || '•••• •••• •••• ••••'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Card Holder</div>
                  <div style={cardStyles.cardName}>{name || 'Your Name'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Expires</div>
                  <div style={cardStyles.cardExpiry}>{expiry || 'MM/YY'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Back */}
          <div style={cardStyles.cardBack}>
            <div style={cardStyles.magneticStripe} />
            <div style={{ padding: '0 24px', position: 'relative' }}>
              <div style={{ width: '100%', height: '36px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '12px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>{cvv || '•••'}</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '9px', color: 'rgba(255,255,255,0.3)', textAlign: 'right', letterSpacing: '0.5px' }}>CVV</div>
            </div>
            <div style={{ position: 'absolute', bottom: '24px', right: '24px', fontSize: '11px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.5px', fontWeight: 600 }}>
              REWIND • REWARD
            </div>
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div>
        <div style={cardStyles.formGroup}>
          <label style={cardStyles.label}>Cardholder Name</label>
          <input
            style={getInputStyle('name')}
            placeholder="Philippe Anaman"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={() => handleFocus('name')}
            onBlur={() => setFocused(null)}
          />
        </div>

        <div style={cardStyles.formGroup}>
          <label style={cardStyles.label}>Card Number</label>
          <input
            style={getInputStyle('number')}
            placeholder="4242 4242 4242 4242"
            value={number}
            onChange={e => setNumber(formatCardNumber(e.target.value))}
            onFocus={() => handleFocus('number')}
            onBlur={() => setFocused(null)}
            maxLength={19}
            inputMode="numeric"
          />
        </div>

        <div style={cardStyles.row}>
          <div style={cardStyles.half}>
            <div style={cardStyles.formGroup}>
              <label style={cardStyles.label}>Expiry Date</label>
              <input
                style={getInputStyle('expiry')}
                placeholder="MM/YY"
                value={expiry}
                onChange={e => setExpiry(formatExpiry(e.target.value))}
                onFocus={() => handleFocus('expiry')}
                onBlur={() => setFocused(null)}
                maxLength={5}
                inputMode="numeric"
              />
            </div>
          </div>
          <div style={cardStyles.half}>
            <div style={cardStyles.formGroup}>
              <label style={cardStyles.label}>CVV</label>
              <input
                style={getInputStyle('cvv')}
                placeholder="***"
                value={cvv}
                onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onFocus={() => handleFocus('cvv')}
                onBlur={() => setFocused(null)}
                maxLength={3}
                inputMode="numeric"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
