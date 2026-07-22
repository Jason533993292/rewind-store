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
      <div className="rw-photo" style={{ height: h, position: 'relative' }}>
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
    "Summer sale ends Sunday 23:59 — shop now before it's gone",
    "Summer sale ends Sunday 23:59 — shop now before it’s gone",
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
export function Header({ cat, setCat, cartCount, onCart, wishlistCount, onWishlistOpen, query, setQuery, cats, version, onVersionClick, onReferral, isAdmin, searchSuggestions }) {
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const suggestRef = useRef(null);

  useEffect(() => {
    if (query) setFocusedIdx(-1);
  }, [query]);

  useEffect(() => {
    const onClick = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setFocusedIdx(-1);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const hasSuggestions = query && searchSuggestions?.length > 0;

  const handleKeyDown = (e) => {
    if (!hasSuggestions) {
      if (e.key === 'Escape' && query) { e.target.blur(); setQuery(''); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, searchSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      setQuery(searchSuggestions[focusedIdx].name);
      setFocusedIdx(-1);
    } else if (e.key === 'Escape') {
      setFocusedIdx(-1);
      e.target.blur();
      setQuery('');
    }
  };

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
          <div className="rw-search" ref={suggestRef} style={{position:'relative'}}>
            <Icon name="search" size={17} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search" />
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
            {hasSuggestions && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--surface)', borderRadius: '10px', marginTop: '4px',
                boxShadow: '0 8px 24px rgba(0,0,0,.1)', overflow: 'hidden',
              }}>
                {searchSuggestions.map((s, i) => (
                  <button key={s.name} onClick={() => { setQuery(s.name); setFocusedIdx(-1); }}
                    onMouseOver={() => setFocusedIdx(i)}
                    style={{
                      display: 'block', width: '100%', padding: '8px 14px',
                      textAlign: 'left', border: 'none', cursor: 'pointer',
                      background: focusedIdx === i ? 'var(--line)' : 'transparent',
                      color: 'var(--ink)', fontSize: '13px', fontWeight: 600,
                      transition: 'background 0.1s',
                    }}>
                    <span>{s.name}</span>
                    <span style={{ float: 'right', fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>{s.cat}</span>
                  </button>
                ))}
              </div>
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
          {isAdmin && version && <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '10px', fontWeight: 600, cursor: 'pointer' }} onClick={onVersionClick} title="Toggle tweaks panel">{version}</span>}
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
          <div><b>4.3</b><span>★ 23 reviews</span></div>
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
  const row = [...items, ...items, ...items, ...items];
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
                <button key={c} onClick={() => onSetCat(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit', textAlign: 'left' }}>{c}</button>
              ))
            : <><button onClick={() => onSetCat('Tracksuits')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Tracksuits</button><button onClick={() => onSetCat('Jerseys')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Jerseys</button><button onClick={() => onSetCat('Polos')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Polos</button><button onClick={() => onSetCat('Shoes')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Kicks</button></>
          }
        </div>
        <div><h4>Help</h4><button onClick={onSizes} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit', textAlign: 'left' }}>Sizing</button><button onClick={() => onInfo('shipping')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Shipping</button><button onClick={() => onInfo('returns')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Returns</button><button onClick={() => onInfo('tracking')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Track order</button><button onClick={() => onInfo('orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Orders</button></div>
        <div><h4>Pay with</h4><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>PayPal</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Apple Pay</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Bancontact</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>iDEAL</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Klarna</button></div>
        <div><h4>Legal</h4><button onClick={() => { window.location.hash = '/privacy'; }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Privacy Policy</button><button onClick={() => { window.location.hash = '/terms'; }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Terms of Service</button><button onClick={() => { window.location.hash = '/returns'; }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Returns & Refunds</button><button onClick={() => { window.location.hash = '/shipping'; }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Shipping</button></div>
      </div>
      <div className="rw-footer-base">© 2026 REWIND. Vintage streetwear — curated, authenticated, shipped in 24h.</div>
    </footer>
  );
}

/* ---------- Truck Loader ---------- */
export function TruckLoader() {
  return (
    <div className="rw-loading-wrap">
      <div style={{ textAlign: 'center' }}>
        <div className="rw-splash-spinner" />
        <p style={{ marginTop: '20px', fontSize: '15px', fontWeight: 600, color: 'var(--muted)' }}>REWIND</p>
      </div>
    </div>
  );
}
