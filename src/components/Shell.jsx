import React, { useState, useEffect, useRef } from 'react';
import { useCountdown, pad, money } from '../hooks/useCountdown';
import { IMG_BASE_URL } from '../data';

/* ---------- Icon ---------- */
export function Icon({ name, size = 20 }) {
  const p = {
    cart:   <><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2.5 3h2.2l2 12h10.3l1.8-9H6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    close:  <><path d="M5 5l14 14M19 5L5 19"/></>,
    plus:   <><path d="M12 5v14M5 12h14"/></>,
    minus:  <><path d="M5 12h14"/></>,
    arrow:  <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check:  <><path d="M4 12l5 5L20 6"/></>,
    chev:   <><path d="M6 9l6 6 6-6"/></>,
    bag:    <><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
    bolt:   <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></>,
    truck:  <><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></>,
    retrn:  <><path d="M3 8h11a5 5 0 0 1 0 10H8"/><path d="M6 5 3 8l3 3"/></>,
    heart:  <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></>,
    heartFilled: <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="currentColor"/></>,
    chevUp:  <><path d="M18 15l-6-6-6 6"/></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
  );
}

/* ---------- Photo ---------- */
export function Photo({ id, hue, label, h = 320, img }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef(null);
  const src = img || (IMG_BASE_URL ? `${IMG_BASE_URL}/${id}.webp` : null);

  useEffect(() => {
    // Reset state when src changes (e.g. navigating between products)
    setLoaded(false);
    setErrored(false);
  }, [src]);

  useEffect(() => {
    if (!imgRef.current || !src) return;
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

  if (!src || errored) {
    // Colour-block placeholder (also used as error fallback when image load fails)
    const bg = `linear-gradient(150deg, oklch(0.72 0.17 ${hue}) 0%, oklch(0.55 0.2 ${(hue + 40) % 360}) 100%)`;
    return (
      <div className="rw-photo" style={{ height: h }}>
        <div className="rw-photo-bg" style={{ background: bg }}>
          <span className="rw-photo-word">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rw-photo" style={{ height: h, overflow: 'hidden', position: 'relative' }}>
      {!loaded && <div className="rw-skeleton" style={{ position: 'absolute', inset: 0 }} />}
      <img ref={imgRef} loading="lazy" className={`rw-img ${loaded ? 'loaded' : ''}`}
        alt={label}
        onLoad={() => setLoaded(true)}
        onError={() => { setErrored(true); setLoaded(true); }}
        style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

/* ---------- Banner ---------- */
export function Banner({ showCountdown }) {
  const msgs = [
    "Summer drop is live — curated vintage, restocked weekly",
    "Free returns within 14 days · Ships from EU in 24h",
    "Every piece authenticated & steam-cleaned before it ships",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % msgs.length), 4200);
    return () => clearInterval(t);
  }, []);
  const c = useCountdown();
  return (
    <div className="rw-banner">
      <div className="rw-banner-track" key={i}>
        <Icon name="bolt" size={14} /> <span>{msgs[i]}</span>
      </div>
      {showCountdown && (
        <div className="rw-banner-count" title="Sale ends Sunday 23:59">
          Sale ends in
          <b>{c.d}d&nbsp;{pad(c.h)}h&nbsp;{pad(c.m)}m&nbsp;{pad(c.s)}s</b>
        </div>
      )}
    </div>
  );
}

/* ---------- Header ---------- */
export function Header({ cat, setCat, cartCount, onCart, wishlistCount, onWishlistOpen, query, setQuery, cats, version, onVersionClick, onReferral }) {
  return (
    <header className="rw-header">
      <div className="rw-header-row">
        <div className="rw-logo" style={{ cursor: 'pointer' }}
          onClick={() => { window.location.hash = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new CustomEvent('reset-store')); }}>REWIND<span>.</span></div>
        <nav className="rw-nav">
          {cats.map((c) => (
            <button key={c} className={"rw-navlink" + (cat === c ? " is-on" : "")}
              onClick={() => setCat(c)}>{c === "All" ? "New in" : c}</button>
          ))}
        </nav>
        <div className="rw-header-actions">
          <div className="rw-search" style={{position:'relative'}}>
            <Icon name="search" size={17} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.target.blur(); setQuery(''); } }} placeholder="Search" />
            {query && (
            <button onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px', display: 'grid', placeItems: 'center',
                color: 'var(--muted)', opacity: 0.7,
                transition: 'opacity 0.15s',
              }}
              onMouseOver={e => e.target.style.opacity = '1'}
              onMouseOut={e => e.target.style.opacity = '0.7'}>
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <button className="rw-iconbtn" onClick={onReferral} aria-label="Refer a friend" title="Refer a friend — get 10% off">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
          <button className="rw-iconbtn" onClick={onWishlistOpen} aria-label="Wishlist">
            <Icon name="heart" size={17} />
            {wishlistCount > 0 && <span className="rw-badge">{wishlistCount}</span>}
          </button>
          <button className="rw-iconbtn" onClick={onCart} aria-label="Cart">
            <Icon name="bag" />
            {cartCount > 0 && <span className="rw-badge">{cartCount}</span>}
          </button>
          {version && <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '10px', fontWeight: 600, cursor: 'pointer' }} onClick={onVersionClick} title="Toggle tweaks panel">{version}</span>}
        </div>
      </div>
    </header>
  );
}

/* ---------- TypingText (inline for no import breakage) ---------- */
export function TypingText({ texts, typingSpeed = 80, deleteSpeed = 40, pauseDuration = 2500 }) {
  const [text, setText] = useState('');
  const [ti, setTi] = useState(0);
  const [ci, setCi] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!texts?.length) return;
    const current = texts[ti];
    const speed = deleting ? deleteSpeed : typingSpeed;
    const t = setTimeout(() => {
      if (!deleting) {
        if (ci < current.length) { setText(current.slice(0, ci + 1)); setCi(c => c + 1); }
        else setTimeout(() => setDeleting(true), pauseDuration);
      } else {
        if (ci > 0) { setText(current.slice(0, ci - 1)); setCi(c => c - 1); }
        else { setDeleting(false); setTi((ti + 1) % texts.length); }
      }
    }, speed);
    return () => clearTimeout(t);
  }, [ci, deleting, ti, texts, typingSpeed, deleteSpeed, pauseDuration]);
  return <span className="type-wrap">{text}<span className="type-cursor">|</span></span>;
}

/* ---------- Hero ---------- */
export function Hero({ onShop }) {
  return (
    <section className="rw-hero">
      <div className="rw-hero-copy">
        <div className="rw-hero-kicker"><Icon name="bolt" size={13} /> Summer '26 · Vol. 04</div>
        <h1 className="rw-hero-title">Worn once.<br/>Loved again.</h1>
        <p className="rw-hero-sub">
          Hand-picked vintage tracksuits, retro jerseys & summer sets. Authenticated,
          cleaned, and shipped in 24 hours. One of each — when it's gone, it's gone.
        </p>
        <div className="rw-hero-cta">
          <button className="rw-btn rw-btn-pri" onClick={() => onShop()}>Shop the drop <Icon name="arrow" size={17} /></button>
          <button className="rw-btn rw-btn-ghost" onClick={() => onShop('Jerseys')}>Browse jerseys</button>
        </div>
        <div className="rw-hero-stats">
          <div><b>4.9</b><span>★ 2,300+ reviews</span></div>
          <div><b>24h</b><span>EU dispatch</span></div>
          <div><b>14d</b><span>free returns</span></div>
        </div>
      </div>
      <div className="rw-hero-art">
        <div className="rw-hero-loop">
          <Photo id="hero-b" hue={210} label="DETAIL" h={420} />
        </div>
      </div>
    </section>
  );
}

/* ---------- Marquee ---------- */
export function Marquee() {
  const items = ["Ships in 24h", "Free EU returns", "One of each", "Restocked weekly", "Authenticated", "Steam-cleaned"];
  // Triple-repeat ensures there's always visible content during the animation
  // loop, preventing any cutoff on narrow viewports.
  const row = [...items, ...items, ...items];
  return (
    <div className="rw-marquee">
      <div className="rw-marquee-track">
        {row.map((t, k) => <span key={k} className="rw-marquee-item"><Icon name="bolt" size={13} /> {t}</span>)}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="rw-toast" key={toast.k}>
      <Icon name="check" size={16} /> <span>{toast.msg}</span>
      {toast.action && (
        <button className="rw-toast-btn" onClick={() => { toast.action.onClick(); onDismiss(); }}>
          {toast.action.label}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss"
        className="rw-toast-close">
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}

/* ---------- Progress Steps (dotted line) ---------- */
export function ProgressSteps() {
  const steps = ["Browse", "Add to cart", "Checkout", "Shipped", "Delivered"];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '0', padding: '24px 0 8px', maxWidth: '400px', margin: '0 auto',
    }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, flexShrink: 0,
          }}>
            {i + 1}
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 0,
              borderTop: '2px dashed var(--line-2)',
              margin: '0 6px', minWidth: '24px',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Footer ---------- */
export function Footer({ onSizes, onInfo, onSetCat, cats }) {
  // Use provided categories or fall back to the main ones that always exist
  const shopCats = cats ? cats.filter(c => c !== 'All') : [];
  return (
    <footer className="rw-footer">
      <div className="rw-footer-top">
        <div className="rw-logo rw-logo-lg">REWIND<span>.</span></div>
        <p>Curated vintage & retro sportswear. Each piece is one of one — sourced,
          authenticated, and sent on within a day.</p>
      </div>
      <div className="rw-footer-cols">
        <div><h4>Shop</h4>
          {shopCats.length > 0
            ? shopCats.map(c => (
                <a key={c} onClick={() => onSetCat(c)}>{c}</a>
              ))
            : <><a onClick={() => onSetCat('Tracksuits')}>Tracksuits</a><a onClick={() => onSetCat('Jerseys')}>Jerseys</a><a onClick={() => onSetCat('Polos')}>Polos</a><a onClick={() => onSetCat('Shoes')}>Kicks</a></>
          }
        </div>
        <div><h4>Help</h4><a onClick={onSizes} style={{ cursor: 'pointer' }}>Sizing</a><a onClick={() => onInfo('shipping')} style={{ cursor: 'pointer' }}>Shipping</a><a onClick={() => onInfo('returns')} style={{ cursor: 'pointer' }}>Returns</a><a onClick={() => onInfo('tracking')} style={{ cursor: 'pointer' }}>Track order</a><a onClick={() => onInfo('orders')} style={{ cursor: 'pointer' }}>Orders</a></div>
        <div><h4>Pay with</h4><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>PayPal</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Payconiq</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Apple Pay</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Bancontact</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Klarna</a></div>
        <div><h4>Legal</h4><a onClick={() => onInfo('privacy')} style={{ cursor: 'pointer' }}>Privacy Policy</a></div>
      </div>
      <div className="rw-footer-base">© 2026 REWIND. Vintage streetwear — curated, authenticated, shipped in 24h.</div>
    </footer>
  );
}

/* ---------- Truck Loader ---------- */
export function TruckLoader() {
  return (
    <div className="loader">
      <div className="truckWrapper">
        <div className="truckBody">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 198 93" width="130" height="70">
            <path strokeWidth="3" stroke="#282828" fill="#F83D3D" d="M135 22.5H177.264C178.295 22.5 179.22 23.114 179.594 24.0624L192.256 56.0618C192.598 56.9273 192 57.9 191.062 57.9H155.5C154.668 57.9 154 57.2289 154 56.3937V27.5C154 26.6716 153.328 26 152.5 26H135C134.172 26 133.5 25.3284 133.5 24.5C133.5 23.6716 134.172 23 135 23Z"/>
            <path strokeWidth="3" stroke="#282828" fill="#282828" d="M71 22.5H134.5C135.328 22.5 136 23.1716 136 24V27.5C136 28.3284 135.328 29 134.5 29H71C70.1716 29 69.5 28.3284 69.5 27.5V24C69.5 23.1716 70.1716 22.5 71 22.5Z"/>
            <path strokeWidth="3" stroke="#282828" fill="#282828" d="M66.5 44H87.5C88.3284 44 89 44.6716 89 45.5V51.5C89 52.3284 88.3284 53 87.5 53H66.5C65.6716 53 65 52.3284 65 51.5V45.5C65 44.6716 65.6716 44 66.5 44Z"/>
            <path strokeWidth="3" stroke="#282828" fill="#282828" d="M86 22.5H126.5C127.328 22.5 128 23.1716 128 24V27C128 27.8284 127.328 28.5 126.5 28.5H86C85.1716 28.5 84.5 27.8284 84.5 27V24C84.5 23.1716 85.1716 22.5 86 22.5Z"/>
            <path strokeWidth="3" stroke="#282828" fill="#282828" d="M95 29.5H105.5C106.328 29.5 107 30.1716 107 31V38.5C107 39.3284 106.328 40 105.5 40H95C94.1716 40 93.5 39.3284 93.5 38.5V31C93.5 30.1716 94.1716 29.5 95 29.5Z"/>
            <path strokeWidth="3" stroke="#282828" fill="#282828" d="M117.5 29.5H131C131.828 29.5 132.5 30.1716 132.5 31V38.5C132.5 39.3284 131.828 40 131 40H117.5C116.672 40 116 39.3284 116 38.5V31C116 30.1716 116.672 29.5 117.5 29.5Z"/>
            <rect strokeWidth="0" fill="#FFD500" rx="4" height="18" width="54" y="70" x="6"/>
            <rect strokeWidth="0" fill="#282828" rx="4" height="10" width="22" y="74" x="41"/>
            <rect strokeWidth="0" fill="#282828" rx="4" height="10" width="22" y="74" x="11"/>
            <rect strokeWidth="0" fill="#FFD500" rx="4" height="15" width="64" y="70" x="64"/>
            <rect strokeWidth="0" fill="#282828" rx="4" height="8" width="56" y="73.5" x="68"/>
            <circle cx="22" cy="84" r="8" fill="#282828" strokeWidth="0"/>
            <circle cx="118" cy="84" r="8" fill="#282828" strokeWidth="0"/>
            <circle cx="22" cy="84" r="4" fill="#fff"/>
            <circle cx="118" cy="84" r="4" fill="#fff"/>
          </svg>
        </div>
        <div className="truckTires">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30" width="24" height="24">
            <circle cx="15" cy="15" r="13" stroke="#282828" strokeWidth="3" fill="#fff"/>
            <circle cx="15" cy="15" r="8" fill="#282828"/>
            <circle cx="15" cy="15" r="4" fill="#fff"/>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30" width="24" height="24">
            <circle cx="15" cy="15" r="13" stroke="#282828" strokeWidth="3" fill="#fff"/>
            <circle cx="15" cy="15" r="8" fill="#282828"/>
            <circle cx="15" cy="15" r="4" fill="#fff"/>
          </svg>
        </div>
        <div className="road"/>
        <svg className="lampPost" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 90" width="20" height="90">
          <path stroke="#282828" strokeWidth="3" d="M10 90V30"/>
          <circle cx="10" cy="15" r="6" fill="#FFD500" stroke="#282828" strokeWidth="2"/>
          <rect x="7" y="28" width="6" height="4" fill="#333"/>
        </svg>
      </div>
    </div>
  );
}
