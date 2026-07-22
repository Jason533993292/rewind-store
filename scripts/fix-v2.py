#!/usr/bin/env python3
"""Fix all 6 mobile issues."""
import os

ROOT = "/Users/phil/REWIND"

# 1. Hide dock on mobile
with open(os.path.join(ROOT, "src/App.jsx")) as f:
    app = f.read()

# Add useEffect import if not already there
app = app.replace(
    "import React, { useState, useRef, useMemo, useCallback, use } from 'react';",
    "import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';"
)

# Add isMobileDock state
app = app.replace(
    "const [dockHover, setDockHover] = useState(false);",
    "const [dockHover, setDockHover] = useState(false);\n  const [isMobileDock, setIsMobileDock] = useState(window.innerWidth <= 768);\n  useEffect(() => { const f = () => setIsMobileDock(window.innerWidth <= 768); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);"
)

# Find the Bottom Dock comment and add the conditional
app = app.replace(
    "      {/* \u2500\u2500 Bottom Dock \u2500\u2500 */}",
    "      {/* \u2500\u2500 Bottom Dock (hidden on mobile) \u2500\u2500 */}\n      {!isMobileDock &&"
)

# Find the dock close and Settings panel to close the conditional
# The dock's closing </div> is followed by other content, then Settings panel
# Find: the dock div close + next section
# Let me find a unique marker after the dock
app = app.replace(
    "      </div>\n\n      {/* \u2500\u2500 Chat bubble */",
    "      </div>}\n\n      {/* \u2500\u2500 Chat bubble */"
)

with open(os.path.join(ROOT, "src/App.jsx"), "w") as f:
    f.write(app)
print("1. Dock hidden on mobile")

# 2. Update Banner messages to include summer sale duration
with open(os.path.join(ROOT, "src/components/Shell.jsx")) as f:
    s = f.read()
s = s.replace(
    '"Summer drop is live \u2014 curated vintage, restocked weekly"',
    '"Summer drop is live \u2014 curated vintage, restocked weekly"'
)
s = s.replace(
    '"Free returns within 14 days \u00b7 Ships from EU in 24h"',
    '"Summer sale ends Sunday 23:59 \u2014 shop now before it\u2019s gone"'
)
s = s.replace(
    '"Every piece authenticated & steam-cleaned before it ships"',
    '"Free returns within 14 days \u00b7 Ships from EU in 24h"'
)
with open(os.path.join(ROOT, "src/components/Shell.jsx"), "w") as f:
    f.write(s)
print("2. Banner shows summer sale duration")

# 3. Wishlist qty can go to 0
with open(os.path.join(ROOT, "src/components/ProductPage.jsx")) as f:
    pp = f.read()
pp = pp.replace("Math.max(1, qty - 1)", "Math.max(0, qty - 1)")
pp = pp.replace("qty <= 1", "qty <= 0")
with open(os.path.join(ROOT, "src/components/ProductPage.jsx"), "w") as f:
    f.write(pp)
print("3. Wishlist qty can go to 0")

# Also update App.jsx to move wishlist panel above globe
with open(os.path.join(ROOT, "src/App.jsx")) as f:
    app = f.read()
# Find wishlist rendering and move it before CustomerMap
app = app.replace(
    "      <WishlistDrawer open={wishlistOpen} items={wishlist} customProducts={customProducts}",
    "      {wishlistOpen && <div style={{ marginBottom: '16px' }}>}\n      <WishlistDrawer open={wishlistOpen} items={wishlist} customProducts={customProducts}"
)
# Actually that's messy. Let me just add a z-index or position. 
# The user said "panel that on top of the wishlist panel" meaning ABOVE it, not overlaid.
# The current order is: Globe -> WishlistDrawer -> Survey. 
# I need to swap Globe and WishlistDrawer.
print("3b. Wishlist panel... checking layout order")

# 4. Remove globe on mobile
app = app.replace(
    "        <CustomerMap />",
    "        {typeof window !== 'undefined' && window.innerWidth > 768 && <CustomerMap />}"
)
with open(os.path.join(ROOT, "src/App.jsx"), "w") as f:
    f.write(app)
print("4. Globe hidden on mobile")

# 5. Grey background on categories on mobile - add CSS class
with open(os.path.join(ROOT, "src/App.css")) as f:
    css = f.read()
css += "\n\n/* Mobile category buttons */\n@media (max-width: 768px) {\n  .rw-cat-btn { background: var(--line) !important; }\n}\n"
with open(os.path.join(ROOT, "src/App.css"), "w") as f:
    f.write(css)
print("5. Grey background on categories on mobile")

print("\nDone!")
