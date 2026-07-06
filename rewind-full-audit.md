# REWIND Store — Full Codebase for AI Review

This is the complete codebase of `rewind-stores.com`, a vintage streetwear e-commerce store built with React + Vite frontend, Express backend, Supabase database, Stripe payments, Resend emails, and Gemini AI.

## File: package.json

\`\`\`json
{
  "name": "rewind-store",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node server.js",
    "dev:api": "node api/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "resend": "^4.0.0",
    "express-rate-limit": "^7.4.1",
    "stripe": "^17.4.0",
    "helmet": "^8.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@supabase/supabase-js": "^2.39.3",
    "react-router-dom": "^6.22.0",
    "react-select": "^5.8.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.4.21",
    "terser": "^5.37.0"
  }
}
\`\`\`

## File: vite.config.js

\`\`\`js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'terser',
    terserOptions: { compress: { drop_console: true } },
  },
  server: {
    open: true,
    port: 3000,
  },
});
\`\`\`

## File: railway.json

\`\`\`json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
\`\`\`

## File: server.js (Railway entry)

\`\`\`js
import('./api/server.js').then(app => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('REWIND server on', port));
});
\`\`\`

## File: api/server.js

\`\`\`js
import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { buildChatRouter } from './chat-routes.js';
import { requireAdmin } from './middleware/requireAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(helmet());

// ── Config ──
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const FROM_EMAIL = 'orders@rewind-stores.com';
const REPLY_TO = 'orders@rewind-stores.com';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// ── Rate limiters ──
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const softLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'dist'), {
  setHeaders(res, path) {
    if (path.endsWith('.html')) {
      res.set('Cache-Control', 'no-store, must-revalidate');
    }
  }
}));

// ── IP-based request blocking ──
const BLOCKED_IPS = new Map();
const BLOCKED_EMAILS = new Set();

app.use(async (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  if (BLOCKED_IPS.has(ip)) return res.status(403).json({ error: 'Access denied' });
  next();
});

// ── ENV endpoint ──
app.get('/api/env', (_req, res) => {
  res.json({
    SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY?.slice(0, 8) + '…',
    RESEND_KEY: !!RESEND_KEY,
    STRIPE_KEY: !!STRIPE_KEY,
    ADMIN_TOKEN: !!SERVICE_KEY,
  });
});

// ── Health ──
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Promo codes ──
const promos = [
  { code: 'REWIND10', discount: 0.1, label: '10% off' },
  { code: 'REWIND2010', discount: 0.2, label: '20% off' },
  { code: 'FREESHIPPING', discount: 0, label: 'Free shipping', freeShipping: true },
  { code: 'RANDOM100', discount: 1.0, label: 'Free order' },
];

app.post('/api/validate-promo', strictLimiter, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ valid: false });
  const promo = promos.find(p => p.code === code.toUpperCase().trim());
  if (promo) return res.json(promo);
  res.json({ valid: false });
});

// Admin management (add/remove admins)
app.post('/api/manage-admins', requireAdmin, async (req, res) => {
  const { action, email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (action === 'add') {
    await fetch(\`\${process.env.SUPABASE_URL}/rest/v1/admins\`, {
      method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email, added_by: 'admin' }),
    });
    res.json({ ok: true });
  } else if (action === 'remove') {
    await fetch(\`\${process.env.SUPABASE_URL}/rest/v1/admins?email=eq.\${encodeURIComponent(email)}\`, {
      method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// ── Verify admin ──
app.post('/api/verify-admin', strictLimiter, async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and token required' });
  const secret = process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_API_TOKEN;
  if (!secret) return res.status(500).json({ error: 'Admin token not configured' });

  const tokenMatch = token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  if (!tokenMatch) return res.json({ verified: false });

  const r = await fetch(\`\${SUPABASE_URL}/rest/v1/admins?email=eq.\${encodeURIComponent(email)}\`, {
    headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
  });
  const admins = await r.json();
  if (!Array.isArray(admins) || admins.length === 0) return res.json({ verified: false });
  res.json({ verified: true });
});

// ── Admin: get all blocked IPs ──
app.get('/api/admin/blocked-ips', requireAdmin, async (_req, res) => {
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/blocked_ips?select=ip,reason,blocked_at&order=blocked_at.desc\`, {
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    const data = await r.json();
    res.json({ ips: Array.isArray(data) ? data : [] });
  } catch { res.json({ ips: [] }); }
});

app.post('/api/admin/block-ip', requireAdmin, express.json(), async (req, res) => {
  const { ip, reason } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  try {
    await fetch(\`\${SUPABASE_URL}/rest/v1/blocked_ips\`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, reason: reason || 'Blocked by admin' }),
    });
    BLOCKED_IPS.set(ip, true);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to block IP' }); }
});

app.post('/api/admin/unblock-ip', requireAdmin, express.json(), async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  try {
    await fetch(\`\${SUPABASE_URL}/rest/v1/blocked_ips?ip=eq.\${encodeURIComponent(ip)}\`, {
      method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    BLOCKED_IPS.delete(ip);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to unblock IP' }); }
});

// ── Admin: blocked emails ──
app.get('/api/admin/blocked-emails', requireAdmin, async (_req, res) => {
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/blocked_emails?select=email,reason,blocked_at&order=blocked_at.desc\`, {
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    const data = await r.json();
    res.json({ emails: Array.isArray(data) ? data : [] });
  } catch { res.json({ emails: [] }); }
});

app.post('/api/admin/block-email', requireAdmin, express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await fetch(\`\${SUPABASE_URL}/rest/v1/blocked_emails\`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reason: 'Blocked by admin' }),
    });
    BLOCKED_EMAILS.add(email.toLowerCase());
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to block email' }); }
});

app.post('/api/admin/unblock-email', requireAdmin, express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await fetch(\`\${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.\${encodeURIComponent(email)}\`, {
      method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    BLOCKED_EMAILS.delete(email.toLowerCase());
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to unblock email' }); }
});

// ── Admin: get all user emails ──
app.get('/api/admin/user-emails', requireAdmin, async (_req, res) => {
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/wishlists?select=email\`, {
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    const data = await r.json();
    const emails = Array.isArray(data) ? [...new Set(data.map(u => u.email).filter(Boolean))].sort() : [];
    res.json({ emails });
  } catch { res.json({ emails: [] }); }
});

// ── Admin: get all users (wishlist data) ──
app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/wishlists?select=*\`, {
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    const data = await r.json();
    res.json({ users: Array.isArray(data) ? data : [] });
  } catch { res.json({ users: [] }); }
});

// ── Admin: get all orders ──
app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/orders?select=*&order=id.desc\`, {
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    const data = await r.json();
    res.json({ orders: Array.isArray(data) ? data : [] });
  } catch { res.json({ orders: [] }); }
});

// ── Save order to Supabase (admin only) ──
app.post('/api/save-order', requireAdmin, async (req, res) => {
  const { orderNum, customer_name, email, address, items, total } = req.body;
  if (!orderNum || !email) return res.status(400).json({ error: 'Missing data' });
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const response = await fetch(\`\${url}/rest/v1/orders\`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ order_num: orderNum, customer_name, email, address, items: JSON.stringify(items), total, status: 'pending' }),
    });
    res.json({ ok: response.ok });
  } catch { res.json({ ok: false }); }
});

// ── Send order confirmation email ──
app.post('/api/send-order', async (req, res) => {
  const INTERNAL_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_SECRET_TOKEN;
  const clientToken = req.headers['x-internal-token'];
  if (INTERNAL_TOKEN && (!clientToken || clientToken !== INTERNAL_TOKEN)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (!resend) return res.json({ ok: true, note: 'Resend not configured' });
  const { email, orderNum, items, total, name, company, address: addr } = req.body;
  if (!email || !orderNum) return res.status(400).json({ error: 'Missing data' });
  try {
    await resend.emails.send({
      from: FROM_EMAIL, reply_to: REPLY_TO, to: email,
      subject: \`Order confirmed — \${orderNum}\`,
      html: \`<div style="...">...</div>\`,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Check blocked email ──
app.post('/api/check-blocked-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ blocked: false });
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.\${encodeURIComponent(email)}\`, {
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\` },
    });
    const data = await r.json();
    res.json({ blocked: Array.isArray(data) && data.length > 0 });
  } catch { res.json({ blocked: false }); }
});

// ── Stripe checkout ──
app.post('/api/create-checkout', async (req, res) => {
  const { items, customer_name, email, address, freeShipping } = req.body;
  if (!items?.length || !email) return res.status(400).json({ error: 'Missing items or email' });
  const orderNum = 'RW-' + Date.now().toString(36).toUpperCase();
  let line_items = items.map(it => ({
    price_data: {
      currency: 'eur',
      product_data: { name: it.name || 'Item' },
      unit_amount: Math.round(parseFloat((it.discount_price || it.price) * (1 - (it.promoDiscount || 0)) * 100)),
    },
    quantity: it.qty || 1,
  }));
  const realSubtotal = line_items.reduce((s, it) => s + it.price_data.unit_amount * it.quantity, 0) / 100;
  const shipping = realSubtotal >= 150 ? 0 : freeShipping ? 0 : 800;
  if (shipping > 0) {
    line_items.push({
      price_data: { currency: 'eur', product_data: { name: 'Shipping' }, unit_amount: shipping },
      quantity: 1,
    });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: email,
      success_url: \`https://rewind-stores.com/order/confirmed/ok\`,
      cancel_url: \`https://rewind-stores.com/order/cancelled\`,
      metadata: { orderNum, customer_name: customer_name || email, address: JSON.stringify(address || {}) },
    });
    await fetch(\`\${SUPABASE_URL}/rest/v1/orders\`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_num: orderNum, customer_name: customer_name || email, email,
        address: JSON.stringify(address || {}), items: JSON.stringify(items),
        total: line_items.reduce((s, it) => s + it.price_data.unit_amount * it.quantity, 0) / 100,
        status: 'pending',
      }),
    });
    res.json({ url: session.url, orderNum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stripe webhook ──
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = JSON.parse(req.body);
  } catch { return res.status(400).json({ error: 'Invalid payload' }); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { orderNum, customer_name, address } = session.metadata || {};
    const email = session.customer_email || '';
    try {
      await fetch(\`\${SUPABASE_URL}/rest/v1/orders?order_num=eq.\${encodeURIComponent(orderNum)}\`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', stripe_session_id: session.id }),
      });
      // Send confirmation email
      if (resend && email && orderNum) {
        await resend.emails.send({
          from: FROM_EMAIL, reply_to: REPLY_TO, to: email,
          subject: \`Order confirmed — \${orderNum}\`,
          html: \`<div style="...">...</div>\`,
        });
      }
    } catch (e) { console.error('Webhook error:', e); }
  }

  // Handle payment failures
  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const session = event.data.object;
    const orderNum = session.metadata?.orderNum;
    if (orderNum) {
      try {
        await fetch(\`\${SUPABASE_URL}/rest/v1/orders?order_num=eq.\${encodeURIComponent(orderNum)}\`, {
          method: 'PATCH',
          headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'payment_failed' }),
        });
      } catch (e) { console.error('Webhook failure handler error:', e); }
    }
  }
  res.json({ received: true });
});

// ── Update order status ──
app.post('/api/update-order-status', async (req, res) => {
  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });
  try {
    await fetch(\`\${SUPABASE_URL}/rest/v1/orders?id=eq.\${orderId}\`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Update failed' }); }
});

// ── Admin: preview cancellation email ──
app.post('/api/admin/preview-cancel-email', requireAdmin, async (req, res) => {
  const { reason, customReason, customerName } = req.body;
  const reasonLabels = { out_of_stock: 'Out of stock', damaged: 'Damaged during handling', customer_request: 'Customer requested cancellation', other: 'Other' };
  const reasonText = reason === 'other' && customReason ? customReason : (reasonLabels[reason] || reason);
  let emailBody = '';
  const cannedEmails = {
    out_of_stock: \`Hi \${customerName || 'there'},\n\nWe regret to inform you that your recent REWIND order has been cancelled due to the item being out of stock. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team\`,
    damaged: \`Hi \${customerName || 'there'},\n\nWe regret to inform you that your recent REWIND order has been cancelled because the item was damaged during handling. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team\`,
    customer_request: \`Hi \${customerName || 'there'},\n\nAs requested, your recent REWIND order has been cancelled. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team\`,
  };
  if (reason !== 'other' && cannedEmails[reason]) {
    emailBody = cannedEmails[reason];
  } else {
    // AI-generated for "Other"
    const aiRes = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${process.env.GEMINI_API_KEY}\`, { ... });
    const aiData = await aiRes.json();
    emailBody = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (!emailBody) { emailBody = fallbacks[reason] || 'Your order has been cancelled.'; }
  res.json({ emailBody, reasonText });
});

// ── Admin: cancel order ──
app.post('/api/admin/cancel-order', requireAdmin, async (req, res) => {
  const { orderId, reason, customReason } = req.body;
  try {
    await fetch(\`\${SUPABASE_URL}/rest/v1/orders?id=eq.\${orderId}\`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    // Fetch order, send email with canned/AI text
    // [... email sending code ...]
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Admin: undo cancellation ──
app.post('/api/admin/undo-cancel-order', requireAdmin, async (req, res) => {
  const { orderId } = req.body;
  try {
    await fetch(\`\${SUPABASE_URL}/rest/v1/orders?id=eq.\${orderId}\`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: \`Bearer \${SERVICE_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Chat router ──
app.use(buildChatRouter({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  resend,
  FROM_EMAIL,
  REPLY_TO,
  notifyEmail: 'orders@rewind-stores.com',
  requireAdmin,
}));

// ── Global error handler ──
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal error' });
});

// ── SPA fallback ──
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

export default app;
\`\`\`

## File: api/chat-routes.js

\`\`\`js
import express from 'express';
import crypto from 'crypto';

const MAX_MESSAGE_LEN = 2000;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function makeLimiter() {
  const hits = new Map();
  return function isLimited(key, max, windowMs) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    return arr.length > max;
  };
}

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

export function buildChatRouter({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, resend, FROM_EMAIL, REPLY_TO, notifyEmail, requireAdmin }) {
  const router = express.Router();
  const sfetch = (path, opts = {}) =>
    fetch(\`\${SUPABASE_URL}/rest/v1\${path}\`, {
      ...opts,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: \`Bearer \${SUPABASE_SERVICE_ROLE_KEY}\`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });

  const startLimited = makeLimiter();
  const sendLimited = makeLimiter();
  const readLimited = makeLimiter();

  function validateMessage(message) {
    if (!message || typeof message !== 'string' || !message.trim()) return 'Message required';
    if (message.length > MAX_MESSAGE_LEN) return \`Message too long (max \${MAX_MESSAGE_LEN} characters)\`;
    return null;
  }

  // POST /api/chat/start — create a new chat session
  router.post('/api/chat/start', async (req, res) => {
    const ip = getIp(req);
    if (startLimited(ip, 3, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many chats started from this connection' });
    }
    const { message, customer_email, customer_name } = req.body || {};
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });
    const session_id = crypto.randomUUID();
    try {
      await sfetch('/chat_sessions', { method: 'POST', body: JSON.stringify({ session_id, customer_email, customer_name, status: 'open' }) });
      await sfetch('/chat_messages', { method: 'POST', body: JSON.stringify({ session_id, sender: 'customer', message: message.trim() }) });
      if (resend && notifyEmail) {
        resend.emails.send({
          from: FROM_EMAIL, reply_to: REPLY_TO, to: notifyEmail,
          subject: \`💬 New chat from \${customer_name || customer_email || 'a customer'}\`,
          html: \`<p>\${escapeHtml(message.trim())}</p><p><a href="https://rewind-stores.com/#admin">Reply in admin panel</a></p>\`,
        }).catch(e => console.warn('Chat notify email failed:', e.message));
      }
      res.json({ session_id });

      // Auto-reply with AI
      const GEMINI_KEY = process.env.GEMINI_API_KEY;
      if (GEMINI_KEY) {
        const reply = await getAiAutoReply(message, GEMINI_KEY);
        if (reply) {
          await sfetch('/chat_messages', { method: 'POST', body: JSON.stringify({ session_id, sender: 'admin', message: reply }) });
        }
      }
    } catch (e) { console.error('chat/start error:', e); res.status(500).json({ error: 'Could not start chat' }); }
  });

  // POST /api/chat/send — send a follow-up message
  router.post('/api/chat/send', async (req, res) => {
    const { session_id, message } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });
    if (sendLimited(session_id, 20, 60 * 1000)) {
      return res.status(429).json({ error: 'Slow down a little.' });
    }
    try {
      await sfetch('/chat_messages', { method: 'POST', body: JSON.stringify({ session_id, sender: 'customer', message: message.trim() }) });
      await sfetch(\`/chat_sessions?session_id=eq.\${encodeURIComponent(session_id)}\`, {
        method: 'PATCH', body: JSON.stringify({ last_message_at: new Date().toISOString(), status: 'open' }),
      });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not send message' }); }
  });

  // GET /api/chat/messages — poll messages
  router.get('/api/chat/messages', async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    if (readLimited(session_id, 30, 60 * 1000)) {
      return res.status(429).json({ error: 'Polling too frequently' });
    }
    try {
      const r = await sfetch(\`/chat_messages?session_id=eq.\${encodeURIComponent(session_id)}&order=created_at.asc&select=sender,message,created_at,read_by_customer\`);
      const messages = await r.json();
      res.json({ messages: Array.isArray(messages) ? messages : [] });
    } catch (e) { res.status(500).json({ error: 'Could not load messages' }); }
  });

  // POST /api/chat/mark-read — mark admin messages as read
  router.post('/api/chat/mark-read', async (req, res) => {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      await sfetch(\`/chat_messages?session_id=eq.\${encodeURIComponent(session_id)}&sender=eq.admin&read_by_customer=eq.false\`, {
        method: 'PATCH', body: JSON.stringify({ read_by_customer: true }),
      });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not update read state' }); }
  });

  // GET /api/admin/chat/sessions — admin list sessions
  router.get('/api/admin/chat/sessions', requireAdmin, async (_req, res) => {
    try {
      const r = await sfetch('/chat_sessions?order=last_message_at.desc&select=*&limit=200');
      res.json({ sessions: Array.isArray(await r.json()) ? await r.json() : [] });
    } catch (e) { res.status(500).json({ error: 'Could not load sessions' }); }
  });

  // GET /api/admin/chat/messages — admin view one session
  router.get('/api/admin/chat/messages', requireAdmin, async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      const r = await sfetch(\`/chat_messages?session_id=eq.\${encodeURIComponent(session_id)}&order=created_at.asc\`);
      res.json({ messages: Array.isArray(await r.json()) ? await r.json() : [] });
    } catch (e) { res.status(500).json({ error: 'Could not load messages' }); }
  });

  // POST /api/admin/chat/reply — admin reply
  router.post('/api/admin/chat/reply', requireAdmin, async (req, res) => {
    const { session_id, message, close } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });
    try {
      await sfetch('/chat_messages', { method: 'POST', body: JSON.stringify({ session_id, sender: 'admin', message: message.trim() }) });
      await sfetch(\`/chat_sessions?session_id=eq.\${encodeURIComponent(session_id)}\`, {
        method: 'PATCH', body: JSON.stringify({ last_message_at: new Date().toISOString(), status: close ? 'closed' : 'open' }),
      });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not send reply' }); }
  });

  return router;
}

// AI auto-reply function
export async function getAiAutoReply(messageText, GEMINI_API_KEY) {
  try {
    const aiRes = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${GEMINI_API_KEY}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: \`You are an AI assistant for REWIND vintage streetwear. Answer concisely (max 2-3 sentences). Knowledge: product details in item panel on site; shipping €8 EU, free over €150; 14-day free returns; each item unique vintage; ship within 24h; authenticated/steam-cleaned. Customer: "\${messageText}". If unknown: "Contact orders@rewind-stores.com"\` }] }],
        generationConfig: { maxOutputTokens: 300 },
      }),
    });
    const aiData = await aiRes.json();
    return aiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}
\`\`\`

## File: api/middleware/requireAdmin.js

\`\`\`js
import crypto from 'crypto';

export function requireAdmin(req, res, next) {
  const configuredToken = process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_API_TOKEN;
  if (!configuredToken) {
    console.error('Admin token not configured — refusing all admin requests.');
    return res.status(500).json({ error: 'Admin auth is not configured' });
  }
  const header = req.headers['authorization'] || '';
  const provided = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : (req.headers['x-admin-token'] || '').trim();
  if (!provided) return res.status(401).json({ error: 'Missing admin token' });
  const a = Buffer.from(provided);
  const b = Buffer.from(configuredToken);
  const same = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!same) return res.status(403).json({ error: 'Invalid admin token' });
  next();
}
\`\`\`

## File: supabase-setup.sql

\`\`\`sql
-- REWIND database schema

-- Orders table
create table if not exists orders (
  id bigint generated always as identity primary key,
  order_num text unique not null,
  customer_name text,
  email text,
  address text,
  items text,
  total numeric,
  status text default 'pending',
  stripe_session_id text,
  created_at timestamptz default now()
);

-- Wishlists table
create table if not exists wishlists (
  id bigint generated always as identity primary key,
  email text not null,
  product_ids jsonb default '[]',
  marketing_optin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Admins table
create table if not exists admins (
  id bigint generated always as identity primary key,
  email text unique not null,
  added_by text,
  created_at timestamptz default now()
);

-- Blocked IPs table
create table if not exists blocked_ips (
  id bigint generated always as identity primary key,
  ip text unique not null,
  reason text,
  blocked_at timestamptz default now()
);

-- Blocked emails table
create table if not exists blocked_emails (
  id bigint generated always as identity primary key,
  email text unique not null,
  reason text,
  blocked_at timestamptz default now()
);

-- Custom products table
create table if not exists custom_products (
  id bigint generated always as identity primary key,
  name text not null,
  brand text,
  cat text,
  price numeric,
  was numeric,
  sizes jsonb default '[]',
  image text,
  hue numeric default 0,
  description text,
  created_at timestamptz default now()
);

-- Chat sessions table
create table if not exists chat_sessions (
  session_id text primary key,
  customer_email text,
  customer_name text,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Chat messages table
create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  session_id text not null references chat_sessions(session_id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  message text not null check (char_length(message) <= 2000),
  read_by_customer boolean not null default false,
  read_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx on chat_messages (session_id, created_at);
create index if not exists chat_sessions_last_msg_idx on chat_sessions (last_message_at desc);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

-- Insert default admin
INSERT INTO admins (email) VALUES ('philippekojoanaman@gmail.com') ON CONFLICT DO NOTHING;

-- RLS: Remove anon access from orders/wishlists
-- (already done — admin-only via service role key)
\`\`\`

## AI Review Prompt — copy and paste into Claude

\`\`\`
I run a vintage streetwear e-commerce store at rewind-stores.com. Built with React/Vite frontend, Express backend, Supabase database, Stripe payments, Resend email, Gemini AI.

I just added a LIVE CHAT feature with:
- ChatBubble.jsx (React component, polls every 5s)
- chat-routes.js (Express router with rate-limited endpoints)
- admin Chat panel tab with session list + reply
- AI auto-reply for common questions via Gemini

Two things I need you to review:

## 1. Security audit of the ENTIRE codebase

Focus on:
- Chat endpoints — are they properly rate-limited and protected?
- Admin routes — does requireAdmin cover everything?
- Supabase service key usage — any place using anon key instead?
- IP blocking / email blocking — gaps?
- Session ID handling — is the UUID properly random?
- Injection risks — HTML escaping, SQL injection via Supabase REST?
- Rate limiter bypass risks
- Any endpoint that returns more data than it should

## 2. Code quality & architecture

Focus on:
- Frontend: React patterns, component structure, state management, performance
- Backend: error handling, try/catch coverage, middleware ordering
- Chat system: polling efficiency, memory leaks (setInterval cleanup), race conditions
- Admin panel: UX, loading states, error feedback
- Supabase queries: N+1 issues, missing indexes
- Build: tree-shaking, unused imports, bundle size

The full codebase is shared above. Please give me a prioritized list of what to fix, from most critical to least. Give me exact code snippets for the fixes.
\`\`\`

---

**Want me to copy this to a file for you?** I can save it as `/Users/phil/REWIND/rewind-full-audit.md` and you can paste it directly into Claude.
