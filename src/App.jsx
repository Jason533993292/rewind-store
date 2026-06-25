import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Banner, Header, Hero, Marquee, Toast, Footer } from './components/Shell';
import { ProductGrid, QuickView, CartDrawer, Checkout, SignupModal, WishlistDrawer } from './components/Shop';
import { TweaksPanel, useTweaks, TweakSection, TweakToggle, TweakColor, TweakRadio } from './components/Tweaks';
import { REWIND_PRODUCTS, REWIND_CATS, BRANDS } from './data';
import { getWishlist, saveWishlist, signupUser, supabase, getCustomProducts, addCustomProduct, uploadProductImage, saveOrder, getOrders, updateOrderStatus } from './lib/supabase';
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

export default function App() {
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
  const [checkout, setCheckout] = useState(false);
  const [toast, setToast] = useState(null);
  const [brand, setBrand] = useState(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('rw_email') || '');
  const [wishlist, setWishlist] = useState([]);
  const [pendingWishlistId, setPendingWishlistId] = useState(null);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlistReady, setWishlistReady] = useState(false);
  const [customProducts, setCustomProducts] = useState([]);

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

  const products = useMemo(() => {
    const allProducts = [...REWIND_PRODUCTS, ...customProducts];
    return allProducts.filter((p) =>
      (cat === 'All' || p.cat === cat) &&
      (!brand || p.brand === brand) &&
      (query.trim() === '' || (p.name + ' ' + p.cat).toLowerCase().includes(query.toLowerCase()))
    );
  }, [cat, brand, query, customProducts]);

  const cartCount = cart.reduce((s, it) => s + it.qty, 0);

  const showToast = useCallback((msg, action) => {
    setToast({ msg, k: Date.now(), action });
    setTimeout(() => setToast((cur) => (cur && cur.k && Date.now() - cur.k >= 2300 ? null : cur)), 2400);
  }, []);

  const addToCart = useCallback((p, size) => {
    const sz = size || p.sizes[0];
    const key = p.id + '-' + sz;
    setCart((c) => {
      const found = c.find((it) => it.key === key);
      if (found) return c.map((it) => it.key === key ? { ...it, qty: it.qty + 1 } : it);
      return [...c, { key, id: p.id, name: p.name, price: p.price, was: p.was, hue: p.hue, size: sz, qty: 1 }];
    });
    showToast(p.name + ' added to bag');
  }, [showToast]);

  const quickAdd = useCallback((p) => { addToCart(p); setDrawer(true); }, [addToCart]);
  const addFromQuick = useCallback((p, size) => { addToCart(p, size); setQuick(null); setDrawer(true); }, [addToCart]);
  const changeQty = useCallback((key, d) => { setCart((c) => c.map((it) => it.key === key ? { ...it, qty: Math.max(1, it.qty + d) } : it)); }, []);
  const removeItem = useCallback((key) => { setCart((c) => c.filter((it) => it.key !== key)); }, []);
  const goCheckout = useCallback(() => { setDrawer(false); setCheckout(true); }, []);
  const orderPlaced = useCallback(() => { setCart([]); setCheckout(false); }, []);

  const handleWishlist = useCallback((p) => {
    if (!userEmail) {
      setPendingWishlistId(p.id);
      setSignupOpen(true);
      return;
    }
    setWishlist((prev) => {
      const exists = prev.includes(p.id);
      if (!exists) {
        showToast(p.name + ' saved', {
          label: 'Show',
          onClick: () => setWishlistOpen(true),
        });
      }
      return exists ? prev.filter((id) => id !== p.id) : [...prev, p.id];
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

  const headingId = 'the-drop';
  const scrollToGrid = useCallback(() => {
    const el = document.getElementById(headingId);
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
  }, []);

  const currentBrands = cat !== 'All' ? BRANDS[cat] || [] : [];

  // ── Admin mode ──
  const [adminMode, setAdminMode] = useState(window.location.hash === '#admin');
  const [blocked, setBlocked] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [infoPage, setInfoPage] = useState(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Handle back/forward navigation for product page
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
      setAdminMode(window.location.hash === '#admin');
      if (window.location.hash.startsWith('#/product/')) {
        const pid = window.location.hash.replace('#/product/', '');
        const allProds = [...REWIND_PRODUCTS, ...customProducts];
        const p = allProds.find(x => (x.id || x.product_id) === pid);
        if (p) setSelectedProduct(p);
      }
    };
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#FAF6EF', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</h1>
        <h2 style={{ fontSize: '24px', color: '#16130F', marginBottom: '8px' }}>Access restricted</h2>
        <p style={{ fontSize: '16px', color: '#6E665A', maxWidth: '400px' }}>This account has been blocked from accessing REWIND. If you think this is a mistake, please contact us.</p>
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
          query={query} setQuery={setQuery} cats={REWIND_CATS} />
        <ProductPage p={selectedProduct} onBack={() => setSelectedProduct(null)}
          onAdd={(p, size) => { addToCart(p, size); setDrawer(true); }} />
      </div>
    );
  }

  return (
    <div className="rw-app">
      {t.showBanner && <Banner showCountdown={t.showCountdown} />}
      <Header cat={cat} setCat={(c) => { setCat(c); scrollToGrid(); }} cartCount={cartCount}
        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
        onWishlistOpen={() => setWishlistOpen(true)}
        query={query} setQuery={setQuery} cats={REWIND_CATS} />
      <Hero onShop={scrollToGrid} />
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
            background: '#f0ece6',
            borderRadius: '12px',
            padding: '20px 16px',
            position: 'sticky',
            top: '20px',
            alignSelf: 'flex-start',
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#16130F', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Categories</h3>
            {REWIND_CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                  borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: cat === c ? 700 : 400,
                  background: cat === c ? '#16130F' : 'transparent',
                  color: cat === c ? '#fff' : '#16130F',
                  marginBottom: '4px',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => { if (cat !== c) e.target.style.background = '#ddd'; }}
                onMouseOut={e => { if (cat !== c) e.target.style.background = 'transparent'; }}>
                {c === 'All' ? 'All' : c}
              </button>
            ))}

            {cat !== 'All' && currentBrands.length > 0 && (
              <>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#16130F', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Brands</h3>
                <button onClick={() => setBrand(null)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                    borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
                    background: !brand ? '#16130F' : 'transparent',
                    color: !brand ? '#fff' : '#16130F',
                    fontWeight: !brand ? 700 : 400,
                    marginBottom: '2px',
                  }}>All</button>
                {currentBrands.map((b) => (
                  <button key={b} onClick={() => setBrand(b)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                      borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
                      background: brand === b ? '#16130F' : 'transparent',
                      color: brand === b ? '#fff' : '#16130F',
                      fontWeight: brand === b ? 700 : 400,
                      marginBottom: '2px',
                    }}>{b}</button>
                ))}
              </>
            )}
          </aside>
          <div className="rw-shop-content">
            <ProductGrid products={products} showCompare={t.showCompare} showStock={t.showStock}
              onQuick={setQuick} onAdd={quickAdd}
              wishlist={wishlist} onWishlist={handleWishlist} onSelect={setSelectedProduct} />
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
      <Checkout open={checkout} items={cart} onClose={() => setCheckout(false)} onPlaced={orderPlaced} />
      <Toast toast={toast} />
      <SignupModal open={signupOpen} onClose={() => setSignupOpen(false)} onSignup={handleSignup} />
      <WishlistDrawer open={wishlistOpen} items={wishlist}
        onClose={() => setWishlistOpen(false)}
        onRemove={(id) => setWishlist((prev) => prev.filter((i) => i !== id))}
        onAddToCart={(p) => { addToCart(p); setDrawer(true); }} />

      {/* ── Promo code button ── */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
        <button onClick={() => setPromoOpen(true)}
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: '#16130F', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: '18px', fontWeight: 700,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s',
          }}
          onMouseOver={e => e.target.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.target.style.transform = ''}>
          💬
        </button>
      </div>

      {promoOpen && (
        <div className="rw-modal-wrap" onClick={() => setPromoOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: '80px', right: '24px',
              background: '#fff', borderRadius: '12px', padding: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              width: '260px', zIndex: 1001,
            }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700 }}>Got a promo code?</h4>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#888' }}>Enter it below and get a discount.</p>
            <input className="rw-input" placeholder="Enter code" value={promoCode}
              onChange={e => setPromoCode(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (promoCode === '74421') {
                    window.location.hash = 'admin';
                  } else if (promoCode) {
                    setPromoMsg('✅ Promo applied! (mock)');
                  }
                }
              }}
              style={{ marginBottom: '8px' }} />
            <button onClick={() => {
              if (promoCode === '74421') {
                window.location.hash = 'admin';
              } else if (promoCode) {
                setPromoMsg('✅ Promo applied! (mock)');
              }
            }}
              style={{ padding: '8px 20px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Apply
            </button>
            {promoMsg && <p style={{ fontSize: '12px', marginTop: '8px', color: '#4caf50' }}>{promoMsg}</p>}
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
          style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
          ← Back to store
        </button>
      </div>

      {/* ── Admin login ── */}
      {adminChecking && <p style={{ textAlign: 'center', color: '#888' }}>Checking access...</p>}

      {!adminChecking && !adminAuthed && (
        <div style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>🔐 Admin Access</h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>Enter your email to access the admin panel.</p>
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
            style={{ padding: '10px 24px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            Enter admin panel
          </button>
          <p style={{ fontSize: '12px', color: '#e53935', marginTop: '8px' }}>{adminMsg}</p>
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
          { id: 'products', label: '🛍️ Products' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setAdminTab(tab.id)}
            style={{
              padding: '10px 20px', borderRadius: '999px', border: 'none',
              background: adminTab === tab.id ? '#16130F' : '#f0f0f0',
              color: adminTab === tab.id ? '#fff' : '#16130F',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {!supabase && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666', background: '#f9f9f9', borderRadius: '12px' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Supabase not connected</p>
          <p style={{ fontSize: '14px' }}>Set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then redeploy.</p>
        </div>
      )}

      {supabase && loading && <p>Loading users...</p>}

      {supabase && !loading && users.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <p>No users signed up yet. Sign up on the storefront to see data here.</p>
        </div>
      )}

      {supabase && !loading && users.length > 0 && adminTab === 'users' && (
        <>
          {/* ── User table ── */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Email</th>
                  <th style={{ padding: '12px 16px' }}>Wishlist</th>
                  <th style={{ padding: '12px 16px' }}>Marketing</th>
                  <th style={{ padding: '12px 16px' }}>Signed up</th>
                  <th style={{ padding: '12px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} style={{ borderTop: '1px solid #eee', background: u.blocked ? '#fff0f0' : 'transparent' }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedUser(selectedUser?.email === u.email ? null : u);
                    }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, cursor: 'context-menu' }}>
                      {u.email} {u.blocked && <span style={{ fontSize: '11px', color: '#e53935' }}>🚫</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.product_ids?.length || 0} items
                      {u.product_ids?.length > 0 && (
                        <button onClick={() => setSelectedUser(selectedUser?.email === u.email ? null : u)}
                          style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                          {selectedUser?.email === u.email ? 'Hide' : 'View'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{u.marketing_optin ? '✅' : '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#888', fontSize: '13px' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <a href={`mailto:${u.email}`} style={{ color: '#666', textDecoration: 'none', fontSize: '16px' }}>✉️</a>
                      <button onClick={() => toggleBlockUser(u.email, !u.blocked)}
                        style={{
                          marginLeft: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: u.blocked ? '#4caf50' : '#e53935',
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
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                {selectedUser.email}'s wishlist
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedUser.product_ids?.map((pid) => {
                  const product = [...REWIND_PRODUCTS, ...customProducts].find((p) => p.id === pid || p.product_id === pid);
                  return (
                    <a key={pid} href="#"
                      onClick={(e) => { e.preventDefault(); window.location.hash = ''; setSelectedProduct(product); }}
                      style={{ padding: '6px 12px', background: '#f0f0f0', borderRadius: '6px', fontSize: '13px', textDecoration: 'none', color: '#16130F', display: 'inline-block', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseOver={e => e.target.style.background = '#e0e0e0'}
                      onMouseOut={e => e.target.style.background = '#f0f0f0'}
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
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.length}</div>
              <div style={{ fontSize: '11px', color: '#888' }}>Total users</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.filter((u) => u.marketing_optin).length}</div>
              <div style={{ fontSize: '11px', color: '#888' }}>Marketing opt-in</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.reduce((s, u) => s + (u.product_ids?.length || 0), 0)}</div>
              <div style={{ fontSize: '11px', color: '#888' }}>Total saved items</div>
            </div>
          </div>

          {/* ── Run Tests ── */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🧪 Automated tests</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
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
                    `<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
                      <span>${r.status}</span>
                      <span style="font-weight:600;margin:0 8px">${r.name}</span>
                      <span style="color:#888;font-size:12px">${r.detail}</span>
                    </div>`
                  ).join('');
                }
              } catch (e) {
                btn.textContent = '❌ Tests failed';
              }
              setTimeout(() => { btn.textContent = '🧪 Run tests'; btn.disabled = false; }, 5000);
            }}
              style={{ padding: '10px 20px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
              🧪 Run tests
            </button>
            <div id="test-results" style={{ marginTop: '16px', maxHeight: '300px', overflow: 'auto' }} />
          </div>
          </>)
}

          {/* ── Email tool ── */}
          {adminTab === 'email' && (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📧 Email users about discounts / sales</h3>
            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)}
              placeholder="Write your email message here... (or leave blank for default)"
              rows={5}
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', resize: 'vertical', marginBottom: '8px' }} />
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
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
                style={{ padding: '10px 20px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
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
                style={{ padding: '10px 20px', borderRadius: '999px', background: '#FF4D14', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                📩 Email opted-in only ({users.filter((u) => u.marketing_optin).length})
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(users.map((u) => u.email).join(', ')); }}
                style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                Copy all emails
              </button>
            </div>
          </div>
          )}

          {/* ── Orders ── */}
          {adminTab === 'orders' && (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            {/* ── Order stats chart ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: '#f0ece6', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.length}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>Total</div>
              </div>
              <div style={{ background: '#fff3cd', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'pending').length}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>⏳ Pending</div>
              </div>
              <div style={{ background: '#cce5ff', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'ordered').length}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>📦 Ordered</div>
              </div>
              <div style={{ background: '#d4edda', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'shipped').length}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>🚚 Shipped</div>
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
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                    📋 Export CSV
                  </button>
                )}
              </div>
            </div>
            {orders.length === 0 ? (
              <p style={{ color: '#888', fontSize: '14px' }}>No orders yet. When a customer checks out, orders appear here.</p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
                  {orders.filter(o => o.status === 'pending').length} pending · {orders.filter(o => o.status === 'ordered').length} ordered · {orders.filter(o => o.status === 'shipped').length} shipped
                </p>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Order</th>
                      <th style={{ padding: '8px 10px' }}>Customer</th>
                      <th style={{ padding: '8px 10px' }}>Items</th>
                      <th style={{ padding: '8px 10px' }}>Total</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                      <th style={{ padding: '8px 10px' }}>Supplier</th>
                    </tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} style={{ borderTop: '1px solid #f0f0f0', background: o.status === 'pending' ? '#fffef5' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: '12px' }}>{o.order_num}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div>{o.customer_name}</div>
                            <div style={{ fontSize: '11px', color: '#888' }}>{o.email}</div>
                            <div style={{ fontSize: '11px', color: '#aaa' }}>{o.address}</div>
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
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', fontWeight: 600,
                                background: o.status === 'pending' ? '#fff3cd' : o.status === 'ordered' ? '#cce5ff' : '#d4edda' }}>
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
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #FF4D14', background: '#fff', color: '#FF4D14', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Stock levels</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const maxStock = Math.max(...allProds.map(p => p.stock || 0), 1);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {allProds.map(p => (
                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '160px', fontSize: '12px', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <div style={{ flex: 1, height: '22px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${Math.round(((p.stock || 0) / maxStock) * 100)}%`,
                          height: '100%',
                          background: (p.stock || 0) <= 5 ? '#e53935' : (p.stock || 0) <= 15 ? '#FF4D14' : '#4caf50',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ width: '30px', fontSize: '12px', fontWeight: 700, color: (p.stock || 0) <= 5 ? '#e53935' : '#888' }}>{p.stock || 0}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Stock alerts ── */}
          {adminTab === 'orders' && (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📉 Stock alerts</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const low = allProds.filter(p => p.stock !== undefined && p.stock <= 5);
              if (low.length === 0) return <p style={{ color: '#888', fontSize: '14px' }}>All products have sufficient stock.</p>;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {low.map(p => (
                    <span key={p.id || p.product_id} style={{ padding: '6px 12px', background: '#fff3cd', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                      {p.name} — only {p.stock} left
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Saved products ── */}
          {adminTab === 'saved' && (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>⭐ Saved products</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
              const saved = allProds.filter(p => savedIds.includes(p.id || p.product_id));
              if (saved.length === 0) return <p style={{ color: '#888', fontSize: '14px' }}>No saved products yet. Click ⋮ on any product and select Save.</p>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {saved.map(p => (
                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: p.hue ? `hsl(${p.hue},60%,80%)` : '#eee', overflow: 'hidden', flexShrink: 0 }}>
                        {p.img && <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{p.brand}{p.brand && p.cat ? ' · ' : ''}{p.cat}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#FF4D14' }}>€{p.price}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => {
                          localStorage.setItem('rw_edit_product', p.id || p.product_id);
                          window.location.hash = '/admin';
                        }}
                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
                          style={{ padding: '6px 12px', borderRadius: '6px', background: '#fff', border: '1px solid #ddd', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
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
                          style={{ padding: '6px 12px', borderRadius: '6px', background: '#e53935', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
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
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Product stats</h3>
            <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }} />
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

              if (productStats.length === 0) return <p style={{ color: '#888', fontSize: '14px' }}>No products found.</p>;
              return (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Product</th>
                      <th style={{ padding: '8px 12px' }}>Brand</th>
                      <th style={{ padding: '8px 12px' }}>Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>⭐ Favs</th>
                      <th style={{ padding: '8px 12px' }}>Users</th>
                    </tr></thead>
                    <tbody>
                      {productStats.map(p => (
                        <tr key={p.id || p.product_id} style={{ borderTop: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name || 'Unnamed'}</td>
                          <td style={{ padding: '8px 12px', color: '#888' }}>{p.brand || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>{p.cat}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{p.favs}</td>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: '#888', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.favUsers.join(', ') || '—'}</td>
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
          <ProductForm />
          )}
        </>
      )}
    </div>
  );
}

/* ── Product Form (separate component) ── */
function ProductForm() {
  const [form, setForm] = React.useState({
    name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: []
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [showCustomCat, setShowCustomCat] = React.useState(false);
  const [showProduct, setShowProduct] = React.useState(null);
  const fileRef = React.useRef(null);
  const catOptions = [...REWIND_CATS.filter(c => c !== 'All'), 'Other'];

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
    const result = await addCustomProduct(product);
    if (result) {
      setMsg(`✅ "${form.name}" added! `);
      setShowProduct(productId);
      setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [] });
      if (fileRef.current) fileRef.current.value = '';
    } else {
      setMsg('❌ Failed to save.');
    }
    setSaving(false);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📦 Add new product</h3>
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
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid #FF4D14', background: '#fff', color: '#FF4D14', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid #4caf50', background: '#fff', color: '#4caf50', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
              style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: '#16130F', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
            background: '#FF4D14',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 4px 12px rgba(255,77,20,0.4)'; }}
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
            <div style={{ fontSize: '13px', color: '#888', marginTop: '6px' }}>
              {form.files.length} file{form.files.length > 1 ? 's' : ''} selected
              {form.files.map((f, i) => (
                <span key={i} style={{ display: 'block', fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {form.file && (
          <div style={{ marginTop: '16px', border: '1px solid #eee', borderRadius: '12px', padding: '20px', background: '#FAF6EF' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#16130F', marginBottom: '12px' }}>📱 Storefront preview</p>
            <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ background: form.hue ? `hsl(${form.hue},60%,85%)` : '#f5f0eb', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src={URL.createObjectURL(form.file)} style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
              </div>
              <div style={{ padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D14', letterSpacing: '1px' }}>{form.cat?.toUpperCase() || 'CATEGORY'}</span>
                {form.brand && <span style={{ fontSize: '11px', color: '#888', marginLeft: '6px' }}>— {form.brand}</span>}
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '4px 0 2px', color: '#16130F' }}>{form.name || 'Product name'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#16130F' }}>{form.price ? `€${form.price}` : '€--'}</span>
                  {form.was && <span style={{ fontSize: '14px', color: '#aaa', textDecoration: 'line-through' }}>€{form.was}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {form.sizes.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #eee', fontSize: '11px', color: '#888' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            {form.note && <p style={{ fontSize: '12px', color: '#888', marginTop: '8px', fontStyle: 'italic' }}>{form.note}</p>}
          </div>
        )}
        {msg && <p style={{ fontSize: '14px', marginBottom: '10px' }}>{msg}
          {showProduct && <button onClick={() => { window.location.hash = '/product/' + showProduct; }}
            style={{ marginLeft: '8px', padding: '4px 10px', borderRadius: '6px', background: '#4caf50', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            👁 View on store
          </button>}
        </p>}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button type="submit" disabled={saving}
        style={{ padding: '10px 20px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
        {saving ? 'Saving...' : '➕ Add product'}
        </button>
        </div>
      </form>
    </div>
  );
}
