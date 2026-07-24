#!/usr/bin/env python3
"""Add mute feature, fix generate-description, cleanup dead code."""
import os

ROOT = "/Users/phil/REWIND"

# ── 1. Add mute endpoints to chat-routes.js ──
with open(os.path.join(ROOT, "api/chat-routes.js")) as f:
    chat = f.read()

# Add mute rate limiter (counts msgs per session per minute for auto-mute)
# After the existing rate limiters
old_after_limiters = """  const startLimited = makeLimiter();
  const sendLimited = makeLimiter();
  const readLimited = makeLimiter();
  const aiReplyCount = new Map();
  const verificationCodes = new Map();"""

new_after_limiters = """  const startLimited = makeLimiter();
  const sendLimited = makeLimiter();
  const readLimited = makeLimiter();
  const muteMsgCount = new Map(); // session_id -> [{timestamp}]
  const aiReplyCount = new Map();
  const verificationCodes = new Map();"""

chat = chat.replace(old_after_limiters, new_after_limiters)

# Modify the send endpoint to check mute and auto-mute
old_send = """  router.post('/api/chat/send', async (req, res) => {
    const { session_id, message } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });
    if (sendLimited(session_id, 20, 60 * 1000)) {
      return res.status(429).json({ error: 'Slow down a little.' });
    }
    try {
      await sfetch('/chat_messages',"""

new_send = """  router.post('/api/chat/send', async (req, res) => {
    const { session_id, message } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });
    if (sendLimited(session_id, 20, 60 * 1000)) {
      return res.status(429).json({ error: 'Slow down a little.' });
    }
    // Check if session is muted
    try {
      const sessCheck = await sfetch('/chat_sessions?session_id=eq.' + encodeURIComponent(session_id) + '&select=muted_until,status');
      const sessData = await sessCheck.json();
      const sess = Array.isArray(sessData) && sessData.length > 0 ? sessData[0] : null;
      if (sess && sess.muted_until) {
        const until = new Date(sess.muted_until).getTime();
        if (Date.now() < until) {
          const remaining = Math.ceil((until - Date.now()) / 60000);
          return res.status(403).json({ error: 'muted', mutedFor: remaining, message: 'You are muted for ' + remaining + ' more minute(s).' });
        }
      }
    } catch {}
    // Auto-mute: if >10 messages in the last 60 seconds, mute for 1 hour
    const now = Date.now();
    const msgTimes = (muteMsgCount.get(session_id) || []).filter(t => now - t < 60000);
    msgTimes.push(now);
    muteMsgCount.set(session_id, msgTimes);
    if (msgTimes.length > 10) {
      try {
        const muteUntil = new Date(now + 3600000).toISOString();
        await sfetch('/chat_sessions?session_id=eq.' + encodeURIComponent(session_id), {
          method: 'PATCH',
          body: JSON.stringify({ muted_until: muteUntil }),
        });
        muteMsgCount.delete(session_id);
        return res.status(403).json({ error: 'muted', mutedFor: 60, message: 'Auto-muted for sending too many messages. Try again in 60 minutes.' });
      } catch {}
    }
    try {
      await sfetch('/chat_messages',"""

chat = chat.replace(old_send, new_send)

# Add mute/unmute endpoints after the close endpoint
old_close_end = """  router.delete('/api/admin/chat/session', requireAdmin, async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      await Promise.all([
        sfetch(`/chat_messages?session_id=eq.${encodeURIComponent(session_id)}`, { method: 'DELETE' }),
        sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, { method: 'DELETE' }),
      ]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not delete session' }); }
  });"""

new_close_end = """  router.delete('/api/admin/chat/session', requireAdmin, async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      await Promise.all([
        sfetch(`/chat_messages?session_id=eq.${encodeURIComponent(session_id)}`, { method: 'DELETE' }),
        sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, { method: 'DELETE' }),
      ]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not delete session' }); }
  });

  // ── Admin: mute a session for a duration ──
  router.post('/api/admin/chat/mute', requireAdmin, async (req, res) => {
    const { session_id, duration_minutes } = req.body || {};
    if (!session_id || !duration_minutes) return res.status(400).json({ error: 'session_id and duration_minutes required' });
    try {
      const muteUntil = new Date(Date.now() + duration_minutes * 60000).toISOString();
      await sfetch('/chat_sessions?session_id=eq.' + encodeURIComponent(session_id), {
        method: 'PATCH',
        body: JSON.stringify({ muted_until: muteUntil }),
      });
      muteMsgCount.delete(session_id);
      res.json({ ok: true, muted_until: muteUntil });
    } catch (e) {
      res.status(500).json({ error: 'Could not mute session' });
    }
  });

  // ── Admin: unmute a session ──
  router.post('/api/admin/chat/unmute', requireAdmin, async (req, res) => {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      await sfetch('/chat_sessions?session_id=eq.' + encodeURIComponent(session_id), {
        method: 'PATCH',
        body: JSON.stringify({ muted_until: null }),
      });
      muteMsgCount.delete(session_id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Could not unmute session' });
    }
  });"""

chat = chat.replace(old_close_end, new_close_end)

with open(os.path.join(ROOT, "api/chat-routes.js"), "w") as f:
    f.write(chat)
print("1. ✅ chat-routes.js — mute/unmute + auto-mute")

# ── 2. Fix generate-description — remove hardened stub, replace with actual generation ──
with open(os.path.join(ROOT, "api/server.js")) as f:
    sv = f.read()

sv = sv.replace(
    "app.post('/api/generate-description', async (req, res) => {\n  res.json({ title: 'Vintage Streetwear Piece', description: 'Hand-picked vintage item. Authenticated, steam-cleaned, and ready to wear.' });\n});",
    "app.post('/api/generate-description', async (req, res) => {\n  const { name, brand } = req.body || {};\n  if (!name) return res.json({ title: 'Vintage Streetwear Piece', description: 'Hand-picked vintage item. Authenticated, steam-cleaned, and ready to wear.' });\n  const suggestions = {\n    'cotton': '100% cotton construction for breathable comfort and lasting durability.',\n    'jersey': 'Soft cotton jersey knit with a smooth, lightweight feel perfect for layering.',\n    'windbreaker': 'Lightweight nylon shell with water-resistant finish. Original zipper hardware.',\n    'knit': 'Heavyweight knit with ribbed cuffs and hem. Pre-shrunk for consistent fit.',\n    'denim': 'Sturdy denim with authentic fading. Triple-stitched seams throughout.',\n    'leather': 'Genuine leather with natural patina. Fully lined interior.',\n  };\n  const lower = name.toLowerCase();\n  let desc = '';\n  for (const [keyword, text] of Object.entries(suggestions)) {\n    if (lower.includes(keyword)) { desc = text; break; }\n  }\n  if (!desc) desc = 'Authenticated vintage piece, steam-cleaned and ready to wear.';\n  if (brand) desc = brand + ' ' + desc.charAt(0).toLowerCase() + desc.slice(1);\n  res.json({ title: name, description: desc });\n});"
)

with open(os.path.join(ROOT, "api/server.js"), "w") as f:
    f.write(sv)
print("2. ✅ generate-description — dynamic generation based on product name")

# Update the frontend call to send name+brand
with open(os.path.join(ROOT, "src/components/ProductForm.jsx")) as f:
    pf = f.read()

pf = pf.replace(
    "body: JSON.stringify({ imageBase64: base64 })",
    "body: JSON.stringify({ name: form.name, brand: form.brand, imageBase64: base64 })"
)

with open(os.path.join(ROOT, "src/components/ProductForm.jsx"), "w") as f:
    f.write(pf)
print("3. ✅ ProductForm.jsx — sends name+brand for description generation")

# ── 4. Fix CreatePromoCode.jsx — use Web Crypto API ──
with open(os.path.join(ROOT, "src/components/CreatePromoCode.jsx")) as f:
    cp = f.read()

cp = cp.replace(
    "const generateCode = () => {\n    const prefix = 'RW';\n    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n    let rand = '';\n    for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];\n    setCode(prefix + rand);\n  };",
    "const generateCode = () => {\n    const prefix = 'RW';\n    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n    const arr = new Uint8Array(6);\n    crypto.getRandomValues(arr);\n    let rand = '';\n    for (let i = 0; i < 6; i++) rand += chars[arr[i] % chars.length];\n    setCode(prefix + rand);\n  };"
)

with open(os.path.join(ROOT, "src/components/CreatePromoCode.jsx"), "w") as f:
    f.write(cp)
print("4. ✅ CreatePromoCode.jsx — crypto.getRandomValues")

# ── 5. Remove dead verificationCodes code from chat-routes.js ──
with open(os.path.join(ROOT, "api/chat-routes.js")) as f:
    cr = f.read()

# Remove the verification codes Map and its cleanup interval
cr = cr.replace(
    "  const muteMsgCount = new Map(); // session_id -> [{timestamp}]\n  const aiReplyCount = new Map();\n  const verificationCodes = new Map();\n  setInterval(() => {\n    const now = Date.now();\n    for (const [email, entry] of verificationCodes) {\n      if (entry.expiresAt < now) verificationCodes.delete(email);\n    }\n  }, 300000);",
    "  const muteMsgCount = new Map(); // session_id -> [{timestamp}]\n  const aiReplyCount = new Map();"
)

# Remove the send-verification and verify-code endpoints
old_verify_start = "  // ── Send verification code (CSPRNG) ──"
old_verify_end = "    res.json({ verified: true });\n  });\n\n  return router;"

new_verify = "  return router;"

# Find the verification endpoints and remove them
verify_section = cr[cr.find(old_verify_start):cr.find("  return router;")]
if verify_section:
    cr = cr.replace(verify_section, "")
    print(f"5. ✅ Removed dead verification code endpoints ({len(verify_section)} chars)")
else:
    print("5. ⚠️ Could not find verification section")

with open(os.path.join(ROOT, "api/chat-routes.js"), "w") as f:
    f.write(cr)

print("\nBackend done! Now updating frontend...")
