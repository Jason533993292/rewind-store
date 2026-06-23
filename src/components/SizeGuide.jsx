import React, { useState } from 'react';

const CATEGORIES = ['Tops / Shirts', 'Jumpers', 'Shoes', 'Bottoms'];

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const MEASUREMENTS = {
  'Tops / Shirts': {
    unit: 'cm',
    cols: ['Chest (A)', 'Length (B)', 'Sleeve (C)'],
    data: {
      XS: [88, 66, 58],
      S: [93, 69, 60],
      M: [98, 72, 62],
      L: [104, 75, 64],
      XL: [110, 78, 66],
    }
  },
  Jumpers: {
    unit: 'cm',
    cols: ['Chest (A)', 'Length (B)', 'Sleeve (C)'],
    data: {
      XS: [90, 64, 58],
      S: [95, 67, 60],
      M: [100, 70, 62],
      L: [106, 73, 64],
      XL: [112, 76, 66],
    }
  },
  Shoes: {
    unit: 'EU',
    cols: ['EU Size', 'UK Size', 'Foot Length (cm)'],
    data: {
      XS: ['36', '3.5', '23'],
      S: ['38', '5', '24'],
      M: ['40', '6.5', '25.5'],
      L: ['42', '8', '27'],
      XL: ['44', '9.5', '28.5'],
    }
  },
  Bottoms: {
    unit: 'cm',
    cols: ['Waist (A)', 'Hips (B)', 'Inseam (C)'],
    data: {
      XS: [72, 88, 74],
      S: [76, 92, 76],
      M: [80, 96, 78],
      L: [84, 100, 80],
      XL: [88, 104, 82],
    }
  },
};

function SizeDiagram({ cat }) {
  if (cat === 'Shoes') {
    return (
      <svg viewBox="0 0 240 200" style={{ width: '100%', maxWidth: '240px' }}>
        {/* Shoe outline */}
        <path d="M30,160 L20,130 Q15,110 25,90 L45,55 Q55,35 80,25 L150,20 Q175,18 195,30 L220,50 Q230,60 235,80 L230,110 Q228,130 220,145 L210,160 Z"
          fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
        {/* Sole */}
        <path d="M210,160 L30,160 Q25,160 25,155 L27,150" fill="none" stroke="#16130F" strokeWidth="2.5" />
        {/* Lace area */}
        <path d="M80,25 L75,55 Q72,70 65,85" fill="none" stroke="#888" strokeWidth="1.5" strokeDasharray="3,2" />
        {/* A - Length */}
        <line x1="20" y1="175" x2="230" y2="175" stroke="#FF4D14" strokeWidth="2" />
        <text x="100" y="195" fill="#FF4D14" fontSize="11" fontWeight="600">A. Length</text>
        {/* B - Width */}
        <line x1="25" y1="140" x2="20" y2="30" stroke="#4caf50" strokeWidth="2" strokeDasharray="4" />
        <text x="0" y="85" fill="#4caf50" fontSize="11" fontWeight="600" transform="rotate(-90,5,85)">B. Width</text>
      </svg>
    );
  }
  if (cat === 'Bottoms') {
    return (
      <svg viewBox="0 0 220 280" style={{ width: '100%', maxWidth: '220px' }}>
        {/* Waistband */}
        <path d="M50,20 Q110,35 170,20 L175,35 Q110,50 45,35 Z"
          fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
        {/* Left leg */}
        <path d="M50,20 Q40,40 38,80 L35,180 Q33,220 40,260 L60,265 Q65,220 68,180 L70,80 Q72,50 70,35"
          fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
        {/* Right leg */}
        <path d="M170,20 Q180,40 182,80 L185,180 Q187,220 180,260 L160,265 Q155,220 152,180 L150,80 Q148,50 150,35"
          fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
        {/* Crotch */}
        <path d="M70,35 Q110,55 150,35" fill="none" stroke="#16130F" strokeWidth="3" />
        {/* A - Waist */}
        <line x1="45" y1="15" x2="175" y2="15" stroke="#FF4D14" strokeWidth="2" />
        <text x="85" y="10" fill="#FF4D14" fontSize="11" fontWeight="600">A. Waist</text>
        {/* B - Hips */}
        <line x1="38" y1="45" x2="182" y2="45" stroke="#4caf50" strokeWidth="2" strokeDasharray="4" />
        <text x="75" y="58" fill="#4caf50" fontSize="11" fontWeight="600">B. Hips</text>
        {/* C - Inseam */}
        <line x1="55" y1="80" x2="55" y2="260" stroke="#888" strokeWidth="2" strokeDasharray="4" />
        <text x="32" y="170" fill="#888" fontSize="11" transform="rotate(-90,38,170)">C. Inseam</text>
      </svg>
    );
  }
  // Tops / Jumpers — improved shirt with proper sleeves
  const isJumper = cat === 'Jumpers';
  const neck = isJumper ? 'M68,28 Q100,45 132,28' : 'M70,25 Q100,45 130,25';
  return (
    <svg viewBox="0 0 260 280" style={{ width: '100%', maxWidth: '240px' }}>
      {/* Left sleeve */}
      <path d="M52,45 Q30,55 18,80 Q10,100 15,120 L25,125 Q30,105 38,90 Q45,75 55,65"
        fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
      {/* Right sleeve */}
      <path d="M208,45 Q230,55 242,80 Q250,100 245,120 L235,125 Q230,105 222,90 Q215,75 205,65"
        fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
      {/* Body */}
      <path d="M52,45 Q55,35 70,30 L130,20 L190,30 Q205,35 208,45 L210,80 Q212,120 210,170 Q208,210 205,240 L200,255 L60,255 L55,240 Q52,210 50,170 Q48,120 50,80 Z"
        fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
      {/* Collar / Neckline */}
      <path d={neck} fill="none" stroke="#16130F" strokeWidth="3" strokeLinejoin="round" />
      {/* A - Shoulder */}
      <line x1="52" y1="22" x2="208" y2="22" stroke="#FF4D14" strokeWidth="2" />
      <text x="110" y="16" fill="#FF4D14" fontSize="11" fontWeight="600">A. Shoulder</text>
      {/* B - Length */}
      <line x1="48" y1="30" x2="48" y2="255" stroke="#4caf50" strokeWidth="2" strokeDasharray="4" />
      <text x="20" y="140" fill="#4caf50" fontSize="11" fontWeight="600" transform="rotate(-90,28,140)">B. Length</text>
      {/* C - Sleeve */}
      <line x1="14" y1="115" x2="246" y2="115" stroke="#888" strokeWidth="2" strokeDasharray="4" />
      <text x="80" y="108" fill="#888" fontSize="11">C. Sleeve</text>
    </svg>
  );
}

export default function SizeGuide({ onClose }) {
  const [cat, setCat] = useState('Tops / Shirts');
  const [size, setSize] = useState('M');

  const m = MEASUREMENTS[cat];

  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal size-guide-modal" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '650px', padding: '32px' }}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>

        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Size Guide</h2>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{
                padding: '8px 18px', borderRadius: '999px', border: 'none',
                background: cat === c ? '#16130F' : '#f0f0f0',
                color: cat === c ? '#fff' : '#16130F',
                cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              }}>
              {c}
            </button>
          ))}
        </div>

        {/* Size selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {SIZES.map(s => (
            <button key={s} onClick={() => setSize(s)}
              style={{
                width: '48px', height: '48px', borderRadius: '50%', border: size === s ? '2px solid #16130F' : '1px solid #ddd',
                background: size === s ? '#16130F' : '#fff',
                color: size === s ? '#fff' : '#16130F',
                cursor: 'pointer', fontWeight: 700, fontSize: '14px',
              }}>
              {s}
            </button>
          ))}
        </div>

        {/* Diagram + table */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto' }}>
            <SizeDiagram cat={cat} />
            <p style={{ fontSize: '11px', color: '#888', marginTop: '4px', textAlign: 'center' }}>
              Size {size} — {cat}
            </p>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #16130F' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Size</th>
                  {m.cols.map(col => (
                    <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', color: '#666' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIZES.map(s => (
                  <tr key={s} style={{ background: size === s ? '#f5f5f5' : 'transparent', borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{s}</td>
                    {m.data[s].map((v, i) => (
                      <td key={i} style={{ padding: '8px 12px' }}>{v} {i === 0 ? m.unit : ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#888', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
          Measurements are approximate. For the best fit, compare to a similar item you already own.<br />
          How to measure: <strong>A</strong> = shoulder seam to shoulder seam · <strong>B</strong> = shoulder seam to bottom hem · <strong>C</strong> = armpit to cuff
        </p>
      </div>
    </div>
  );
}
