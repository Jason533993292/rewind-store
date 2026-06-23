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
  const w = 200, h = 260;
  if (cat === 'Shoes') {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: '220px' }}>
        <path d="M40,200 Q30,180 35,160 L45,80 Q50,50 80,40 L140,35 Q170,35 175,60 L185,100 Q190,120 185,140 L180,170 Q178,190 160,195 L60,200 Z"
          fill="none" stroke="#16130F" strokeWidth="3" />
        <line x1="85" y1="40" x2="85" y2="195" stroke="#FF4D14" strokeWidth="2" strokeDasharray="4" />
        <line x1="175" y1="60" x2="50" y2="100" stroke="#FF4D14" strokeWidth="2" strokeDasharray="4" />
        <text x="90" y="30" fill="#888" fontSize="11">A. Length</text>
        <text x="100" y="120" fill="#888" fontSize="11">B. Width</text>
      </svg>
    );
  }
  // Tops/Jumpers diagram
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: '220px' }}>
      {/* Shirt body */}
      <path d="M50,30 L40,80 L30,130 L30,230 L170,230 L170,130 L160,80 L150,30 Z"
        fill="none" stroke="#16130F" strokeWidth="3" />
      {/* Collar */}
      <path d="M70,30 L100,50 L130,30" fill="none" stroke="#16130F" strokeWidth="3" />
      {/* Sleeves */}
      <path d="M40,80 L20,105 L25,115 L38,100" fill="none" stroke="#16130F" strokeWidth="2.5" />
      <path d="M160,80 L180,105 L175,115 L162,100" fill="none" stroke="#16130F" strokeWidth="2.5" />
      {/* Measurement A - shoulder to shoulder */}
      <line x1="50" y1="25" x2="150" y2="25" stroke="#FF4D14" strokeWidth="2" />
      <text x="85" y="20" fill="#FF4D14" fontSize="11" fontWeight="600">A. Shoulder</text>
      {/* Measurement B - shoulder to waist */}
      <line x1="48" y1="30" x2="48" y2="230" stroke="#4caf50" strokeWidth="2" strokeDasharray="4" />
      <text x="5" y="130" fill="#4caf50" fontSize="11" fontWeight="600" transform="rotate(-90,12,130)">B. Length</text>
      {/* Measure C - sleeve length */}
      <line x1="20" y1="108" x2="178" y2="108" stroke="#888" strokeWidth="1.5" strokeDasharray="3" />
      <text x="60" y="104" fill="#888" fontSize="10">C. Sleeve</text>
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
