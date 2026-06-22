import React, { useState, useRef, useCallback, useEffect } from 'react';
import { money, discountPct } from '../hooks/useCountdown';
import { Icon, Photo } from './Shell';
import { REWIND_PAYMENTS, REWIND_PRODUCTS } from '../data';

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
export function ProductCard({ p, showCompare, showStock, onQuick, onAdd, wishlisted, onWishlist }) {
  const low = p.stock <= 5;
  return (
    <article className="rw-card">
      <div className="rw-card-media">
        <Photo id={p.id} hue={p.hue} label={p.name.toUpperCase()} h={340} />
        <div className="rw-card-tags">
          {showCompare && discountPct(p) > 0 && <span className="rw-tag rw-tag-sale">-{discountPct(p)}%</span>}
          {showStock && low && <span className="rw-tag rw-tag-low">Only {p.stock} left</span>}
        </div>
        <button className="rw-card-quick" onClick={(e) => { e.stopPropagation(); onQuick(p); }}>Quick view</button>
        <button className={"rw-card-fav" + (wishlisted ? ' is-wishlisted' : '')}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          style={{ color: wishlisted ? 'var(--accent)' : undefined }}
          onClick={() => onWishlist(p)}>
          <Icon name={wishlisted ? 'heartFilled' : 'heart'} size={17} />
        </button>
      </div>
      <div className="rw-card-body">
        <div className="rw-card-head">
          <h3 onClick={() => onQuick(p)}>{p.name}</h3>
          <span className="rw-card-cat">{p.cat}</span>
        </div>
        <div className="rw-card-foot">
          <div className="rw-price">
            <span className="rw-price-now">{money(p.price)}</span>
            {showCompare && p.was && <span className="rw-price-was">{money(p.was)}</span>}
          </div>
          <button className="rw-add" onClick={() => onAdd(p)} aria-label={"Add " + p.name}>
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------- ProductGrid ---------- */
export function ProductGrid({ products, wishlist, onWishlist, ...rest }) {
  if (products.length === 0) {
    return <div className="rw-empty">Nothing matched your search — try a different term?</div>;
  }
  return (
    <div className="rw-grid">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} wishlisted={wishlist?.includes(p.id)} onWishlist={onWishlist} {...rest} />
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
        <div className="rw-modal-media">
          <Photo id={p.id + "-qv"} hue={p.hue} label={p.name.toUpperCase()} h={500} />
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
          <button className="rw-btn rw-btn-pri rw-btn-full" onClick={() => onAdd(p, size)}>
            Add to bag — {money(p.price)}
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
        {subtotal < FREE_THRESHOLD && (
          <div className="rw-freebar">
            <Icon name="truck" size={14} /> Add <b>{money(freeLeft)}</b> more for free shipping
            <div className="rw-freebar-track"><div style={{ width: freeProgress + '%' }} /></div>
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
                    <button className="rw-line-x" onClick={() => onRemove(it.key)} aria-label="Remove">
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
export function Checkout({ open, items, onClose, onPlaced }) {
  const [payment, setPayment] = useState('card');
  const [placed, setPlaced] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!open) return null;
  if (placed) {
    const orderNum = 'RW-' + String(Date.now()).slice(-8);
    return (
      <div className="rw-checkout">
        <div className="rw-checkout-bar">
          <div className="rw-logo">REWIND<span>.</span></div>
          <button className="rw-btn rw-btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="rw-confirm">
          <div className="rw-confirm-mark"><Icon name="check" size={36} /></div>
          <h2>Order confirmed</h2>
          <p>Thanks for your order! We'll send you a shipping confirmation once your items are on their way.</p>
          <div className="rw-confirm-num">{orderNum}</div>
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
    // Mock API delay — replace with real payment gateway call
    await new Promise((r) => setTimeout(r, 1800));
    setProcessing(false);
    setPlaced(true);
  }

  return (
    <div className="rw-checkout">
      <div className="rw-checkout-bar">
        <div className="rw-logo">REWIND<span>.</span></div>
        <button className="rw-btn rw-btn-ghost" onClick={onClose}>Back</button>
      </div>
      <div className="rw-checkout-grid">
        <div className="rw-checkout-main">
          <div className="rw-co-sec">
            <h3>Contact</h3>
            <input className="rw-input" type="email" placeholder="Email" defaultValue="hi@example.com" />
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
export function WishlistDrawer({ open, items, onClose, onRemove, onAddToCart }) {
  const wishlistItems = items.map((id) => REWIND_PRODUCTS.find((p) => p.id === id)).filter(Boolean);

  return (
    <>
      <div className={"rw-scrim" + (open ? " is-on" : "")} onClick={onClose} />
      <div className={"rw-drawer" + (open ? " is-on" : "")}>
        <div className="rw-drawer-head">
          <h3>Wishlist <span>({wishlistItems.length})</span></h3>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        {wishlistItems.length === 0 ? (
          <div className="rw-drawer-empty">
            <Icon name="heart" size={36} />
            <p>Your wishlist is empty</p>
          </div>
        ) : (
          <div className="rw-drawer-items">
            {wishlistItems.map((p) => (
              <div key={p.id} className="rw-line">
                <div className="rw-line-media">
                  <Photo id={p.id + "-wish"} hue={p.hue} label="" h={74} />
                </div>
                <div className="rw-line-info">
                  <div className="rw-line-top">
                    <h4>{p.name}</h4>
                    <button className="rw-line-x" onClick={() => onRemove(p.id)} aria-label="Remove from wishlist">
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                  <div className="rw-line-meta">{p.cat}</div>
                  <div className="rw-line-bot">
                    <span className="rw-line-price">{money(p.price)}</span>
                    <button className="rw-add" style={{ width: 36, height: 36 }}
                      onClick={() => onAddToCart(p)}
                      aria-label={"Add " + p.name + " to cart"}>
                      <Icon name="plus" size={16} />
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
