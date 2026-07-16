import React from 'react';

export default function Survey({ onDone, onSkip }) {
  const [step, setStep] = React.useState(0);
  const [source, setSource] = React.useState('');
  const [other, setOther] = React.useState('');
  const [sent, setSent] = React.useState(false);

  const handleSubmit = async () => {
    const val = source === 'other' ? other : source;
    if (!val) return;
    setSent(true);
    try { await fetch('/api/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: val }) }); } catch {}
    setTimeout(() => { onDone(); }, 2000);
  };

  const options = [
    { id: 'social', label: 'Social media' },
    { id: 'friend', label: 'From a friend' },
    { id: 'search', label: 'Google search' },
    { id: 'ads', label: 'Online ad' },
    { id: 'other', label: 'Other' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {sent ? (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🙏</div>
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#16130F', margin: 0 }}>Thanks for the feedback!</p>
          </div>
        ) : step === 0 ? (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#16130F', margin: '0 0 8px' }}>Welcome to REWIND 🎉</h2>
            <p style={{ fontSize: '14px', color: '#6E665A', margin: '0 0 20px' }}>How did you hear about us?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.map(o => (
                <button key={o.id} onClick={() => { setSource(o.id); setStep(1); }}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px solid #E2DCD3', background: '#FAF6EF', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#16130F', transition: 'all 0.15s' }}>
                  {o.label}
                </button>
              ))}
            </div>
            <button onClick={onSkip} style={{ marginTop: '16px', background: 'none', border: 'none', color: '#6E665A', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>Skip</button>
          </div>
        ) : source === 'other' ? (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#16130F', margin: '0 0 8px' }}>Tell us more</h2>
            <input placeholder="How did you find us?" value={other} onChange={e => setOther(e.target.value)}
              style={{ width: '100%', padding: '12px', border: '1px solid #E2DCD3', borderRadius: '8px', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} />
            <button onClick={handleSubmit} disabled={!other.trim()}
              style={{ padding: '12px 24px', borderRadius: '999px', border: 'none', background: '#16130F', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Submit</button>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#16130F', margin: '0 0 8px' }}>Great choice!</h2>
            <p style={{ fontSize: '14px', color: '#6E665A', margin: '0 0 20px' }}>We're glad you found us through {options.find(o => o.id === source)?.label}.</p>
            <button onClick={handleSubmit}
              style={{ padding: '12px 24px', borderRadius: '999px', border: 'none', background: '#16130F', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Continue</button>
          </div>
        )}
      </div>
    </div>
  );
}
