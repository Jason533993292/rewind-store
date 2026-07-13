import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Banner, Header, Hero, Marquee, Toast, Footer, Icon, TruckLoader } from './components/Shell';
import { ProductGrid, QuickView, CartDrawer, Checkout, SignupModal, WishlistDrawer } from './components/Shop';
import { ReferralDialog } from './components/Referral';
import ClickSpark from './components/ClickSpark';
import ChatBubble from './components/ChatBubble';
import { TweaksPanel, useTweaks, TweakSection, TweakToggle, TweakColor, TweakRadio } from './components/Tweaks';
import { REWIND_PRODUCTS, REWIND_CATS, BRANDS } from './data';
import { getWishlist, saveWishlist, signupUser, supabase, getCustomProducts, addCustomProduct, updateCustomProduct, uploadProductImage, getOrders, updateOrderStatus } from './lib/supabase';
import SizeGuide from './components/SizeGuide';
import InfoModal from './components/InfoModal';
import ProductPage from './components/ProductPage';
import RecentlyViewed from './components/RecentlyViewed';
import { money } from './hooks/useCountdown';

// Code-split — the admin panel (users/orders/products CRUD) is only ever
// needed behind #admin, so anonymous shoppers shouldn't download it.
const AdminPanel = React.lazy(() => import('./components/AdminPanel.jsx'));
const SettingsPanel = React.lazy(() => import('./components/SettingsPanel.jsx'));
const Shop = React.lazy(() => import('./components/Shop.jsx'));

const TWEAK_DEFAULTS = {
  accent: '#FF4D14',
  headingFont: 'Bricolage Grotesque',
  showBanner: true,
  showCountdown: true,
  showCompare: true,
  showStock: true,
};

const VERSION = 'V11.11.0';

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
  // showSurvey MUST be the VERY FIRST state var so no TDZ error can occur
  // when the scroll-lock useEffect references it.
  const [showSurvey, setShowSurvey] = useState(false);
  // Ref-based guard against minifier TDZ — effects use showSurveyRef.current
  // instead of the raw `showSurvey` state variable so that even if esbuild
  // hoists the effect closures, they reference a stable object (ref) rather
  // than an uninitialized const binding.
  const showSurveyRef = useRef(showSurvey);
  useEffect(() => { showSurveyRef.current = showSurvey; }, [showSurvey]);

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [cat, setCat] = useState(() => { try { return localStorage.getItem('rw_cat') || 'All'; } catch { return 'All'; } });
  const [query, setQuery] = useState(() => { try { return localStorage.getItem('rw_query') || ''; } catch { return ''; } });
  const [brand, setBrand] = useState(() => { try { const b = localStorage.getItem('rw_brand'); return b ? JSON.parse(b) : null; } catch { return null; } });
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
  
  // Lock body scroll when checkout is open (prevents double scrollbar + background peek)
  useEffect(() => {
    if (checkout) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [checkout]);
  const [toast, setToast] = useState(null);
  const [infoPage, setInfoPage] = useState(null);
  const [showReferral, setShowReferral] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dockHover, setDockHover] = useState(false);
  const dockRef = useRef(null);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('rw_theme') === 'dark'; } catch { return false; }
  });
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoClosing, setPromoClosing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('rw_email') || '');
  const [wishlist, setWishlist] = useState([]);
  const [pendingWishlistId, setPendingWishlistId] = useState(null);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlistReady, setWishlistReady] = useState(false);
  const [customProducts, setCustomProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sortBy, setSortBy] = useState(() => {
    try {
      return localStorage.getItem('rw_sort') || '';
    } catch { return ''; }
  });
  const [orderNumber, setOrderNumber] = useState('');
  const [showTweaks, setShowTweaks] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      const stored = localStorage.getItem('rw_recent');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showScrollTop, setShowScrollTop] = useState(false);

// ═══════════════════════════════════════════════════════════
// ⚡ TDZ GUARD — ALL callback/effect declarations below this
// line MUST reference only variables declared ABOVE this line.
// showToast is declared FIRST so every callback can use it.
// ═══════════════════════════════════════════════════════════
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, action, duration = 2400) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, k: Date.now(), action });
    toastTimer.current = setTimeout(() => setToast((cur) => (cur && cur.k && Date.now() - cur.k >= duration - 100 ? null : cur)), duration);
  }, []);
  const promoCloseTimerRef = useRef(null);
// ── ALL NEW useCallback/useEffect declarations go below ──
  // The survey overlay uses pointer-events: none (clicks pass through).
  // Adding a new state AFTER this point will break the site with a TDZ error.
  const customProductsRef = useRef(customProducts);
  useEffect(() => { customProductsRef.current = customProducts; }, [customProducts]);
  const wishlistRef = useRef(wishlist);
  useEffect(() => { wishlistRef.current = wishlist; }, [wishlist]);
  const recentlyViewedRef = useRef(recentlyViewed);
  useEffect(() => { recentlyViewedRef.current = recentlyViewed; }, [recentlyViewed]);

  // Load custom products from Supabase & re-check URL hash for direct product links
  useEffect(() => {
    getCustomProducts().then((prods) => {
      if (prods.length) setCustomProducts(prods);
      // Re-check the URL hash after custom products load — the hash-change
      // handler from the other effect only fires on *changes* to the hash,
      // so a direct navigation to #/product/<custom-id> on first page load
      // would miss custom products that hadn't loaded from Supabase yet.
      if (window.location.hash.startsWith('#/product/')) {
        const pid = window.location.hash.replace('#/product/', '');
        const allProds = [...REWIND_PRODUCTS, ...prods];
        const p = allProds.find(x => (x.id || x.product_id) === pid);
        if (p) setSelectedProduct(p);
      }
    });
  }, []);

  // Load wishlist from Supabase on mount / email change
  useEffect(() => {
    if (userEmail) {
      getWishlist(userEmail).then((ids) => {
        // Merge loaded IDs with any items already in state (e.g. a pending
        // wishlist item added by handleSignup during the signup flow, before
        // getWishlist resolves). Without merging, the async Supabase response
        // overwrites locally-added items and they silently disappear.
        setWishlist((prev) => {
          if (!ids.length) return prev;
          const merged = [...ids];
          prev.forEach((id) => {
            if (!merged.includes(id)) merged.push(id);
          });
          return merged;
        });
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

  // Persist sort preference to localStorage
  useEffect(() => {
    if (sortBy) localStorage.setItem('rw_sort', sortBy);
    else localStorage.removeItem('rw_sort');
  }, [sortBy]);

  // Persist recently viewed to localStorage
  useEffect(() => {
    localStorage.setItem('rw_recent', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  // Reset brand when category changes
  useEffect(() => { setBrand(null); }, [cat]);

  // Apply style tweaks to :root
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--font-head', `"${t.headingFont}", sans-serif`);
  }, [t.accent, t.headingFont]);

  // Lock body scroll when any modal/drawer is open
  // showSurvey is deliberately excluded from this effect.
  // The survey overlay uses pointer-events: none (clicks pass through).
  useEffect(() => {
    const anyOpen = quick !== null || drawer || checkout || signupOpen || showSizes || infoPage !== null || promoOpen || wishlistOpen || showReferral || showSettings;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    document.documentElement.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; };
  }, [quick, drawer, checkout, signupOpen, showSizes, infoPage, promoOpen, wishlistOpen, showReferral, showSettings]);

  // Mouse-following glow — REMOVED (caused stacking issues with panels/modals)

  // Close modals/drawers on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (promoOpen && !promoClosing) {
        setPromoClosing(true);
        promoCloseTimerRef.current = setTimeout(() => { setPromoOpen(false); setPromoClosing(false); promoCloseTimerRef.current = null; }, 300);
      }
      if (quick !== null)    setQuick(null);
      if (drawer)           setDrawer(false);
      if (checkout)         setCheckout(false);
      if (signupOpen)       setSignupOpen(false);
      if (showSizes)        setShowSizes(false);
      if (infoPage !== null) setInfoPage(null);
      if (wishlistOpen)     setWishlistOpen(false);
      if (showReferral)    setShowReferral(false);
      if (showSettings)    setShowSettings(false);
      // Dismiss survey on Escape only when it's actually visible — prevents
      // permanently hiding the first-visit survey for new users who press
      // Escape to close a modal/popup/drawer before the survey was dismissed.
      // NOTE: showSurvey deliberately omitted from deps to prevent the minifier
      // from hoisting this effect before showSurvey's state variable is initialized (TDZ bug).
      // showSurveyRef is used instead since refs are stable across hoisting.
      if (showSurveyRef.current) {
        localStorage.setItem('rw_survey_done', '1');
        setShowSurvey(false);
      }
      if (selectedProduct)  { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (promoCloseTimerRef.current) { clearTimeout(promoCloseTimerRef.current); promoCloseTimerRef.current = null; }
    };
  }, [promoOpen, quick, drawer, checkout, signupOpen, showSizes, infoPage, wishlistOpen, showReferral, showSettings, selectedProduct]);

  const products = useMemo(() => {
    const allProducts = [...REWIND_PRODUCTS, ...customProducts];
    return allProducts.filter((p) =>
      (cat === 'All' || p.cat === cat) &&
      (!brand || p.brand === brand) &&
      (query.trim() === '' || (p.name + ' ' + p.cat + ' ' + (p.brand || '') + ' ' + (p.note || '') + ' ' + (p.material || '')).toLowerCase().includes(query.toLowerCase()))
    );
  }, [cat, brand, query, customProducts]);

  // Compute categories that actually have products (including custom products)
  // Also appends any categories created via the admin panel's custom-category
  // input that aren't already in REWIND_CATS.
  const availableCats = useMemo(() => {
    const allProds = [...REWIND_PRODUCTS, ...customProducts];
    const available = new Set(allProds.map(p => p.cat).filter(Boolean));
    const base = REWIND_CATS.filter(c => c === 'All' || available.has(c));
    const extras = [...available].filter(c => !REWIND_CATS.includes(c));
    return [...base, ...extras];
  }, [customProducts]);

  const cartCount = cart.reduce((s, it) => s + it.qty, 0);

  // Apply dark mode on mount and when it changes
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('rw_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // ── ALL new state vars for modals/panels MUST go above this line ──
  // succession so the final toast Undo restores ALL of them, not just the last.
  const pendingRestoreRef = useRef([]);
  const restoreTimerRef = useRef(null);
  // Buffered undo for wishlist removals — same pattern as cart undo above.
  const pendingWishlistRestoreRef = useRef([]);
  const wishlistRestoreTimerRef = useRef(null);
  // Buffered undo for recently-viewed "Clear" button — saves the full list so
  const recentlyViewedBufferRef = useRef([]);
  const recentlyViewedTimerRef = useRef(null);
  // Scroll position memory — saves the Y offset before opening a product
  // detail page so that clicking "Back" restores the user exactly where they
  // were in the grid, rather than snapping them to the top of the page.
  const scrollPosRef = useRef(0);
  // ── ALREADY DECLARED at top of TDZ guard — do not re-declare ──
  // Extract RecentlyViewed handlers to eliminate duplication between product-page and shop views
  const handleRecentlyViewedSelect = useCallback((p) => {
    const pid = p?.id || p?.product_id;
    if (p && pid) {
      setSelectedProduct(p);
    } else if (pid) {
      setRecentlyViewed(prev => prev.filter(x => (x.id || x.product_id) !== pid));
      showToast('This product is no longer available');
    }
  }, [showToast]);

  const handleRecentlyViewedClear = useCallback(() => {
    setRecentlyViewed((prev) => {
      // Buffer the ENTIRE list from state (not the child's filtered `items` arg)
      // so Undo can restore every item including the current product when the
      // user clicks "Clear" from the product detail page.
      recentlyViewedBufferRef.current = [...prev];
      return [];
    });
    if (recentlyViewedTimerRef.current) clearTimeout(recentlyViewedTimerRef.current);
    recentlyViewedTimerRef.current = setTimeout(() => { recentlyViewedBufferRef.current = []; }, 2800);
    showToast('Recently viewed cleared', {
      label: 'Undo',
      onClick: () => {
        setRecentlyViewed((prev) => {
          // Only restore items not already present (e.g. if user
          // navigated to a new product during the window)
          const saved = recentlyViewedBufferRef.current || [];
          const merged = [...prev];
          saved.forEach((item) => {
            const pid = item.id || item.product_id;
            if (pid && !merged.find(x => (x.id || x.product_id) === pid)) {
              merged.push(item);
            }
          });
          recentlyViewedBufferRef.current = [];
          if (recentlyViewedTimerRef.current) clearTimeout(recentlyViewedTimerRef.current);
          return merged;
        });
      },
    });
  }, [showToast]);

  const handleRecentlyViewedRemove = useCallback((pid, name) => {
    // Use ref instead of raw recentlyViewed to prevent stale closure;
    // follows the same ref pattern as showSurveyRef, customProductsRef, wishlistRef.
    const removedItem = recentlyViewedRef.current.find(p => (p.id || p.product_id) === pid);
    if (!removedItem) return;
    setRecentlyViewed((prev) => prev.filter(p => (p.id || p.product_id) !== pid));
    showToast((name || 'Item') + ' removed', {
      label: 'Undo',
      onClick: () => {
        setRecentlyViewed((prev) => {
          // Only restore if not already present
          if (prev.find(p => (p.id || p.product_id) === pid)) return prev;
          return [removedItem, ...prev];
        });
      },
    });
  }, [showToast]);

  const addToCart = useCallback((p, size, qty = 1) => {
    // Guard: don't allow adding out-of-stock items
    if (p.stock === 0) {
      showToast(p.name + ' is sold out');
      return;
    }
    const sz = size || p.sizes?.[0] || 'One size';
    const pid = p.id || p.product_id;
    const key = pid + '-' + sz;
    setCart((c) => {
      const found = c.find((it) => it.key === key);
      if (found) return c.map((it) => it.key === key ? { ...it, qty: it.qty + qty } : it);
      return [...c, { key, id: pid, name: p.name, price: p.price, was: p.was, hue: p.hue, img: p.img || '', size: sz, qty: qty }];
    });
    showToast((qty > 1 ? qty + '× ' : '') + p.name + ' added to bag');
  }, [showToast]);

  const quickAdd = useCallback((p) => { addToCart(p); setDrawer(true); }, [addToCart]);
  const addFromQuick = useCallback((p, size) => { addToCart(p, size); setQuick(null); setDrawer(true); }, [addToCart]);
  const changeQty = useCallback((key, d) => { 
    setCart((c) => {
      const item = c.find(it => it.key === key);
      if (!item) return c;
      const newQty = item.qty + d;
      if (newQty <= 0) {
        if (d < 0) {
          setPendingRemove({ key, name: item.name });
          return c.map(it => it.key === key ? { ...it, qty: 1 } : it);
        }
        return c;
      }
      return c.map((it) => it.key === key ? { ...it, qty: newQty } : it); 
    }); 
  }, []);
  const [pendingRemove, setPendingRemove] = useState(null);
  const removeItem = useCallback((key, name) => { 
    // Capture the removed item so Undo always restores the right data,
    // regardless of subsequent cart changes before the user clicks Undo.
    const removedItem = cart.find(it => it.key === key);
    setCart((c) => c.filter((it) => it.key !== key));
    // Accumulate into the pending-restore buffer so rapid removals don't
    // silently drop earlier undo actions (showToast replaces the current toast).
    if (removedItem) {
      pendingRestoreRef.current = [...pendingRestoreRef.current, removedItem];
    }
    // Clear the buffer when the toast auto-dismisses (slightly after the toast
    // duration so there's no race with a user clicking Undo in the final ms).
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = setTimeout(() => { pendingRestoreRef.current = []; }, 2600);
    const count = pendingRestoreRef.current.length;
    const msg = count > 1
      ? `${count} items removed`
      : (name || 'Item') + ' removed';
    showToast(msg, {
      label: 'Undo',
      onClick: () => {
        setCart((c) => {
          let next = [...c];
          pendingRestoreRef.current.forEach(item => {
            if (item && !next.find(i => i.key === item.key)) {
              next.push(item);
            }
          });
          pendingRestoreRef.current = [];
          if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
          return next;
        });
      },
    });
  }, [cart, showToast]);
  const goCheckout = useCallback(() => { setDrawer(false); setCheckout(true); setCheckoutCount(c => c + 1); setPromoOpen(false); setPromoClosing(false); setOrderNumber(''); }, []);
  const orderPlaced = useCallback(() => { setCart([]); setCheckout(false); setOrderNumber(''); }, []);

  const handleWishlist = useCallback((p) => {
    const pid = p.id || p.product_id;
    if (!pid) return;
    if (!userEmail) {
      setPendingWishlistId(pid);
      setSignupOpen(true);
      return;
    }
    // Determine whether the item was in the wishlist INSIDE the functional
    // setter — React executes updaters synchronously (the variable below is
    // set before the code continues), eliminating the stale-closure bug that
    // could show the wrong toast when users click the heart rapidly.
    let willBeRemoved = false;
    setWishlist((prev) => {
      const exists = prev.includes(pid);
      willBeRemoved = exists;
      return exists ? prev.filter((id) => id !== pid) : [...prev, pid];
    });
    if (willBeRemoved) {
      showToast(p.name + ' removed', {
        label: 'Undo',
        onClick: () => setWishlist((inner) => inner.includes(pid) ? inner : [...inner, pid]),
      });
    } else {
      showToast(p.name + ' saved', {
        label: 'Show',
        onClick: () => setWishlistOpen(true),
      });
    }
  }, [userEmail, showToast]);

  const handleSignup = useCallback(({ email, acceptMarketing }) => {
    setUserEmail(email);
    setSignupOpen(false);
    signupUser(email, acceptMarketing);
    if (pendingWishlistId) {
      setWishlist((prev) => prev.includes(pendingWishlistId) ? prev : [...prev, pendingWishlistId]);
      // Look up product name for a personalised toast
      const allProds = [...REWIND_PRODUCTS, ...customProducts];
      const pendingProduct = allProds.find(p => (p.id || p.product_id) === pendingWishlistId);
      setPendingWishlistId(null);
      showToast((pendingProduct?.name || 'Item') + ' saved', {
        label: 'Show',
        onClick: () => setWishlistOpen(true),
      });
    }
  }, [pendingWishlistId, showToast, customProducts]);

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

  // Show/hide scroll-to-top button based on scroll position
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Check initial position
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Wrap setQuery so that the first keystroke scrolled to the product grid,
  // consistent with every other filter method (sidebar, header nav, hero, footer).
  const handleQueryChange = useCallback((value) => {
    if (value && !query) scrollToGrid();
    setQuery(value);
  }, [query, scrollToGrid]);

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

  const currentBrands = useMemo(() => {
    if (cat === 'All') return [];
    const hardcoded = BRANDS[cat] || [];
    const actualBrands = Object.keys(brandCounts);
    const extras = actualBrands.filter(b => !hardcoded.includes(b));
    return [...hardcoded, ...extras];
  }, [cat, brandCounts]);

  // Reconcile recently viewed with fresh product data when custom products load/update.
  // Prevents stale names/prices in the recently viewed mini-cards after editing a
  // custom product in the admin panel. The click handler already resolves fresh data,
  // but the mini-card display now updates automatically.
  useEffect(() => {
    if (!allProducts.length || !recentlyViewed.length) return;
    setRecentlyViewed((prev) => {
      let changed = false;
      const updated = prev.map((p) => {
        const pid = p.id || p.product_id;
        if (!pid) return p;
        const fresh = allProducts.find(x => (x.id || x.product_id) === pid);
        if (fresh && fresh !== p) { changed = true; return fresh; }
        return p;
      });
      return changed ? updated : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts]);

  // Search suggestions for autocomplete dropdown — top 5 matches
  const searchSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return [...REWIND_PRODUCTS, ...customProducts]
      .filter(p => (p.name + ' ' + p.cat + ' ' + (p.brand || '')).toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({ name: p.name, cat: p.cat }));
  }, [query, customProducts]);

  // Admin check — used to gate admin-only UI elements
  // Checks for the actual session token, not just the email (which is
  // trivially spoofable in localStorage). If the token is missing, admin
  // UI buttons won't render — and even if they did, the server would
  // reject any action since the real auth comes from the token.
  const isAdmin = !!localStorage.getItem('rw_admin_email') && !!localStorage.getItem('rw_admin_token');
  // Only activate admin mode if the user has a verified admin email saved,
  // NOT just because #admin is in the URL (security: prevents full admin
  // panel access by anyone who navigates to /#admin).
  const [adminMode, setAdminMode] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Handle Stripe success redirect — show confirmation view instead of just a toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('order') === 'success') {
      const orderNum = params.get('orderNum');
      const msg = orderNum ? `✅ ${orderNum} confirmed!` : '✅ Order confirmed!';
      showToast(msg);
      setCart([]);
      // Keep checkout open and pass the order number so the confirmation view
      // (with confetti, copy button, and Continue shopping CTA) is shown.
      setOrderNumber(orderNum || '');
      setCheckout(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);
  
  // First-visit questionnaire — moved closer to the other state vars above
  
  useEffect(() => {
    if (!localStorage.getItem('rw_survey_done')) {
      setShowSurvey(true);
    }
    // Check if this user's email is blocked (API path — e.g. blocked_emails table)
    const stored = localStorage.getItem('rw_email');
    if (stored) {
      fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: stored }) })
        .then(r => r.json())
        .then(d => { if (d.blocked) setBlocked(true); })
        .catch(() => {});
    }
    // Listen for logo click to reset store
    const handler = () => { setCat('All'); setBrand(null); setQuery(''); };
    window.addEventListener('reset-store', handler);
    return () => window.removeEventListener('reset-store', handler);
  }, []);

  // Auto-dismiss survey when any other modal/drawer or product detail page opens
  // — prevents the survey overlay from remaining visible on top of product content.
  useEffect(() => {
    // Use ref instead of raw showSurvey to prevent minifier TDZ
    if (showSurveyRef.current && (signupOpen || quick !== null || drawer || checkout || showSizes || infoPage !== null || promoOpen || wishlistOpen || selectedProduct !== null)) {
      localStorage.setItem('rw_survey_done', '1');
      setShowSurvey(false);
    }
  }, [showSurvey, signupOpen, quick, drawer, checkout, showSizes, infoPage, promoOpen, wishlistOpen, selectedProduct]);

  // Auto-close promo popup with animation when any drawer/checkout opens
  useEffect(() => {
    if ((drawer || wishlistOpen || checkout) && promoOpen && !promoClosing) {
      setPromoClosing(true);
      const tid = setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300);
      promoCloseTimerRef.current = tid;
      return () => { clearTimeout(tid); if (promoCloseTimerRef.current === tid) promoCloseTimerRef.current = null; };
    }
  }, [drawer, wishlistOpen, checkout, promoOpen, promoClosing]);

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

  // When selectedProduct changes, update the URL hash and scroll to top.
  // Saves the grid scroll position before opening a product and restores it
  // on return so the user lands exactly where they left off browsing.
  useEffect(() => {
    if (selectedProduct) {
      const id = selectedProduct.id || selectedProduct.product_id;
      window.history.pushState({ product: id }, '', '#/product/' + id);
      scrollPosRef.current = window.scrollY;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (scrollPosRef.current > 0) {
      window.scrollTo({ top: scrollPosRef.current, behavior: 'smooth' });
    }
  }, [selectedProduct]);

  // Set document title to product name when viewing a product detail page,
  // and restore the default title when returning to the shop.
  useEffect(() => {
    const DEFAULT_TITLE = 'REWIND — Curated Vintage & Retro Sportswear';
    if (selectedProduct) {
      document.title = selectedProduct.name + ' — REWIND';
    } else {
      document.title = DEFAULT_TITLE;
    }
    return () => { document.title = DEFAULT_TITLE; };
  }, [selectedProduct]);

  // Track recently viewed products (only full-page views, not quickview)
  useEffect(() => {
    if (!selectedProduct) return;
    const pid = selectedProduct.id || selectedProduct.product_id;
    if (!pid) return;
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((p) => (p.id || p.product_id) !== pid);
      return [selectedProduct, ...filtered].slice(0, 5);
    });
  }, [selectedProduct]);
  useEffect(() => {
    const onHash = () => {
      const isAdminHash = window.location.hash === '#admin';
      if (isAdminHash) {
        // Show the AdminPanel component — it handles its own auth internally
        // via server-verified email check + admin API token.
        // The AdminPanel will show a login form until the user authenticates.
        setAdminMode(true);
      } else if (window.location.hash === '') {
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

  // Check if current user is blocked via server endpoint
  useEffect(() => {
    const email = localStorage.getItem('rw_email');
    if (!email || adminMode) return;
    fetch('/api/check-blocked-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).then(r => r.json()).then(d => {
      if (d.blocked) setBlocked(true);
    }).catch(() => {});
  }, [adminMode]);

  if (adminMode) return (
    <React.Suspense fallback={<div className="rw-loading-wrap"><TruckLoader /></div>}>
      <AdminPanel onExit={() => { window.location.hash = ''; }} onSelect={setSelectedProduct} customProducts={customProducts} setCustomProducts={setCustomProducts} />
    </React.Suspense>
  );

  // Blocked screen
  if (blocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</h1>
        <h2 style={{ fontSize: '24px', color: 'var(--ink)', marginBottom: '8px' }}>Access restricted</h2>
        <p style={{ fontSize: '16px', color: 'var(--muted)', maxWidth: '400px' }}>This account has been blocked from accessing REWIND. If you think this is a mistake, please <a href="mailto:orders@rewind-stores.com" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}>contact us</a>.</p>
      </div>
    );
  }

  const curPid = selectedProduct?.id || selectedProduct?.product_id;

  // Show product detail page instead of shop
  const viewContent = selectedProduct ? (
    {/* Per-product JSON-LD for SEO */}
    {selectedProduct && (
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": selectedProduct.name,
          "description": (selectedProduct.note || selectedProduct.material || selectedProduct.name),
          "image": selectedProduct.img || undefined,
          "brand": { "@type": "Brand", "name": selectedProduct.brand || "REWIND" },
          "offers": {
            "@type": "Offer",
            "price": selectedProduct.price,
            "priceCurrency": "EUR",
            "availability": (selectedProduct.stock && selectedProduct.stock > 0)
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            "url": `https://rewind-stores.com/#/product/${selectedProduct.id || selectedProduct.product_id}`
          }
        }, null, 2)}
      </script>
    )}
    <div className="rw-product-page" id="rw-product-page">
      <Header cat={cat} setCat={(c) => { setCat(c); setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); scrollPosRef.current = 0; scrollToGrid(); }} cartCount={cartCount}
        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
        onWishlistOpen={() => setWishlistOpen(true)}
        query={query} setQuery={handleQueryChange} cats={availableCats} version={VERSION}
        onVersionClick={() => setShowTweaks(v => !v)} onReferral={() => setShowReferral(true)}
        isAdmin={isAdmin} searchSuggestions={searchSuggestions} />
      <main className="rw-shop">
      <ProductPage key={curPid} p={selectedProduct}
        onBack={() => { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }}
        onAdd={(p, size, qty) => { addToCart(p, size, qty); setDrawer(true); }}
        onWishlist={handleWishlist}
        wishlisted={wishlist.includes(curPid)}
        showCompare={t.showCompare}
        showStock={t.showStock}
        onSizeGuide={() => setShowSizes(true)} />

      {/* ── Recently viewed (on product page, excluding current product) ── */}
      <RecentlyViewed
        items={recentlyViewed.filter(p => (p.id || p.product_id) !== curPid)}
        allProducts={allProducts}
        onSelect={handleRecentlyViewedSelect}
        onClear={handleRecentlyViewedClear}
        onRemoveItem={handleRecentlyViewedRemove}
        showToast={showToast}
      />
      </main>
      <Footer onSizes={() => setShowSizes(true)} onInfo={(p) => setInfoPage(p)} onSetCat={(c) => { setCat(c); scrollToGrid(); }} cats={availableCats} />
    </div>
  ) : (
    <div className="rw-app" key="shop">
      {t.showBanner && <Banner showCountdown={t.showCountdown} />}
      <Header cat={cat} setCat={(c) => { setCat(c); scrollToGrid(); }} cartCount={cartCount}
        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
        onWishlistOpen={() => setWishlistOpen(true)}
        query={query} setQuery={handleQueryChange} cats={availableCats} version={VERSION}
        onVersionClick={() => setShowTweaks(v => !v)} onReferral={() => setShowReferral(true)}
        isAdmin={isAdmin} searchSuggestions={searchSuggestions} />
      <Hero onShop={(filterCat) => { setCat(filterCat || 'All'); scrollToGrid(); }} />
      <Marquee />
      {/* Mobile scroll hint — shows a subtle indicator on first visit that there's more content below */}
      <main className="rw-shop">
        <div className="rw-shop-head" id={headingId}>
          <div className="rw-shop-headl">
            <h2 className="rw-shop-title">{cat === 'All' ? 'The drop' : cat}</h2>
            <p className="rw-shop-sub">{products.length} piece{products.length !== 1 ? 's' : ''} · one of each</p>
          </div>
        </div>

        <div className="rw-shop-layout">
          <aside id="rw-sidebar" style={{
            width: '260px',
            flexShrink: 0,
            background: 'var(--bg)',
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

            {cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand) && (
              <>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Brands</h3>
                <SidebarBtn label="All" isOn={!brand} count={catCounts[cat] || 0} onClick={() => { setBrand(null); scrollToGrid(); }} />
                {currentBrands.map((b) => (
                  <SidebarBtn key={b} label={b} isOn={brand === b} count={brandCounts[b] || 0} onClick={() => { setBrand(b); scrollToGrid(); }} />
                ))}
              </>
            )}
          </aside>

          {/* Mobile nav slide-out */}
          <div className={"rw-mobile-nav-overlay" + (showMobileNav ? ' open' : '')} onClick={() => setShowMobileNav(false)} />
          <div className={"rw-mobile-nav-sheet" + (showMobileNav ? ' open' : '')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <strong style={{ fontSize: '16px' }}>Filters</strong>
              <button onClick={() => setShowMobileNav(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--line)', cursor: 'pointer', fontSize: '16px', display: 'grid', placeItems: 'center', color: 'var(--muted)' }} aria-label="Close filters">&times;</button>
            </div>
            <h3>Category</h3>
            {availableCats.map((c) => (
              <button key={c} onClick={() => { setCat(c); setShowMobileNav(false); scrollToGrid(); }}
                style={{ fontWeight: cat === c ? 700 : 400, color: cat === c ? 'var(--surface)' : 'var(--ink)', background: cat === c ? 'var(--ink)' : 'transparent' }}>
                {c === 'All' ? 'All' : c}
              </button>
            ))}
            {cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand) && (
              <>
                <h3>Brand</h3>
                <button onClick={() => { setBrand(null); setShowMobileNav(false); scrollToGrid(); }}
                  style={{ fontWeight: !brand ? 700 : 400, color: !brand ? 'var(--surface)' : 'var(--ink)', background: !brand ? 'var(--ink)' : 'transparent' }}>All</button>
                {currentBrands.map((b) => (
                  <button key={b} onClick={() => { setBrand(b); setShowMobileNav(false); scrollToGrid(); }}
                    style={{ fontWeight: brand === b ? 700 : 400, color: brand === b ? 'var(--surface)' : 'var(--ink)', background: brand === b ? 'var(--ink)' : 'transparent' }}>{b}</button>
                ))}
              </>
            )}
            {(cat !== 'All' || brand !== null || query !== '' || sortBy !== '') && (
              <button onClick={() => { setQuery(''); setCat('All'); setBrand(null); setSortBy(''); setShowMobileNav(false); scrollToGrid(); }}
                style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', textAlign: 'center', fontWeight: 600, fontSize: '13px', width: '100%', cursor: 'pointer' }}>
                Clear filters
              </button>
            )}
          </div>

          <div className="rw-shop-content">
            {products.length > 0 && (
            <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand)) ? '8px' : '16px', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1 1 auto' }}>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                aria-label="Sort products"
                className="rw-sort">
                <option value="">Featured</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
              </select>
              <button id="rw-mobile-filter-btn" onClick={() => setShowMobileNav(true)}
                aria-label="Filter products"
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', display: 'none', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                className="rw-mobile-filter-btn">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12M4 8h8M6 12h4"/></svg>
                Filter
              </button>
              </div>
              {(cat !== 'All' || brand !== null || query !== '' || sortBy !== '') && (
                <button onClick={() => { setQuery(''); setCat('All'); setBrand(null); setSortBy(''); scrollToGrid(); }}
                  aria-label="Clear all filters"
                  className="rw-txt-btn"
                  style={{ fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ✕ Clear all
                </button>
              )}
            </div>
            {cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand) && (
              <select className="rw-sort rw-mobile-brand" value={brand || ''} onChange={e => { setBrand(e.target.value || null); scrollToGrid(); }}
                aria-label="Filter by brand"
                style={{ width: '100%', marginBottom: '16px' }}>
                <option value="">All brands</option>
                {currentBrands.map(b => (
                  <option key={b} value={b}>{b} ({brandCounts[b] || 0})</option>
                ))}
              </select>
            )}
            </>
            )}
            <ProductGrid products={products} sort={sortBy} query={query} showCompare={t.showCompare} showStock={t.showStock}
              onQuick={setQuick} onAdd={quickAdd}
              wishlist={wishlist} onWishlist={handleWishlist} onSelect={setSelectedProduct}
              activeCat={cat} activeBrand={brand}
              onCart={() => setDrawer(true)}
              cats={availableCats} onSetCat={(c) => { setCat(c); scrollToGrid(); }}
              onClearSearch={() => { setQuery(''); setCat('All'); setBrand(null); setSortBy(''); scrollToGrid(); }} />
          </div>
        </div>

        {/* ── Recently viewed ── */}
        <RecentlyViewed
          items={recentlyViewed}
          allProducts={allProducts}
          onSelect={handleRecentlyViewedSelect}
          onClear={handleRecentlyViewedClear}
          onRemoveItem={handleRecentlyViewedRemove}
          showToast={showToast}
        />
      </main>

      <Footer onSizes={() => setShowSizes(true)} onInfo={(p) => setInfoPage(p)} onSetCat={(c) => { setCat(c); scrollToGrid(); }} cats={availableCats} />
    </div>
  );

  return (
    <ClickSpark sparkColor="#FF4D14" sparkSize={8} sparkRadius={16} sparkCount={10}>
      {viewContent}

      {/* ── Shared overlays (rendered in BOTH product page view AND shop view) ── */}
      {/* These must stay here so header cart/wishlist icons work on the product detail page. */}
      {showSizes && <SizeGuide onClose={() => setShowSizes(false)} />}
      {infoPage && <InfoModal page={infoPage} onClose={() => setInfoPage(null)} />}

      <QuickView p={quick} showCompare={t.showCompare} showStock={t.showStock}
        onClose={() => setQuick(null)} onAdd={addFromQuick} />
      <CartDrawer open={drawer} items={cart} onClose={() => setDrawer(false)}
        onQty={changeQty} onRemove={removeItem} onCheckout={goCheckout}
        pendingRemove={pendingRemove} onCancelRemove={() => setPendingRemove(null)} />
      <Checkout key={checkoutCount} open={checkout} items={cart} onClose={() => setCheckout(false)} onPlaced={orderPlaced} userEmail={userEmail} showToast={showToast} orderNumber={orderNumber} onInfo={(p) => setInfoPage(p)} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <SignupModal open={signupOpen} onClose={() => { setSignupOpen(false); setPendingWishlistId(null); }} onSignup={handleSignup} />
      <ReferralDialog open={showReferral} onClose={() => setShowReferral(false)} userEmail={userEmail} showToast={showToast} />
      <WishlistDrawer open={wishlistOpen} items={wishlist} customProducts={customProducts}
        onClose={() => setWishlistOpen(false)}
        onRemove={(ids) => {
          const removeIds = Array.isArray(ids) ? ids : [ids];
          pendingWishlistRestoreRef.current = [...pendingWishlistRestoreRef.current, ...removeIds];
          setWishlist((prev) => prev.filter((i) => !removeIds.includes(i)));
          if (wishlistRestoreTimerRef.current) clearTimeout(wishlistRestoreTimerRef.current);
          wishlistRestoreTimerRef.current = setTimeout(() => { pendingWishlistRestoreRef.current = []; }, 2600);
          const count = pendingWishlistRestoreRef.current.length;
          showToast(count > 1 ? `${count} items removed` : 'Item removed', {
            label: 'Undo',
            onClick: () => {
              setWishlist((prev) => {
                const toRestore = pendingWishlistRestoreRef.current.filter(id => !prev.includes(id));
                pendingWishlistRestoreRef.current = [];
                if (wishlistRestoreTimerRef.current) clearTimeout(wishlistRestoreTimerRef.current);
                return [...prev, ...toRestore];
              });
            },
          });
        }}
        onAddToCart={(p, size) => { addToCart(p, size); }}
        onSelect={(p) => { setSelectedProduct(p); setWishlistOpen(false); }}
        onCartOpen={() => { setWishlistOpen(false); setDrawer(true); }}
        showToast={showToast} />

      {showSurvey && selectedProduct === null && !signupOpen && quick === null && !drawer && !checkout && !showSizes && infoPage === null && !promoOpen && !wishlistOpen && (
        <div className="rw-survey-overlay" onClick={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }}>
          <div className="rw-survey-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', padding: '32px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--r)', position: 'relative', boxShadow: '0 30px 80px -20px rgba(22,19,15,.5)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Welcome to REWIND 👋</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Where did you hear about us?</p>
            <Survey onDone={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} onSkip={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} />
          </div>
        </div>
      )}

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
          style={{
            position: 'fixed', bottom: '20px', left: '20px', zIndex: 999,
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--surface)', color: 'var(--ink)',
            border: '1.5px solid var(--line-2)',
            cursor: 'pointer', fontSize: '18px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            display: 'grid', placeItems: 'center',
          }}
          onMouseOver={e => { e.target.style.transform = 'scale(1.1)'; e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}>
          <Icon name="chevUp" size={18} />
        </button>
      )}

      {/* ── Bottom Dock ── */}
      <div ref={dockRef}
        onMouseEnter={() => setDockHover(true)}
        onMouseLeave={() => setDockHover(false)}
        style={{
          position: 'fixed', bottom: '28px', left: '50%', zIndex: 99999,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0',
          background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          borderRadius: '24px', boxShadow: dockHover ? '0 8px 30px rgba(0,0,0,0.09)' : '0 2px 12px rgba(0,0,0,0.08)',
          padding: '7px',
          transform: dockHover ? 'translateX(-50%) translateY(-2px)' : 'translateX(-50%) translateY(0)',
          transition: 'max-width 0.8s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.5s ease, transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'max-width, transform',
          cursor: 'default',
          maxWidth: dockHover ? '420px' : '54px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {/* Referrals */}
        <button onClick={() => { setShowSettings(false); setShowReferral(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: dockHover ? '8px 12px' : '8px 0',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
            fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
            opacity: dockHover ? 1 : 0, overflow: 'hidden',
            transition: 'opacity 0.8s ease 0.12s, padding 0.8s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s ease',
            pointerEvents: dockHover ? 'auto' : 'none', maxWidth: dockHover ? '120px' : '0',
            transform: 'scale(1)',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--muted)'; }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/><circle cx="12" cy="12" r="10"/></svg>
          <span>Referrals</span>
        </button>

        {/* Home */}
        <button onClick={() => { setShowReferral(false); setShowSettings(false); window.location.hash = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); setDockHover(false); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '6px', borderRadius: '16px', flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)',
            fontSize: '13px', fontWeight: 700, transition: 'transform 0.2s ease',
            transform: 'scale(1)',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.12)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          {dockHover && <span style={{ fontSize: '13px', fontWeight: 600, marginLeft: '6px' }}>Home</span>}
        </button>

        {/* Settings */}
        <button onClick={() => { setShowReferral(false); setShowSettings(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: dockHover ? '8px 12px' : '8px 0',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
            fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
            opacity: dockHover ? 1 : 0, overflow: 'hidden',
            transition: 'opacity 0.8s ease 0.1s, padding 0.8s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s ease',
            pointerEvents: dockHover ? 'auto' : 'none', maxWidth: dockHover ? '110px' : '0',
            transform: 'scale(1)',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--muted)'; }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          <span style={{ opacity: dockHover ? 1 : 0, transition: 'opacity 0.3s ease 0.2s', overflow: 'hidden' }}>Settings</span>
        </button>

        {/* Dark mode toggle */}
        <button onClick={() => setDarkMode(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: dockHover ? '8px 12px' : '8px 0',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
            fontSize: '14px', whiteSpace: 'nowrap',
            opacity: dockHover ? 1 : 0, overflow: 'hidden',
            transition: 'opacity 0.8s ease 0.08s, padding 0.8s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s ease',
            pointerEvents: dockHover ? 'auto' : 'none', maxWidth: dockHover ? '60px' : '0',
            transform: 'scale(1)',
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'var(--muted)'; }}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>{darkMode ? '☀️' : '🌙'}</span>
        </button>
      </div>

      {/* ── Chat bubble ── */}
      <ChatBubble />

      {showSettings && (
        <React.Suspense fallback={null}>
          <SettingsPanel onClose={() => setShowSettings(false)} showToast={showToast} />
        </React.Suspense>
      )}

      {isAdmin && (showTweaks || window.location.search.includes('tweaks')) && <TweaksPanel>
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
    </ClickSpark>
  );
}

/* ══════════════════════════════════════════════
   ADMIN PANEL — accessible at /#admin
   ══════════════════════════════════════════════ */
function Survey({ onDone, onSkip }) {
  const [step, setStep] = useState('choose');
  const [source, setSource] = useState('');
  const [otherText, setOtherText] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (answer) => {
    const ans = answer || (source === 'Other' ? otherText : source);
    try { await fetch('/api/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: ans }) }); } catch {}
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
        <button key={o} onClick={() => { if (o === 'Other') { setSource(o); setStep('other'); } else { submit(o); } }}
          style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '8px', borderRadius: '8px', border: '1px solid var(--line)', background: source === o ? 'var(--ink)' : 'var(--surface)', color: source === o ? 'var(--surface)' : 'var(--ink)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', textAlign: 'center', transition: 'all 0.15s' }}
          onMouseOver={e => { if (source !== o) { e.target.style.background = 'var(--line)'; e.target.style.transform = 'translateY(-1px)'; } }}
          onMouseOut={e => { if (source !== o) { e.target.style.background = 'var(--surface)'; e.target.style.transform = ''; } }}>
          {o}
        </button>
      ))}
      {step === 'other' && (
        <div style={{ marginTop: '12px' }}>
          <input className="rw-input" placeholder="Tell us where..." value={otherText} onChange={e => setOtherText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && otherText.trim()) submit(otherText.trim()); }} autoFocus />
          <button onClick={() => submit(otherText.trim())} disabled={!otherText.trim()}
            style={{ marginTop: '8px', padding: '10px 20px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 600, width: '100%', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
            Submit
          </button>
        </div>
      )}
      <button onClick={onSkip} className="rw-txt-btn" style={{ marginTop: '12px', padding: '8px', fontSize: '12px' }}>Skip</button>
      </>)}
    </div>
  );
}


