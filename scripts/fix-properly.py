#!/usr/bin/env python3
"""Fix all issues with targeted patches, not global replace."""

# 1. Fix parseImgs function in Shell.jsx
import subprocess

with open('src/components/Shell.jsx') as f:
    shell = f.read()

# Fix parseImgs — was corrupted by blind find-and-replace
old_parse = """function parseImgs(p) {
  const imgs = parseImgs(p)[0] || p.imgs || parseImgs(p)[0] || p.img;
  if (Array.isArray(imgs)) return imgs;
  if (typeof imgs === 'string' && imgs.startsWith('[')) { try { return JSON.parse(imgs); } catch {} }
  return imgs ? [imgs] : [];
}"""

new_parse = """function parseImgs(p) {
  const raw = p.imgs || p.img;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) { try { return JSON.parse(raw); } catch {} }
  return raw ? [raw] : [];
}"""

shell = shell.replace(old_parse, new_parse)

# Fix Photo component to use parseImgs for the first image
# The Photo component likely uses p.img to get the image URL
# Find: const images = [p.img || ''];
shell = shell.replace(
    "const images = [p.img || ''];",
    "const images = parseImgs(p);"
)

# In the card rendering, the main image is shown via <Photo img={p.img} ... />
# We need to update it to use the first image from parseImgs
shell = shell.replace(
    "img={p.img}",
    "img={(parseImgs(p)[0] || p.img)}"
)

# But DON'T replace img in parseImgs body — it was already fixed above

# Fix the quick-add/flash image references
shell = shell.replace(
    "src={p.img}",
    "src={parseImgs(p)[0] || p.img}"
)

with open('src/components/Shell.jsx', 'w') as f:
    f.write(shell)
print("1. Shell.jsx fixed")

# 2. Fix Shop.jsx — same parseImgs corruption
with open('src/components/Shop.jsx') as f:
    shop = f.read()

# Fix parseImgs 
old_parse2 = """function parseImgs(p) {
  const imgs = parseImgs(p)[0] || p.imgs || parseImgs(p)[0] || p.img;
  if (Array.isArray(imgs)) return imgs;
  if (typeof imgs === 'string' && imgs.startsWith('[')) { try { return JSON.parse(imgs); } catch {} }
  return imgs ? [imgs] : [];
}"""

new_parse2 = """function parseImgs(p) {
  const raw = p.imgs || p.img;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.startsWith('[')) { try { return JSON.parse(raw); } catch {} }
  return raw ? [raw] : [];
}"""

shop = shop.replace(old_parse2, new_parse2)

# Fix QuickView image — uses product.img
shop = shop.replace(
    "src={product.img}",
    "src={parseImgs(product)[0] || product.img}"
)

# Fix card images
shop = shop.replace(
    "img={p.img}",
    "img={parseImgs(p)[0] || p.img}"
)

# Fix card <img src={p.img} ...
shop = shop.replace(
    "src={p.img}",
    "src={parseImgs(p)[0] || p.img}"
)

with open('src/components/Shop.jsx', 'w') as f:
    f.write(shop)
print("2. Shop.jsx fixed")

# 3. ProductPage.jsx — revert and redo the fix
with open('src/components/ProductPage.jsx') as f:
    pp = f.read()

# Fix: images variable should use parseImgs
pp = pp.replace(
    "const images = [p.img || ''];",
    "const images = (() => { const raw = p.imgs || p.img; if (Array.isArray(raw)) return raw; if (typeof raw === 'string' && raw.startsWith('[')) { try { return JSON.parse(raw); } catch {} } return raw ? [raw] : []; })();"
)

with open('src/components/ProductPage.jsx', 'w') as f:
    f.write(pp)
print("3. ProductPage.jsx fixed")

# 4. Fix chat — re-add the fix for message disappearing
with open('src/components/ChatBubble.jsx') as f:
    cb = f.read()

# Fix message send — don't fetchMessages immediately
old_send = """      } else {
        setMessages((prev) => [...prev, { sender: 'customer', message: text, created_at: new Date().toISOString() }]);
        await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, message: text }),
        });
        fetchMessages(true);
      }"""

new_send = """      } else {
        const optimistic = { sender: 'customer', message: text, created_at: new Date().toISOString() };
        setMessages((prev) => [...prev, optimistic]);
        try {
          await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, message: text }),
          });
        } catch {}
      }"""

cb = cb.replace(old_send, new_send)

# Fix poll interval
cb = cb.replace(
    "const OPEN_POLL_MS = 5000;",
    "const OPEN_POLL_MS = 3000;"
)

with open('src/components/ChatBubble.jsx', 'w') as f:
    f.write(cb)
print("4. ChatBubble.jsx fixed")

# 5. EditProductPanel — add catalog product guard
with open('src/components/EditProductPanel.jsx') as f:
    ep = f.read()

ep = ep.replace(
    "  const [saving, setSaving] = useState(false);\n  const [msg, setMsg] = useState('');\n\n  const handleSave",
    "  const [saving, setSaving] = useState(false);\n  const [msg, setMsg] = useState('');\n  const isCatalogProduct = !product.product_id && REWIND_CATS.length > 0;\n\n  const handleSave"
)

ep = ep.replace(
    "    setSaving(true); setMsg('');\n    const result = await updateCustomProduct",
    "    if (isCatalogProduct) {\n      setMsg('❌ Catalog products cannot be edited here — add a custom product instead');\n      return;\n    }\n    setSaving(true); setMsg('');\n    const result = await updateCustomProduct"
)

with open('src/components/EditProductPanel.jsx', 'w') as f:
    f.write(ep)
print("5. EditProductPanel.jsx fixed")

print("\nAll fixes applied!")
