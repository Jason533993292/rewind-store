#!/usr/bin/env python3
"""Fix remaining hash references in App.jsx only."""
with open('src/App.jsx') as f:
    c = f.read()

# 1. Import nav + getRoute
c = c.replace(
    "import ChatBubble from './components/ChatBubble';",
    "import ChatBubble from './components/ChatBubble';\nimport { nav, getRoute, initRouter } from './lib/router';"
)

# 2. Replace hashchange listener with pathname router
old = """  // Hash routing for legal pages
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      if (h === '#/privacy') setLegalPage('privacy');
      else if (h === '#/terms') setLegalPage('terms');
      else if (h === '#/returns') setLegalPage('returns');
      else if (h === '#/shipping') setLegalPage('shipping');
      else setLegalPage(null);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);"""

new_router = """  // Pathname routing for SPA pages
  useEffect(() => {
    const onRoute = () => {
      const route = getRoute();
      if (route === 'privacy') setLegalPage('privacy');
      else if (route === 'terms') setLegalPage('terms');
      else if (route === 'returns') setLegalPage('returns');
      else if (route === 'shipping') setLegalPage('shipping');
      else setLegalPage(null);
    };
    onRoute();
    window.addEventListener('spa-navigate', onRoute);
    window.addEventListener('popstate', onRoute);
    return () => {
      window.removeEventListener('spa-navigate', onRoute);
      window.removeEventListener('popstate', onRoute);
    };
  }, []);

  // Initialize router on mount — converts any existing hash URL to pathname
  useEffect(() => { initRouter(); }, []);"""

c = c.replace(old, new_router)

# 3. Track order routing
c = c.replace(
    "  const [showTrackOrder, setShowTrackOrder] = useState(() => window.location.hash === '#/track');\n  useEffect(() => {\n    const onHash = () => setShowTrackOrder(window.location.hash === '#/track');\n    onHash();\n    window.addEventListener('hashchange', onHash);\n    return () => window.removeEventListener('hashchange', onHash);\n  }, []);",
    "  const [showTrackOrder, setShowTrackOrder] = useState(() => getRoute() === 'track');\n  useEffect(() => {\n    const fn = () => setShowTrackOrder(getRoute() === 'track');\n    fn();\n    window.addEventListener('spa-navigate', fn);\n    window.addEventListener('popstate', fn);\n    return () => { window.removeEventListener('spa-navigate', fn); window.removeEventListener('popstate', fn); };\n  }, []);"
)

# 4. Product hash routing
c = c.replace(
    "if (window.location.hash.startsWith('#/product/')) {",
    "if (getRoute().startsWith('product/')) {"
)
c = c.replace(
    """      const pid = window.location.hash.replace('#/product/', '');""",
    """      const pid = getRoute().replace('product/', '');"""
)

c = c.replace(
    """        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');""",
    """        const params = new URLSearchParams(window.location.search.slice(1));"""
)

# 5. Login response
c = c.replace(
    """if (d.admin) { window.location.hash = 'admin'; }""",
    """if (d.admin) { nav('/admin'); }"""
)

# 6. Admin check
c = c.replace(
    "const isAdmin = window.location.hash === '#admin' || !!localStorage.getItem('rw_admin_email');",
    "const isAdmin = getRoute() === 'admin' || !!localStorage.getItem('rw_admin_email');"
)

c = c.replace(
    "const isAdminHash = window.location.hash === '#admin';",
    "const isAdminHash = getRoute() === 'admin';"
)

# 7. Product route checks
c = c.replace(
    """if (!getRoute().startsWith('product/')) {""",
    """if (getRoute() !== 'admin' && !getRoute().startsWith('product/')) {"""
)

c = c.replace(
    "} else if (window.location.hash === '') {",
    "} else if (getRoute() === '') {"
)

c = c.replace(
    "if (getRoute().startsWith('payment-complete')) {",
    "if (getRoute().startsWith('payment-complete')) {"
)
# Fix the duplicate that might appear
c = c.replace(
    """if (getRoute().startsWith('payment-complete')) {""",
    """if (getRoute().startsWith('payment-complete')) {"""
)

# 8. Dock buttons
c = c.replace(
    "window.location.hash = 'admin'; setDockHover(false);",
    "nav('/admin'); setDockHover(false);"
)
c = c.replace(
    "window.location.hash = ''; setDockHover(false);",
    "nav('/'); setDockHover(false);"
)
c = c.replace(
    "window.location.hash = '#/track'; setDockHover(false);",
    "nav('/track'); setDockHover(false);"
)

# 9. Track order onClose
c = c.replace(
    "<OrderTracking onClose={() => { setShowTrackOrder(false); window.location.hash = ''; }} />",
    "<OrderTracking onClose={() => { setShowTrackOrder(false); nav('/'); }} />"
)

with open('src/App.jsx', 'w') as f:
    f.write(c)
print('App.jsx fixed')
