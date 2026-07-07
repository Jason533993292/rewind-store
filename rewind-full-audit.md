# REWIND Store — Full Codebase + AI Review Prompt

**rewind-stores.com** — Vintage streetwear e-commerce
**Stack:** React/Vite · Express · Supabase · Stripe · Resend · Gemini AI
**Bundle:** 544KB JS + 32KB CSS · **Version:** V8.0.0
**Deployed:** Railway (rewind-store-production-2299.up.railway.app) + Cloudflare (rewind-stores.com)

---

## CRITICAL CONTEXT

- Admin token: `Phil4ever!` (stored in localStorage as `rw_admin_token`)
- Supabase service role key used server-side (no anon write access)
- Chat tables: `chat_sessions`, `chat_messages` (RLS enabled, no anon policies)
- Promo codes table: `promo_codes` (for admin-generated codes)
- Blocked emails/IPs hydrated from Supabase on server boot
- Gemini AI auto-replies in chat via `gemini-2.5-flash`
- Stripe webhooks have signature verification

---

## Recent changes (V8.0.0)

- Live chat system (ChatBubble.jsx + chat-routes.js + admin chat panel)
- Separate modals for Close session, Block email, Give promo in admin chat
- Notification badge on 💬 Chats tab (polls every 10s)
- Session closed UI for customers ("Session closed" + "Open a new one")
- Spinning refresh button (SVG icon + CSS spinner)
- Version restored from localStorage after page refresh
- Admin token now reads from localStorage on mount (was lost on refresh)
- Cancel flow with step indicators (1→2→3 in same panel)
- Canned emails for predefined cancel reasons, AI only for "Other"
- Removed unused deps (react-router-dom, react-select)
- Added content-visibility + loading="lazy" optimizations

---

## Source files

### File: src/App.jsx (3000+ lines — KEY STRUCTURE)

\`\`\`jsx
// IMPORTS
import ChatBubble from './components/ChatBubble';
// ... other imports ...

const VERSION = 'V8.0.0';

function App() {
  // State: products, cart, wishlist, checkout, admin mode, chat, etc.
  // Effects: auth, scroll, hash routing
  // Returns: <ClickSpark><Header/><Hero/><Marquee/><ProductGrid/>...</ClickSpark>
}

// AdminPanel (lines ~1000-1988)
// - Tabs: users, email, orders, chats, saved, blocked, products
// - Cancel flow with step indicators
// - Admin chat panel integrated

// AdminChatPanel (lines ~1931-2300)
// - Session list with email, hover preview, refresh
// - Message view with sender labels, close X button
// - Separate modals: Close session, Block email, Give promo
// - Notification polling every 10s

// BlockedPanel (lines ~2300+)
// Other utility components...
\`\`\`

### File: src/components/ChatBubble.jsx

\`\`\`jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_KEY = 'rw_chat_session';
const OPEN_POLL_MS = 5000;
const BADGE_POLL_MS = 30000;
const WELCOME = "Hey! Ask us anything about sizing, an item, or your order.";

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    try { return localStorage.getItem(SESSION_KEY) || null; } catch { return null; }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sessionStatus, setSessionStatus] = useState('open');
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  // Fetch messages + session status
  const fetchMessages = useCallback(async (markRead) => {
    if (!sessionId) return;
    try {
      const r = await fetch(`/api/chat/messages?session_id=${sessionId}`);
      const d = await r.json();
      setMessages(Array.isArray(d.messages) ? d.messages : []);
      setSessionStatus(d.status || 'open');
      // Track unread admin messages, beep on new ones
      const unreadAdmin = d.messages?.filter(m => m.sender === 'admin' && !m.read_by_customer).length || 0;
      if (!open && unreadAdmin > lastCountRef.current) beep();
      setUnread(unreadAdmin);
      if (markRead && unreadAdmin > 0) {
        fetch('/api/chat/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) }).catch(() => {});
      }
      lastCountRef.current = unreadAdmin;
    } catch {}
  }, [sessionId, open]);

  // Poll: 5s when open, 30s when closed
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => fetchMessages(open), open ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [sessionId, open, fetchMessages]);

  // Auto-scroll
  useEffect(() => { if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setInput('');
    try {
      if (!sessionId) {
        const r = await fetch('/api/chat/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
        const d = await r.json();
        if (d.session_id) {
          localStorage.setItem(SESSION_KEY, d.session_id);
          setSessionId(d.session_id);
          setMessages([{ sender: 'customer', message: text, created_at: new Date().toISOString() }]);
        }
      } else {
        setMessages(prev => [...prev, { sender: 'customer', message: text, created_at: new Date().toISOString() }]);
        await fetch('/api/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, message: text }) });
        fetchMessages(true);
      }
    } catch { setInput(text); }
    finally { setSending(false); }
  }

  // Don't render on admin pages (after all hooks, so React hook order is consistent)
  if (typeof window !== 'undefined' && window.location.hash === '#admin') return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 10000 }}>
      {open && (
        <div style={{ width: '360px', height: '480px', background: '#fff', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', marginBottom: '12px', overflow: 'hidden' }}>
          {/* Header with New button + close */}
          {/* Messages area */}
          {/* Input: if closed show "Session closed" + Close/Open buttons, else type input */}
        </div>
      )}
      <button onClick={open ? () => setOpen(false) : () => { setOpen(true); setUnread(0); if (sessionId) fetchMessages(true); }}
        style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
        {open ? '×' : '💬'}
        {!open && unread > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#16130F', color: '#fff', borderRadius: '999px', fontSize: '11px', fontWeight: 700, minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>
    </div>
  );
}
\`\`\`

### File: api/chat-routes.js (274 lines)

\`\`\`js
import express from 'express';
import crypto from 'crypto';

const MAX_MESSAGE_LEN = 2000;
function makeLimiter() { const hits = new Map(); return (key, max, windowMs) => { const now = Date.now(); const arr = (hits.get(key) || []).filter(t => now - t < windowMs); arr.push(now); hits.set(key, arr); return arr.length > max; }; }
function getIp(req) { return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip; }

export function buildChatRouter({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, resend, FROM_EMAIL, REPLY_TO, notifyEmail, requireAdmin }) {
  const router = express.Router();
  const sfetch = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...opts, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

  const startLimited = makeLimiter(); // 3 chats / 10 min / IP
  const sendLimited = makeLimiter();  // 20 msgs / min / session
  const readLimited = makeLimiter();  // 30 polls / min / session

  // POST /api/chat/start — rate-limited, creates session, sends notification email, fires AI auto-reply (fire-and-forget)
  // POST /api/chat/send — sends follow-up message, rate-limited per session
  // GET /api/chat/messages — polls messages + session status (returns { messages, status })
  // POST /api/chat/mark-read — marks admin messages as read by customer
  // GET /api/admin/chat/sessions — admin: list all sessions (requireAdmin)
  // GET /api/admin/chat/messages — admin: view session messages (requireAdmin)
  // POST /api/admin/chat/reply — admin: reply + optional close (requireAdmin)

  return router;
}

// AI auto-reply (fire-and-forget, never touches res)
export async function getAiAutoReply(messageText, GEMINI_API_KEY) {
  try {
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are an AI assistant for REWIND vintage streetwear. Answer concisely. Knowledge: product details in item panel; shipping €8 EU, free > €150; 14-day returns; each item unique vintage; ship within 24h; authenticated/steam-cleaned. Customer: "${messageText}". If unknown: "Contact orders@rewind-stores.com"` }] }],
        generationConfig: { maxOutputTokens: 300 },
      }),
    });
    const aiData = await aiRes.json();
    return aiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}
\`\`\`

### File: api/middleware/requireAdmin.js

\`\`\`js
import crypto from 'crypto';

export function requireAdmin(req, res, next) {
  const configuredToken = process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_API_TOKEN;
  if (!configuredToken) return res.status(500).json({ error: 'Admin auth is not configured' });
  const header = req.headers['authorization'] || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : (req.headers['x-admin-token'] || '').trim();
  if (!provided) return res.status(401).json({ error: 'Missing admin token' });
  const a = Buffer.from(provided);
  const b = Buffer.from(configuredToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Invalid admin token' });
  next();
}
\`\`\`

### File: api/server.js (970 lines — KEY SECTIONS)

\`\`\`js
// Imports: express, Stripe, Resend, helmet, rateLimit, chat-routes, requireAdmin
// Module-level consts: SUPABASE_URL, SUPABASE_KEY, SERVICE_KEY, resend, stripe

// ROUTES:
// GET /api/health
// GET /api/env (requireAdmin)
// POST /api/verify-admin (token + admin table check)
// POST /api/validate-promo (static list + DB lookup)
// POST /api/admin/create-promo (requireAdmin — writes to promo_codes table)
// POST /api/manage-admins (requireAdmin)
// POST /api/create-checkout-session (blocked email check, server-side pricing, Stripe session)
// POST /api/send-order (internal token check)
// GET /api/admin/users, /api/admin/orders, /api/admin/user-emails (requireAdmin)
// POST /api/save-order (requireAdmin)
// POST /api/stripe-webhook (signature verification, payment failure handling)
// POST /api/admin/cancel-order, /api/admin/undo-cancel-order (requireAdmin)
// POST /api/admin/preview-cancel-email (requireAdmin, Gemini for Other reasons)
// POST /api/admin/block-ip, /api/admin/unblock-ip (requireAdmin)
// POST /api/admin/block-email, /api/admin/unblock-email (requireAdmin)
// POST /api/check-blocked-email
// Chat router mounts via buildChatRouter(...)
// SPA fallback with Cache-Control: no-store

// Hydrates in-memory BLOCKED_IPS/BLOCKED_EMAILS from Supabase on boot
\`\`\`

### File: supabase-setup.sql

\`\`\`sql
-- orders: order_num, customer_name, email, status, total, items, stripe_session_id
-- wishlists: email, product_ids (JSONB)
-- admins: email (unique)
-- blocked_ips: ip, reason
-- blocked_emails: email, reason
-- custom_products: name, brand, cat, price, image, sizes
-- chat_sessions: session_id (PK), customer_email, customer_name, status, last_message_at
-- chat_messages: id, session_id (FK), sender, message, read_by_customer, read_by_admin
-- promo_codes: code (unique), discount, label, used
\`\`\`

---

## 🚨 AI Review Prompt — Copy everything above + below into Claude

I run a vintage streetwear store at **rewind-stores.com**.

**Stack:** React/Vite (544KB bundle) · Express/node · Supabase · Stripe · Resend · Gemini AI
**Version:** V8.0.0 · **Deployed on:** Railway + Cloudflare

### What's new since last review:
- Full live chat system (customer widget + admin panel + AI auto-reply)
- Separate popup modals for Close session, Block email, Give promo
- Notification badge on Chats tab (polls every 10s)
- Step-indicator cancel flow in admin (reason → preview email → refund)
- Canned emails for predefined cancel reasons (AI only for "Other")
- Chat session closed UI for customers
- Promo codes now stored in DB (work in checkout)
- Admin token reads from localStorage on mount (prevents blank tabs after refresh)
- SVG refresh spinner, chat panel with email display, block email with preset reasons

### Please review for:

**1. SECURITY (CRITICAL)**
- Any endpoint missing `requireAdmin` that should have it
- Stripe webhook signature verification gaps
- Price/discount tampering in checkout (client-supplied prices)
- AI auto-reply crash risk (should be fire-and-forget)
- Rate limiter bypass risks on chat endpoints
- HTML/SQL injection vectors in chat/email/checkout
- Data over-exposure in any API response

**2. BUGS**
- React hook order violations (early returns before hooks)
- Stale closures / missing deps in useEffect/useCallback
- Chat session localStorage persistence across tabs/devices
- Race conditions in polling (setInterval cleanup)
- `SERVICE_KEY is not defined` type scope errors
- Admin token lost on refresh (already fixed in V8.0.0 — verify)
- Any silent failures (catch{} blocks with no logging)

**3. UI/UX**
- Chat panel missing loading/error/empty states
- Mobile responsiveness for chat bubble + admin panel
- Accessibility: aria-labels, keyboard navigation, focus management
- Any hardcoded text that should be configurable

**4. CODE QUALITY**
- Duplicate code patterns (server.js vs chat-routes.js)
- Unused imports or dead code
- CSS that could be consolidated
- Performance: large re-renders, unnecessary useEffect runs
- The AdminPanel component is 1000+ lines in App.jsx — should it be extracted?

**Give me a PRIORITIZED list (most critical first) with exact code snippets for each fix.**
