import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Banner, Header, Hero, Marquee, Toast, Footer, Icon } from './components/Shell';
import { ProductGrid, QuickView, CartDrawer, Checkout, SignupModal, WishlistDrawer } from './components/Shop';
import { TweaksPanel, useTweaks, TweakSection, TweakToggle, TweakColor, TweakRadio } from './components/Tweaks';
import { REWIND_PRODUCTS, REWIND_CATS, BRANDS } from './data';
import { getWishlist, saveWishlist, signupUser, supabase, getCustomProducts, addCustomProduct, updateCustomProduct, uploadProductImage, saveOrder, getOrders, updateOrderStatus } from './lib/supabase';
import SizeGuide from './components/SizeGuide';
import InfoModal from './components/InfoModal';
import ProductPage from './components/ProductPage';

const TWEAK_DEFAULTS = {
  accent: '#FF4D14',
  headingFont: 'Bricolage Grotesque',
  showBanner: true,
  showCountdown: true,
  showCompare: true,
  showStock: true,
};

const VERSION = 'V6.5.38';

// Small reusable component — defined outside App() to prevent TDZ issues with
// the minifier reordering hoisted function declarations before state variables.
function SidebarBtn({ label, isOn, onClick, count }) {
  return (
    <button className={"rw-sb-btn" + (isOn ? " is-on" : "")} onClick={onClick}>
      <span className="rw-sb-label">{label}</span>
      {count !== undefined && <span className="rw-sb-count">{count}</span>}
    </button>
  );
}

export default function App() {
  // showSurvey & blockedOverlay MUST be the VERY FIRST state vars so no TDZ
  // error can occur when the scroll-lock useEffect references them.
  const [showSurvey, setShowSurvey] = useState(false);
  const [blockedOverlay, setBlockedOverlay] = useState(false);
  // Ref-based guard against minifier TDZ — effects use showSurveyRef.current
  // instead of the raw `showSurvey` state variable so that even if esbuild
  // hoists the effect closures, they reference a stable object (ref) rather
  // than an uninitialized const binding.
  const showSurveyRef = useRef(showSurvey);
  useEffect(() => { showSurveyRef.current = showSurvey; }, [showSurvey]);

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('rw_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('rw_cart', JSON.stringify(cart));
  }, [cart]);
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(null);
  const [showSizes, setShowSizes] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [checkoutCount, setCheckoutCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [infoPage, setInfoPage] = useState(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoClosing, setPromoClosing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [brand, setBrand] = useState(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('rw_email') || '');
  const [wishlist, setWishlist] = useState([]);
  const [pendingWishlistId, setPendingWishlistId] = useState(null);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlistReady, setWishlistReady] = useState(false);
  const [customProducts, setCustomProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sortBy, setSortBy] = useState('');

  // ── ALL new state vars for modals/panels MUST go above this line ──
  // The scroll-lock useEffect (below) references these in its `anyOpen` check.
  // Adding a new state AFTER this point will break the site with a TDZ error.
  const customProductsRef = useRef(customProducts);
  useEffect(() => { customProductsRef.current = customProducts; }, [customProducts]);

  // Load custom products from Supabase
  useEffect(() => {
    getCustomProducts().then((prods) => {
      if (prods.length) setCustomProducts(prods);
    });
  }, []);

  // Load wishlist from Supabase on mount / email change
  useEffect(() => {
    if (userEmail) {
      getWishlist(userEmail).then((ids) => {
        if (ids.length) setWishlist(ids);
        setWishlistReady(true);
      });
    } else {
      // Load from localStorage cache immediately
      try {
        const cached = JSON.parse(localStorage.getItem('rw_wishlist') || '[]');
        if (cached.length) setWishlist(cached);
      } catch {}
      setWishlistReady(true);
    }
  }, [userEmail]);

  // Persist wishlist to Supabase — only after initial load
  useEffect(() => {
    if (!wishlistReady) return;
    if (userEmail) {
      saveWishlist(userEmail, wishlist);
    }
    localStorage.setItem('rw_wishlist', JSON.stringify(wishlist));
  }, [wishlist, userEmail, wishlistReady]);

  // Persist email
  useEffect(() => { if (userEmail) localStorage.setItem('rw_email', userEmail); }, [userEmail]);

  // Reset brand when category changes
  useEffect(() => { setBrand(null); }, [cat]);

  // Apply style tweaks to :root
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--font-head', `"${t.headingFont}", sans-serif`);
  }, [t.accent, t.headingFont]);

  // Lock body scroll when any modal/drawer is open
  // NOTE: showSurvey and blockedOverlay deliberately excluded from this effect.
  //   The survey overlay uses pointer-events: none (clicks pass through), and the
  //   blocked overlay fills the full viewport (inset:0). Neither needs body
  //   scroll-lock. Excluding them also prevents the minifier from hoisting the
  //   effect's closure before those state variables are initialized (TDZ bug).
  useEffect(() => {
    const anyOpen = quick !== null || drawer || checkout || signupOpen || showSizes || infoPage !== null || promoOpen || wishlistOpen;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [quick, drawer, checkout, signupOpen, showSizes, infoPage, promoOpen, wishlistOpen]);

  // Close modals/drawers on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (promoOpen)        { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); }
      if (quick !== null)    setQuick(null);
      if (drawer)           setDrawer(false);
      if (checkout)         setCheckout(false);
      if (signupOpen)       setSignupOpen(false);
      if (showSizes)        setShowSizes(false);
      if (infoPage !== null) setInfoPage(null);
      if (wishlistOpen)     setWishlistOpen(false);
      // Always try to dismiss survey on Escape — safe no-op if not open.
      // NOTE: showSurvey deliberately omitted from deps to prevent the minifier
      // from hoisting this effect before showSurvey's state variable is initialized (TDZ bug).
      localStorage.setItem('rw_survey_done', '1');
      setShowSurvey(false);
      if (selectedProduct)  { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [promoOpen, quick, drawer, checkout, signupOpen, showSizes, infoPage, wishlistOpen, selectedProduct]);

  const products = useMemo(() => {
    const allProducts = [...REWIND_PRODUCTS, ...customProducts];
    return allProducts.filter((p) =>
      (cat === 'All' || p.cat === cat) &&
      (!brand || p.brand === brand) &&
      (query.trim() === '' || (p.name + ' ' + p.cat + ' ' + (p.brand || '') + ' ' + (p.note || '')).toLowerCase().includes(query.toLowerCase()))
    );
  }, [cat, brand, query, customProducts]);

  // Compute categories that actually have products (including custom products)
  const availableCats = useMemo(() => {
    const allProds = [...REWIND_PRODUCTS, ...customProducts];
    const available = new Set(allProds.map(p => p.cat).filter(Boolean));
    return REWIND_CATS.filter(c => c === 'All' || available.has(c));
  }, [customProducts]);

  const cartCount = cart.reduce((s, it) => s + it.qty, 0);

  const toastTimer = useRef(null);
  const showToast = useCallback((msg, action, duration = 2400) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, k: Date.now(), action });
    toastTimer.current = setTimeout(() => setToast((cur) => (cur && cur.k && Date.now() - cur.k >= duration - 100 ? null : cur)), duration);
  }, []);

  const addToCart = useCallback((p, size, qty = 1) => {
    const sz = size || p.sizes[0];
    const key = p.id + '-' + sz;
    setCart((c) => {
      const found = c.find((it) => it.key === key);
      if (found) return c.map((it) => it.key === key ? { ...it, qty: it.qty + qty } : it);
      return [...c, { key, id: p.id, name: p.name, price: p.price, was: p.was, hue: p.hue, size: sz, qty: qty }];
    });
    showToast((qty > 1 ? qty + '× ' : '') + p.name + ' added to bag');
  }, [showToast]);

  const quickAdd = useCallback((p) => { addToCart(p); setDrawer(true); }, [addToCart]);
  const addFromQuick = useCallback((p, size) => { addToCart(p, size); setQuick(null); setDrawer(true); }, [addToCart]);
  const changeQty = useCallback((key, d) => { setCart((c) => c.map((it) => it.key === key ? { ...it, qty: Math.max(1, it.qty + d) } : it)); }, []);
  const removeItem = useCallback((key, name) => { 
    // Capture the removed item so Undo always restores the right data,
    // regardless of subsequent cart changes before the user clicks Undo.
    const removedItem = cart.find(it => it.key === key);
    setCart((c) => c.filter((it) => it.key !== key)); 
    showToast((name || 'Item') + ' removed', {
      label: 'Undo',
      onClick: () => setCart((c) => {
        if (c.find(it => it.key === key)) return c; // already restored
        return [...c, removedItem].filter(Boolean);
      }),
    });
  }, [cart, showToast]);
  const goCheckout = useCallback(() => { setDrawer(false); setCheckout(true); setCheckoutCount(c => c + 1); setPromoOpen(false); setPromoClosing(false); }, []);
  const orderPlaced = useCallback(() => { setCart([]); setCheckout(false); }, []);

  const handleWishlist = useCallback((p) => {
    const pid = p.id || p.product_id;
    if (!pid) return;
    if (!userEmail) {
      setPendingWishlistId(pid);
      setSignupOpen(true);
      return;
    }
    setWishlist((prev) => {
      const exists = prev.includes(pid);
      if (!exists) {
        showToast(p.name + ' saved', {
          label: 'Show',
          onClick: () => setWishlistOpen(true),
        });
      } else {
        showToast(p.name + ' removed', {
          label: 'Undo',
          onClick: () => setWishlist((inner) => inner.includes(pid) ? inner : [...inner, pid]),
        });
      }
      return exists ? prev.filter((id) => id !== pid) : [...prev, pid];
    });
  }, [userEmail, showToast]);

  const handleSignup = useCallback(({ email, acceptMarketing }) => {
    setUserEmail(email);
    setSignupOpen(false);
    signupUser(email, acceptMarketing);
    if (pendingWishlistId) {
      setWishlist((prev) => prev.includes(pendingWishlistId) ? prev : [...prev, pendingWishlistId]);
      setPendingWishlistId(null);
      showToast('Saved to wishlist');
    }
  }, [pendingWishlistId, showToast]);

  const applyPromo = useCallback(async () => {
    if (!promoCode || promoLoading) return;
    setPromoLoading(true);
    setPromoMsg('');
    try {
      const r = await fetch('/api/validate-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode }) });
      const d = await r.json();
      if (d.admin) { window.location.hash = 'admin'; }
      else { setPromoMsg('✅ Promo applied!'); }
    } catch {
      setPromoMsg('❌ Network error — try again');
    }
    setPromoLoading(false);
  }, [promoCode, promoLoading]);

  const headingId = 'the-drop';
  const scrollToGrid = useCallback(() => {
    const el = document.getElementById(headingId);
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
  }, []);

  const currentBrands = cat !== 'All' ? BRANDS[cat] || [] : [];

  // Count products per category and brand for sidebar badges
  const allProducts = useMemo(() => [...REWIND_PRODUCTS, ...customProducts], [customProducts]);
  const catCounts = useMemo(() => {
    const counts = {};
    allProducts.forEach(p => {
      if (p.cat) counts[p.cat] = (counts[p.cat] || 0) + 1;
    });
    counts['All'] = allProducts.length;
    return counts;
  }, [allProducts]);
  const brandCounts = useMemo(() => {
    if (cat === 'All') return {};
    const counts = {};
    allProducts.filter(p => p.cat === cat).forEach(p => {
      if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
    });
    return counts;
  }, [allProducts, cat]);

  // ── Admin mode ──
  const [adminMode, setAdminMode] = useState(window.location.hash === '#admin');
  const [blocked, setBlocked] = useState(false);

  // Handle Stripe success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('order') === 'success') {
      const orderNum = params.get('orderNum');
      const msg = orderNum ? `✅ ${orderNum} confirmed!` : '✅ Order confirmed!';
      showToast(msg);
      setCart([]);
      setCheckout(false);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);
  
  // First-visit questionnaire — moved closer to the other state vars above
  
  useEffect(() => {
    if (!localStorage.getItem('rw_survey_done')) {
      setShowSurvey(true);
    }
    // Check if this user's email is blocked
    const stored = localStorage.getItem('rw_email');
    if (stored) {
      fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: stored }) })
        .then(r => r.json())
        .then(d => { if (d.blocked) setBlockedOverlay(true); })
        .catch(() => {});
    }
    // Listen for logo click to reset store
    const handler = () => { setCat('All'); setBrand(null); setQuery(''); };
    window.addEventListener('reset-store', handler);
    return () => window.removeEventListener('reset-store', handler);
  }, []);

  // Auto-dismiss survey when any other modal/drawer opens — prevents
  // the survey overlay from blocking interaction with signup, cart quickview, etc.
  useEffect(() => {
    // Use ref instead of raw showSurvey to prevent minifier TDZ
    if (showSurveyRef.current && (signupOpen || quick !== null || drawer || checkout || showSizes || infoPage !== null || promoOpen || wishlistOpen)) {
      localStorage.setItem('rw_survey_done', '1');
      setShowSurvey(false);
    }
  }, [showSurvey, signupOpen, quick, drawer, checkout, showSizes, infoPage, promoOpen, wishlistOpen]);

  // Auto-dismiss survey when user scrolls down past the hero — prevents
  // the survey card from covering the product grid area.
  useEffect(() => {
    // Use ref instead of raw showSurvey to prevent minifier TDZ
    if (!showSurveyRef.current) return;
    const onScroll = () => {
      if (window.scrollY > 200) {
        localStorage.setItem('rw_survey_done', '1');
        setShowSurvey(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showSurvey]);

  useEffect(() => {
    const onPop = () => {
      if (!window.location.hash.startsWith('#/product/')) {
        setSelectedProduct(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // When selectedProduct changes, update the URL hash
  useEffect(() => {
    if (selectedProduct) {
      const id = selectedProduct.id || selectedProduct.product_id;
      window.history.pushState({ product: id }, '', '#/product/' + id);
    }
  }, [selectedProduct]);
  useEffect(() => {
    const onHash = () => {
      const isAdminHash = window.location.hash === '#admin';
      if (isAdminHash) {
        // Only show admin if already authenticated
        const saved = localStorage.getItem('rw_admin_email');
        if (!saved) { window.location.hash = ''; return; }
        // Verify against Supabase
        supabase?.from('admins').select('email').eq('email', saved).single()
          .then(({ data }) => { if (!data) { window.location.hash = ''; } else { setAdminMode(true); } });
      } else {
        setAdminMode(false);
      }
      if (window.location.hash.startsWith('#/product/')) {
        const pid = window.location.hash.replace('#/product/', '');
        const allProds = [...REWIND_PRODUCTS, ...customProductsRef.current];
        const p = allProds.find(x => (x.id || x.product_id) === pid);
        if (p) setSelectedProduct(p);
      }
    };
    // Handle initial URL hash immediately (direct navigation to #/product/xxx)
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Check if current user is blocked
  useEffect(() => {
    if (!supabase || adminMode) return;
    const email = localStorage.getItem('rw_email');
    if (!email) return;
    supabase.from('wishlists').select('blocked').eq('email', email).single()
      .then(({ data }) => {
        if (data?.blocked) setBlocked(true);
      });
  }, [adminMode]);

  if (adminMode) return <AdminPanel onExit={() => { window.location.hash = ''; }} onSelect={setSelectedProduct} />;

  // Blocked screen
  if (blocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</h1>
        <h2 style={{ fontSize: '24px', color: 'var(--ink)', marginBottom: '8px' }}>Access restricted</h2>
        <p style={{ fontSize: '16px', color: 'var(--muted)', maxWidth: '400px' }}>This account has been blocked from accessing REWIND. If you think this is a mistake, please contact us.</p>
      </div>
    );
  }

  // Show product detail page instead of shop
  if (selectedProduct) {
    return (
      <div className="rw-app">
        <Header cat={cat} setCat={(c) => { setCat(c); }} cartCount={cartCount}
          onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
          onWishlistOpen={() => setWishlistOpen(true)}
          query={query} setQuery={setQuery} cats={availableCats} version={VERSION} />
        <ProductPage key={selectedProduct.id || selectedProduct.product_id} p={selectedProduct} onBack={() => { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }}
          onAdd={(p, size, qty) => { addToCart(p, size, qty); setDrawer(true); }}
          onWishlist={handleWishlist}
          wishlisted={wishlist.includes(selectedProduct?.id || selectedProduct?.product_id)} />
      </div>
    );
  }

  return (
    <div className="rw-app">
      {t.showBanner && <Banner showCountdown={t.showCountdown} />}
      <Header cat={cat} setCat={(c) => { setCat(c); scrollToGrid(); }} cartCount={cartCount}
        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
        onWishlistOpen={() => setWishlistOpen(true)}
        query={query} setQuery={setQuery} cats={availableCats} version={VERSION} />
      <Hero onShop={(filterCat) => { if (filterCat) setCat(filterCat); scrollToGrid(); }} />
      <Marquee />

      <main className="rw-shop">
        <div className="rw-shop-head" id={headingId}>
          <div className="rw-shop-headl">
            <h2 className="rw-shop-title">{cat === 'All' ? 'The drop' : cat}</h2>
            <p className="rw-shop-sub">{products.length} piece{products.length !== 1 ? 's' : ''} · one of each</p>
          </div>
        </div>

        <div className="rw-shop-layout">
          <aside id="rw-sidebar" style={{
            width: '200px',
            flexShrink: 0,
            background: 'var(--line)',
            borderRadius: '12px',
            padding: '20px 16px',
            position: 'sticky',
            top: '20px',
            alignSelf: 'flex-start',
          }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Categories</h3>
            {availableCats.map((c) => (
              <SidebarBtn key={c} label={c === 'All' ? 'All' : c} count={catCounts[c] || 0} isOn={cat === c} onClick={() => { setCat(c); scrollToGrid(); }} />
            ))}

            {cat !== 'All' && currentBrands.length > 0 && (
              <>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Brands</h3>
                <SidebarBtn label="All" isOn={!brand} count={catCounts[cat] || 0} onClick={() => { setBrand(null); scrollToGrid(); }} />
                {currentBrands.map((b) => (
                  <SidebarBtn key={b} label={b} isOn={brand === b} count={brandCounts[b] || 0} onClick={() => { setBrand(b); scrollToGrid(); }} />
                ))}
              </>
            )}
          </aside>
          <div className="rw-shop-content">
            {products.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                aria-label="Sort products"
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', outline: 'none' }}>
                <option value="">Featured</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
              </select>
              <select id="rw-mobile-cat" value={cat} onChange={e => { setCat(e.target.value); scrollToGrid(); }}
                aria-label="Select category"
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', outline: 'none' }}>
                {availableCats.map((c) => (
                  <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>
                ))}
              </select>
            </div>
            )}
            <ProductGrid products={products} sort={sortBy} query={query} showCompare={t.showCompare} showStock={t.showStock}
              onQuick={setQuick} onAdd={quickAdd}
              wishlist={wishlist} onWishlist={handleWishlist} onSelect={setSelectedProduct}
              onClearSearch={() => setQuery('')} />
          </div>
        </div>
      </main>

      <Footer onSizes={() => setShowSizes(true)} onInfo={(p) => setInfoPage(p)} onSetCat={(c) => { setCat(c); scrollToGrid(); }} />
      {showSizes && <SizeGuide onClose={() => setShowSizes(false)} />}
      {infoPage && <InfoModal page={infoPage} onClose={() => setInfoPage(null)} />}

      <QuickView p={quick} showCompare={t.showCompare} showStock={t.showStock}
        onClose={() => setQuick(null)} onAdd={addFromQuick} />
      <CartDrawer open={drawer} items={cart} onClose={() => setDrawer(false)}
        onQty={changeQty} onRemove={removeItem} onCheckout={goCheckout} />
      <Checkout key={checkoutCount} open={checkout} items={cart} onClose={() => setCheckout(false)} onPlaced={orderPlaced} userEmail={userEmail} />
      <Toast toast={toast} />
      <SignupModal open={signupOpen} onClose={() => setSignupOpen(false)} onSignup={handleSignup} />
      <WishlistDrawer open={wishlistOpen} items={wishlist} customProducts={customProducts}
        onClose={() => setWishlistOpen(false)}
        onRemove={(id) => setWishlist((prev) => prev.filter((i) => i !== id))}
        onAddToCart={(p) => { addToCart(p); }}
        onSelect={(p) => { setSelectedProduct(p); setWishlistOpen(false); }}
        onCartOpen={() => { setWishlistOpen(false); setDrawer(true); }} />

      {showSurvey && !signupOpen && quick === null && !drawer && !checkout && !showSizes && infoPage === null && !promoOpen && !wishlistOpen && (
        <div className="rw-survey-overlay" onClick={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }}>
          <div className="rw-survey-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', padding: '32px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--r)', position: 'relative', boxShadow: '0 30px 80px -20px rgba(22,19,15,.5)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Welcome to REWIND 👋</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Where did you hear about us?</p>
            <Survey onDone={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} onSkip={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} />
          </div>
        </div>
      )}

      {blockedOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>Access Restricted</h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', maxWidth: '400px', lineHeight: '1.6', margin: '0' }}>
            Your account has been blocked from using REWIND.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '400px', lineHeight: '1.6', marginTop: '16px' }}>
            If you believe this is a mistake, please email us at <strong style={{ color: 'var(--ink)' }}>orders@rewind-stores.com</strong> to appeal.
          </p>
        </div>
      )}

      {/* ── Promo code button (hidden during checkout so it doesn't overlay the payment form) ── */}
      {!drawer && !wishlistOpen && !checkout && (
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
        <button onClick={() => { if (promoOpen) { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); } else { setPromoOpen(true); setPromoCode(''); setPromoMsg(''); } }}
          aria-label="Promo code"
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--ink)', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: '18px', fontWeight: 700,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s',
          }}
          onMouseOver={e => e.target.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.target.style.transform = ''}>
          💬
        </button>
      </div>
      )}

      {!drawer && !wishlistOpen && !checkout && (promoOpen || promoClosing) && (
        <div onClick={() => { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            animation: promoClosing ? 'fadeOut 0.25s ease forwards' : 'fadeIn 0.15s ease',
          }}>
          <div onClick={e => { e.stopPropagation(); }}
            style={{
              pointerEvents: 'auto',
              position: 'fixed', bottom: '80px', right: '24px',
              background: 'var(--surface)', borderRadius: '14px', padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              width: '280px', zIndex: 1001,
              animation: promoClosing ? 'genieDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'genieUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transformOrigin: 'bottom right',
            }}>
            <button onClick={() => { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); }}
              className="rw-modal-x"
              style={{
                position: 'absolute', top: '10px', right: '10px',
                width: '28px', height: '28px',
                background: 'color-mix(in oklab, var(--surface) 85%, transparent)', backdropFilter: 'blur(6px)',
              }}
              aria-label="Close">
              <Icon name="close" size={16} />
            </button>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Got a code?</div>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--muted)' }}>Enter it below and get a discount.</p>
            <input className="rw-input" placeholder="Enter code" value={promoCode}
              onChange={e => { setPromoCode(e.target.value); setPromoMsg(''); }}
              onKeyDown={e => {
                if (e.key === 'Enter') applyPromo();
              }}
              disabled={promoLoading}
              style={{ marginBottom: '8px' }} />
            <button onClick={applyPromo} disabled={promoLoading}
              style={{
                padding: '8px 20px', borderRadius: '999px',
                background: promoLoading ? 'var(--line-2)' : 'var(--ink)',
                color: '#fff', border: 'none', cursor: promoLoading ? 'default' : 'pointer',
                fontSize: '13px', fontWeight: 600, transition: 'background 0.15s',
              }}>
              {promoLoading ? '⏳ Applying…' : 'Apply'}
            </button>
            {promoMsg && <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--accent)' }}>{promoMsg}</p>}
          </div>
        </div>
      )}

      {window.location.search.includes('tweaks') && <TweaksPanel>
        <TweakSection label="Urgency & social proof" />
        <TweakToggle label="Announcement bar" value={t.showBanner} onChange={(v) => setTweak('showBanner', v)} />
        <TweakToggle label="Live sale countdown" value={t.showCountdown} onChange={(v) => setTweak('showCountdown', v)} />
        <TweakToggle label='"Was" pricing & % off' value={t.showCompare} onChange={(v) => setTweak('showCompare', v)} />
        <TweakToggle label="Low-stock badges" value={t.showStock} onChange={(v) => setTweak('showStock', v)} />
        <TweakSection label="Look" />
        <TweakColor label="Accent" value={t.accent}
          options={['#FF4D14', '#2E5BFF', '#E11D74', '#0E9F6E']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakRadio label="Headline font" value={t.headingFont}
          options={['Bricolage Grotesque', 'Space Grotesk']}
          onChange={(v) => setTweak('headingFont', v)} />
      </TweaksPanel>}
    </div>
  );
}

/* ══════════════════════════════════════════════
   ADMIN PANEL — accessible at /#admin
   ══════════════════════════════════════════════ */
function AdminPanel({ onExit, onSelect }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [emailText, setEmailText] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [customProducts, setCustomProducts] = useState([]);
  const [adminTab, setAdminTab] = useState('users');
  const [editProduct, setEditProduct] = useState(null); // direct product for editing
  const [adminEmail, setAdminEmail] = useState('');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [orders, setOrders] = useState([]);
  const [adminMsg, setAdminMsg] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setAdminChecking(false);
      return;
    }
    // Check if user's email is an admin
    const saved = localStorage.getItem('rw_admin_email');
    if (saved) {
      setAdminEmail(saved);
      supabase.from('admins').select('email').eq('email', saved).single()
        .then(({ data }) => {
          if (data) setAdminAuthed(true);
          setAdminChecking(false);
        })
        .catch(() => setAdminChecking(false));
    } else {
      setAdminChecking(false);
    }
    supabase.from('wishlists').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    getCustomProducts().then(setCustomProducts).catch(() => {});
    getOrders().then(setOrders).catch(() => {});
  }, []);

  async function toggleBlockUser(email, blocked) {
    if (!supabase) return;
    await supabase.from('wishlists').upsert({ email, blocked }, { onConflict: 'email' });
    setUsers(prev => prev.map(u => u.email === email ? { ...u, blocked } : u));
  }

  // Stats
  const totalFavs = users.reduce((s, u) => s + (u.product_ids?.length || 0), 0);

  const allEmails = users.map((u) => u.email).join(', ');
  const marketingEmails = users.filter((u) => u.marketing_optin).map((u) => u.email).join(', ');

  return (
    <div style={{ padding: '40px 24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>REWIND Admin</h1>
        <button onClick={onExit}
          style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: 'var(--ink)', transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; }}>
          ← Back to store
        </button>
      </div>
      <div style={{ position: 'absolute', top: '44px', right: '24px', fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>{VERSION}</div>

      {/* ── Admin login ── */}
      {adminChecking && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Checking access...</p>}

      {!adminChecking && !adminAuthed && (
        <div style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>🔐 Admin Access</h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Enter your email to access the admin panel.</p>
          <input className="rw-input" placeholder="your@email.com" value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            style={{ width: '100%', marginBottom: '12px' }} />
          <button onClick={async () => {
            if (!adminEmail) return;
            localStorage.setItem('rw_admin_email', adminEmail);
            const { data } = await supabase.from('admins').select('email').eq('email', adminEmail).single();
            if (data) {
              setAdminAuthed(true);
            } else {
              setAdminMsg('❌ Access denied. This email is not on the admin list.');
            }
          }}
            style={{ padding: '10px 24px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
            Enter admin panel
          </button>
          <p style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '8px' }}>{adminMsg}</p>
        </div>
      )}

      {adminAuthed && (<>
      {/* ── Tab navigation ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: '📊 Users' },
          { id: 'email', label: '📧 Email' },
          { id: 'orders', label: '📦 Orders' },
          { id: 'saved', label: '⭐ Saved' },
          { id: 'blocked', label: '🚫 Blocked' },
          { id: 'products', label: '🛍️ Products' },
          { id: 'edit', label: editProduct ? '✏️ ' + editProduct.name : null },
        ].filter(t => t.label).map((t) => (
          <button key={t.id} onClick={() => setAdminTab(t.id)}
            style={{
              padding: '10px 20px', borderRadius: '999px', border: 'none',
              background: adminTab === t.id ? 'var(--ink)' : 'var(--line)',
              color: adminTab === t.id ? '#fff' : 'var(--ink)',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (adminTab !== t.id) { e.target.style.background = '#d9d0c0'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (adminTab !== t.id) { e.target.style.background = 'var(--line)'; e.target.style.transform = ''; } }}>
            {t.label}
          </button>
        ))}
      </div>

      {!supabase && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', background: 'var(--line)', borderRadius: '12px' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Supabase not connected</p>
          <p style={{ fontSize: '14px' }}>Set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then redeploy.</p>
        </div>
      )}

      {supabase && loading && <p>Loading users...</p>}

      {supabase && !loading && users.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          <p>No users signed up yet. Sign up on the storefront to see data here.</p>
        </div>
      )}

      {supabase && !loading && users.length > 0 && adminTab === 'users' && (
        <>
          {/* ── User table ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Email</th>
                  <th style={{ padding: '12px 16px' }}>Wishlist</th>
                  <th style={{ padding: '12px 16px' }}>Marketing</th>
                  <th style={{ padding: '12px 16px' }}>Signed up</th>
                  <th style={{ padding: '12px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} style={{ borderTop: '1px solid var(--line)', background: u.blocked ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent' }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedUser(selectedUser?.email === u.email ? null : u);
                    }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, cursor: 'context-menu' }}>
                      {u.email} {u.blocked && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>🚫</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.product_ids?.length || 0} items
                      {u.product_ids?.length > 0 && (
                        <button onClick={() => setSelectedUser(selectedUser?.email === u.email ? null : u)}
                          style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px' }}>
                          {selectedUser?.email === u.email ? 'Hide' : 'View'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{u.marketing_optin ? '✅' : '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <a href={`mailto:${u.email}`} style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '16px' }}>✉️</a>
                      <button onClick={() => toggleBlockUser(u.email, !u.blocked)}
                        style={{
                          marginLeft: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: u.blocked ? 'color-mix(in oklab, var(--accent) 30%, transparent)' : 'var(--accent)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 700,
                          transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)'; }}
                        onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
                        {u.blocked ? '✅ Unblock' : '🚫 Block'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Selected user's wishlist ── */}
          {selectedUser && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                {selectedUser.email}'s wishlist
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedUser.product_ids?.map((pid) => {
                  const product = [...REWIND_PRODUCTS, ...customProducts].find((p) => p.id === pid || p.product_id === pid);
                  return (
                    <a key={pid} href="#"
                      onClick={(e) => { e.preventDefault(); window.location.hash = ''; setSelectedProduct(product); }}
                      style={{ padding: '6px 12px', background: 'var(--line)', borderRadius: '6px', fontSize: '13px', textDecoration: 'none', color: 'var(--ink)', display: 'inline-block', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseOver={e => e.target.style.background = 'var(--line-2)'}
                      onMouseOut={e => e.target.style.background = 'var(--line)'}
                      title={`${product?.name || pid} — ${product?.brand || 'no brand'} — ${product?.cat || ''}`}>
                      {product?.name || pid} {product ? `— ${product.cat}` : ''}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total users</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.filter(u => u.marketing_optin).length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Marketing opt-in</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.reduce((s, u) => s + (u.product_ids?.length || 0), 0)}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Saved items</div>
            </div>
          </div>

          {/* ── Admin manager ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🔑 Admin management</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input placeholder="Email to add as admin" id="new-admin-email"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px' }} />
              <button onClick={async () => {
                const input = document.getElementById('new-admin-email');
                const email = input.value.trim();
                if (!email) return;
                const r = await fetch('/api/manage-admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', email, adminEmail }) });
                const d = await r.json();
                alert(d.ok ? `✅ ${email} added as admin` : `❌ ${d.error}`);
                if (d.ok) input.value = '';
              }}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                Add admin
              </button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
              Current admins: {users.filter(u => u.blocked !== true).length} users · add your dad (fanaman74) or others here
            </div>
          </div>

          {/* ── Run Tests ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🧪 Automated tests</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
              Tests every button and page on the site using Playwright browser automation.
            </p>
            <button onClick={async () => {
              const btn = document.activeElement;
              btn.textContent = '🔄 Running tests...';
              btn.disabled = true;
              try {
                const r = await fetch('/api/run-tests');
                const d = await r.json();
                if (d.error) throw new Error(d.error);
                btn.textContent = `✅ ${d.passed}/${d.total} passed`;
                // Show results inline
                const resultsDiv = document.getElementById('test-results');
                if (resultsDiv) {
                  resultsDiv.innerHTML = d.results.map(r =>
                    `<div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
                      <span>${r.status}</span>
                      <span style="font-weight:600;margin:0 8px">${r.name}</span>
                      <span style="color:var(--muted);font-size:12px">${r.detail}</span>
                    </div>`
                  ).join('');
                }
              } catch (e) {
                btn.textContent = '❌ Tests failed';
              }
              setTimeout(() => { btn.textContent = '🧪 Run tests'; btn.disabled = false; }, 5000);
            }}
              style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
              🧪 Run tests
            </button>
            <div id="test-results" style={{ marginTop: '16px', maxHeight: '300px', overflow: 'auto' }} />
          </div>
          </>)
}

          {/* ── Email tool ── */}
          {adminTab === 'email' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📧 Email users about discounts / sales</h3>
            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)}
              placeholder="Write your email message here... (or leave blank for default)"
              rows={5}
              style={{ width: '100%', padding: '12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', marginBottom: '8px' }} />
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
              Emails are sent via Resend. Leave message blank for a default template.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.textContent = 'Sending...';
                btn.disabled = true;
                const r = await fetch('/api/send-campaign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ emails: users.map((u) => u.email), subject: '', message: emailText || '' }),
                });
                const d = await r.json();
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
              }}
                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                📩 Email all users ({users.length})
              </button>
              <button onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.textContent = 'Sending...';
                btn.disabled = true;
                const marketingUsers = users.filter((u) => u.marketing_optin);
                const r = await fetch('/api/send-campaign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ emails: marketingUsers.map((u) => u.email), subject: '', message: emailText || '' }),
                });
                const d = await r.json();
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
              }}
                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                📩 Email opted-in only ({users.filter((u) => u.marketing_optin).length})
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(users.map((u) => u.email).join(', ')); }}
                style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '14px' }}>
                Copy all emails
              </button>
            </div>
          </div>
          )}

          {/* ── Orders ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            {/* ── Order stats chart ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'pending').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>⏳ Pending</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'ordered').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>📦 Ordered</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--ink) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'shipped').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>🚚 Shipped</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📦 Orders to fulfill</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {orders.length > 0 && (
                  <button onClick={() => {
                    const csv = ["Order,Customer,Email,Items,Total,Status,Address"];
                    orders.forEach(o => {
                      const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size})`).join('; ');
                      csv.push(`"${o.order_num}","${o.customer_name}","${o.email}","${items}","€${o.total}","${o.status}","${o.address}"`);
                    });
                    navigator.clipboard.writeText(csv.join('\n'));
                    alert('📋 Orders CSV copied! Paste into Shopify or Excel.');
                  }}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                            📋 Export CSV
                  </button>
                )}
              </div>
            </div>
            {orders.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No orders yet. When a customer checks out, orders appear here.</p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                  {orders.filter(o => o.status === 'pending').length} pending · {orders.filter(o => o.status === 'ordered').length} ordered · {orders.filter(o => o.status === 'shipped').length} shipped
                </p>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Order</th>
                      <th style={{ padding: '8px 10px' }}>Customer</th>
                      <th style={{ padding: '8px 10px' }}>Items</th>
                      <th style={{ padding: '8px 10px' }}>Total</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                      <th style={{ padding: '8px 10px' }}>Supplier</th>
                    </tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} style={{ borderTop: '1px solid var(--line)', background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: '12px' }}>{o.order_num}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div>{o.customer_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.email}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.address}</div>
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '12px' }}>
                            {(Array.isArray(o.items) ? o.items : []).map((it, i) => (
                              <div key={i}>{typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`}</div>
                            ))}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>€{o.total}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <select value={o.status} onChange={async (e) => {
                              await updateOrderStatus(o.id, e.target.value);
                              setOrders(prev => prev.map(ord => ord.id === o.id ? { ...ord, status: e.target.value } : ord));
                            }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', fontWeight: 600,
                                background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 20%, transparent)' : o.status === 'ordered' ? 'color-mix(in oklab, var(--accent) 40%, transparent)' : 'color-mix(in oklab, var(--ink) 20%, transparent)' }}>
                              <option value="pending">⏳ Pending</option>
                              <option value="ordered">📦 Ordered</option>
                              <option value="shipped">🚚 Shipped</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button onClick={() => {
                              const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`).join(', ');
                              const msg = `NEW ORDER\n━━━━━━━━━━━\nOrder: ${o.order_num}\nItem: ${items}\nCustomer: ${o.customer_name}\nAddress: ${o.address}\nEmail: ${o.email}\n━━━━━━━━━━━\nPlease ship to the address above.`;
                              navigator.clipboard.writeText(msg);
                              alert('✅ Order info copied! Paste it into your Alibaba / WhatsApp / DSers chat.');
                            }}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              📋 Copy for supplier
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          )}

          {/* ── Stock bar chart ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Stock levels</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const maxStock = Math.max(...allProds.map(p => p.stock || 0), 1);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {allProds.map(p => (
                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '160px', fontSize: '12px', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <div style={{ flex: 1, height: '22px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${Math.round(((p.stock || 0) / maxStock) * 100)}%`,
                          height: '100%',
                          background: (p.stock || 0) <= 5 ? 'var(--accent)' : (p.stock || 0) <= 15 ? 'color-mix(in oklab, var(--accent) 60%, var(--ink))' : 'color-mix(in oklab, var(--ink) 40%, transparent)',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ width: '30px', fontSize: '12px', fontWeight: 700, color: (p.stock || 0) <= 5 ? 'var(--accent)' : 'var(--muted)' }}>{p.stock || 0}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Stock alerts ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📉 Stock alerts</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const low = allProds.filter(p => p.stock !== undefined && p.stock <= 5);
              if (low.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>All products have sufficient stock.</p>;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {low.map(p => (
                    <span key={p.id || p.product_id} style={{ padding: '6px 12px', background: 'color-mix(in oklab, var(--accent) 15%, transparent)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                      {p.name} — only {p.stock} left
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Edit product panel ── */}
          {adminTab === 'edit' && editProduct && (
            <EditProductPanel key={editProduct.id || editProduct.product_id} product={editProduct} onDone={() => { setEditProduct(null); setAdminTab('saved'); }}
              setCustomProducts={setCustomProducts} />
          )}

          {/* ── Blocked IPs ── */}
          {adminTab === 'blocked' && <BlockedPanel />}

          {/* ── Saved products ── */}
          {adminTab === 'saved' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>⭐ Saved products</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
              const saved = allProds.filter(p => savedIds.includes(p.id || p.product_id));
              if (saved.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No saved products yet. Click ⋮ on any product and select Save.</p>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {saved.map(p => (
                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--line)', borderRadius: '8px' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: p.hue ? `hsl(${p.hue},60%,80%)` : 'var(--line-2)', overflow: 'hidden', flexShrink: 0 }}>
                        {p.img && <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p.brand}{p.brand && p.cat ? ' · ' : ''}{p.cat}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>€{p.price}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => {
                          setEditProduct(p);
                          setAdminTab('edit');
                        }}
                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => {
                          const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
                          const newIds = savedIds.filter(id => id !== (p.id || p.product_id));
                          localStorage.setItem('rw_admin_saved', JSON.stringify(newIds));
                          setAdminTab('users');
                          setTimeout(() => setAdminTab('saved'), 0);
                        }}
                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Product stats ── */}
          {adminTab === 'products' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Product stats</h3>
            <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }} />
            {(() => {
              // Count favorites per product from all users
              const favCounts = {};
              users.forEach(u => {
                (u.product_ids || []).forEach(pid => {
                  if (!favCounts[pid]) favCounts[pid] = { count: 0, users: [] };
                  favCounts[pid].count++;
                  if (!favCounts[pid].users.includes(u.email)) favCounts[pid].users.push(u.email);
                });
              });
              // Build product list from all products + custom products
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const productStats = allProds.filter(p => {
                const name = p.name?.toLowerCase() || '';
                const brand = p.brand?.toLowerCase() || '';
                const q = productSearch.toLowerCase();
                return !q || name.includes(q) || brand.includes(q);
              }).map(p => ({
                ...p,
                favs: favCounts[p.id || p.product_id]?.count || 0,
                favUsers: favCounts[p.id || p.product_id]?.users || [],
              })).sort((a, b) => b.favs - a.favs);

              if (productStats.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No products found.</p>;
              return (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Product</th>
                      <th style={{ padding: '8px 12px' }}>Brand</th>
                      <th style={{ padding: '8px 12px' }}>Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>⭐ Favs</th>
                      <th style={{ padding: '8px 12px' }}>Users</th>
                    </tr></thead>
                    <tbody>
                      {productStats.map(p => (
                        <tr key={p.id || p.product_id} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name || 'Unnamed'}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.brand || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>{p.cat}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{p.favs}</td>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.favUsers.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
          )}

          {adminTab === 'products' && (
          <ProductForm editProduct={editProduct} onClearEdit={() => setEditProduct(null)}
            customProducts={customProducts} setCustomProducts={setCustomProducts} />
          )}
        </>
      )}
    </div>
  );
}

/* ── Blocked Emails Panel ── */
function BlockedPanel() {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  const loadAll = async () => {
    try {
      const [re, ru] = await Promise.all([
        fetch('/api/admin/blocked-emails').then(r => r.json()),
        fetch('/api/admin/user-emails').then(r => r.json()),
      ]);
      setEmails(re.emails || []);
      setAllUsers(ru.emails || []);
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { loadAll(); }, []);

  const blockEmail = async (email) => {
    if (!email) return;
    await fetch('/api/admin/block-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    setNewEmail(''); loadAll();
  };

  const unblockEmail = async (email) => {
    await fetch('/api/admin/unblock-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    loadAll();
  };

  const blockedEmails = new Set(emails.map(e => e.email));
  const unblockedUsers = allUsers.filter(email => !blockedEmails.has(email));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🚫 Blocked Emails</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>Blocked users will see a permanent notice when they try to checkout: <em>"Contact orders@rewind-stores.com to appeal."</em></p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input className="rw-input" placeholder="user@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newEmail.trim()) blockEmail(newEmail.trim()); }} />
          <button onClick={() => blockEmail(newEmail.trim())} disabled={!newEmail.trim()}
            style={{ padding: '10px 20px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>Block</button>
        </div>
        {loading ? <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</p> : emails.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No blocked emails.</p>
        ) : emails.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: '13px' }}>{e.email}</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(e.created_at).toLocaleDateString()}</span>
            <button onClick={() => unblockEmail(e.email)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)' }}>Unblock</button>
          </div>
        ))}
      </div>
      {unblockedUsers.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>👥 All Users</h3>
          {unblockedUsers.map(email => (
            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: '13px' }}>{email}</span>
              <button onClick={() => blockEmail(email)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)' }}>Block</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Edit Product Panel ── */
function EditProductPanel({ product, onDone, setCustomProducts }) {
  const [form, setForm] = React.useState(() => ({
    name: product.name || '', brand: product.brand || '', cat: product.cat || '',
    price: product.price?.toString() || '', was: product.was?.toString() || '',
    stock: product.stock?.toString() || '10', sizes: (product.sizes || ['S','M','L','XL']).join(','),
    material: product.material || '', note: product.note || '',
  }));
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const result = await updateCustomProduct(product.product_id || product.id, {
      name: form.name, brand: form.brand, cat: form.cat,
      price: parseFloat(form.price) || 0, was: form.was ? parseFloat(form.was) : null,
      stock: parseInt(form.stock) || 10,
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
      material: form.material || '', note: form.note || '',
    });
    setSaving(false);
    if (result) {
      setMsg('✅ Updated');
      getCustomProducts().then(setCustomProducts);
      setTimeout(onDone, 600);
    } else {
      setMsg('❌ Failed');
    }
  };

  const labelStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' };
  const inputStyle = { display: 'block', width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const btnStyle = { padding: '14px 28px', borderRadius: '999px', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' };

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Edit product</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{product.name}</h3>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{product.brand}{product.brand && product.cat ? ' · ' : ''}{product.cat}</div>
        </div>
        <button onClick={onDone}
          style={{ padding: '10px 18px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
          ← Back to saved
        </button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: 600,
          background: msg.includes('✅') ? 'color-mix(in oklab, var(--ink) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 10%, transparent)', color: msg.includes('✅') ? 'var(--ink)' : 'var(--accent)' }}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Image */}
        <div style={{ marginBottom: '28px' }}>
          <div style={labelStyle}>Product photo</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
            <div style={{ width: '160px', height: '200px', borderRadius: '12px', overflow: 'hidden', background: product.hue ? `hsl(${product.hue},50%,88%)` : '#f0ece6', flexShrink: 0 }}>
              {product.img
                ? <img src={product.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '13px', color: 'var(--muted)' }}>No photo</div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
                To change the photo, you'll need to delete this product and re-add it with the new image. All other fields can be edited here.
              </p>
            </div>
          </div>
        </div>

        {/* Name + Brand row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={labelStyle}>Product name</div>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} placeholder="e.g. Vintage Nike Windbreaker" />
          </div>
          <div>
            <div style={labelStyle}>Brand</div>
            <input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} style={inputStyle} placeholder="e.g. Ralph Lauren" />
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Category</div>
          <select value={form.cat} onChange={e => setForm({...form, cat: e.target.value})}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
            {REWIND_CATS.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Price row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={labelStyle}>Current price (€)</div>
            <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} style={inputStyle} placeholder="95.00" />
          </div>
          <div>
            <div style={labelStyle}>Original price (€)</div>
            <input type="number" step="0.01" value={form.was} onChange={e => setForm({...form, was: e.target.value})} style={inputStyle} placeholder="120.00" />
          </div>
        </div>

        {/* Stock */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Stock (shows "Only X left" when ≤ 5)</div>
          <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} style={{...inputStyle, maxWidth: '120px'}} />
        </div>

        {/* Sizes */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Sizes</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(form.cat === 'Shoes' ? ['36','37','38','39','40','41','42','43','44','45','46','47'] : ['XS','S','M','L','XL','XXL']).map(s => {
              const active = form.sizes.split(',').map(x => x.trim()).includes(s);
              return (
                <button key={s} type="button" onClick={() => {
                  const current = form.sizes.split(',').map(x => x.trim()).filter(Boolean);
                  const next = active ? current.filter(x => x !== s) : [...current, s];
                  setForm({...form, sizes: next.join(',')});
                }}
                  style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    border: active ? '2px solid var(--ink)' : '1px solid var(--line-2)',
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? 'var(--bg)' : 'var(--muted)',
                    cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!active) { e.target.style.borderColor = 'var(--line)'; e.target.style.transform = 'scale(1.05)'; } }}
                  onMouseOut={e => { if (!active) { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; } }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Material */}
        <div style={{ marginBottom: '28px' }}>
          <div style={labelStyle}>Material</div>
          <input value={form.material} onChange={e => setForm({...form, material: e.target.value})} style={inputStyle} placeholder="e.g. 100% cotton pique, fleece" />
        </div>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button type="submit" disabled={saving}
            style={{...btnStyle, background: saving ? 'var(--line-2)' : 'var(--ink)', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button type="button" onClick={onDone}
            style={{ padding: '14px 28px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── First-visit survey ── */
function Survey({ onDone, onSkip }) {
  const [step, setStep] = useState('choose');
  const [source, setSource] = useState('');
  const [otherText, setOtherText] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    const answer = source === 'Other' ? otherText : source;
    try { await fetch('/api/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: answer }) }); } catch {}
    setDone(true);
    setTimeout(() => onDone(), 1500);
  };

  const options = ['Social media', 'Vinted', 'Grailed', 'Google', 'From a friend', 'Other'];
  return (
    <div>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🙏</div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', margin: '0' }}>Thanks for letting us know!</p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>Enjoy browsing REWIND.</p>
        </div>
      ) : (
      <>
      {options.map(o => (
        <button key={o} onClick={() => { setSource(o); if (o === 'Other') setStep('other'); else submit(); }}
          style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '8px', borderRadius: '8px', border: '1px solid var(--line)', background: source === o ? 'var(--ink)' : 'var(--surface)', color: source === o ? '#fff' : 'var(--ink)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', textAlign: 'center', transition: 'all 0.15s' }}
          onMouseOver={e => { if (source !== o) { e.target.style.background = 'var(--line)'; e.target.style.transform = 'translateY(-1px)'; } }}
          onMouseOut={e => { if (source !== o) { e.target.style.background = 'var(--surface)'; e.target.style.transform = ''; } }}>
          {o}
        </button>
      ))}
      {step === 'other' && (
        <div style={{ marginTop: '12px' }}>
          <input className="rw-input" placeholder="Tell us where..." value={otherText} onChange={e => setOtherText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && otherText.trim()) submit(); }} autoFocus />
          <button onClick={submit} disabled={!otherText.trim()}
            style={{ marginTop: '8px', padding: '10px 20px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontWeight: 600, width: '100%', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
            Submit
          </button>
        </div>
      )}
      <button onClick={onSkip} style={{ marginTop: '12px', padding: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '12px', transition: 'color 0.15s' }}
        onMouseOver={e => e.target.style.color = 'var(--ink)'}
        onMouseOut={e => e.target.style.color = 'var(--muted)'}>Skip</button>
      </>)}
    </div>
  );
}

// ── Blocked email check ──
const EMAIL_CODES = {}; // email → blocked status cache

async function checkBlockedEmail(email, showToast) {
  if (!email || EMAIL_CODES[email] === false) return false;
  try {
    const r = await fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const d = await r.json();
    EMAIL_CODES[email] = d.blocked;
    if (d.blocked) {
      showToast('🚫 Your email has been blocked. Contact orders@rewind-stores.com to appeal.', { label: 'OK', onClick: () => {} }, 8000);
    }
    return d.blocked;
  } catch { return false; }
}
function ProductForm({ editProduct, onClearEdit, customProducts, setCustomProducts }) {
  const [form, setForm] = React.useState({
    name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: []
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [showCustomCat, setShowCustomCat] = React.useState(false);
  const [showProduct, setShowProduct] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const fileRef = React.useRef(null);
  const catOptions = [...REWIND_CATS.filter(c => c !== 'All'), 'Other'];

  // Load product for editing when editProduct prop changes
  React.useEffect(() => {
    if (editProduct) {
      setForm({
        name: editProduct.name || '', brand: editProduct.brand || '', cat: editProduct.cat || '',
        catCustom: '', price: editProduct.price?.toString() || '', was: editProduct.was?.toString() || '',
        stock: editProduct.stock?.toString() || '10', sizes: (editProduct.sizes || ['S','M','L','XL']).join(','),
        material: editProduct.material || '', note: editProduct.note || '', file: null, files: [],
      });
      setEditingId(editProduct.product_id || editProduct.id);
      setMsg('✏️ Editing: ' + editProduct.name);
    }
  }, [editProduct]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const cat = form.cat === 'Other' ? form.catCustom : form.cat;
    if (!form.name || !cat || !form.price) {
      setMsg('❌ Name, category, and price are required'); setSaving(false); return;
    }
    const productId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const product = {
      product_id: productId, name: form.name, brand: form.brand || '', cat,
      price: parseFloat(form.price), was: form.was ? parseFloat(form.was) : null,
      stock: form.stock || 5, hue: Math.floor(Math.random() * 360), img: '', note: form.note || '',
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean), material: form.material || '',
    };
    // Upload images if selected
    if (form.files?.length) {
      const url = await uploadProductImage(form.files[0], productId);
      if (url) product.img = url;
      // Upload additional images if any
      for (let i = 1; i < form.files.length; i++) {
        await uploadProductImage(form.files[i], `${productId}-${i}`);
      }
    }
    // Save or update
    if (editingId) {
      const result = await updateCustomProduct(editingId, { name: form.name, brand: form.brand, cat, price: parseFloat(form.price), was: form.was ? parseFloat(form.was) : null, stock: parseInt(form.stock) || 10, sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean), material: form.material || '', note: form.note || '' });
      if (result) {
        setMsg(`✅ "${form.name}" updated!`);
        setEditingId(null);
        if (onClearEdit) onClearEdit();
        setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [] });
        getCustomProducts().then(setCustomProducts);
      } else { setMsg('❌ Failed to update.'); }
    } else {
      const result = await addCustomProduct(product);
      if (result) {
        setMsg(`✅ "${form.name}" added! `);
        setShowProduct(productId);
        setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [] });
        if (fileRef.current) fileRef.current.value = '';
      } else { setMsg('❌ Failed to save.'); }
    }
    setSaving(false);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
        {editingId ? '✏️ Edit product' : '📦 Add new product'}
        {editingId && <button onClick={() => { setEditingId(null); setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [] }); if (onClearEdit) onClearEdit(); }}
          style={{ marginLeft: '10px', padding: '4px 10px', borderRadius: '6px', background: 'var(--line)', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Cancel edit</button>}
      </h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <input className="rw-input" placeholder="Product name *" value={form.name}
            onChange={e => setForm({...form, name: e.target.value})} required />
          <input className="rw-input" placeholder="Brand (e.g. Nike)" value={form.brand}
            onChange={e => setForm({...form, brand: e.target.value})} />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <select className="rw-input"
            value={showCustomCat ? 'Other' : form.cat}
            onChange={e => { setForm({...form, cat: e.target.value}); setShowCustomCat(e.target.value === 'Other'); }}>
            <option value="">Select category *</option>
            {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {showCustomCat && (
            <input className="rw-input" placeholder="New category name" value={form.catCustom}
              onChange={e => setForm({...form, catCustom: e.target.value})} />
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <input className="rw-input" type="number" step="0.01" placeholder="Price * (€)" value={form.price}
            onChange={e => setForm({...form, price: e.target.value})} required />
          <input className="rw-input" type="number" step="0.01" placeholder="Original price (€)" value={form.was}
            onChange={e => setForm({...form, was: e.target.value})} />
        </div>
        <input className="rw-input" type="number" min="0" placeholder="Stock (e.g. 3)" value={form.stock}
          onChange={e => setForm({...form, stock: e.target.value})} style={{ marginBottom: '12px' }} />
        <input className="rw-input" placeholder="Sizes (comma separated)" value={form.sizes}
          onChange={e => setForm({...form, sizes: e.target.value})} style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
          <input className="rw-input" placeholder="Material (e.g. 100% cotton, fleece)" value={form.material}
            onChange={e => setForm({...form, material: e.target.value})} />
        </div>
        <textarea className="rw-input" placeholder="Description / product notes (appears on product page)"
          value={form.note}
          onChange={e => setForm({...form, note: e.target.value})}
          rows={3}
          style={{ marginBottom: '12px', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
          {form.file && (<div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button"
              onClick={async () => {
                const reader = new FileReader();
                reader.onload = () => {
                  const prompt = "I'm listing a vintage streetwear item. Look at this photo and describe only the product. Do NOT mention the filename, 'WhatsApp', 'image', or any file metadata. Respond with:\n\nTITLE: (short product name, max 6 words)\nDESCRIPTION: (2-3 sentences describing the item — material, era, colors, style, brand clues)\n\nOnly respond with the title and description, nothing else.";
                  navigator.clipboard.writeText(prompt);
                  window.open('https://gemini.google.com/app', '_blank');
                  setMsg('✅ Prompt copied! Paste it into Gemini (tab opened). Then copy the response back here.');
                };
                reader.readAsDataURL(form.file);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              📋 Copy to Gemini
            </button>
            <button type="button"
              onClick={async () => {
                const reader = new FileReader();
                reader.onload = () => {
                  const prompt = "Enhance this product photo for a streetwear store listing. Remove any creases and wrinkles from the fabric. Make the background pure white (#FAF6EF). Improve contrast and lighting so the item pops. Keep the product exactly as it is — just make it look professionally photographed.";
                  navigator.clipboard.writeText(prompt);
                  window.open('https://gemini.google.com/app', '_blank');
                  setMsg('✅ Enhancement prompt copied! Paste into Gemini (tab opened) along with your photo.');
                };
                reader.readAsDataURL(form.file);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid color-mix(in oklab, var(--ink) 30%, transparent)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              🎨 Enhance photo
            </button>
            <button type="button"
              onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.disabled = true;
                btn.textContent = '⏳ Generating...';
                try {
                  const img = new Image();
                  const url = URL.createObjectURL(form.file);
                  const base64 = await new Promise((resolve) => {
                    img.onload = () => {
                      const c = document.createElement('canvas');
                      let w = img.width, h = img.height;
                      const m = 1200;
                      if (w > m || h > m) { if (w > h) { h = Math.round(h*m/w); w = m; } else { w = Math.round(w*m/h); h = m; } }
                      c.width = w; c.height = h;
                      c.getContext('2d').drawImage(img, 0, 0, w, h);
                      resolve(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                  });
                  const r = await fetch('/api/generate-description', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64 }) });
                  const d = await r.json();
                  if (d.description || d.title) {
                    setForm(prev => ({ ...prev, name: d.title || prev.name, note: d.description || '' }));
                    btn.textContent = '✅ Generated';
                  } else {
                    btn.textContent = '❌ ' + ((d.error || '').slice(0, 30) || 'Failed');
                    setMsg('❌ AI Error: ' + (d.error || 'Failed'));
                  }
                } catch (e) {
                  btn.textContent = '❌ Error';
                  setMsg('❌ Network Error: ' + e.message);
                }
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
              ✨ Generate from photo
            </button>
            </div>
          </div>)}
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'inline-block',
            padding: '10px 20px',
            borderRadius: '999px',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 4px 12px color-mix(in oklab, var(--accent) 40%, transparent)'; }}
            onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
            📁 Choose files
            <input ref={fileRef} type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.pdf,.svg"
              multiple
              onChange={e => {
                const files = Array.from(e.target.files);
                setForm({...form, file: files[0] || null, files});
              }}
              style={{ display: 'none' }} />
          </label>
          {form.files?.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
              {form.files.length} file{form.files.length > 1 ? 's' : ''} selected
              {form.files.map((f, i) => (
                <span key={i} style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {form.file && (
          <div style={{ marginTop: '16px', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', background: 'var(--bg)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>📱 Storefront preview</p>
            <div style={{ background: 'var(--surface)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ background: form.hue ? `hsl(${form.hue},60%,85%)` : 'var(--line)', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src={URL.createObjectURL(form.file)} style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
              </div>
              <div style={{ padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px' }}>{form.cat?.toUpperCase() || 'CATEGORY'}</span>
                {form.brand && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>— {form.brand}</span>}
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--ink)' }}>{form.name || 'Product name'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>{form.price ? `€${form.price}` : '€--'}</span>
                  {form.was && <span style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'line-through' }}>€{form.was}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {form.sizes.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '11px', color: 'var(--muted)' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            {form.note && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontStyle: 'italic' }}>{form.note}</p>}
          </div>
        )}
        {msg && <p style={{ fontSize: '14px', marginBottom: '10px' }}>{msg}
          {showProduct && <button onClick={() => { window.location.hash = '/product/' + showProduct; }}
            style={{ marginLeft: '8px', padding: '4px 10px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            👁 View on store
          </button>}
        </p>}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button type="submit" disabled={saving}
        style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
        onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
        onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
        {saving ? 'Saving...' : editingId ? '💾 Save changes' : '➕ Add product'}
        </button>
        </div>
      </form>
    </div>
  );
}
// trigger
