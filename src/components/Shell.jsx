import React, { useState, useEffect, useRef } from 'react';
import { useCountdown, pad, money } from '../hooks/useCountdown';
import { IMG_BASE_URL } from '../data';

function parseImgs(p) {
  const raw = p.imgs || p.img;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) { try { return JSON.parse(raw); } catch {} }
  return raw ? [raw] : [];
}
import { nav } from '../lib/router';
import { useLang, LANGS, LANG_NAMES } from '../i18n';

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
    bag:    <><path d="M6.5 9h11l-.9 11H7.4L6.5 9z"/><path d="M9.5 9V6.5a2.5 2.5 0 0 1 5 0V9"/></>,
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
export function Photo({ id, hue, label, h = 320, img, eager }) {
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
    if (eager) {
      // Above-the-fold image: load immediately with high priority (LCP hero)
      imgRef.current.src = src;
      imgRef.current.fetchPriority = 'high';
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src;
          observer.disconnect();
        }
      },
      { rootMargin: '600px' }
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
      <img ref={imgRef} loading={eager ? 'eager' : 'lazy'} className={`rw-img ${loaded ? 'loaded' : ''}`}
        alt={label}
        onLoad={() => setLoaded(true)}
        onError={() => { setErrored(true); setLoaded(true); }}
        style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

/* ---------- Banner ---------- */
export function Banner({ showCountdown }) {
  const { t } = useLang();
  const msgs = [t('banner_1'), t('banner_2'), t('banner_3')];
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((v) => (v + 1) % msgs.length), 4200);
    return () => clearInterval(timer);
  }, [msgs.length]);
  const c = useCountdown();
  return (
    <div className="rw-banner">
      <div className="rw-banner-track" key={i}>
        <Icon name="bolt" size={14} /> <span>{msgs[i]}</span>
      </div>
      {showCountdown && (
        <div className="rw-banner-count" title={t('banner_2')}>
          {t('sale_ends_in')}
          <b>{c.d}d&nbsp;{pad(c.h)}h&nbsp;{pad(c.m)}m&nbsp;{pad(c.s)}s</b>
        </div>
      )}
    </div>
  );
}

/* ---------- LanguageSelector ---------- */
export function LanguageSelector() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="rw-lang" ref={ref}>
      <button className="rw-lang-btn" onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox" aria-expanded={open} aria-label="Change language">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        <span>{lang.toUpperCase()}</span>
      </button>
      {open && (
        <div className="rw-lang-menu" role="listbox" aria-label="Language">
          {LANGS.map((code) => (
            <button key={code} role="option" aria-selected={code === lang}
              className={code === lang ? 'is-on' : ''}
              onClick={() => { setLang(code); setOpen(false); }}>
              {LANG_NAMES[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Header ---------- */
export function Header({ cat, setCat, cartCount, onCart, wishlistCount, onWishlistOpen, query, setQuery, cats, version, onVersionClick, onReferral, isAdmin, searchSuggestions, onSearchSelect }) {
  const { t } = useLang();
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
      if (onSearchSelect) onSearchSelect(searchSuggestions[focusedIdx]);
      else { setQuery(searchSuggestions[focusedIdx].name); setFocusedIdx(-1); }
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
          role="link" tabIndex={0}
          onClick={() => { nav('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new CustomEvent('reset-store')); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new CustomEvent('reset-store')); } }}>RE<span className="rw-logo-w">W</span>IND<span>.</span></div>
        <nav className="rw-nav">
          {cats.map((c) => (
            <button key={c} className={"rw-navlink" + (cat === c ? " is-on" : "")}
              onClick={() => setCat(c)}>{c === "All" ? t('new_in') : c}</button>
          ))}
        </nav>
        <div className="rw-header-actions">
          <div className="rw-search" ref={suggestRef} style={{position:'relative'}}>
            <Icon name="search" size={17} />
            <input id="rw-search" name="q" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder={t('search')} aria-label={t('search_aria')}
              role="combobox" aria-expanded={!!hasSuggestions} aria-haspopup="listbox" aria-autocomplete="list"
              aria-controls="rw-search-listbox"
              aria-activedescendant={focusedIdx >= 0 ? `rw-sugg-${focusedIdx}` : undefined} />
            {query && (
            <button onClick={(e) => { setQuery(''); setFocusedIdx(-1); e.currentTarget.blur(); }}
              aria-label={t('clear_search')}
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
              <div role="listbox" id="rw-search-listbox" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--surface)', borderRadius: '10px', marginTop: '4px',
                boxShadow: '0 8px 24px rgba(0,0,0,.1)', overflow: 'hidden',
              }}>
                {searchSuggestions.map((s, i) => (
                  <button key={s.name} id={`rw-sugg-${i}`} role="option" aria-selected={focusedIdx === i}
                    onClick={() => { if (onSearchSelect) onSearchSelect(s); else { setQuery(s.name); setFocusedIdx(-1); } }}
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
          <LanguageSelector />
          <button className="rw-iconbtn" onClick={onWishlistOpen} aria-label={`${t('wishlist')}${wishlistCount > 0 ? ` (${wishlistCount})` : ''}`}>
            <Icon name="heart" size={17} />
            {wishlistCount > 0 && <span className="rw-badge">{wishlistCount}</span>}
          </button>
          <button className="rw-iconbtn" onClick={onCart} aria-label={`${t('cart')}${cartCount > 0 ? ` (${cartCount})` : ''}`}>
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
export function Hero({ onShop, onBundle, bundle }) {
  const { t } = useLang();
  return (
    <section className="rw-hero">
      <div className="rw-hero-copy">
        <div className="rw-hero-kicker"><Icon name="bolt" size={13} /> {t('hero_kicker')}</div>
        <h1 className="rw-hero-title">{t('hero_title_1')}<br/>{t('hero_title_2')}</h1>
        <p className="rw-hero-sub">
          {t('hero_sub')}
        </p>
        <div className="rw-hero-cta">
          <button className="rw-btn rw-btn-pri" onClick={() => onShop()}>{t('shop_drop')} <Icon name="arrow" size={17} /></button>
          <button className="rw-btn rw-btn-ghost" onClick={() => onShop('Jerseys')}>{t('browse_jerseys')}</button>
        </div>
        <div className="rw-hero-stats">
          <div><b>4.3</b><span>★ {t('reviews')}</span></div>
          <div><b>24h</b><span>{t('dispatch')}</span></div>
          <div><b>1 of 1</b><span>{t('one_of_each')}</span></div>
        </div>
      </div>
      <div className="rw-hero-art">
        <button type="button" className="rw-hero-bundle" onClick={onBundle}
          aria-label={bundle ? `View ${bundle.name} — €${bundle.price}` : t('view_bundle')}>
          <span className="rw-hero-loop">
            <Photo id="hero-b" hue={210} label="DETAIL" h={420} img="/products/hero-detail.jpg?v=2" eager />
          </span>
          {bundle && (
            <span className="rw-hero-caption">{bundle.name} · €{bundle.price}</span>
          )}
        </button>
      </div>
    </section>
  );
}

/* ---------- Marquee ---------- */
export function Marquee() {
  const { t } = useLang();
  const items = [t('marquee_ships'), t('marquee_final'), t('marquee_one'), t('marquee_restocked'), t('marquee_auth'), t('marquee_clean')];
  // Triple-repeat ensures there's always visible content during the animation
  // loop, preventing any cutoff on narrow viewports.
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="rw-marquee">
      <div className="rw-marquee-track" aria-hidden="true">
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
  const { t } = useLang();
  const steps = [t('step_browse'), t('step_add'), t('step_checkout'), t('step_shipped'), t('step_delivered')];
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
  const { t } = useLang();
  // Use provided categories or fall back to the main ones that always exist
  const shopCats = cats ? cats.filter(c => c !== 'All') : [];
  return (
    <footer className="rw-footer">
      <div className="rw-footer-top">
        <div className="rw-logo rw-logo-lg">REWIND<span>.</span></div>
        <p>{t('footer_desc')}</p>
      </div>
      <div className="rw-footer-cols">
        <div><h4>{t('footer_shop')}</h4>
          {shopCats.length > 0
            ? shopCats.map(c => (
                <button key={c} onClick={() => onSetCat(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit', textAlign: 'left' }}>{c}</button>
              ))
            : <><button onClick={() => onSetCat('Tracksuits')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Tracksuits</button><button onClick={() => onSetCat('Jerseys')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Jerseys</button><button onClick={() => onSetCat('Polos')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Polos</button><button onClick={() => onSetCat('Shoes')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>Kicks</button></>
          }
        </div>
        <div><h4>{t('footer_help')}</h4><button onClick={onSizes} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit', textAlign: 'left' }}>{t('help_sizing')}</button><button onClick={() => onInfo('shipping')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('help_shipping')}</button><button onClick={() => onInfo('returns')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('help_returns')}</button><button onClick={() => onInfo('tracking')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('help_track')}</button><button onClick={() => onInfo('orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('help_orders')}</button></div>
        <div><h4>{t('footer_pay')}</h4><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('pay_paypal')}</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('pay_apple')}</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('pay_bancontact')}</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('pay_ideal')}</button><button onClick={() => onInfo('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('pay_klarna')}</button></div>
        <div><h4>{t('footer_legal')}</h4><button onClick={() => { nav('/privacy'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('legal_privacy')}</button><button onClick={() => { nav('/terms'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('legal_terms')}</button><button onClick={() => { nav('/returns'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('legal_returns')}</button><button onClick={() => { nav('/shipping'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}>{t('legal_shipping')}</button><a href="https://github.com/Jason533993292/rewind-store" target="_blank" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit', textDecoration: 'none', display: 'block' }}>GitHub</a></div>
      </div>
      <div className="rw-footer-base">© 2026 REWIND. {t('footer_base')}</div>
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
