import React, { useState, useEffect } from 'react';
import { Photo, Icon } from './Shell';
import { deleteCustomProduct } from '../lib/supabase';
import { money } from '../hooks/useCountdown';

export default function ProductPage({ p, onBack, onAdd, onWishlist, wishlisted, showCompare = true, showStock = true, onSizeGuide }) {
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [selectedImg, setSelectedImg] = useState(0);
  const [added, setAdded] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [isRealAdmin, setIsRealAdmin] = useState(!!localStorage.getItem('rw_admin_email'));

  // Verify admin status server-side — don't trust localStorage alone
  useEffect(() => {
    if (!localStorage.getItem('rw_admin_email')) return;
    fetch('/api/admin/check-auth').then(r => r.json()).then(d => {
      if (!d.authed) setIsRealAdmin(false);
    }).catch(() => setIsRealAdmin(false));
  }, []);

  // Reset selected thumbnail when navigating to a different product
  useEffect(() => { setSelectedImg(0); setSize(null); setQty(1); setAdded(false); }, [p?.id || p?.product_id]);

  if (!p) return null;

  // Mock multiple images — replace with real photos
  const images = [p.img || ''];

  const low = p.stock > 0 && p.stock <= 5;
  const soldOut = p.stock === 0;

  return (
    <div className="rw-product-page">
      <button className="rw-btn rw-btn-ghost" onClick={onBack}
        style={{ marginBottom: '20px', fontSize: '14px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        ← Back to shop
      </button>

      {isRealAdmin && (
        <div style={{ float: 'right', marginTop: '8px', position: 'relative' }}>
          <button onClick={() => setShowAdminMenu(v => !v)}
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            ⋮
          </button>
          {showAdminMenu && <div onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', top: '36px', right: 0, background: 'var(--surface)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '120px', zIndex: 30 }}>
            <button onClick={() => {
              const id = p.id || p.product_id;
              const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
              if (savedIds.includes(id)) { localStorage.setItem('rw_admin_saved', JSON.stringify(savedIds.filter(x => x !== id))); alert('Removed from saved'); }
              else { localStorage.setItem('rw_admin_saved', JSON.stringify([...savedIds, id])); alert('Saved!'); }
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              ⭐ Save
            </button>
            <button onClick={async () => {
              if (confirm('Delete this product?')) {
                const ok = await deleteCustomProduct(p.id || p.product_id).catch(() => false);
                if (ok) onBack();
                else alert('❌ Failed to delete product — check admin session');
              }
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              🗑 Delete
            </button>
            <button onClick={() => {
              localStorage.setItem('rw_edit_product', p.id || p.product_id);
              window.location.hash = '#admin';
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              ✏️ Edit
            </button>
          </div>}
        </div>
      )}

      <div className="rw-product-layout">
        {/* ── Images ── */}
        <div className="rw-product-images">
          <div className="rw-product-main-img" style={{
            background: p.hue ? `hsl(${p.hue},60%,85%)` : 'var(--bg)',
            borderRadius: '16px', overflow: 'hidden', marginBottom: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '400px',
          }}>
            <Photo id={(p.id || p.product_id) + '-page'} hue={p.hue} label={p.name?.toUpperCase() || ''} h={500} img={images[selectedImg] || p.img} />
          </div>
          {/* Thumbnail strip — only show when there are multiple distinct images */}
          {images.filter(Boolean).length > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {images.filter(Boolean).map((img, i) => (
                <div key={i} onClick={() => setSelectedImg(i)}
                  style={{
                    width: '72px', height: '72px', borderRadius: '8px', cursor: 'pointer',
                    background: p.hue ? `hsl(${p.hue},60%,85%)` : 'var(--bg)',
                    border: selectedImg === i ? '2px solid var(--ink)' : '2px solid transparent',
                    overflow: 'hidden',
                  }}>
                  <img src={img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="rw-product-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px' }}>
                {p.cat?.toUpperCase()}
              </span>
              {p.brand && (
                <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '6px' }}>— {p.brand}</span>
              )}
            </div>
            <button
              aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
              onClick={(e) => { e.stopPropagation(); onWishlist && onWishlist(p); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: wishlisted ? 'var(--accent)' : 'var(--muted)',
                transition: 'color 0.15s, transform 0.15s',
                marginTop: '-2px',
              }}
              onMouseOver={e => { if (!wishlisted) e.target.style.color = 'var(--accent)'; e.target.style.transform = 'scale(1.15)'; }}
              onMouseOut={e => { if (!wishlisted) e.target.style.color = 'var(--muted)'; e.target.style.transform = 'scale(1)'; }}
            >
              <Icon name={wishlisted ? 'heartFilled' : 'heart'} size={20} />
            </button>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0 4px', color: 'var(--ink)' }}>{p.name}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>{money(p.price)}</span>
            {showCompare && p.was && <span style={{ fontSize: '18px', color: 'var(--muted)', textDecoration: 'line-through' }}>{money(p.was)}</span>}
          </div>

          {showStock && soldOut && (
            <div style={{ padding: '8px 14px', background: 'color-mix(in oklab, var(--accent) 10%, transparent)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Icon name="bolt" size={15} /> Sold out — check back soon
            </div>
          )}
          {showStock && low && !soldOut && (
            <div style={{ padding: '8px 14px', background: 'color-mix(in oklab, var(--accent) 10%, transparent)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Icon name="bolt" size={15} /> Only {p.stock} left
            </div>
          )}

          <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--muted)', marginBottom: '16px' }}>
            {p.note || 'Hand-picked vintage piece. Authenticated, steam-cleaned, and ready to wear.'}
          </p>
          {p.material && (
            <div style={{ display: 'inline-block', padding: '6px 14px', background: 'var(--line)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '20px' }}>
              {p.material}
            </div>
          )}

          {/* ── Size selector ── */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Size</div>
              {onSizeGuide && (
                <button onClick={onSizeGuide}
                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', textDecoration: 'underline', textUnderlineOffset: '3px', transition: 'color 0.15s' }}
                  onMouseOver={e => e.target.style.color = 'var(--accent)'}
                  onMouseOut={e => e.target.style.color = 'var(--muted)'}>
                  Size guide →
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {p.sizes?.map(s => (
                <button key={s} onClick={() => setSize(s)}
                  className={"rw-size" + (size === s ? " is-on" : "")}
                  style={{
                    borderRadius: '50%', width: '52px', height: '52px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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
                disabled={qty <= 1}
                onMouseOver={e => { if (!e.target.disabled) e.target.style.background = 'var(--line)'; }}
                onMouseOut={e => { if (!e.target.disabled) e.target.style.background = 'var(--surface)'; }}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: qty <= 1 ? 'not-allowed' : 'pointer', transition: 'background 0.15s, opacity 0.15s', opacity: qty <= 1 ? 0.35 : 1, display: 'grid', placeItems: 'center' }}><Icon name="minus" size={14} /></button>
              <span style={{ fontSize: '16px', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(Math.min(p.stock || 99, qty + 1))}
                disabled={qty >= (p.stock || 99)}
                onMouseOver={e => { if (!e.target.disabled) e.target.style.background = 'var(--line)'; }}
                onMouseOut={e => { if (!e.target.disabled) e.target.style.background = 'var(--surface)'; }}
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: qty >= (p.stock || 99) ? 'not-allowed' : 'pointer', transition: 'background 0.15s, opacity 0.15s', opacity: qty >= (p.stock || 99) ? 0.35 : 1, display: 'grid', placeItems: 'center' }}><Icon name="plus" size={14} /></button>
            </div>
          </div>

          <button onClick={() => { if (onAdd) onAdd(p, size, qty); setAdded(true); setTimeout(() => setAdded(false), 2000); }}
            disabled={!size || added || soldOut}
            className="rw-btn rw-btn-pri rw-btn-full"
            style={{ marginBottom: '12px' }}>
            {added ? (
              <>✓ Added!</>
            ) : soldOut ? (
              'Sold out'
            ) : size ? (
              `Add ${qty > 1 ? qty + '× ' : ''}to bag — ${money(p.price * qty)}`
            ) : (
              'Select a size'
            )}
          </button>

          {/* ── Details ── */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
              <span>Free shipping on orders over €150</span>
              <span>14-day returns</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
