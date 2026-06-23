import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Banner, Header, Hero, Marquee, Toast, Footer } from './components/Shell';
import { ProductGrid, QuickView, CartDrawer, Checkout, SignupModal, WishlistDrawer } from './components/Shop';
import { TweaksPanel, useTweaks, TweakSection, TweakToggle, TweakColor, TweakRadio } from './components/Tweaks';
import { REWIND_PRODUCTS, REWIND_CATS, BRANDS } from './data';
import { getWishlist, saveWishlist, signupUser, supabase, getCustomProducts, addCustomProduct, uploadProductImage } from './lib/supabase';

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
  const [cart, setCart] = useState([]);
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
  useEffect(() => {
    const onHash = () => setAdminMode(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (adminMode) return <AdminPanel onExit={() => { window.location.hash = ''; }} />;

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
            <p className="rw-shop-sub">{products.length} pieces · one of each</p>
          </div>
          <div className="rw-chips">
            {REWIND_CATS.map((c) => (
              <button key={c} className={'rw-chip' + (cat === c ? ' is-on' : '')} onClick={() => setCat(c)}>
                {c === 'All' ? 'All' : c}
              </button>
            ))}
          </div>
        </div>

        <div className="rw-shop-layout">
          {cat !== 'All' && currentBrands.length > 0 && (
            <aside className="rw-brand-panel">
              <h3 className="rw-brand-title">Brands</h3>
              <div className="rw-brand-list">
                <button
                  className={'rw-brand-item' + (!brand ? ' is-on' : '')}
                  onClick={() => setBrand(null)}
                >All</button>
                {currentBrands.map((b) => (
                  <button
                    key={b}
                    className={'rw-brand-item' + (brand === b ? ' is-on' : '')}
                    onClick={() => setBrand(b)}
                  >{b}</button>
                ))}
              </div>
            </aside>
          )}
          <div className="rw-shop-content">
            <ProductGrid products={products} showCompare={t.showCompare} showStock={t.showStock}
              onQuick={setQuick} onAdd={quickAdd}
              wishlist={wishlist} onWishlist={handleWishlist} />
          </div>
        </div>
      </main>

      <Footer />

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

      <TweaksPanel>
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
      </TweaksPanel>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ADMIN PANEL — accessible at /#admin
   ══════════════════════════════════════════════ */
function AdminPanel({ onExit }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [emailText, setEmailText] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.from('wishlists').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setUsers(data);
        setLoading(false);
      });
  }, []);

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

      {supabase && !loading && users.length > 0 && (
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
                  <tr key={u.email} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.email}</td>
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
                      <a href={`mailto:${u.email}`} style={{ color: '#666', textDecoration: 'none', fontSize: '13px' }}>✉️</a>
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
                  const product = REWIND_PRODUCTS.find((p) => p.id === pid);
                  return (
                    <span key={pid} style={{ padding: '6px 12px', background: '#f0f0f0', borderRadius: '6px', fontSize: '13px' }}>
                      {product?.name || pid} {product ? `— ${product.cat}` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '16px' }}>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{users.length}</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Total users</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{users.filter((u) => u.marketing_optin).length}</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Marketing opt-in</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{users.reduce((s, u) => s + (u.product_ids?.length || 0), 0)}</div>
              <div style={{ fontSize: '13px', color: '#888' }}>Total saved items</div>
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

          {/* ── Product Manager ── */}
          <ProductForm />

          {/* ── Email tool ── */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '24px' }}>
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
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : '❌ Failed';
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
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
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : '❌ Failed';
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
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
        </>
      )}
    </div>
  );
}

/* ── Product Form (separate component) ── */
function ProductForm() {
  const [form, setForm] = React.useState({
    name: '', brand: '', cat: '', catCustom: '', price: '', was: '', sizes: 'S,M,L,XL', note: '', file: null, files: [], enhancedImage: null
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [showCustomCat, setShowCustomCat] = React.useState(false);
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
      stock: 5, hue: Math.floor(Math.random() * 360), img: '', note: form.note || '',
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
    };
    // Upload image if selected
    if (form.enhancedImage) {
      // Upload the enhanced version instead
      const blob = await fetch(`data:image/jpeg;base64,${form.enhancedImage}`).then(r => r.blob());
      const enhancedFile = new File([blob], `${productId}-enhanced.jpg`, { type: 'image/jpeg' });
      const url = await uploadProductImage(enhancedFile, productId);
      if (url) product.img = url;
    } else if (form.file) {
      const url = await uploadProductImage(form.file, productId);
      if (url) product.img = url;
    }
    const result = await addCustomProduct(product);
    if (result) {
      setMsg(`✅ "${form.name}" added!`);
      setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', sizes: 'S,M,L,XL', note: '', file: null, files: [] });
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
        <input className="rw-input" placeholder="Sizes (comma separated)" value={form.sizes}
          onChange={e => setForm({...form, sizes: e.target.value})} style={{ marginBottom: '12px' }} />
        <textarea className="rw-input" placeholder="Description" value={form.note}
          onChange={e => setForm({...form, note: e.target.value})} rows={2}
          style={{ marginBottom: '12px', resize: 'vertical' }} />
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
          <button type="button" onClick={async () => {
            setMsg('🔄 Generating description...');
            const img = new Image();
            const url = URL.createObjectURL(form.file);
            img.onload = async () => {
              const canvas = document.createElement('canvas');
              const maxDim = 1200;
              let w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = h * maxDim / w; w = maxDim; }
                else { w = w * maxDim / h; h = maxDim; }
              }
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
              URL.revokeObjectURL(url);
              try {
                const r = await fetch('/api/generate-description', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageBase64: compressedBase64, mimeType: 'image/jpeg' }),
                });
                const d = await r.json();
                if (d.description) {
                  setForm({...form, note: d.description});
                  setMsg('✅ Description generated!');
                } else {
                  setMsg('⚠️ No description returned. Make sure GEMINI_API_KEY is set in Railway.');
                }
              } catch (e) {
                setMsg('❌ Error: ' + e.message);
              }
            };
            img.src = url;
          }}
            style={{
              padding: '8px 18px',
              borderRadius: '999px',
              background: '#FF4D14',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 4px 12px rgba(255,77,20,0.4)'; }}
            onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
            ✨ Generate description from image
          </button>
        )}
        {form.file && (
          <button type="button" onClick={async () => {
            setMsg('🔄 Enhancing image...');
            // Compress image to reduce size before sending
            const img = new Image();
            const url = URL.createObjectURL(form.file);
            img.onload = async () => {
              const canvas = document.createElement('canvas');
              const maxDim = 1200;
              let w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = h * maxDim / w; w = maxDim; }
                else { w = w * maxDim / h; h = maxDim; }
              }
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
              URL.revokeObjectURL(url);
              try {
                const r = await fetch('/api/enhance-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageBase64: compressedBase64 }),
                });
                const d = await r.json();
                if (d.imageBase64) {
                  setForm({ ...form, enhancedImage: d.imageBase64 });
                  setMsg('✅ Image enhanced!');
                } else {
                  setMsg('⚠️ ' + (d.error || 'No enhancement returned'));
                }
              } catch (e) {
                setMsg('❌ Error: ' + e.message);
              }
            };
            img.src = url;
          }}
            style={{
              padding: '8px 18px',
              borderRadius: '999px',
              background: '#FF4D14',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 4px 12px rgba(255,77,20,0.4)'; }}
            onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
            🎨 Enhance photo
          </button>
        )}
        {form.enhancedImage && (
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>Enhanced preview (resized 1200px, sharpened, contrast adjusted):</p>
            <img src={`data:image/jpeg;base64,${form.enhancedImage}`} style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #eee' }} />
          </div>
        )}
        {msg && <p style={{ fontSize: '14px', marginBottom: '10px' }}>{msg}</p>}
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
