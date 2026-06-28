import React, { useState } from 'react';
import { Icon } from './Shell';

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
  const images = {
    'Tops / Shirts': '/images/size-shirt.png',
    Jumpers: '/images/size-jumper.png',
    Bottoms: '/images/size-pants.png',
    Shoes: '/images/size-shoe.png',
  };
  const labels = {
    'Tops / Shirts': ['A. Shoulder', 'B. Length', 'C. Sleeve'],
    Jumpers: ['A. Shoulder', 'B. Length', 'C. Sleeve'],
    Bottoms: ['A. Waist', 'B. Hips', 'C. Inseam'],
    Shoes: ['A. Foot length', 'B. Width'],
  };
  const img = images[cat];
  const lbl = labels[cat] || [];
  if (!img) return null;
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
      <img src={img} alt={`${cat} size guide`}
        style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
        {lbl.map((l, i) => (
          <div key={i} style={{
            position: 'absolute',
            background: i === 0 ? 'color-mix(in oklab, var(--accent) 90%, transparent)' : i === 1 ? 'color-mix(in oklab, var(--ink) 90%, transparent)' : 'color-mix(in oklab, var(--muted) 90%, transparent)',
            color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
            top: `${10 + i * 25}%`, left: '8px',
          }}>{l}</div>
        ))}
      </div>
    </div>
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
          <Icon name="close" size={18} />
        </button>

        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Size Guide</h2>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{
                padding: '8px 18px', borderRadius: '999px', border: 'none',
                background: cat === c ? 'var(--ink)' : 'var(--line)',
                color: cat === c ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                transition: 'background 0.15s, color 0.15s, transform 0.15s',
              }}
              onMouseOver={e => { if (cat !== c) { e.target.style.background = 'var(--line-2)'; } }}
              onMouseOut={e => { if (cat !== c) { e.target.style.background = 'var(--line)'; } }}>
              {c}
            </button>
          ))}
        </div>

        {/* Size selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {SIZES.map(s => (
            <button key={s} onClick={() => setSize(s)}
              style={{
                width: '48px', height: '48px', borderRadius: '50%',
                border: size === s ? '2px solid var(--ink)' : '1px solid var(--line-2)',
                background: size === s ? 'var(--ink)' : 'var(--surface)',
                color: size === s ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
              }}
              onMouseOver={e => { if (size !== s) { e.target.style.borderColor = 'var(--ink)'; e.target.style.transform = 'scale(1.05)'; } }}
              onMouseOut={e => { if (size !== s) { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; } }}>
              {s}
            </button>
          ))}
        </div>

        {/* Diagram + table */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto' }}>
            <SizeDiagram cat={cat} />
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', textAlign: 'center' }}>
              Size {size} — {cat}
            </p>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--ink)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Size</th>
                  {m.cols.map(col => (
                    <th key={col} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', color: 'var(--muted)' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIZES.map(s => (
                  <tr key={s} style={{ background: size === s ? 'var(--bg)' : 'transparent', borderBottom: '1px solid var(--line)' }}>
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

        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '20px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
          Measurements are approximate. For the best fit, compare to a similar item you already own.<br />
          How to measure: <strong>A</strong> = shoulder seam to shoulder seam · <strong>B</strong> = shoulder seam to bottom hem · <strong>C</strong> = armpit to cuff
        </p>
      </div>
    </div>
  );
}
