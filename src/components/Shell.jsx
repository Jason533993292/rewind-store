import React, { useState, useEffect, useRef } from 'react';
import { useCountdown, pad, money } from '../hooks/useCountdown';
import { IMG_BASE_URL } from '../data';
import AnimatedText from './AnimatedText';

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
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
  );
}

/* ---------- Photo ---------- */
export function Photo({ id, hue, label, h = 320, img }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);
  const src = img || (IMG_BASE_URL ? `${IMG_BASE_URL}/${id}.webp` : null);

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

  if (!src) {
    // Colour-block placeholder
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
      <img ref={imgRef} className={`rw-img ${loaded ? 'loaded' : ''}`}
        alt={label} onLoad={() => setLoaded(true)}
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
export function Header({ cat, setCat, cartCount, onCart, wishlistCount, onWishlistOpen, query, setQuery, cats, version }) {
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
          <button className="rw-iconbtn" onClick={onWishlistOpen} aria-label="Wishlist">
            <Icon name="heart" size={17} />
            {wishlistCount > 0 && <span className="rw-badge">{wishlistCount}</span>}
          </button>
          <button className="rw-iconbtn" onClick={onCart} aria-label="Cart">
            <Icon name="bag" />
            {cartCount > 0 && <span className="rw-badge">{cartCount}</span>}
          </button>
          {version && <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '10px', fontWeight: 600 }}>{version}</span>}
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
export function Hero({ onShop }) {
  return (
    <section className="rw-hero">
      <div className="rw-hero-copy">
        <div className="rw-hero-kicker"><Icon name="bolt" size={13} /> Summer '26 · Vol. 04</div>
        <h1 className="rw-hero-title"><AnimatedText texts={["Worn once. Loved again.", "Curated vintage, authenticated.", "Shipped in 24 hours.", "One of each — gone for good."]} typingSpeed={60} pauseDuration={3000} /></h1>
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
  const items = ["Authenticated", "Steam-cleaned", "Ships in 24h", "Free EU returns", "One of each", "Restocked weekly"];
  const row = [...items, ...items];
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
        <button className="rw-toast-btn" onClick={() => { toast.action.onClick(); }}>
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

/* ---------- Footer ---------- */
export function Footer({ onSizes, onInfo, onSetCat }) {
  return (
    <footer className="rw-footer">
      <div className="rw-footer-top">
        <div className="rw-logo rw-logo-lg">REWIND<span>.</span></div>
        <p>Curated vintage & retro sportswear. Each piece is one of one — sourced,
          authenticated, and sent on within a day.</p>
      </div>
      <div className="rw-footer-cols">
        <div><h4>Shop</h4><a onClick={() => onSetCat('Tracksuits')}>Tracksuits</a><a onClick={() => onSetCat('Jerseys')}>Jerseys</a><a onClick={() => onSetCat('Polos')}>Polos</a><a onClick={() => onSetCat('Shoes')}>Kicks</a></div>
        <div><h4>Help</h4><a onClick={onSizes} style={{ cursor: 'pointer' }}>Sizing</a><a onClick={() => onInfo('shipping')} style={{ cursor: 'pointer' }}>Shipping</a><a onClick={() => onInfo('returns')} style={{ cursor: 'pointer' }}>Returns</a><a onClick={() => onInfo('tracking')} style={{ cursor: 'pointer' }}>Track order</a><a onClick={() => onInfo('orders')} style={{ cursor: 'pointer' }}>Orders</a></div>
        <div><h4>Pay with</h4><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>PayPal</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Payconiq</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Apple Pay</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Bancontact</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Klarna</a></div>
      </div>
      <div className="rw-footer-base">© 2026 REWIND. Vintage streetwear — curated, authenticated, shipped in 24h.</div>
    </footer>
  );
}
