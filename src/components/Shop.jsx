import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { money, discountPct } from '../hooks/useCountdown';
import { Icon, Photo } from './Shell';
import { REWIND_PAYMENTS, REWIND_PRODUCTS } from '../data';
import { deleteCustomProduct } from '../lib/supabase';

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
export function ProductCard({ p, showCompare, showStock, onQuick, onAdd, wishlisted, onWishlist, onSelect }) {
  const low = p.stock <= 5;
  const [added, setAdded] = useState(false);
  return (
    <article className="rw-card">
      <div className="rw-card-media" style={{ cursor: 'pointer' }} onClick={() => onSelect ? onSelect(p) : onQuick(p)}>
        <Photo id={p.id || p.product_id} hue={p.hue} label={p.name.toUpperCase()} h={340} img={p.img} />
        <div className="rw-card-tags">
          {showCompare && discountPct(p) > 0 && <span className="rw-tag rw-tag-sale">-{discountPct(p)}%</span>}
          {showStock && low && <span className="rw-tag rw-tag-low">Only {p.stock} left</span>}
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
          {added ? (
            <button className="rw-add" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
              onClick={() => onSelect ? onSelect(p) : onQuick(p)} aria-label="View in bag">
              <Icon name="bag" size={16} />
            </button>
          ) : (
          <button className="rw-add" onClick={() => { onAdd(p); setAdded(true); setTimeout(() => setAdded(false), 2000); }} aria-label={"Add " + p.name}>
            <Icon name="plus" size={18} />
          </button>
          )}
        </div>
        <div className="rw-card-ship">
          <Icon name="retrn" size={13} /> Free returns <span className="rw-price-was">€8</span>
        </div>
      </div>
    </article>
  );
}

/* ---------- ProductGrid ---------- */
export function ProductGrid({ products, wishlist, onWishlist, sort, query, ...rest }) {
  if (products.length === 0) {
    const msg = query && query.trim()
      ? `Nothing matched "${query.trim()}" — try a different term?`
      : 'Nothing here yet — check back soon for new drops in this category.';
    return <div className="rw-empty">{msg}</div>;
  }
  // Sort products
  let sorted = [...products];
  const isSorting = sort === 'price-asc' || sort === 'price-desc';
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);

  // When sorting is active, render a single flat grid so the sort order is respected globally.
  if (isSorting) {
    return (
      <div>
        <div className="rw-grid">
          {sorted.map((p) => (
            <ProductCard key={p.id || p.product_id} p={p} wishlisted={wishlist?.includes(p.id || p.product_id)} onWishlist={onWishlist}
              showCompare={rest.showCompare} showStock={rest.showStock} onQuick={rest.onQuick} onAdd={rest.onAdd} onSelect={rest.onSelect} />
          ))}
        </div>
      </div>
    );
  }

  // Group products by brand → category, then flatten with headers (Featured view)
  const grouped = {};
  sorted.forEach(p => {
    const brand = p.brand || '';
    const cat = p.cat || 'Other';
    if (!grouped[brand]) grouped[brand] = {};
    if (!grouped[brand][cat]) grouped[brand][cat] = [];
    grouped[brand][cat].push(p);
  });

  const sections = [];
  Object.entries(grouped).forEach(([brand, cats]) => {
    Object.entries(cats).forEach(([cat, items]) => {
      const label = [brand, cat].filter(Boolean).join(' — ');
      sections.push({ label, items });
    });
  });

  return (
    <div>
      {sections.map((s, i) => (
        <div key={i}>
          {s.label && (
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)', margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {s.label}
            </h3>
          )}
          <div className="rw-grid" style={{ marginBottom: '8px' }}>
            {s.items.map((p) => (
              <ProductCard key={p.id || p.product_id} p={p} wishlisted={wishlist?.includes(p.id || p.product_id)} onWishlist={onWishlist}
                showCompare={rest.showCompare} showStock={rest.showStock} onQuick={rest.onQuick} onAdd={rest.onAdd} onSelect={rest.onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- QuickView ---------- */
export function QuickView({ p, showCompare, showStock, onClose, onAdd }) {
  const [size, setSize] = useState(null);
  if (!p) return null;
  const low = p.stock <= 5;
  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        {!!localStorage.getItem('rw_admin_email') && (
        <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 20 }}>
          <button onClick={(e) => { e.stopPropagation();
            const menu = e.target.nextElementSibling;
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
          }}
            style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            ⋮
          </button>
          <div onClick={e => e.stopPropagation()}
            style={{ display: 'none', position: 'absolute', top: '32px', left: 0, background: 'var(--surface)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '120px', zIndex: 30 }}>
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
              window.location.hash = '#admin';
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              ✏️ Edit
            </button>
          </div>
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
          {showStock && low && <div className="rw-stockline"><Icon name="bolt" size={15} /> Only {p.stock} left</div>}
          <div className="rw-sizes">
            <div className="rw-sizes-label">Size</div>
            <div className="rw-sizes-row">
              {p.sizes.map((s) => (
                <button key={s} className={"rw-size" + (size === s ? " is-on" : "")}
                  onClick={() => setSize(s)}>{s}</button>
              ))}
            </div>
          </div>
          <button className="rw-btn rw-btn-pri rw-btn-full" disabled={!size} onClick={() => onAdd(p, size)}>
            {size ? 'Add to bag — ' + money(p.price) : 'Select a size'}
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
export function CartDrawer({ open, items, onClose, onQty, onRemove, onCheckout }) {
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
        {subtotal < FREE_THRESHOLD ? (
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
                  <Photo id={it.id + "-cart"} hue={it.hue} label="" h={74} />
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
                    <span className="rw-line-price">{money(it.price * it.qty)}</span>
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
    </>
  );
}

/* ---------- Checkout ---------- */
export function Checkout({ open, items, onClose, onPlaced, userEmail }) {
  const [payment, setPayment] = useState('card');
  const [placed, setPlaced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [orderNum, setOrderNum] = useState('');

  // Launch confetti burst (CSS-based, no external lib needed)
  useEffect(() => {
    if (!orderNum) return;
    const colors = [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF4D14', '#FF6B8A', '#FFD700', '#00C853', '#2979FF', '#E040FB'];
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
    document.body.appendChild(container);
    for (let i = 0; i < 150; i++) {
      const c = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const delay = Math.random() * 1.5;
      const size = 4 + Math.random() * 10;
      const drift = (Math.random() - 0.5) * 200;
      c.style.cssText = `position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size * 0.6}px;background:${color};border-radius:2px;animation:confettiFall 5s ${delay}s ease-out forwards;--drift:${drift}px`;
      container.appendChild(c);
    }
    const timer = setTimeout(() => { if (container.parentNode) container.parentNode.removeChild(container); }, 8000);
    return () => {
      clearTimeout(timer);
      if (container.parentNode) container.parentNode.removeChild(container);
    };
  }, [orderNum]);

  if (!open) return null;
  if (placed) {
    return (
      <div className="rw-checkout">
        <div className="rw-checkout-bar">
          <div className="rw-logo" style={{ cursor: 'pointer' }}
            onClick={() => { window.location.hash = ''; window.dispatchEvent(new CustomEvent('reset-store')); }}>REWIND<span>.</span></div>
          <button className="rw-btn rw-btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="rw-confirm">
          <div className="rw-confirm-mark"><Icon name="check" size={36} /></div>
          <h2>Order confirmed</h2>
          <p>Thanks for your order! We'll send you a shipping confirmation once your items are on their way.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '4px' }}>
            <div className="rw-confirm-num">{orderNum}</div>
            <button onClick={() => { navigator.clipboard.writeText(orderNum); const btn = document.activeElement; btn.textContent = '✓'; setTimeout(() => btn.textContent = '⎘', 1200); }}
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
  const total = subtotal + shipping;

  async function handlePay() {
    setProcessing(true);
    const orderNum = 'RW-' + String(Date.now()).slice(-8);
    const email = document.querySelector('.rw-input[type="email"]')?.value || '';
    // Check if email is blocked
    try {
      const br = await fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const bd = await br.json();
      if (bd.blocked) {
        setProcessing(false);
        return alert('🚫 Your email has been blocked.\nPlease contact orders@rewind-stores.com to appeal.');
      }
    } catch {}
    try {
      const r = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(it => ({ name: it.name, size: it.size, price: it.price, qty: it.qty })),
          total: total,
          orderNum,
          email,
          name: document.querySelector('.rw-input[placeholder="Full name"]')?.value || '',
          address: [
            document.querySelector('.rw-input[placeholder="Address"]')?.value,
            document.querySelector('.rw-input[placeholder="Postal code"]')?.value,
            document.querySelector('.rw-input[placeholder="City"]')?.value,
          ].filter(Boolean).join(', '),
        }),
      });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
      } else {
        throw new Error(d.error || 'Checkout failed');
      }
    } catch (e) {
      setProcessing(false);
      console.warn('Payment error:', e);
    }
  }

  return (
    <div className="rw-checkout">
      <div className="rw-checkout-bar">
        <div className="rw-logo" style={{ cursor: 'pointer' }}
          onClick={() => { window.location.hash = ''; window.dispatchEvent(new CustomEvent('reset-store')); }}>REWIND<span>.</span></div>
        <button className="rw-btn rw-btn-ghost" onClick={onClose}>Back</button>
      </div>
      <div className="rw-checkout-grid">
        <div className="rw-checkout-main">
          <div className="rw-co-sec">
            <h3>Contact</h3>
            <input className="rw-input" type="email" placeholder="Email" defaultValue={userEmail || ''} />
          </div>
          <div className="rw-co-sec">
            <h3>Delivery</h3>
            <input className="rw-input" type="text" placeholder="Full name" defaultValue="Alex R." />
            <input className="rw-input" type="text" placeholder="Address" defaultValue="Kerkstraat 42" />
            <div className="rw-input-row">
              <input className="rw-input" type="text" placeholder="Postal code" defaultValue="1000" />
              <input className="rw-input" type="text" placeholder="City" defaultValue="Brussels" />
            </div>
            <input className="rw-input" type="text" placeholder="Country" defaultValue="Belgium" />
          </div>
          <div className="rw-co-sec">
            <h3>Payment</h3>
            <div className="rw-pay-grid">
              {REWIND_PAYMENTS.map((pm) => (
                <button key={pm.id} className={"rw-pay" + (payment === pm.id ? " is-on" : "")}
                  onClick={() => setPayment(pm.id)}>
                  <div className="rw-pay-radio">{payment === pm.id && <Icon name="check" size={13} />}</div>
                  <div className="rw-pay-label">
                    {pm.label}
                    <small>{pm.sub}</small>
                  </div>
                </button>
              ))}
            </div>
            {payment === 'card' && (
              <div className="rw-card-fields">
                <input className="rw-input" type="text" placeholder="Card number" defaultValue="4242 4242 4242 4242" />
                <div className="rw-input-row">
                  <input className="rw-input" type="text" placeholder="MM / YY" defaultValue="12 / 27" />
                  <input className="rw-input" type="text" placeholder="CVC" defaultValue="123" />
                </div>
              </div>
            )}
            <div className="rw-co-config">
              {payment === 'payconiq' && 'Scan the QR code with Payconiq to complete payment.'}
              {payment === 'applepay' && 'Complete payment with Face ID or Touch ID.'}
              {payment === 'klarna' && 'Pay in 3 interest-free instalments.'}
              {payment === 'bancontact' && 'You will be redirected to your bank to confirm.'}
              {payment === 'paypal' && 'You will be redirected to PayPal to complete your purchase.'}
            </div>
            <label className="rw-check">
              <input type="checkbox" defaultChecked /> Save my info for next time
            </label>
          </div>
        </div>
        <div className="rw-checkout-summary">
          <h3>Order summary</h3>
          <div className="rw-sum-items">
            {items.map((it) => (
              <div key={it.key} className="rw-sum-line">
                <div className="rw-sum-media">
                  <Photo id={it.id + "-sum"} hue={it.hue} label="" h={52} />
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
            <div><span>Shipping</span><span>{shipping === 0 ? 'Free' : money(shipping)}</span></div>
          </div>
          <div className="rw-sum-total">
            <div><span>Total</span><b>{money(total)}</b></div>
          </div>
          <button className="rw-btn rw-btn-pri rw-btn-full" disabled={processing}
            onClick={handlePay}>
            {processing ? <><i className="rw-spinner" /> Processing…</> : `Pay ${money(total)}`}
          </button>
          <div className="rw-co-trust">
            <Icon name="check" size={13} /> Secured with 256-bit SSL
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Wishlist Signup Modal ---------- */
const POLICY_TEXT = `By creating a wishlist account you agree to the following:
• We use your email only to manage your wishlist and send order-related notifications
• You can delete your account and data at any time by contacting us
• We do not share your personal data with third parties
• Your data is stored securely and never used for purposes beyond what you consent to below`;

export function SignupModal({ open, onClose, onSignup }) {
  const [email, setEmail] = useState('');
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState('');
  const [showPolicy, setShowPolicy] = useState(false);

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
export function WishlistDrawer({ open, items, customProducts, onClose, onRemove, onAddToCart, onSelect, onCartOpen }) {
  const allProducts = useMemo(() => [...REWIND_PRODUCTS, ...(customProducts || [])], [customProducts]);
  const wishlistItems = items.map((id) => allProducts.find((p) => p.id === id || p.product_id === id)).filter(Boolean);
  const [selected, setSelected] = useState([]);

  // Custom products (from Supabase) use product_id as their key, not id.
  // Always use getId(p) to get the canonical wishlist identifier.
  const getId = (p) => p.id || p.product_id;

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const addSelectedToCart = () => {
    const toAdd = wishlistItems.filter(p => selected.includes(getId(p)));
    if (toAdd.length > 0) {
      if (toAdd.length === 1 && onSelect) {
        // Single item — navigate to product page so the user can pick a size
        onSelect(toAdd[0]);
        setSelected([]);
      } else if (onAddToCart) {
        // Multiple items — add all to cart (silently picks first size; user can adjust later)
        toAdd.forEach(p => onAddToCart(p));
        setSelected([]);
        // Open cart drawer to show what was added
        if (onCartOpen) onCartOpen();
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
              {selected.length === 1 ? 'Choose size' : `Add ${selected.length} to cart`}
            </button>
            <button style={{ marginLeft: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '12px' }}
              onClick={() => setSelected([])}>Cancel</button>
            <button style={{ marginLeft: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--accent)', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}
              onClick={() => { selected.forEach(id => onRemove(id)); setSelected([]); }}>Delete all</button>
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
                  <Photo id={p.id + "-wish"} hue={p.hue} label="" h={74} />
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
                  <button onClick={() => onSelect(p)}
                    aria-label={"Select size for " + p.name}
                    style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      border: '1.5px solid var(--line-2)', background: 'var(--surface)',
                      cursor: 'pointer', display: 'grid', placeItems: 'center',
                      color: 'var(--ink)', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; e.target.style.borderColor = 'var(--ink)'; }}
                    onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; e.target.style.borderColor = 'var(--line-2)'; }}>
                    <Icon name="plus" size={14} />
                  </button>
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
