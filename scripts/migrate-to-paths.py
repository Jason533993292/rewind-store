#!/usr/bin/env python3
"""Replace hash routing with pathname routing across all components."""
import os, re

ROOT = "/Users/phil/REWIND"

# 1. App.jsx — update the hash router to pathname router
with open(os.path.join(ROOT, "src/App.jsx")) as f:
    app = f.read()

# Replace hashchange listener
old_hash = """  // Hash routing for legal pages
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

new_path_router = """  // Pathname routing for SPA pages
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

app = app.replace(old_hash, new_path_router)

# Update product hash routing in the main content area
app = app.replace(
    """      if (window.location.hash.startsWith('#/product/')) {
        const pid = window.location.hash.replace('#/product/', '');""",
    """      if (getRoute().startsWith('product/')) {
        const pid = getRoute().replace('product/', '');"""
)

# Update admin detection
app = app.replace(
    "const isAdmin = window.location.hash === '#admin' || !!localStorage.getItem('rw_admin_email');",
    "const isAdmin = getRoute() === 'admin' || !!localStorage.getItem('rw_admin_email');"
)

# Update login response
app = app.replace(
    """if (d.admin) { window.location.hash = 'admin'; }""",
    """if (d.admin) { nav('/admin'); }"""
)

# Update product view routing
app = app.replace(
    """if (!window.location.hash.startsWith('#/product/')) {""",
    """if (!getRoute().startsWith('product/')) {"""
)

# Update admin hash check
app = app.replace(
    """const isAdminHash = window.location.hash === '#admin';""",
    """const isAdminHash = getRoute() === 'admin';"""
)

# Update empty hash check
app = app.replace(
    """} else if (window.location.hash === '') {""",
    """} else if (getRoute() === '') {"""
)

# Update product hash routing (second instance)
app = app.replace(
    """if (window.location.hash.startsWith('#/product/')) {
        const pid = window.location.hash.replace('#/product/', '');""",
    """if (getRoute().startsWith('product/')) {
        const pid = getRoute().replace('product/', '');"""
)

# Update payment-complete
app = app.replace(
    """if (window.location.hash.startsWith('#/payment-complete')) {""",
    """if (getRoute().startsWith('payment-complete')) {"""
)

with open(os.path.join(ROOT, "src/App.jsx"), "w") as f:
    f.write(app)
print("✅ App.jsx updated")

# 2. ProductPage.jsx
with open(os.path.join(ROOT, "src/components/ProductPage.jsx")) as f:
    pp = f.read()
pp = pp.replace(
    "import { Icon } from './Shell';",
    "import { Icon } from './Shell';\nimport { nav } from '../lib/router';"
)
pp = pp.replace(
    """window.location.hash = '#admin';""",
    """nav('/admin');"""
)
with open(os.path.join(ROOT, "src/components/ProductPage.jsx"), "w") as f:
    f.write(pp)
print("✅ ProductPage.jsx updated")

# 3. ChatBubble.jsx
with open(os.path.join(ROOT, "src/components/ChatBubble.jsx")) as f:
    cb = f.read()
cb = cb.replace(
    "if (typeof window !== 'undefined' && window.location.hash === '#admin') return null;",
    "if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return null;"
)
with open(os.path.join(ROOT, "src/components/ChatBubble.jsx"), "w") as f:
    f.write(cb)
print("✅ ChatBubble.jsx updated")

# 4. Shell.jsx — header logo + footer legal links
with open(os.path.join(ROOT, "src/components/Shell.jsx")) as f:
    sh = f.read()
if "import { nav }" not in sh:
    sh = sh.replace(
        "import React, { useState, useEffect, useRef } from 'react';\nimport { useCountdown, pad, money } from '../hooks/useCountdown';\nimport { IMG_BASE_URL } from '../data';",
        "import React, { useState, useEffect, useRef } from 'react';\nimport { useCountdown, pad, money } from '../hooks/useCountdown';\nimport { IMG_BASE_URL } from '../data';\nimport { nav } from '../lib/router';"
    )
sh = sh.replace(
    """window.location.hash = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new CustomEvent('reset-store'));""",
    """nav('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new CustomEvent('reset-store'));"""
)
sh = sh.replace(
    """window.location.hash = '/privacy'""",
    """nav('/privacy')"""
)
sh = sh.replace(
    """window.location.hash = '/terms'""",
    """nav('/terms')"""
)
sh = sh.replace(
    """window.location.hash = '/returns'""",
    """nav('/returns')"""
)
sh = sh.replace(
    """window.location.hash = '/shipping'""",
    """nav('/shipping')"""
)
with open(os.path.join(ROOT, "src/components/Shell.jsx"), "w") as f:
    f.write(sh)
print("✅ Shell.jsx updated")

# 5. AdminPanel.jsx
with open(os.path.join(ROOT, "src/components/AdminPanel.jsx")) as f:
    ap = f.read()
if "import { nav }" not in ap:
    ap = ap.replace(
        "import React, { useState, useEffect, useCallback, useRef } from 'react';",
        "import React, { useState, useEffect, useCallback, useRef } from 'react';\nimport { nav } from '../lib/router';"
    )
ap = ap.replace(
    """window.location.hash = ''; onSelect(product)""",
    """nav('/'); onSelect(product)"""
)
with open(os.path.join(ROOT, "src/components/AdminPanel.jsx"), "w") as f:
    f.write(ap)
print("✅ AdminPanel.jsx updated")

# 6. Shop.jsx — checkout redirect + admin link + logo clicks
with open(os.path.join(ROOT, "src/components/Shop.jsx")) as f:
    sp = f.read()
if "import { nav }" not in sp:
    sp = sp.replace(
        "import React, { useState, useEffect, useRef } from 'react';",
        "import React, { useState, useEffect, useRef } from 'react';\nimport { nav } from '../lib/router';"
    )
sp = sp.replace(
    """window.location.hash = '#admin';""",
    """nav('/admin');"""
)
sp = sp.replace(
    """window.location.hash = ''; window.dispatchEvent(new CustomEvent('reset-store')); onPlaced()""",
    """nav('/'); window.dispatchEvent(new CustomEvent('reset-store')); onPlaced()"""
)
sp = sp.replace(
    """window.location.hash = ''; window.dispatchEvent(new CustomEvent('reset-store')); onClose()""",
    """nav('/'); window.dispatchEvent(new CustomEvent('reset-store')); onClose()"""
)
with open(os.path.join(ROOT, "src/components/Shop.jsx"), "w") as f:
    f.write(sp)
print("✅ Shop.jsx updated")

# 7. SettingsPanel.jsx
with open(os.path.join(ROOT, "src/components/SettingsPanel.jsx")) as f:
    st = f.read()
if "import { nav }" not in st:
    st = st.replace(
        "import React from 'react';",
        "import React from 'react';\nimport { nav } from '../lib/router';"
    )
st = st.replace(
    """window.location.hash = '#admin';""",
    """nav('/admin');"""
)
with open(os.path.join(ROOT, "src/components/SettingsPanel.jsx"), "w") as f:
    f.write(st)
print("✅ SettingsPanel.jsx updated")

# 8. OrderTracking.jsx
with open(os.path.join(ROOT, "src/components/OrderTracking.jsx")) as f:
    ot = f.read()
if "import { nav }" not in ot:
    ot = ot.replace(
        "import React, { useState, useEffect } from 'react';",
        "import React, { useState, useEffect } from 'react';\nimport { nav } from '../lib/router';"
    )
ot = ot.replace(
    """window.location.hash = ''; if (onClose) onClose()""",
    """nav('/'); if (onClose) onClose()"""
)
# Second occurrence
ot = ot.replace(
    """window.location.hash = ''; if (onClose) onClose()""",
    """nav('/'); if (onClose) onClose()"""
)
with open(os.path.join(ROOT, "src/components/OrderTracking.jsx"), "w") as f:
    f.write(ot)
print("✅ OrderTracking.jsx updated")

# 9. CookieBanner.jsx
with open(os.path.join(ROOT, "src/components/CookieBanner.jsx")) as f:
    cb = f.read()
if "import { nav }" not in cb:
    cb = cb.replace(
        "import React from 'react';",
        "import React from 'react';\nimport { nav } from '../lib/router';"
    )
cb = cb.replace(
    """window.location.hash = '/privacy'""",
    """nav('/privacy')"""
)
with open(os.path.join(ROOT, "src/components/CookieBanner.jsx"), "w") as f:
    f.write(cb)
print("✅ CookieBanner.jsx updated")

# 10. ProductForm.jsx
with open(os.path.join(ROOT, "src/components/ProductForm.jsx")) as f:
    pf = f.read()
if "import { nav }" not in pf:
    pf = pf.replace(
        "import React, { useState } from 'react';",
        "import React, { useState } from 'react';\nimport { nav } from '../lib/router';"
    )
pf = pf.replace(
    """window.location.hash = '#/product/' + showProduct; window.location.reload();""",
    """nav('/product/' + showProduct);"""
)
with open(os.path.join(ROOT, "src/components/ProductForm.jsx"), "w") as f:
    f.write(pf)
print("✅ ProductForm.jsx updated")

# 11. Clean up any remaining hash references in src/
print("\n--- Checking for remaining hash references ---")
import subprocess
result = subprocess.run(
    ["grep", "-rn", r"location\.hash|hashchange|#admin|#/privacy|#/terms|#/returns|#/shipping", ROOT + "/src"],
    capture_output=True, text=True, timeout=10
)
remaining = [l for l in result.stdout.split('\n') if l.strip() and 'node_modules' not in l]
for r in remaining[:20]:
    print(f"  ⚠️  {r}")
if not remaining:
    print("  ✅ No remaining hash references!")

print("\nDone! Run 'npm run build' to verify.")
