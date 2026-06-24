import React, { useState } from 'react';
import { Photo, Icon } from './Shell';

export default function ProductPage({ p, onBack, onAdd }) {
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [selectedImg, setSelectedImg] = useState(0);

  if (!p) return null;

  // Mock multiple images — replace with real photos
  const images = [p.img || ''];

  const low = p.stock <= 5;

  return (
    <div className="rw-product-page">
      <button onClick={onBack} style={{
        padding: '8px 16px', borderRadius: '999px', border: '1px solid #ddd',
        background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
        marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}>
        ← Back to shop
      </button>

      {!!localStorage.getItem('rw_admin_email') && (
        <button onClick={() => {
          const id = p.id || p.product_id;
          const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
          const isSaved = savedIds.includes(id);
          if (isSaved) localStorage.setItem('rw_admin_saved', JSON.stringify(savedIds.filter(x => x !== id)));
          else localStorage.setItem('rw_admin_saved', JSON.stringify([...savedIds, id]));
          const btn = document.activeElement;
          btn.textContent = isSaved ? '⭐' : '✕';
          setTimeout(() => { btn.textContent = '⋮'; }, 1500);
        }}
          style={{ float: 'right', marginTop: '8px', width: '32px', height: '32px', borderRadius: '50%', background: '#333', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
          ⋮
        </button>
      )}

      <div className="rw-product-layout">
        {/* ── Images ── */}
        <div className="rw-product-images">
          <div className="rw-product-main-img" style={{
            background: p.hue ? `hsl(${p.hue},60%,85%)` : '#f5f0eb',
            borderRadius: '16px', overflow: 'hidden', marginBottom: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '400px',
          }}>
            <Photo id={p.id || p.product_id + '-page'} hue={p.hue} label={p.name?.toUpperCase() || ''} h={500} img={p.img} />
          </div>
          {/* Thumbnail strip — only show if multiple photos */}
          {p.img && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {[0, 1].map(i => (
                <div key={i} onClick={() => setSelectedImg(i)}
                  style={{
                    width: '72px', height: '72px', borderRadius: '8px', cursor: 'pointer',
                    background: i === 0 ? '#f5f0eb' : p.hue ? `hsl(${p.hue + 60},40%,80%)` : '#e8e4dd',
                    border: selectedImg === i ? '2px solid #16130F' : '2px solid transparent',
                    overflow: 'hidden',
                  }}>
                  {i === 0 && p.img && <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="rw-product-info">
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF4D14', letterSpacing: '1px' }}>
            {p.cat?.toUpperCase()}
          </span>
          {p.brand && (
            <span style={{ fontSize: '12px', color: '#888', marginLeft: '6px' }}>— {p.brand}</span>
          )}
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0 4px', color: '#16130F' }}>{p.name}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: '#16130F' }}>€{p.price}</span>
            {p.was && <span style={{ fontSize: '18px', color: '#aaa', textDecoration: 'line-through' }}>€{p.was}</span>}
          </div>

          {low && (
            <div style={{ padding: '8px 14px', background: '#fff3cd', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
              ⚡ Only {p.stock} left
            </div>
          )}

          <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#6E665A', marginBottom: '16px' }}>
            {p.note || 'Hand-picked vintage piece. Authenticated, steam-cleaned, and ready to wear.'}
          </p>
          {p.material && (
            <div style={{ display: 'inline-block', padding: '6px 14px', background: '#f0ece6', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#16130F', marginBottom: '20px' }}>
              {p.material}
            </div>
          )}

          {/* ── Size selector ── */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Size</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {p.sizes?.map(s => (
                <button key={s} onClick={() => setSize(s)}
                  style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    border: size === s ? '2px solid #16130F' : '1px solid #ddd',
                    background: size === s ? '#16130F' : '#fff',
                    color: size === s ? '#fff' : '#16130F',
                    cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Quantity ── */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Quantity</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '16px' }}>−</button>
              <span style={{ fontSize: '16px', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(Math.min(p.stock || 99, qty + 1))}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '16px' }}>+</button>
            </div>
          </div>

          <button onClick={() => { if (onAdd) onAdd(p, size); }}
            disabled={!size}
            style={{
              width: '100%', padding: '16px', borderRadius: '999px', border: 'none',
              background: size ? '#16130F' : '#ddd',
              color: size ? '#fff' : '#888',
              cursor: size ? 'pointer' : 'default',
              fontSize: '16px', fontWeight: 700,
              marginBottom: '12px',
            }}>
            {size ? `Add to bag — €${p.price}` : 'Select a size'}
          </button>

          {/* ── Details ── */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#888', marginBottom: '8px' }}>
              <span>Free shipping on orders over €150</span>
              <span>14-day returns</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
