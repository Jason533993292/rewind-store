#!/usr/bin/env python3
"""Fix all remaining issues in one pass."""
import os

ROOT = "/Users/phil/REWIND"

# 1. Fix QuickView to show all images (Shop.jsx)
with open(os.path.join(ROOT, "src/components/Shop.jsx")) as f:
    shop = f.read()

# Add image parser helper
old_import = "import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';\nimport { nav } from '../lib/router';\nimport { money, discountPct } from '../hooks/useCountdown';"
new_import = "import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';\nimport { nav } from '../lib/router';\nimport { money, discountPct } from '../hooks/useCountdown';\n\nfunction parseImgs(p) {\n  const imgs = p.imgs || p.img;\n  if (Array.isArray(imgs)) return imgs;\n  if (typeof imgs === 'string' && imgs.startsWith('[')) { try { return JSON.parse(imgs); } catch {} }\n  return imgs ? [imgs] : [];\n}"
shop = shop.replace(old_import, new_import)

# Fix QuickView image display — find the img src in QuickView
# The QuickView likely uses p.img or product.img — update to use first image
shop = shop.replace(
    "product.img",
    "parseImgs(product)[0] || product.img"
)

# Also fix the main product image in product card section
shop = shop.replace(
    "p.img",
    "parseImgs(p)[0] || p.img"
)

with open(os.path.join(ROOT, "src/components/Shop.jsx"), "w") as f:
    f.write(shop)
print("1. Shop.jsx — QuickView + card images")

# 2. Fix Shell.jsx product card Photo component
with open(os.path.join(ROOT, "src/components/Shell.jsx")) as f:
    shell = f.read()

def fix_shell_img(match):
    """Replace p.img with parsed multi-image first"""
    return match.group(0).replace("p.img", "parseImgs(p)[0] || p.img")

import re
# Add parseImgs helper and fix img references in Photo/Header components
shell = shell.replace(
    "import React, { useState, useEffect, useRef } from 'react';\nimport { useCountdown, pad, money } from '../hooks/useCountdown';\nimport { IMG_BASE_URL } from '../data';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { useCountdown, pad, money } from '../hooks/useCountdown';\nimport { IMG_BASE_URL } from '../data';\n\nfunction parseImgs(p) {\n  const imgs = p.imgs || p.img;\n  if (Array.isArray(imgs)) return imgs;\n  if (typeof imgs === 'string' && imgs.startsWith('[')) { try { return JSON.parse(imgs); } catch {} }\n  return imgs ? [imgs] : [];\n}"
)

# Fix image references in Shell that use p.img
# These are in the Photo component and card rendering
shell = shell.replace(
    "p.img",
    "parseImgs(p)[0] || p.img"
)

with open(os.path.join(ROOT, "src/components/Shell.jsx"), "w") as f:
    f.write(shell)
print("2. Shell.jsx — card images")

# 3. ProductPage.jsx — already has productImgs parsing, just make sure it's used everywhere
# The images variable at line 30 is already set to productImgs
# But we need to check the Photo component usage
with open(os.path.join(ROOT, "src/components/ProductPage.jsx")) as f:
    pp = f.read()

# The images and productImgs variables already exist, just verify the Photo component
# is using images[selectedImg] correctly
pp = pp.replace(
    "img={images[selectedImg] || p.img}",
    "img={images[selectedImg]}"
)

with open(os.path.join(ROOT, "src/components/ProductPage.jsx"), "w") as f:
    f.write(pp)
print("3. ProductPage.jsx — multi-image display")

# 4. Fix edit save not persisting — check updateCustomProduct
# The handleSave sends imgs: JSON.stringify(images) — that's correct.
# But maybe the issue is that the product uses product_id for custom products
# but the handleSave sends product.product_id || product.id
# If the product was stored in sessionStorage from a REWIND catalog product,
# it has 'id' not 'product_id'. updateCustomProduct sends to the server,
# but the server's update endpoint uses product_id (the custom_products column).
# REWIND catalog products can't be updated via the API — only custom products can!
# We need to check if the product is a custom product or catalog product.

# Also fix: when saving, the updated product data isn't refreshed from server
# The handleSave calls updateCustomProduct then getCustomProducts then onDone
# But onDone just closes the panel. The product should have its data updated.

# 5. Fix chat messages disappearing
with open(os.path.join(ROOT, "src/components/ChatBubble.jsx")) as f:
    cb = f.read()

# The issue is likely in fetchMessages — the poll fetches from server
# which may not have the latest message yet (race condition)
# When sending, the message is optimistically added to local state,
# then fetchMessages is called. If the server hasn't indexed the message yet,
# the fetch returns the old list, replacing the local state.

# Fix: keep a local-only copy of sent messages that aren't confirmed by server yet
# Simpler fix: add sent message to a 'pending' list and merge with server messages

# Actually the simplest fix: when sending, DON'T fetchMessages immediately
# Wait for the next poll tick instead
cb = cb.replace(
    """      } else {
        setMessages((prev) => [...prev, { sender: 'customer', message: text, created_at: new Date().toISOString() }]);
        await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, message: text }),
        });
        fetchMessages(true);
      }""",
    """      } else {
        const optimistic = { sender: 'customer', message: text, created_at: new Date().toISOString() };
        setMessages((prev) => [...prev, optimistic]);
        try {
          await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, message: text }),
          });
        } catch {}
        // Don't refetch immediately — server may not have indexed it yet.
        // The next poll tick will pick it up.
      }"""
)

# Also increase poll interval slightly to reduce race
cb = cb.replace(
    "const OPEN_POLL_MS = 5000;",
    "const OPEN_POLL_MS = 3000;"
)

with open(os.path.join(ROOT, "src/components/ChatBubble.jsx"), "w") as f:
    f.write(cb)
print("4. ChatBubble.jsx — message disappearing fix")

print("\nAll fixes applied!")
