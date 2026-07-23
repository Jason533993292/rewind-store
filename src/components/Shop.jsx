import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { money, discountPct } from '../hooks/useCountdown';
import { Icon, Photo } from './Shell';
import { REWIND_PAYMENTS, REWIND_PRODUCTS } from '../data';
import PaymentCard from './PaymentCard';
import { ReferralInput } from './Referral';
import { loadStripe } from '@stripe/stripe-js';

/* ---------- LazyImage (for real product photos) ---------- */
function LazyImage({ src, alt, className }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src;
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div className="rw-photo" style={{ position: 'relative', overflow: 'hidden' }}>
      {!loaded && !error && <div className="rw-skeleton" style={{ position: 'absolute', inset: 0 }} />}
      {error && (
        <div className="rw-photo-bg" style={{ background: 'var(--line)' }}>
          <span className="rw-photo-word" style={{ color: 'var(--muted)', mixBlendMode: 'normal' }}>{alt}</span>
        </div>
      )}
      <img ref={imgRef} className={`rw-img ${loaded ? 'loaded' : ''}`}
        alt={alt} onLoad={() => setLoaded(true)} onError={() => setError(true)}
        style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

/* ---------- ProductCard ---------- */
export function ProductCard({ p, showCompare, showStock, onQuick, onAdd, wishlisted, onWishlist, onSelect, onCart }) {
  const low = p.stock > 0 && p.stock <= 5;
  const soldOut = p.stock === 0;
  const [added, setAdded] = useState(false);
  return (
    <article className="rw-card" style={{ opacity: soldOut ? 0.5 : 1 }}>
      <div className="rw-card-media" style={{ cursor: 'pointer' }} onClick={() => onSelect ? onSelect(p) : onQuick(p)}>
        <Photo id={p.id || p.product_id} hue={p.hue} label={p.name.toUpperCase()} h={340} img={p.img} />
        <div className="rw-card-tags">
          {showCompare && discountPct(p) > 0 && <span className="rw-tag rw-tag-sale">-{discountPct(p)}%</span>}
          {showStock && soldOut && <span className="rw-tag rw-tag-low">Sold out</span>}
          {showStock && low && !soldOut && <span className="rw-tag rw-tag-low">Only {p.stock} left</span>}
        </div>
        <button className="rw-card-quick" onClick={(e) => { e.stopPropagation(); onQuick(p); }}>Quick view</button>
        <button className={"rw-card-fav" + (wishlisted ? ' is-wishlisted' : '')}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          style={{ color: wishlisted ? 'var(--accent)' : undefined }}
          onClick={(e) => { e.stopPropagation(); onWishlist(p); const btn = e.currentTarget; btn.classList.add('wiggle'); setTimeout(() => btn.classList.remove('wiggle'), 500); }}>
          <Icon name={wishlisted ? 'heartFilled' : 'heart'} size={17} />
        </button>
      </div>
      <div className="rw-card-body">
        <div className="rw-card-head">
          <h3 onClick={() => onSelect ? onSelect(p) : onQuick(p)} style={{ cursor: 'pointer' }}>{p.name}</h3>
          <span className="rw-card-cat">{p.cat}</span>
        </div>
        <div className="rw-card-foot">
          <div className="rw-price">
            <span className="rw-price-now">{money(p.price)}</span>
            {showCompare && p.was && <span className="rw-price-was">{money(p.was)}</span>}
          </div>
          {soldOut ? (
            <span className="rw-add" style={{ opacity: 0.35, cursor: 'default', background: 'none', display: 'grid', placeItems: 'center', width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid var(--line-2)' }}>
              <Icon name="close" size={16} />
            </span>
          ) : added ? (
            <button className="rw-add" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
              onClick={onCart} aria-label="View in bag">
              <Icon name="bag" size={16} />
            </button>
          ) : (
          <button className="rw-add" onClick={() => { onAdd(p); setAdded(true); setTimeout(() => setAdded(false), 2000); }} aria-label={"Add " + p.name}>
            <Icon name="plus" size={18} />
          </button>
          )}
        </div>
        {soldOut ? (
          <div className="rw-card-ship" style={{color:'var(--muted)',fontSize:'12px',textAlign:'center',padding:'8px 0'}}>Unavailable</div>
        ) : (
        <div className="rw-card-ship">
          <Icon name="retrn" size={13} /> Free returns <span className="rw-price-was">€8</span>
        </div>
        )}
      </div>
    </article>
  );
}

/* ---------- ProductGrid ---------- */
export function ProductGrid({ products, wishlist, onWishlist, sort, query, onClearSearch, activeCat, activeBrand, onCart, cats, ...rest }) {
  if (products.length === 0) {
    const hasQuery = query && query.trim();
    const hasBrand = activeBrand;
    const hasCat = activeCat && activeCat !== 'All';
    let msg;
    if (hasQuery && hasBrand) {
      msg = `Nothing matched "${query.trim()}" for ${activeBrand}${hasCat ? ' in ' + activeCat : ''} — try a different term?`;
    } else if (hasQuery && hasCat) {
      msg = `Nothing matched "${query.trim()}" in ${activeCat} — try a different term?`;
    } else if (hasQuery) {
      msg = `Nothing matched "${query.trim()}" — try a different term?`;
    } else if (hasBrand) {
      msg = `No ${activeBrand} products${hasCat ? ' in ' + activeCat : ''} — try a different brand or category?`;
    } else if (hasCat) {
      msg = 'Nothing here in this category yet — try browsing all or checking back soon.';
    } else {
      msg = 'Nothing here yet — check back soon for new drops.';
    }
    const showClearFilters = hasQuery || hasBrand || hasCat;
    return (
      <div className="rw-empty">
        <span>{msg}</span>
        {showClearFilters && (
          <div style={{ marginTop: '14px' }}>
            <button className="rw-btn rw-btn-ghost" onClick={onClearSearch}
              style={{ fontSize: '13px', padding: '10px 18px' }}>
              ✕ Clear filters & show all
            </button>
          </div>
        )}
        {hasQuery && cats && cats.filter(c => c !== 'All').length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Browse categories:</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {cats.filter(c => c !== 'All').slice(0, 6).map(c => (
                <button key={c} onClick={() => { if (rest.onSetCat) rest.onSetCat(c); }}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', border: '1px solid var(--line-2)',
                    background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    color: 'var(--muted)', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.color = 'var(--ink)'; }}
                  onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.color = 'var(--muted)'; }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  // Sort products
  let sorted = [...products];
  const isSorting = sort === 'price-asc' || sort === 'price-desc' || sort === 'name-asc' || sort === 'name-desc';
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'name-asc') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (sort === 'name-desc') sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));

  // When sorting is active, render a single flat grid so the sort order is respected globally.
  if (isSorting) {
    return (
      <div>
        <div className="rw-grid">
          {sorted.map((p) => (
            <ProductCard key={p.id || p.product_id} p={p} wishlisted={wishlist?.includes(p.id || p.product_id)} onWishlist={onWishlist}
              showCompare={rest.showCompare} showStock={rest.showStock} onQuick={rest.onQuick} onAdd={rest.onAdd} onSelect={rest.onSelect} onCart={onCart} />
          ))}
        </div>
      </div>
    );
  }

  // Group products by category, then flatten with headers (Featured view)
  const grouped = {};
  sorted.forEach(p => {
    const cat = p.cat || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const sections = Object.entries(grouped).map(([cat, items]) => {
    // When browsing a specific category (not "All"), the category is already
    // shown in the page title — omit it from section headers to reduce noise.
    const isCurrentCat = activeCat && activeCat !== 'All' && cat === activeCat;
    const label = isCurrentCat ? '' : cat;
    return { label, items };
  });

  return (
    <div className="rw-grid">
      {sections.map((s, i) => (
        <React.Fragment key={i}>
          {s.label && (
            <h3 className="rw-section-head">
              {s.label}
            </h3>
          )}
          {s.items.map((p) => (
            <ProductCard key={p.id || p.product_id} p={p} wishlisted={wishlist?.includes(p.id || p.product_id)} onWishlist={onWishlist}
              showCompare={rest.showCompare} showStock={rest.showStock} onQuick={rest.onQuick} onAdd={rest.onAdd} onSelect={rest.onSelect} onCart={onCart} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- QuickView ---------- */
export function QuickView({ p, showCompare, showStock, onClose, onAdd }) {
  const [size, setSize] = useState(null);
  const [showQvMenu, setShowQvMenu] = useState(false);
  // Reset size selection when the product changes — prevents stale size
  // from a previous product (e.g. shoe size "42" persisting after switching
  // to a jersey with S/M/L/XL sizes).
  useEffect(() => { setSize(null); }, [p?.id || p?.product_id]);
  if (!p) return null;
  const low = p.stock > 0 && p.stock <= 5;
  const soldOut = p.stock === 0;
  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        {!!localStorage.getItem('rw_admin_email') && (
        <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 20 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowQvMenu(v => !v); }}
            style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            ⋮
          </button>
          {showQvMenu && <div onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', top: '32px', left: 0, background: 'var(--surface)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '120px', zIndex: 30 }}>
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
            <button onClick={() => {
              if (confirm('Delete this product?')) {
                deleteCustomProduct(p.id || p.product_id);
                window.location.reload();
              }
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              🗑 Delete
            </button>
            <button onClick={() => {
              localStorage.setItem('rw_edit_product', p.id || p.product_id);
              nav('/admin');
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              ✏️ Edit
            </button>
          </div>}
        </div>
        )}
        <div className="rw-modal-media">
          <Photo id={(p.id || p.product_id) + "-qv"} hue={p.hue} label={p.name.toUpperCase()} h={500} img={p.img} />
        </div>
        <div className="rw-modal-info">
          <span className="rw-card-cat">{p.cat}</span>
          <h2>{p.name}</h2>
          <div className="rw-price rw-price-lg">
            <span className="rw-price-now">{money(p.price)}</span>
            {showCompare && p.was && <span className="rw-price-was">{money(p.was)}</span>}
          </div>
          <p className="rw-modal-note">{p.note}</p>
          {showStock && soldOut && <div className="rw-stockline"><Icon name="bolt" size={15} /> Sold out — check back soon</div>}
          {showStock && low && !soldOut && <div className="rw-stockline"><Icon name="bolt" size={15} /> Only {p.stock} left</div>}
          <div className="rw-sizes">
            <div className="rw-sizes-label">Size</div>
            <div className="rw-sizes-row">
              {p.sizes.map((s) => (
                <button key={s} className={"rw-size" + (size === s ? " is-on" : "")}
                  onClick={() => setSize(s)}>{s}</button>
              ))}
            </div>
          </div>
          <button className="rw-btn rw-btn-pri rw-btn-full" disabled={!size || soldOut} onClick={() => onAdd(p, size)}>
            {soldOut ? 'Sold out' : size ? 'Add to bag — ' + money(p.price) : 'Select a size'}
          </button>
          <div className="rw-modal-perks">
            <span><Icon name="truck" size={15} /> Ships in 24h</span>
            <span><Icon name="retrn" size={15} /> Free returns</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- CartDrawer ---------- */
export function CartDrawer({ open, items, onClose, onQty, onRemove, onCheckout, showToast, pendingRemove, onCancelRemove }) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const FREE_THRESHOLD = 150;
  const freeProgress = Math.min(100, (subtotal / FREE_THRESHOLD) * 100);
  const freeLeft = Math.max(0, FREE_THRESHOLD - subtotal);

  return (
    <>
      <div className={"rw-scrim" + (open ? " is-on" : "")} onClick={onClose} />
      <div className={"rw-drawer" + (open ? " is-on" : "")}>
        <div className="rw-drawer-head">
          <h3>Bag</h3>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        {items.length > 0 && subtotal < FREE_THRESHOLD ? (
          <div className="rw-freebar">
            <Icon name="truck" size={14} /> Add <b>{money(freeLeft)}</b> more for free shipping
            <div className="rw-freebar-track"><div style={{ width: freeProgress + '%' }} /></div>
          </div>
        ) : subtotal >= FREE_THRESHOLD && items.length > 0 && (
          <div className="rw-freebar" style={{ color: 'var(--ink)' }}>
            <Icon name="check" size={14} /> <b>Free shipping unlocked!</b> 🎉
          </div>
        )}
        {items.length === 0 ? (
          <div className="rw-drawer-empty">
            <Icon name="bag" size={36} />
            <p>Your bag is empty</p>
          </div>
        ) : (
          <div className="rw-drawer-items">
            {items.map((it) => (
              <div key={it.key} className="rw-line">
                <div className="rw-line-media">
                  <Photo id={it.id + "-cart"} hue={it.hue} label="" h={74} img={it.img} />
                </div>
                <div className="rw-line-info">
                  <div className="rw-line-top">
                    <h4>{it.name}</h4>
                    <button className="rw-line-x" onClick={() => onRemove(it.key, it.name)} aria-label="Remove">
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                  <div className="rw-line-meta">{it.size}</div>
                  <div className="rw-line-bot">
                    <div className="rw-qty">
                      <button onClick={() => onQty(it.key, -1)} aria-label="Decrease"><Icon name="minus" size={13} /></button>
                      <span>{it.qty}</span>
                      <button onClick={() => onQty(it.key, 1)} aria-label="Increase"><Icon name="plus" size={13} /></button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {it.was && (
                        <span style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'line-through' }}>
                          {money(it.was * it.qty)}
                        </span>
                      )}
                      <span className="rw-line-price">{money(it.price * it.qty)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="rw-drawer-foot">
            <div className="rw-subtotal">
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <button className="rw-btn rw-btn-pri rw-btn-full" onClick={onCheckout}>
              Checkout <Icon name="arrow" size={16} />
            </button>
            <div className="rw-paystrip">
              {REWIND_PAYMENTS.map((pm) => (
                <span key={pm.id} className="rw-paychip">{pm.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {pendingRemove && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 52, background: 'var(--bg)', borderRadius: '12px', padding: '24px', maxWidth: '340px', width: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px', color: 'var(--ink)' }}>Remove "{pendingRemove.name}" from your bag?</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={() => { onRemove(pendingRemove.key, pendingRemove.name); onCancelRemove(); }} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'var(--accent, #FF4D14)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Remove</button>
            <button onClick={onCancelRemove} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Checkout ---------- */
export function Checkout({ open, items, onClose, onPlaced, userEmail, showToast, orderNumber: orderNumberProp, onInfo }) {
  const [payment, setPayment] = useState('card');
  const [placed, setPlaced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cardValid, setCardValid] = useState(false);
  const [promoData, setPromoData] = useState(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promo, setPromo] = useState('');
  const [payError, setPayError] = useState('');
  const [orderNum, setOrderNum] = useState('');
  // Referral state
  const [referralCode, setReferralCode] = useState('');
  const [appliedReferral, setAppliedReferral] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const paymentRef = useRef(null);
  const [saveInfo, setSaveInfo] = useState(false);
  const [formFields, setFormFields] = useState({ email: '', name: '', address: '', postal: '', city: '', country: '' });
  const isMobile = useMemo(() => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent), []);

  // Generate order number when checkout opens
  useEffect(() => {
    if (open) {
      setOrderNum('RW-' + crypto.randomUUID().slice(0, 8).toUpperCase());
      // Restore saved checkout info
      try {
        const saved = localStorage.getItem('rw_checkout_info');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.email || parsed.name || parsed.address) {
            setFormFields(prev => ({ ...prev, ...parsed }));
            setSaveInfo(true);
          }
        }
      } catch {}
    }
  }, [open]);

  // ── Shared post-payment success handler ──
  const completeOrder = useCallback(async (paymentIntent, orderNumForReferral) => {
    setOrderNum(orderNum);
    setCardValid(false);

    // Record referral redemption (if a referral code was applied)
    if (referralCode) {
      fetch('/api/referral/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: referralCode,
          refereeEmail: formFields.email,
          orderNum: orderNumForReferral || orderNum,
          refereeName: formFields.name,
          refereeAddress: [formFields.address, formFields.postal, formFields.city, formFields.country].filter(Boolean).join(', '),
        }),
      }).catch(e => console.warn('Referral apply failed:', e));
    }

    setProcessing(false);
    setPlaced(true);
  }, [orderNum, referralCode, formFields]);

  // Handle return from redirect payment methods (Klarna, Bancontact, iDEAL)
  useEffect(() => {
    if (open && orderNumberProp) {
      setOrderNum(orderNumberProp);
      setPlaced(true);
    }
  }, [open, orderNumberProp]);

  // Validate promo code with debounce — checks /api/referral/validate which
  // also falls back to promo_codes table for admin-generated codes
  useEffect(() => {
    if (!promo.trim()) { setPromoData(null); setPromoValidating(false); return; }
    const timer = setTimeout(async () => {
      setPromoValidating(true);
      try {
        const r = await fetch('/api/referral/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: promo.trim() }),
        });
        const d = await r.json();
        setPromoData(d);
      } catch { setPromoData(null); }
      setPromoValidating(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [promo]);
  const setField = (key) => (e) => setFormFields((prev) => ({ ...prev, [key]: e.target.value }));

  if (!open) return null;
  if (placed) {
    return (
      <div className="rw-checkout" style={{ position: 'relative', overflow: 'hidden' }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: '-10px', left: (Math.random() * 100) + '%',
            width: (Math.random() * 8 + 4) + 'px', height: (Math.random() * 8 + 4) + 'px',
            borderRadius: '2px',
            background: ['#FF4D14','#D4AF37','#FF6B35','#FFB800','#FF4081','#00C853'][i % 6],
            animation: 'confettiFall ' + (Math.random() * 2 + 2) + 's ease-in ' + (Math.random() * 0.5) + 's infinite',
            zIndex: 0, pointerEvents: 'none',
          }} />
        ))}
        <div className="rw-checkout-bar" style={{ position: 'relative', zIndex: 1 }}>
          <div className="rw-logo" style={{ cursor: 'pointer' }}
            onClick={() => { nav('/'); window.dispatchEvent(new CustomEvent('reset-store')); onPlaced(); }}>REWIND<span>.</span></div>
          <button className="rw-btn rw-btn-ghost" onClick={onPlaced}>Close</button>
        </div>
        <div className="rw-confirm">
          <div className="rw-confirm-mark"><Icon name="check" size={36} /></div>
          <h2>Order confirmed</h2>
          <p>Thanks for your order! We'll send you a shipping confirmation once your items are on their way.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '4px' }}>
            <div className="rw-confirm-num">{orderNum}</div>
            <button onClick={(e) => { const btn = e.currentTarget; navigator.clipboard.writeText(orderNum).then(() => { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⎘'; }, 1200); }).catch(() => { btn.textContent = '✗'; setTimeout(() => { btn.textContent = '⎘'; }, 1200); }); }}
              style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', display: 'grid', placeItems: 'center', color: 'var(--muted)', transition: 'background 0.15s' }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'var(--surface)'}>
              ⎘
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>A confirmation has been sent to your email</p>
          <button className="rw-btn rw-btn-pri" onClick={onPlaced}>Continue shopping</button>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipping = subtotal >= 150 ? 0 : 8;
  let discountPrice = subtotal;
  let discountShipping = shipping;
  let discountLabel = null;
  if (promoData?.valid) {
    if (promoData.type === 'percent') {
      discountPrice = Math.round(subtotal * (100 - promoData.value)) / 100;
      discountLabel = `${promoData.value}% off`;
    } else if (promoData.type === 'free_shipping') {
      discountShipping = 0;
      discountLabel = 'Free shipping';
    }
  }
  // Apply referral discount on top of promo (if any)
  let referralDiscountLabel = null;
  let referralDiscountAmount = 0;
  if (appliedReferral?.discount) {
    referralDiscountAmount = Math.round(discountPrice * (appliedReferral.discount / 100) * 100) / 100;
    discountPrice = Math.round((discountPrice - referralDiscountAmount) * 100) / 100;
    referralDiscountLabel = `${appliedReferral.discount}% off (referral)`;
  }
  const finalTotal = discountPrice + discountShipping;

  // Referral code handler
  async function handleReferralApply(code) {
    if (!code) {
      // Remove referral
      setAppliedReferral(null);
      setReferralCode('');
      setReferralError('');
      return;
    }
    if (!formFields.email?.trim()) {
      setReferralError('Please enter your email first');
      return;
    }
    setReferralLoading(true);
    setReferralError('');
    try {
      const r = await fetch('/api/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: formFields.email.trim() }),
      });
      const d = await r.json();
      if (d.valid) {
        setAppliedReferral({ code: code.toUpperCase(), discount: d.discount });
        setReferralCode(code);
        setReferralError('');
      } else {
        setAppliedReferral(null);
        setReferralError(d.error || 'Invalid referral code');
      }
    } catch {
      setReferralError('Network error — try again');
      setAppliedReferral(null);
    }
    setReferralLoading(false);
  }

  async function handlePay() {
    console.log('REWIND PAY: handlePay called');
    setProcessing(true);
    setPayError('');
    // Safety timeout: reset processing after 30s if something hangs
    const safetyTimer = setTimeout(() => { console.log('REWIND PAY: safety timeout'); setProcessing(false); }, 30000);
    // Client-side field validation before hitting the API
    const missing = [];
    if (!formFields.email?.trim()) missing.push('Email');
    else if (!/^\S+@\S+\.\S+$/.test(formFields.email.trim())) {
      setPayError('Please enter a valid email address');
      setProcessing(false);
      return;
    }
    if (!formFields.name?.trim()) missing.push('Full name');
    if (!formFields.address?.trim()) missing.push('Address');
    if (!formFields.postal?.trim()) missing.push('Postal code');
    if (!formFields.city?.trim()) missing.push('City');
    if (!formFields.country?.trim()) missing.push('Country');
    if (missing.length > 0) {
      setPayError('Please fill in: ' + missing.join(', '));
      setProcessing(false);
      return;
    }
    const email = formFields.email;
    // Check if email is blocked BEFORE persisting any data to localStorage —
    // prevents blocked users' personal info from being saved locally.
    try {
      const br = await fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const bd = await br.json();
      if (bd.blocked) {
        setProcessing(false);
        if (showToast) {
          showToast('🚫 Your email has been blocked. Contact orders@rewind-stores.com to appeal.', null, 8000);
        } else {
          alert('🚫 Your email has been blocked.\nPlease contact orders@rewind-stores.com to appeal.');
        }
        return;
      }
    } catch {}
    // Save delivery info to localStorage if checkbox is checked
    if (saveInfo) {
      localStorage.setItem('rw_checkout_save_info', 'true');
      const { email, name, address, postal, city, country } = formFields;
      if (email || name || address || postal || city || country) {
        localStorage.setItem('rw_checkout_info', JSON.stringify({ email, name, address, postal, city, country }));
      }
    } else {
      localStorage.setItem('rw_checkout_save_info', 'false');
      localStorage.removeItem('rw_checkout_info');
    }
    // Use the orderNum already set in state (generated when checkout opened)
    const currentOrderNum = orderNum;
    console.log('REWIND PAY: starting payment, order=' + currentOrderNum);
    let payResult;
    try {
      if (payment === 'card' || payment === 'applepay' || payment === 'googlepay') {
        console.log('REWIND PAY: calling paymentRef.pay()');
        // Card/Apple Pay: use Elements inline
        payResult = await paymentRef.current?.pay({
          name: formFields.name,
          email: formFields.email,
          address: formFields.address,
          city: formFields.city,
          postal: formFields.postal,
          country: formFields.country,
        });

        console.log('REWIND PAY: pay() returned', payResult ? 'result' : 'undefined');

        if (!payResult || payResult.error) {
          setPayError(payResult?.error || 'Payment failed — please try again');
          setProcessing(false);
          return;
        }

        if (!payResult.success) {
          setPayError(`Payment ${payResult.paymentIntent?.status || 'failed'}`);
          setProcessing(false);
          return;
        }
      } else {
        // Redirect-based methods (Klarna, Bancontact, iDEAL, PayPal)
        // Create payment intent first via the API
        const piRes = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(i => ({ id: i.id || i.product_id, qty: i.qty })),
            orderNum: currentOrderNum,
            email: formFields.email,
            name: formFields.name,
            address: formFields.address,
            promoCode: promo,
            paymentMethod: payment,
            country: formFields.country,
          }),
        });
        const piData = await piRes.json();
        if (!piData.clientSecret) {
          setPayError(piData.error || 'Failed to create payment');
          setProcessing(false);
          return;
        }
        // Load Stripe and redirect
        const stripeInstance = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        const billingBase = {
          name: formFields.name,
          email: formFields.email,
        };
        const paymentMethodDataByType = {
          klarna: {
            type: 'klarna',
            billing_details: {
              ...billingBase,
              address: {
                line1: formFields.address,
                city: formFields.city,
                postal_code: formFields.postal,
                country: formFields.country,
              },
            },
          },
          bancontact: { type: 'bancontact', billing_details: billingBase },
          ideal: { type: 'ideal', billing_details: billingBase },
          paypal: { type: 'paypal', billing_details: billingBase },
        };
        const { error } = await stripeInstance.confirmPayment({
          clientSecret: piData.clientSecret,
          confirmParams: {
            return_url: window.location.origin + '/#/payment-complete?order=' + currentOrderNum,
            payment_method_data: paymentMethodDataByType[payment],
          },
        });
        if (error) {
          setPayError(error.message);
          setProcessing(false);
          return;
        }
        // If we get here with no redirect, payment was instant (unlikely for redirect methods)
        console.log('Payment completed for:', currentOrderNum);
        setProcessing(false);
        return;
      }

      // Payment succeeded (card / Apple Pay / Google Pay only)
      if (payResult && payResult.paymentIntent) {
        completeOrder(payResult.paymentIntent, currentOrderNum);
      } else {
        setPayError('Payment result missing — please try again');
        setProcessing(false);
      }
    } catch (e) {
      setProcessing(false);
      setPayError('Payment could not be processed — please check your details and try again.');
      console.warn('Payment error:', e);
    }
  }

  return (
    <div className="rw-checkout">
      <div className="rw-checkout-bar">
        <div className="rw-logo" style={{ cursor: 'pointer' }}
          onClick={() => { nav('/'); window.dispatchEvent(new CustomEvent('reset-store')); onClose(); }}>REWIND<span>.</span></div>
        <button className="rw-btn rw-btn-ghost" onClick={onClose}>Back</button>
      </div>
      <div className="rw-checkout-grid">
        <div className="rw-checkout-main">
          <div className="rw-co-sec">
            <h3>Contact</h3>
            <input className="rw-input" type="email" placeholder="Email" value={formFields.email} onChange={setField('email')} autoComplete="email" />
          </div>
          <div className="rw-co-sec">
            <h3>Promo code</h3>
            <div style={{ position: 'relative' }}>
              <input className="rw-input" placeholder="Enter code" value={promo} onChange={e => setPromo(e.target.value)}
                style={{ paddingRight: promo ? '32px' : undefined }} />
              {promo && (
                <button onClick={() => setPromo('')}
                  aria-label="Clear promo code"
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', display: 'grid', placeItems: 'center',
                    color: 'var(--muted)', opacity: 0.7,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={e => e.target.style.opacity = '1'}
                  onMouseOut={e => e.target.style.opacity = '0.7'}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
            {promoValidating && (
              <span style={{color: 'var(--muted)', fontSize: '13px', marginTop: '6px', display: 'block', fontWeight: 500}}>
                ⏳ Validating...
              </span>
            )}
            {promoData?.valid && (
              <span style={{color: 'var(--ink)', fontSize: '13px', marginTop: '6px', display: 'block', fontWeight: 600}}>
                ✓ {promoData.type === 'percent' ? `${promoData.value}% off applied!` : 'Free shipping applied!'}
              </span>
            )}
            {promoData && !promoData.valid && promo.trim() && !promoValidating && (
              <span style={{color: 'var(--accent)', fontSize: '13px', marginTop: '6px', display: 'block'}}>
                Invalid promo code
              </span>
            )}
          </div>
          <ReferralInput
            onApply={handleReferralApply}
            appliedReferral={appliedReferral}
            referralDiscount={appliedReferral?.discount || 0}
            referralLoading={referralLoading}
            referralError={referralError} />
          <div className="rw-co-sec">
            <h3>Delivery</h3>
            <input className="rw-input" type="text" placeholder="Full name" value={formFields.name} onChange={setField('name')} autoComplete="name" />
            <input className="rw-input" type="text" placeholder="Address" value={formFields.address} onChange={setField('address')} autoComplete="street-address" />
            <div className="rw-input-row">
              <input className="rw-input" type="text" placeholder="Postal code" value={formFields.postal} onChange={setField('postal')} autoComplete="postal-code" />
              <input className="rw-input" type="text" placeholder="City" value={formFields.city} onChange={setField('city')} autoComplete="address-level2" />
            </div>
            <select className="rw-input" value={formFields.country} onChange={setField('country')} autoComplete="country-name" style={{color: formFields.country ? 'var(--ink)' : 'var(--muted)'}}>
              <option value="" disabled style={{color:'var(--muted)'}}>Country</option>
              <option value="CN">China</option>
              <option value="JP">Japan</option>
              <option value="KR">South Korea</option>
              <option value="TW">Taiwan</option>
              <option value="HK">Hong Kong</option>
              <option value="MO">Macau</option>
              <option value="TH">Thailand</option>
              <option value="VN">Vietnam</option>
              <option value="SG">Singapore</option>
              <option value="MY">Malaysia</option>
              <option value="ID">Indonesia</option>
              <option value="PH">Philippines</option>
              <option value="IN">India</option>
              <option value="BD">Bangladesh</option>
              <option value="LK">Sri Lanka</option>
              <option value="NP">Nepal</option>
              <option value="PK">Pakistan</option>
              <option value="AE">United Arab Emirates</option>
              <option value="SA">Saudi Arabia</option>
              <option value="QA">Qatar</option>
              <option value="KW">Kuwait</option>
              <option value="BH">Bahrain</option>
              <option value="OM">Oman</option>
              <option value="IL">Israel</option>
              <option value="TR">Turkey</option>
              <option value="GB">United Kingdom</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="IT">Italy</option>
              <option value="ES">Spain</option>
              <option value="NL">Netherlands</option>
              <option value="BE">Belgium</option>
              <option value="AT">Austria</option>
              <option value="CH">Switzerland</option>
              <option value="SE">Sweden</option>
              <option value="DK">Denmark</option>
              <option value="NO">Norway</option>
              <option value="FI">Finland</option>
              <option value="IE">Ireland</option>
              <option value="PT">Portugal</option>
              <option value="PL">Poland</option>
              <option value="CZ">Czech Republic</option>
              <option value="HU">Hungary</option>
              <option value="GR">Greece</option>
              <option value="RO">Romania</option>
              <option value="HR">Croatia</option>
              <option value="SK">Slovakia</option>
              <option value="SI">Slovenia</option>
              <option value="LT">Lithuania</option>
              <option value="LV">Latvia</option>
              <option value="EE">Estonia</option>
              <option value="BG">Bulgaria</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="MX">Mexico</option>
              <option value="AU">Australia</option>
              <option value="NZ">New Zealand</option>
              <option value="BR">Brazil</option>
              <option value="AR">Argentina</option>
              <option value="CO">Colombia</option>
              <option value="CL">Chile</option>
              <option value="PE">Peru</option>
              <option value="ZA">South Africa</option>
              <option value="NG">Nigeria</option>
              <option value="EG">Egypt</option>
              <option value="MA">Morocco</option>
              <option value="KE">Kenya</option>
            </select>
          </div>
        </div>
        <div className="rw-checkout-summary">
          <h3>Order summary</h3>
          <div className="rw-sum-items">
            {items.map((it) => (
              <div key={it.key} className="rw-sum-line">
                <div className="rw-sum-media">
                  <Photo id={it.id + "-sum"} hue={it.hue} label="" h={52} img={it.img} />
                  {it.qty > 1 && <span className="rw-sum-qty">{it.qty}</span>}
                </div>
                <div className="rw-sum-info">
                  <h4>{it.name}</h4>
                  <span>{it.size}</span>
                </div>
                <span className="rw-sum-price">{money(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="rw-sum-rows">
            <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {promoData?.valid && promoData.type === 'percent' && (
              <div style={{color: 'var(--ink)', fontSize: '13px', fontWeight: 600}}>
                <span>{discountLabel}</span><span>-{money(subtotal - discountPrice)}</span>
              </div>
            )}
            {referralDiscountLabel && (
              <div style={{color: '#0E9F6E', fontSize: '13px', fontWeight: 600}}>
                <span>{referralDiscountLabel}</span><span>-{money(referralDiscountAmount)}</span>
              </div>
            )}
            <div><span>Shipping</span><span>{discountShipping === 0 ? (promoData?.valid && promoData.type === 'free_shipping' ? 'Free 🎉' : 'Free') : money(discountShipping)}</span></div>
            {formFields.country && (() => {
              const c = (formFields.country || '').toUpperCase().trim().substring(0, 2);
              const est = { CN: '3-7d', JP: '3-7d', KR: '3-7d', SG: '5-10d', TH: '5-10d', VN: '5-10d', IN: '7-14d', PK: '7-14d',
                GB: '7-14d', DE: '7-14d', FR: '7-14d', IT: '7-14d', ES: '7-14d', NL: '7-14d', BE: '7-14d', CH: '7-14d',
                US: '7-14d', CA: '7-14d', MX: '10-18d', AU: '10-16d', NZ: '10-16d',
                AE: '10-18d', SA: '10-18d', IL: '10-18d', TR: '10-18d',
                BR: '14-21d', AR: '14-21d', ZA: '14-21d', NG: '14-21d', EG: '14-21d' }[c] || '10-18d';
              return <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Est. delivery: {est}</div>;
            })()}
          </div>
          <div className="rw-sum-total">
            <div><span>Total</span><b>{money(finalTotal)}</b></div>
          </div>
          <button className="rw-btn rw-btn-pri rw-btn-full"
            disabled={processing}
            onClick={handlePay}>
            {processing ? <><i className="rw-spinner" /> Processing…</> : `Pay ${money(finalTotal)}`}
          </button>
          <div className="rw-co-trust">
            <Icon name="check" size={13} /> Secured with 256-bit SSL
          </div>
        </div>
      </div>
      <div className="rw-checkout-payment">
        <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '14px' }}>Payment</h3>
        <div className="rw-pay-grid">
          {REWIND_PAYMENTS.map((pm) => {
            const isApplePayDisabled = pm.id === 'applepay' && !isMobile;
            return (
            <button key={pm.id}
              className={"rw-pay" + (payment === pm.id ? " is-on" : "") + (isApplePayDisabled ? " is-disabled" : "")}
              onClick={() => { if (!isApplePayDisabled) setPayment(pm.id); }}
              style={isApplePayDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>
              <div className="rw-pay-radio">{payment === pm.id && <Icon name="check" size={13} />}</div>
              <div className="rw-pay-label">
                {pm.label}
                <small>{isApplePayDisabled ? 'Mobile only' : pm.sub}</small>
              </div>
            </button>
            );
          })}
        </div>
        {(payment === 'card' || payment === 'applepay' || payment === 'googlepay') && (
          <div className="rw-card-fields">
            <PaymentCard
              ref={paymentRef}
              amount={money(finalTotal)}
              stripeKey={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}
              orderNum={orderNum}
              email={formFields.email}
              name={formFields.name}
              address={[formFields.address, formFields.postal, formFields.city, formFields.country].filter(Boolean).join(', ')}
              items={items}
              promoCode={promo}
              paymentMethod={payment}
              country={formFields.country}
              onPaymentSuccess={completeOrder}
              walletOnly={payment === 'applepay' || payment === 'googlepay'}
              onChange={({ valid }) => setCardValid(valid)}
            />
          </div>
        )}
        <div className="rw-co-config">
          {payment === 'applepay' && 'Complete payment with Face ID or Touch ID.'}
          {payment === 'klarna' && 'Pay in 3 interest-free instalments.'}
          {payment === 'bancontact' && 'You will be redirected to your bank to confirm.'}
          {payment === 'paypal' && 'You will be redirected to PayPal to complete your purchase.'}
        </div>
        <label className="rw-check">
          <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} /> Save my info for next time
        </label>
        <p style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '12px', lineHeight: '1.5' }}>
          By proceeding, you agree to our <button type="button" onClick={() => onInfo && onInfo('privacy')}
          style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--muted)', fontWeight: 600, padding: 0, fontSize: 'inherit' }}>Privacy Policy</button>.
        </p>
      </div>
    </div>
  );
}

/* ---------- Wishlist Signup Modal ---------- */
const POLICY_TEXT = `REWIND Privacy Policy

Controller: REWIND (sole trader), 1800 Vilvoorde, Belgium
Contact: orders@rewind-stores.com

Data retention:
• Order data: 7 years (tax compliance)
• Inactive account/wishlist data: 24 months after last activity
• Marketing data: until you withdraw consent

1. Information We Collect
• Email address (when you create a wishlist or place an order)
• Shipping address and name (when you place an order)
• Payment information is processed securely by Stripe — we never store card details
• IP address and browser/device information (for fraud prevention, analytics, and site security)

2. How We Use Your Data
• To manage your wishlist and save your favorite items
• To process and fulfill your orders
• To send order confirmations and shipping updates
• To detect and prevent fraud (including IP-based blocking)
• With your consent, to send emails about new drops and exclusive offers

3. Data Storage & Security
• Your data is stored securely in our database (Supabase, EU-hosted)
• We use industry-standard encryption for data transmission
• You can request deletion of your data at any time by emailing orders@rewind-stores.com

4. Third-Party Services
• Stripe (US): Payment processing — view their privacy policy at stripe.com/privacy
• Supabase (US): Database hosting
• Resend (US): Order confirmation emails
• Google Gemini (US): AI-powered chat auto-replies
• These services may process your data outside the EU/EEA under Standard Contractual Clauses

5. Your Rights (GDPR)
• Right to access your personal data
• Right to rectification — correct inaccurate data
• Right to erasure — delete your account and data at any time
• Right to restrict processing
• Right to data portability
• Right to object to processing
• To exercise any of these rights, email orders@rewind-stores.com

6. Cookies
• We use essential cookies for cart functionality
• No tracking or advertising cookies are used
• Stripe may set cookies during payment processing

7. Marketing Emails
• You can opt in to marketing emails when creating your wishlist
• You can unsubscribe at any time via the link in any email
• Opting out will not affect your orders or wishlist

8. Contact
• Email: orders@rewind-stores.com
• Response time: within 48 hours

Last updated: July 2026`;

export function SignupModal({ open, onClose, onSignup }) {
  const [email, setEmail] = useState('');
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState('');
  const [showPolicy, setShowPolicy] = useState(false);

  // Reset form fields whenever the modal opens — prevents stale data from a
  // previous session persisting when the user reopens the signup modal.
  useEffect(() => {
    if (open) {
      setEmail('');
      setAgreePolicy(false);
      setAcceptMarketing(false);
      setError('');
      setShowPolicy(false);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!agreePolicy) {
      setError('Please agree to the privacy policy');
      return;
    }
    onSignup({ email: email.trim(), acceptMarketing });
  }

  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal rw-modal--signup" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px', gridTemplateColumns: '1fr' }}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        {showPolicy ? (
          <div className="rw-modal-info">
            <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Privacy Policy</h2>
            <div style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
              {POLICY_TEXT}
            </div>
            <button className="rw-btn rw-btn-pri rw-btn-full" style={{ marginTop: '20px' }}
              onClick={() => setShowPolicy(false)}>Back</button>
          </div>
        ) : (
          <div className="rw-modal-info">
            <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>Save to wishlist</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              Sign up with your email to save items and come back later.
            </p>
            <form onSubmit={handleSubmit}>
              <input className="rw-input" type="email" placeholder="Your email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ marginBottom: '14px' }} autoFocus />
              <label className="rw-check" style={{ marginBottom: '10px' }}>
                <input type="checkbox" checked={agreePolicy}
                  onChange={(e) => setAgreePolicy(e.target.checked)} />
                <span>I agree to the <button type="button" onClick={() => setShowPolicy(true)}
                  style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--ink)', fontWeight: 600, padding: 0, fontSize: 'inherit' }}>
                  privacy policy</button></span>
              </label>
              <label className="rw-check" style={{ marginBottom: '16px' }}>
                <input type="checkbox" checked={acceptMarketing}
                  onChange={(e) => setAcceptMarketing(e.target.checked)} />
                <span>Email me about new drops & exclusive offers</span>
              </label>
              {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
              <button type="submit" className="rw-btn rw-btn-pri rw-btn-full">
                Sign up & save <Icon name="heart" size={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Wishlist Drawer ---------- */
export function WishlistDrawer({ open, items, customProducts, onClose, onRemove, onAddToCart, onSelect, onCartOpen, showToast }) {
  const allProducts = useMemo(() => [...REWIND_PRODUCTS, ...(customProducts || [])], [customProducts]);
  const wishlistItems = items.map((id) => allProducts.find((p) => p.id === id || p.product_id === id)).filter(Boolean);
  const [selected, setSelected] = useState([]);
  // Track which wishlist item has its inline size picker open (stored as product id)
  const [choosingSize, setChoosingSize] = useState(null);
  // Reset size picker when drawer opens — prevents a stale open picker from a
  // previous session (where the user opened a size picker then closed the drawer
  // without selecting a size) from persisting when the drawer is reopened.
  useEffect(() => {
    if (open) setChoosingSize(null);
  }, [open]);

  // Custom products (from Supabase) use product_id as their key, not id.
  // Always use getId(p) to get the canonical wishlist identifier.
  const getId = (p) => p.id || p.product_id;

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const addSelectedToCart = () => {
    const toAdd = wishlistItems.filter(p => selected.includes(getId(p)));
    if (toAdd.length === 0) return;
    // Single item: open inline size picker instead of silently defaulting size
    if (toAdd.length === 1) {
      setChoosingSize(getId(toAdd[0]));
      setSelected([]);
      return;
    }
    // Multiple items: add all with default sizes but warn explicitly
    if (onAddToCart) {
      toAdd.forEach(p => onAddToCart(p));
      setSelected([]);
      if (onCartOpen) onCartOpen();
      if (showToast) {
        setTimeout(() => showToast(toAdd.length + ' items added — each used the first available size'), 50);
      }
    }
  };

  return (
    <>
      <div className={"rw-scrim" + (open ? " is-on" : "")} onClick={onClose} />
      <div className={"rw-drawer" + (open ? " is-on" : "")} style={{ width: '400px' }}>
        <div className="rw-drawer-head">
          <h3>Wishlist <span>({wishlistItems.length})</span></h3>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        {wishlistItems.length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={selected.length === wishlistItems.length && wishlistItems.length > 0}
              onChange={() => { if (selected.length === wishlistItems.length) { setSelected([]); } else { setSelected(wishlistItems.map(p => getId(p))); } }}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}
              onClick={() => { if (selected.length === wishlistItems.length) { setSelected([]); } else { setSelected(wishlistItems.map(p => getId(p))); } }}>
              {selected.length === wishlistItems.length && wishlistItems.length > 0 ? 'Deselect all' : 'Select all'}
            </span>
          </div>
        )}
        {selected.length > 0 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
            <button className="rw-btn rw-btn-pri" style={{ padding: '8px 14px', fontSize: '13px' }}
              onClick={addSelectedToCart}>
              {`Add ${selected.length} to cart`}
            </button>
            <button style={{ marginLeft: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--line)'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.transform = ''; }}
              onClick={() => setSelected([])}>Cancel</button>
            <button style={{ marginLeft: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--accent)', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}
              onClick={() => {
                const ids = [...selected];
                setSelected([]);
                // Remove immediately — App.jsx shows an undo toast
                onRemove(ids);
              }}>Delete all</button>
          </div>
        )}
        {wishlistItems.length === 0 ? (
          <div className="rw-drawer-empty">
            <Icon name="heart" size={36} />
            <p>Your wishlist is empty</p>
          </div>
        ) : (
          <div className="rw-drawer-items">
            {wishlistItems.map((p) => (
              <div key={p.id || p.product_id} className="rw-line" style={{ alignItems: 'flex-start', paddingTop: '12px' }}>
                <div style={{ paddingTop: '4px' }}>
                  <input type="checkbox" checked={selected.includes(getId(p))}
                    onChange={() => toggleSelect(getId(p))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
                </div>
                <div className="rw-line-media">
                  <Photo id={(p.id || p.product_id) + "-wish"} hue={p.hue} label="" h={74} />
                </div>
                <div className="rw-line-info">
                <div className="rw-line-top">
                  <h4>{p.name}</h4>
                  <button className="rw-line-x" onClick={() => onRemove(getId(p))} aria-label="Remove from wishlist">
                    <Icon name="close" size={15} />
                  </button>
                </div>
                <div className="rw-line-meta">{p.cat}</div>
                <div className="rw-line-bot">
                  <span className="rw-line-price">{money(p.price)}</span>
                  {choosingSize === getId(p) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {p.sizes.map(s => (
                        <button key={s} onClick={() => { if (onAddToCart) onAddToCart(p, s); setChoosingSize(null); if (onCartOpen) onCartOpen(); }}
                          style={{
                            minWidth: '30px', height: '26px', borderRadius: '5px', border: '1px solid var(--line-2)',
                            background: 'var(--surface)', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                            color: 'var(--ink)', transition: 'all 0.1s',
                          }}
                          onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.background = 'var(--ink)'; e.target.style.color = 'var(--surface)'; }}
                          onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; }}>{s}</button>
                      ))}
                      <button onClick={() => setChoosingSize(null)}
                        style={{ width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}
                        onMouseOver={e => e.target.style.color = 'var(--ink)'}
                        onMouseOut={e => e.target.style.color = 'var(--muted)'}>
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  ) : (
                  <button onClick={() => setChoosingSize(prev => prev === getId(p) ? null : getId(p))}
                    aria-label={"Add " + p.name + " to bag"}
                    style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      border: '1.5px solid var(--line-2)', background: 'var(--surface)',
                      cursor: 'pointer', display: 'grid', placeItems: 'center',
                      color: 'var(--ink)', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = 'var(--surface)'; e.target.style.borderColor = 'var(--ink)'; }}
                    onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; e.target.style.borderColor = 'var(--line-2)'; }}>
                    <Icon name="plus" size={14} />
                  </button>
                  )}
                </div>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
