import express from 'express';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import { resolveMx } from 'node:dns/promises';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { buildChatRouter } from './chat-routes.js';
import { buildReferralRouter } from './referral-routes.js';
import { buildSettingsRouter } from './settings-routes.js';
import { getVapidPublicKey } from './push-routes.js';
import { registerAdminOrdersRoutes } from './routes/admin-orders.js';
import { registerAdminBlockingRoutes } from './routes/admin-blocking.js';
import { registerAdminProductRoutes } from './routes/admin-products.js';
import { registerAdminAuditRoutes } from './routes/admin-audit.js';
import { requireAdmin, signAdminSession, verifyAdminSession } from './middleware/requireAdmin.js';
import { escapeHtml, orderHtml, campaignHtml } from './email-helpers.js';
import cookieParser from 'cookie-parser';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);

// ── Cron token auth middleware ──
function requireCronToken(req, res, next) {
  const storedToken = (process.env.CRON_SECRET_TOKEN || '').trim();
  if (!storedToken) return res.status(500).json({ error: 'CRON_SECRET_TOKEN not configured' });
  const token = (req.headers['x-cron-token'] || '').trim();
  const a = Buffer.from(token);
  const b = Buffer.from(storedToken);
  if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://luiqimsfvllgsmzedncw.supabase.co", "https://api.stripe.com", "https://api.resend.com", "https://generativelanguage.googleapis.com", "https://*.stripe.com", "https://plausible.io"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://*.stripe.com"],
      scriptSrc: ["'self'", "https://js.stripe.com", "https://*.stripe.com", "https://plausible.io", "'sha256-TQ+H+q9RA7uwUHJDjza5gW/bkbQTH3a/KIx05GK9Bdk='", "'sha256-h/dVpkgXYfnTM2vSiuXCxYpb9hhzFt+TV9FP10VST6Q='", "'sha256-l/hbD89akcakcMMD+XXsqKXJPoV0/5C9lHkm0XOrYK4='"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://*.stripe.com"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
app.use(cookieParser());
// Larger body limit for the image-upload route only, registered before the
// global 1mb parser so it claims the request first (body-parser skips
// re-parsing once req._body is set).
app.use('/api/admin/products/upload-image', express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

// ── CSRF protection ──
const ALLOWED_ORIGINS = ['https://rewind-stores.com', 'https://www.rewind-stores.com', 'http://localhost:3000', 'http://localhost:5173'];
app.use((req, res, next) => {
  if (['POST', 'DELETE', 'PUT', 'PATCH'].includes(req.method) && req.path.startsWith('/api/')) {
    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Cross-origin request blocked' });
    if (!origin && referer) {
      try { const o = new URL(referer).origin; if (!ALLOWED_ORIGINS.includes(o)) return res.status(403).json({ error: 'Blocked' }); }
      catch { return res.status(403).json({ error: 'Blocked' }); }
    }
  }
  next();
});

// ── Request logging ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => { if (req.path.startsWith('/api/')) console.log(req.method, req.path, res.statusCode, Date.now() - start + 'ms'); });
  next();
});

// ── IP blocker middleware ──
const BLOCKED_IPS = new Map(); // in-memory cache, cleared on restart
const BLOCKED_EMAILS = new Set();

// Hydrate in-memory blocked lists from Supabase on boot (with 5s timeout)
const startupFetch = async (url, opts) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    return await r.json();
  } catch { return []; }
  finally { clearTimeout(timer); }
};

(async () => {
  const ipData = await startupFetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/blocked_ips?select=ip_address`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (Array.isArray(ipData)) ipData.forEach(r => BLOCKED_IPS.set(r.ip_address, true));
  const emailData = await startupFetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/blocked_emails?select=email`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (Array.isArray(emailData)) emailData.forEach(r => BLOCKED_EMAILS.add(r.email.toLowerCase()));
})();

// ── Admin audit logging ──
// Logs every admin action to Supabase audit_log table for forensic traceability.
async function auditLog(adminEmail, action, details, ip) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = SUPABASE_URL;
  if (!key || !url || !adminEmail) return;
  try {
    await fetch(`${url}/rest/v1/audit_log`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        admin_email: adminEmail,
        action,
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ip: ip || '',
        created_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {}
}
// Extract admin email from session token or cookie for audit logging
function getAdminEmailFromToken(req) {
  const token = (req.headers['x-admin-token'] || req.cookies?.admin_session || '').trim();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) return Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {}
  return null;
}

app.use(async (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress;
  if (BLOCKED_IPS.has(ip)) {
    return res.status(403).send(`
      <html><body style="background:#FAF6EF;display:grid;place-items:center;height:100vh;margin:0;font-family:sans-serif">
      <div style="text-align:center"><h1 style="font-size:48px;color:#16130F;margin:0">403</h1>
      <p style="color:#6E665A;margin-top:8px">You don't have access to this site.</p></div></body></html>`);
  }
  next();
});


// ── Sitemap — generate dynamically from product catalog (incl. custom products) ──
// Must be registered BEFORE express.static so the dynamic route wins over the build-time static file.
app.get('/sitemap.xml', async (_req, res) => {
  const urls = [
    'https://rewind-stores.com',
    'https://rewind-stores.com/privacy',
    'https://rewind-stores.com/terms',
    'https://rewind-stores.com/returns',
    'https://rewind-stores.com/shipping',
    'https://rewind-stores.com/track',
  ];
  // Add static product pages
  for (const p of SERVER_PRODUCTS) {
    urls.push(`https://rewind-stores.com/product/${encodeURIComponent(p.id)}`);
  }
  // Add custom products from Supabase
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SERVICE_KEY) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?select=product_id&order=created_at.desc`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const custom = await r.json();
      if (Array.isArray(custom)) {
        custom.forEach(p => {
          if (p.product_id) urls.push(`https://rewind-stores.com/product/${encodeURIComponent(p.product_id)}`);
        });
      }
    }
  } catch {}
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => '  <url><loc>' + u + '</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>').join('\n')}
</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

app.use(express.static(path.join(__dirname, '..', 'dist'), {
  maxAge: '1y',
  etag: true,
  setHeaders(res, p) {
    if (p.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, must-revalidate');
    } else if (p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.woff2') || p.endsWith('.png') || p.endsWith('.webp')) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
console.log('[static]', path.join(__dirname, '..', 'dist'));

// ── Survey — save first-visit attribution data ──
const surveyLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true });
app.post('/api/survey', surveyLimiter, async (req, res) => {
  const { source } = req.body || {};
  if (!source) return res.json({ ok: false });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !SUPABASE_URL) return res.json({ ok: true, note: 'Supabase not configured' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/surveys`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ source, created_at: new Date().toISOString() }),
    });
  } catch {}
  res.json({ ok: true });
});

// ── Health check (must be before rate limiter so Railway healthchecks don't get blocked) ──
app.get('/api/health', (_req, res) => {
  const distPath = path.join(__dirname, '..', 'dist');
  const assetsPath = path.join(distPath, 'assets');
  let distStatus = 'missing';
  try {
    const files = fs.readdirSync(assetsPath);
    distStatus = files.length + ' files';
  } catch (e) {
    distStatus = 'error: ' + e.message;
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.VERCEL ? 'vercel' : process.env.RAILWAY_ENVIRONMENT_NAME ? 'railway' : 'local',
    dist: distStatus,
  });
});

// ── Rate limiting ──
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use(generalLimiter);
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });

// Load blocked IPs on startup

// Track failed login attempts per IP (5 → 1h ban)
const verifyAttempts = new Map();
// Periodic cleanup of expired IP entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of verifyAttempts) {
    if (typeof entry === 'object' && entry.count === 0) {
      if (now - entry.updated > 120000) verifyAttempts.delete(ip);
    }
  }
}, 120000);
// `token` is either the master secret (first login, typed by the admin) or a
// previously-issued session token (silent re-check on page load). Either way,
// the response hands back a fresh signed session token — that's what the
// client stores and replays, never the master secret itself.
app.post('/api/verify-admin', strictLimiter, async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.json({ verified: false, reason: 'missing' });
  const ADMIN_TOKEN = process.env.ADMIN_SECRET_TOKEN;
  const isMasterToken = ADMIN_TOKEN && token.length === ADMIN_TOKEN.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(ADMIN_TOKEN));
  const isValidSession = verifyAdminSession(token, email);
  if (!isMasterToken && !isValidSession) {
    // Track failed attempts per IP
    const ip = req.ip;
    const attempts = (verifyAttempts.get(ip) || 0) + 1;
    verifyAttempts.set(ip, attempts);
    setTimeout(() => { const c = verifyAttempts.get(ip); if (c && c <= 1) verifyAttempts.delete(ip); else if (c) verifyAttempts.set(ip, c - 1); }, 60000);
    if (attempts > 5) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    return res.json({ verified: false, reason: 'bad_token' });
  }
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY || !SUPABASE_URL) return res.json({ verified: false });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    const verified = Array.isArray(data) && data.length > 0;
    if (!verified) return res.json({ verified: false, reason: 'not_admin' });
    const sessionToken = signAdminSession(email);
    // Set HttpOnly cookie — JS can't read it, XSS-safe
    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api',
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.json({ verified: true });
  } catch {
    res.json({ verified: false, reason: 'server_error' });
  }
});

// ── Admin: check if session cookie is still valid (no localStorage needed) ──
// Returns 200 with { authed: false } when logged out — it's an auth-status probe
// called on every storefront load (Visitors button visibility), so a 401 would
// spam the console with network errors for every logged-out visitor.
app.get('/api/admin/check-auth', async (req, res) => {
  const token = req.cookies?.admin_session;
  if (!token) return res.json({ authed: false });
  if (verifyAdminSession(token)) {
    res.json({ authed: true });
  } else {
    res.clearCookie('admin_session');
    res.json({ authed: false });
  }
});

// ── Generate product description (fallback — AI was removed for security) ──
app.post('/api/generate-description', async (req, res) => {
  const { name, brand } = req.body || {};
  if (!name) return res.json({ title: 'Vintage Streetwear Piece', description: 'Hand-picked vintage item. Authenticated, steam-cleaned, and ready to wear.' });
  const suggestions = {
    'cotton': '100% cotton construction for breathable comfort and lasting durability.',
    'jersey': 'Soft cotton jersey knit with a smooth, lightweight feel perfect for layering.',
    'windbreaker': 'Lightweight nylon shell with water-resistant finish. Original zipper hardware.',
    'knit': 'Heavyweight knit with ribbed cuffs and hem. Pre-shrunk for consistent fit.',
    'denim': 'Sturdy denim with authentic fading. Triple-stitched seams throughout.',
    'leather': 'Genuine leather with natural patina. Fully lined interior.',
  };
  const lower = name.toLowerCase();
  let desc = '';
  for (const [keyword, text] of Object.entries(suggestions)) {
    if (lower.includes(keyword)) { desc = text; break; }
  }
  if (!desc) desc = 'Authenticated vintage piece, steam-cleaned and ready to wear.';
  if (brand) desc = brand + ' ' + desc.charAt(0).toLowerCase() + desc.slice(1);
  res.json({ title: name, description: desc });
});

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'REWIND <orders@rewind-stores.com>';
const REPLY_TO = process.env.REPLY_TO || 'orders@rewind-stores.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

// Built here (not inline at mount time) so the webhook handler below can
// call referralRouter.fulfillReferral(...) directly instead of looping
// back over HTTP to itself.
const referralRouter = buildReferralRouter({
  SUPABASE_URL,
  SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  resend,
  FROM_EMAIL,
  REPLY_TO,
  requireAdmin,
});

// ── Order confirmation email — plain function, called directly by the
// webhook (no HTTP loopback) and by the /api/send-order route below (kept
// for any external/manual callers, e.g. an admin "resend confirmation"
// button). A `http://localhost:${PORT}` round-trip only works on Railway's
// single long-running process — it silently fails on serverless targets
// (e.g. the Vercel path this codebase's `export default app` still
// supports), so real logic lives here and both callers use it directly. ──
async function sendOrderConfirmationEmail({ email, name, items, total, address, orderNum }) {
  if (!resend) return { ok: true, note: 'Resend not configured' };
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'No items provided' };
  }
  if (!email) {
    return { ok: false, error: 'No recipient email provided' };
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: email,
      subject: `Order confirmed — ${orderNum || 'N/A'}`,
      html: orderHtml({ name, items, total, address, orderNum }),
    });
    return { ok: true };
  } catch (err) {
    console.error('Email failed:', err);
    return { ok: false, error: err.message };
  }
}

app.post('/api/send-order', async (req, res) => {
  const INTERNAL_TOKEN = process.env.ADMIN_SECRET_TOKEN;
  if (!INTERNAL_TOKEN) {
    return res.status(500).json({ error: 'Server not configured for order emails' });
  }
  const clientToken = req.headers['x-internal-token'];
  if (!clientToken || clientToken !== INTERNAL_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const result = await sendOrderConfirmationEmail(req.body);
  if (!result.ok) return res.status(result.error === 'No items provided' || result.error === 'No recipient email provided' ? 400 : 500).json(result);
  res.json(result);
});

// ── Campaign (admin panel) ──
app.post('/api/send-campaign', requireAdmin, async (req, res) => {
  const { emails, subject, message } = req.body;
  if (!resend) return res.json({ ok: false, sent: 0, total: emails?.length || 0, error: 'RESEND_API_KEY not configured on Railway' });
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ ok: false, sent: 0, total: 0, error: 'No email recipients provided' });
  }
  const defaultMsg = "Hey,\n\nWe just got new pieces in.\n\nCheck them out:\nhttps://rewind-stores.com\n\nBest,\nREWIND";
  let sent = 0;
  const errors = [];
  for (const email of emails) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        reply_to: REPLY_TO,
        to: email,
        subject: subject || 'New arrivals & exclusive offers — REWIND',
        html: campaignHtml({ message: message || defaultMsg }),
      });
      sent++;
    } catch (err) {
      errors.push(`${email}: ${err.message}`);
    }
  }
  if (errors.length > 0 && sent === 0) {
    res.json({ ok: false, sent: 0, total: emails.length, error: errors[0] });
  } else {
    res.json({ ok: true, sent, total: emails.length, errors: errors.length });
  }
});

// ── Payment endpoints ──
import Stripe from 'stripe';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Server-side product catalog — lookup real prices, never trust the client.
const SERVER_PRODUCTS = [
  { id: "jersey-brasil",   name: "Brasil '02 Jersey",     price: 42 },
  { id: "jersey-azzurri",  name: "Azzurri Retro Jersey",  price: 45 },
  { id: "jersey-ajax",     name: "Ajax Training Top",     price: 34 },
  { id: "polo-terry",      name: "Terry Polo",            price: 52 },
  { id: "polo-pique",      name: "Cotton Pique Polo",     price: 38 },
  { id: "polo-rugby",      name: "Striped Rugby Polo",    price: 44 },
  { id: "jumper-knit",     name: "Vintage Knit Jumper",   price: 55 },
  { id: "jumper-crew",     name: "Retro Crewneck",        price: 48 },
  { id: "jumper-cardigan", name: "Argyle Cardigan",       price: 58 },
  { id: "track-velour",    name: "Velour Tracksuit '94",  price: 68 },
  { id: "track-shell",     name: "Shell Suit — Cobalt",   price: 54 },
  { id: "track-classic",   name: "Classic Track Jacket",  price: 48 },
  { id: "zip-windbreaker", name: "Windbreaker Half-Zip",  price: 58 },
  { id: "zip-fleece",      name: "Tech Fleece Zip-Up",    price: 65 },
  { id: "zip-bomber",      name: "Satin Bomber Jacket",   price: 72 },
  { id: "pants-cargo",     name: "Cargo Sweatpants",      price: 42 },
  { id: "pants-tech",      name: "Tech Woven Pants",      price: 55 },
  { id: "pants-chino",     name: "Retro Chino Pants",     price: 38 },
  { id: "set-track",       name: "Track Set — Navy",      price: 78 },
  { id: "set-jogger",      name: "Jogger Set — Grey",     price: 68 },
  { id: "set-polo",        name: "Polo Set — Ivory",      price: 85 },
  { id: "shoe-court",      name: "Court Classic Lo",      price: 72 },
  { id: "shoe-suede",      name: "Suede Runner '88",      price: 85 },
  { id: "shoe-hitop",      name: "Hi-Top Retro",          price: 78 },
  { id: "gtg",             name: "GTG",                   price: 55 },
];

async function lookupProductPrice(id) {
  // 1. Check hardcoded server catalog
  const found = SERVER_PRODUCTS.find(p => p.id === id);
  if (found) return found.price;
  // 2. Check Supabase custom_products by product_id (string slug).
  //    Use SERVICE_ROLE_KEY because custom_products RLS may not allow
  //    anonymous SELECT on the price column.
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !key) return null;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(id)}&select=price`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0 && data[0].price != null) {
      return data[0].price;
    }
  } catch {}
  // 3. Fallback: try looking up by numeric id (for legacy custom products
  //    that were created before product_id was auto-generated)
  if (/^\d+$/.test(id)) {
    try {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !key) return null;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?id=eq.${encodeURIComponent(id)}&select=price`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0 && data[0].price != null) {
        return data[0].price;
      }
    } catch {}
  }
  return null;
}

// Validate promo code — checks static list AND database for generated codes
app.post('/api/validate-promo', strictLimiter, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ valid: false });

  const PROMO_CODES = {
    'REWIND10': { valid: true, type: 'percent', value: 10 },
    'FREESHIP': { valid: true, type: 'free_shipping', value: 0 },
  };

  const upper = code.toUpperCase().trim();
  const staticCode = PROMO_CODES[upper];
  if (staticCode) return res.json(staticCode);

  // Check database for generated promo codes with anti-abuse checks
  try {
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!svcKey || !SUPABASE_URL) return res.json({ valid: false });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(upper)}&select=code,discount,label,used,expires_at`, {
      headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
    });
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) {
      const p = data[0];
      // Already used
      if (p.used) return res.json({ valid: false, error: 'Code already used' });
      // Max uses reached
      if (p.max_uses != null && (p.uses || 0) >= p.max_uses) return res.json({ valid: false, error: 'Usage limit reached' });
      // Expired
      if (p.expires_at && new Date(p.expires_at) < new Date()) return res.json({ valid: false, error: 'Code expired' });
      return res.json({ valid: true, type: 'percent', value: p.discount, label: p.label || `${p.discount}% off` });
    }
  } catch {}

  res.json({ valid: false });
});

// Admin: create a promo code (stored in DB)
app.post('/api/admin/create-promo', requireAdmin, async (req, res) => {
  const { discount, label, code, max_uses, expires_at, percent, customAmount, email } = req.body;
  // Support both discount (percentage number) and percent/customAmount fields
  const finalDiscount = discount || percent || (customAmount ? null : 10);
  if (finalDiscount && (finalDiscount < 1 || finalDiscount > 100)) return res.status(400).json({ error: 'Discount must be 1-100' });
  const promoCode = code || 'REWIND-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const body = { code: promoCode, label: label || `${finalDiscount}% off`, created_by: 'admin' };
    if (finalDiscount) body.discount = finalDiscount;
    if (customAmount) { body.discount = customAmount; body.discount_type = 'amount'; }
    if (max_uses) body.max_uses = max_uses;
    if (expires_at) body.expires_at = expires_at;
    if (email) body.email = email;
    // Remove undefined values before serialization
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k]; });
    const promoRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!promoRes.ok) {
      const errText = await promoRes.text();
      console.error('Create promo failed:', errText);
      // Retry without optional fields
      delete body.expires_at;
      delete body.email;
      delete body.max_uses;
      delete body.discount_type;
      const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });
      if (!retryRes.ok) {
        const retryErr = await retryRes.text();
        try {
          const parsed = JSON.parse(retryErr);
          return res.status(500).json({ error: 'Failed: ' + (parsed.message || parsed.error || retryErr.slice(0, 200)) });
        } catch {
          // Fallback to the original error message if retry also fails
          const orig = errText;
          try {
            const p = JSON.parse(orig);
            return res.status(500).json({ error: 'Failed: ' + (p.message || p.error || orig.slice(0, 200)) });
          } catch {
            return res.status(500).json({ error: 'Failed: ' + orig.slice(0, 200) });
          }
        }
      }
    }
    auditLog(getAdminEmailFromToken(req), 'create_promo', `${promoCode} (${finalDiscount}% off)`, req.ip);
    res.json({ code: promoCode, discount: finalDiscount });
  } catch (e) { console.error('Create promo error:', e); res.status(500).json({ error: 'Failed to create promo code' }); }
});

// Admin: list all promo codes (for the Active Promos panel with live countdowns)
app.get('/api/admin/promos', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?select=code,discount,discount_type,label,uses,max_uses,expires_at,created_by,created_at&order=created_at.desc&limit=200`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    res.json(Array.isArray(data) ? data : []);
  } catch (e) { console.error('List promos error:', e); res.status(500).json({ error: 'Failed to list promo codes' }); }
});

// Admin: delete one or more promo codes
app.post('/api/admin/delete-promo', requireAdmin, async (req, res) => {
  const { codes } = req.body || {};
  const list = Array.isArray(codes) ? codes : (codes ? [codes] : []);
  const clean = list.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  if (clean.length === 0) return res.status(400).json({ error: 'No promo codes provided' });
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  try {
    const encoded = clean.map((c) => encodeURIComponent(c)).join(',');
    await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=in.(${encoded})`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    for (const c of clean) auditLog(getAdminEmailFromToken(req), 'delete_promo', c, req.ip);
    res.json({ ok: true, deleted: clean.length });
  } catch (e) { console.error('Delete promo error:', e); res.status(500).json({ error: 'Failed to delete promo codes' }); }
});

// A/B testing — record a visitor event (impression/conversion). Public (non-admin).
app.post('/api/ab/event', async (req, res) => {
  const { experiment, variant, event_type, session_id } = req.body || {};
  if (!experiment || !variant || !event_type) return res.status(400).json({ error: 'Missing fields' });
  if (!['impression', 'conversion'].includes(event_type)) return res.status(400).json({ error: 'Bad event_type' });
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ab_events`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ experiment, variant, event_type, session_id: session_id || null }),
    });
    res.json({ ok: true });
  } catch (e) { console.error('AB event error:', e); res.status(500).json({ error: 'Failed to log event' }); }
});

// Admin: A/B testing report (aggregated impressions/conversions per variant)
app.get('/api/admin/ab', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ab_events?select=experiment,variant,event_type&limit=10000`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows)) return res.json([]);
    const by = {};
    for (const row of rows) {
      const k = `${row.experiment}|${row.variant}`;
      if (!by[k]) by[k] = { experiment: row.experiment, variant: row.variant, impressions: 0, conversions: 0 };
      if (row.event_type === 'impression') by[k].impressions++;
      else if (row.event_type === 'conversion') by[k].conversions++;
    }
    res.json(Object.values(by));
  } catch (e) { console.error('AB report error:', e); res.status(500).json({ error: 'Failed to load A/B report' }); }
});

// Admin management — requires master token specifically, not just any admin session
app.post('/api/manage-admins', strictLimiter, async (req, res) => {
  const ADMIN_TOKEN = process.env.ADMIN_SECRET_TOKEN;
  const provided = (req.headers['x-admin-token'] || req.cookies?.admin_session || '').trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_TOKEN || '');
  const isMaster = a.length === b.length && ADMIN_TOKEN && crypto.timingSafeEqual(a, b);
  if (!isMaster) return res.status(403).json({ error: 'Master token required to manage admins' });

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  const { action, email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  if (action === 'add') {
    await fetch(`${SUPABASE_URL}/rest/v1/admins`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email, added_by: 'admin' }),
    });
    res.json({ ok: true });
  } else if (action === 'remove') {
    await fetch(`${SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// Shipping zones from China
const SHIPPING_ZONES = {
  // Zone 1 — East Asia ($8)
  'JP': 8, 'KR': 8, 'TW': 8, 'HK': 8, 'MO': 8, 'CN': 3,
  // Zone 2 — SE Asia ($12)
  'TH': 12, 'VN': 12, 'SG': 12, 'MY': 12, 'ID': 12, 'PH': 12, 'BN': 12, 'KH': 12, 'LA': 12, 'MM': 12,
  // Zone 3 — South Asia ($15)
  'IN': 15, 'BD': 15, 'LK': 15, 'NP': 15, 'PK': 15, 'MV': 15,
  // Zone 4 — Middle East / Central Asia ($18)
  'AE': 18, 'SA': 18, 'QA': 18, 'KW': 18, 'BH': 18, 'OM': 18, 'IR': 18, 'IQ': 18, 'IL': 18, 'TR': 18, 'KZ': 18, 'UZ': 18, 'MN': 15,
  // Zone 5 — Europe ($22)
  'GB': 22, 'DE': 22, 'FR': 22, 'IT': 22, 'ES': 22, 'NL': 22, 'BE': 22, 'AT': 22, 'CH': 22, 'SE': 22, 'DK': 22, 'NO': 22, 'FI': 22, 'IE': 22, 'PT': 22, 'PL': 22, 'CZ': 22, 'HU': 22, 'GR': 22, 'RO': 22, 'BG': 22, 'HR': 22, 'SK': 22, 'SI': 22, 'LT': 22, 'LV': 22, 'EE': 22, 'IS': 22,
  // Zone 6 — North America ($22)
  'US': 22, 'CA': 22, 'MX': 22,
  // Zone 7 — Oceania ($25)
  'AU': 25, 'NZ': 25, 'FJ': 25,
  // Zone 8 — South America ($28)
  'BR': 28, 'AR': 28, 'CO': 28, 'CL': 28, 'PE': 28, 'EC': 28, 'VE': 28, 'UY': 28, 'PY': 28, 'BO': 28,
  // Zone 9 — Africa ($28)
  'ZA': 28, 'NG': 28, 'KE': 28, 'EG': 28, 'MA': 28, 'TN': 28, 'DZ': 28, 'GH': 28, 'CI': 28, 'SN': 28, 'ET': 28, 'TZ': 28, 'UG': 28,
};
const DEFAULT_SHIPPING = 28;

// Map full country names to ISO-2 codes (in case user types a name instead)
const COUNTRY_NAME_MAP = {
  'china': 'CN', 'japan': 'JP', 'south korea': 'KR', 'korea': 'KR', 'taiwan': 'TW',
  'hong kong': 'HK', 'macau': 'MO', 'thailand': 'TH', 'vietnam': 'VN', 'singapore': 'SG',
  'malaysia': 'MY', 'indonesia': 'ID', 'philippines': 'PH', 'india': 'IN', 'bangladesh': 'BD',
  'sri lanka': 'LK', 'nepal': 'NP', 'pakistan': 'PK', 'united arab emirates': 'AE', 'uae': 'AE',
  'saudi arabia': 'SA', 'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM',
  'israel': 'IL', 'turkey': 'TR', 'turkiye': 'TR', 'united kingdom': 'GB', 'uk': 'GB',
  'england': 'GB', 'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'spain': 'ES',
  'netherlands': 'NL', 'holland': 'NL', 'belgium': 'BE', 'austria': 'AT', 'switzerland': 'CH',
  'sweden': 'SE', 'denmark': 'DK', 'norway': 'NO', 'finland': 'FI', 'ireland': 'IE',
  'portugal': 'PT', 'poland': 'PL', 'czech republic': 'CZ', 'czechia': 'CZ', 'hungary': 'HU',
  'greece': 'GR', 'romania': 'RO', 'croatia': 'HR', 'slovakia': 'SK', 'slovenia': 'SI',
  'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE', 'bulgaria': 'BG',
  'united states': 'US', 'usa': 'US', 'canada': 'CA', 'mexico': 'MX',
  'australia': 'AU', 'new zealand': 'NZ',
  'brazil': 'BR', 'argentina': 'AR', 'colombia': 'CO', 'chile': 'CL', 'peru': 'PE',
  'south africa': 'ZA', 'nigeria': 'NG', 'egypt': 'EG', 'morocco': 'MA', 'kenya': 'KE',
};

function resolveCountry(country) {
  if (!country) return '';
  const upper = country.toUpperCase().trim();
  // If it's already a 2-letter ISO code, use it
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  // Otherwise try the name map
  return (COUNTRY_NAME_MAP[country.toLowerCase().trim()] || '').toUpperCase();
}

// Compute real order total server-side — never trust the client
async function computeOrder(items, promoCode, country) {
  let subtotal = 0;
  for (const it of (items || [])) {
    const pid = it.id || it.product_id;
    const realPrice = pid ? await lookupProductPrice(String(pid)) : null;
    // Never fall back to the client-supplied price. If the product ID
    // isn't found in the server catalog or custom_products, treat it as
    // free/ignored rather than trusting whatever price the client sent.
    subtotal += (realPrice ?? 0) * (it.qty || 1);
  }
  const zoneRate = SHIPPING_ZONES[resolveCountry(country)] || DEFAULT_SHIPPING;
  let shipping = subtotal >= 150 ? 0 : zoneRate;
  let discountPrice = subtotal;
  let discountLabel = null;
  // Validate promo code against DB
  if (promoCode) {
    const upperCode = promoCode.toUpperCase().trim();
    try {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(upperCode)}&select=discount,discount_type,label,used,expires_at`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        const promo = data[0];
        // Anti-abuse: reject used, expired, or maxed-out promos
        if (promo.used) { /* ignore code */ }
        else if (promo.expires_at && new Date(promo.expires_at) < new Date()) { /* expired */ }
        else if (promo.max_uses != null && (promo.uses || 0) >= promo.max_uses) { /* maxed out */ }
        else {
          if (promo.discount_type === 'free_shipping') {
            discountPrice = subtotal;
            shipping = 0;
            discountLabel = 'Free shipping';
          } else {
            discountPrice = Math.round(subtotal * (100 - promo.discount)) / 100;
            discountLabel = `${promo.discount}% off`;
          }
        }
      }
    } catch {}
  }
  return { subtotal, shipping, discountPrice, discountLabel };
}

// Decrement custom_products.stock for a paid order's line items (by product id).
// Shared by both the legacy checkout.session.completed path and the live
// payment_intent.succeeded path so stock actually depletes on real orders.
async function decrementStockByIds(items) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = SUPABASE_URL;
  if (!key || !url || !items?.length) return;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  for (const item of items) {
    const pid = String(item.id || item.product_id || '');
    const qty = item.qty || 1;
    if (!pid) continue;
    try {
      // Atomic RPC decrement — no read-then-write race
      await fetch(`${url}/rest/v1/rpc/decrement_stock`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_product_id: pid, p_qty: qty }),
      });
    } catch (e) {
      console.warn(`Stock decrement failed for "${pid}":`, e.message);
    }
  }
}

// ── Stripe Payment Intent (for Elements) ──
app.post('/api/create-payment-intent', strictLimiter, async (req, res) => {
  let orderComputed;
  let finalTotal = 0;
  try {
    if (!stripe) return res.status(400).json({ error: 'STRIPE_SECRET_KEY not configured' });
    const { items, orderNum, email, name, address, promoCode, paymentMethod, country } = req.body;
    if (!items || !items.length || !orderNum || !email) return res.status(400).json({ error: 'Missing required fields' });
    
    // Validate items array — each must have a valid id and positive qty
    for (const it of items) {
      const pid = String(it.id || it.product_id || '');
      if (!pid) return res.status(400).json({ error: 'Each item must have a valid product id' });
      const qty = it.qty || 1;
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) return res.status(400).json({ error: `Item "${pid}" has invalid quantity` });
    }
    
    // Check stock before creating PaymentIntent — prevents overselling
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    for (const it of items) {
      const pid = String(it.id || it.product_id || '');
      const qty = it.qty || 1;
      try {
        // Check custom_products first (these have variable stock)
        let product = null;
        // Try by product_id first
        let r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(pid)}&select=stock,name,id`, {
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
        let data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          product = data[0];
        }
        // Fallback: try by numeric id (legacy custom products)
        if (!product && /^\d+$/.test(pid)) {
          r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?id=eq.${encodeURIComponent(pid)}&select=stock,name,id`, {
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          });
          data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            product = data[0];
          }
        }
        if (product && product.stock != null && product.stock < qty) {
          return res.status(400).json({ error: `"${product.name || pid}" only has ${product.stock} in stock` });
        }
        // If not found in custom_products, it's a static SERVER_PRODUCT — no stock to check
      } catch {}
    }

    // Build Stripe metadata — truncate itemsJson to stay under 500-char per-value limit
    const buildMetadata = () => {
      const itemsJson = JSON.stringify(items.map(i => ({ id: i.id || i.product_id, qty: i.qty })));
      return {
        orderNum, email,
        name: (name || '').slice(0, 200),
        address: (address || '').slice(0, 480),
        itemsJson: itemsJson.length > 470 ? itemsJson.slice(0, 470) + '…' : itemsJson,
        promoCode: (promoCode || '').slice(0, 100),
        country: (country || '').slice(0, 10),
      };
    };

    // Server-side price recompute — never trust client amounts
    try {
      orderComputed = await computeOrder(items, promoCode, country);
    } catch (e) {
      console.error('computeOrder error:', e.message || e);
      return res.status(500).json({ error: 'Could not calculate order total. Please try again or contact support.' });
    }
    const { subtotal, discountPrice, shipping } = orderComputed;
    finalTotal = Math.round((discountPrice + shipping) * 100);

    if (!finalTotal || finalTotal < 50) {
      return res.status(400).json({ error: 'Order total too low for payment processing.' });
    }

    // Validate payment method — return 400 for unknown ones before Stripe
    // Apple Pay and Google Pay are NOT separate Stripe payment_method_types —
    // there is no 'apple_pay' or 'google_pay' value in Stripe's enum. Both
    // wallets produce a standard 'card' PaymentMethod under the hood via the
    // Payment Request Button, and are mapped to 'card' below.
    const KNOWN_METHODS = ['card', 'bancontact', 'klarna', 'ideal', 'paypal', 'applepay', 'googlepay'];
    if (!paymentMethod || !KNOWN_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Unknown payment method selected.' });
    }
    // Map frontend payment method IDs to Stripe payment method types.
    const methodTypes = paymentMethod === 'bancontact' ? ['bancontact']
      : paymentMethod === 'klarna' ? ['klarna']
      : paymentMethod === 'ideal' ? ['ideal']
      : paymentMethod === 'paypal' ? ['paypal']
      : ['card'];

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalTotal,
      currency: 'eur',
      metadata: buildMetadata(),
      payment_method_types: methodTypes,
    }).catch(async (stripeErr) => {
      // Retry once on transient Stripe errors (rate limit, service unavailable)
      if (stripeErr.type === 'StripeError' && (stripeErr.statusCode === 429 || stripeErr.statusCode >= 500)) {
        console.warn('Stripe transient error, retrying in 1s:', stripeErr.code);
        await new Promise(r => setTimeout(r, 1000));
        return stripe.paymentIntents.create({
          amount: finalTotal,
          currency: 'eur',
          metadata: buildMetadata(),
          payment_method_types: methodTypes,
        });
      }
      throw stripeErr;
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    const errMsg = e.message || String(e);
    const errCode = e.code || (e.type === 'StripeError' ? e.type : null);
    const reqEmail = req.body?.email || 'unknown';
    const reqOrder = req.body?.orderNum || 'unknown';
    const reqMethod = req.body?.paymentMethod || 'unknown';
    console.error('PaymentIntent error:', errMsg, '(code:', errCode, ')', `order=${reqOrder}`, `email=${reqEmail}`, `method=${reqMethod}`, req.body?.items ? `items=${req.body.items.length}` : 'items=none');
    const stripeMsg = e.type === 'StripeError' ? e.message : null;
    const refCode = `ERR-${req.body?.orderNum?.slice(0, 8) || '????'}-${Date.now().toString(36).slice(-4)}`;
    // Build a human-friendly error message that includes Stripe context.
    // Stripe SDK errors have `type` like 'StripeInvalidRequestError' and
    // always carry `statusCode` on API errors — use it for 4xx passthrough
    // so the frontend shows the right code instead of a misleading 500.
    let httpStatus = (e.statusCode && e.statusCode < 500) ? e.statusCode : 500;
    // Known error codes get a friendly message that overrides the raw Stripe
    // message (which often contains internal details, not user-facing copy).
    let userMsg;
    // Detect unsupported / unactivated payment methods by error message or code
    const isInvalidPayMethod = errCode === 'payment_intent_invalid_parameter'
      || errCode === 'payment_method_not_available'
      || (errMsg && /payment method type.*(invalid|not supported|not available|not activated|unsupported)/i.test(errMsg))
      || (errMsg && /payment_method_type.*(invalid|not supported|not available|not activated|unsupported)/i.test(errMsg));
    if (isInvalidPayMethod) {
      httpStatus = 400;
      userMsg = 'This payment method is not supported by our payment provider yet. Please try a different payment method (Card, Bancontact, Klarna, iDEAL, or PayPal).';
    } else {
      userMsg = stripeMsg;
      if (!userMsg) {
        userMsg = 'Could not create payment';
        if (errCode) userMsg += ' (' + errCode + ')';
        userMsg += '. Please try again or contact support.';
      }
    }
    // Log to webhook events so the Bug Watcher can detect failures
    try {
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (SERVICE_KEY) {
        fetch(`${SUPABASE_URL}/rest/v1/webhook_events`, {
          method: 'POST',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ source: 'stripe', event: 'payment.failed', payload: JSON.stringify({ error: stripeMsg || errMsg, code: errCode, amount: finalTotal || 0, orderNum: req.body?.orderNum || 'unknown' }) }),
        }).catch(() => {});
      }
    } catch {}
    // Include a reference code in the error so support can trace it
    return res.status(httpStatus).json({ error: userMsg, ref: refCode });
  }
});

// ── Get orders by email ──
// ── Customer order lookup by email + order number ──
app.post('/api/lookup-order', strictLimiter, async (req, res) => {
  const { email, orderNum } = req.body;
  if (!email || !orderNum) return res.status(400).json({ error: 'Email and order number required' });
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_num=eq.${encodeURIComponent(orderNum)}&email=eq.${encodeURIComponent(email)}&select=order_num,status,total,items,customer_name,created_at,tracking_number,courier,tracking_url`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const data = await r.json();
    const order = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!order) return res.json({ found: false });
    res.json({
      found: true,
      order: {
        order_num: order.order_num,
        status: order.status,
        total: order.total,
        customer_name: order.customer_name,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []),
        created_at: order.created_at,
        tracking_number: order.tracking_number,
        courier: order.courier,
        tracking_url: order.tracking_url,
      }
    });
  } catch { res.json({ found: false }); }
});

// ── Report a bug (submitted from the BugReportModal panel) ──
app.post('/api/report-bug', strictLimiter, (req, res) => {
  const { message, email, page, browser, device, submittedAt, ua } = req.body || {};
  const clean = (message || '').trim();
  if (!message || typeof message !== 'string' || clean.length < 15) {
    return res.status(400).json({ error: 'Message must be at least 15 characters' });
  }
  // Spam heuristic: reject keyboard-mash submissions (e.g. "6767676676767")
  const counts = {};
  for (const ch of clean.toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) counts[ch] = (counts[ch] || 0) + 1;
  }
  const top2 = Object.values(counts).sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + (b || 0), 0);
  const single = Object.values(counts).reduce((a, b) => Math.max(a, b), 0);
  if (top2 / Math.max(clean.length, 1) > 0.7 || single / Math.max(clean.length, 1) > 0.5) {
    return res.status(400).json({ error: 'That message looks like spam — please describe the issue in words.' });
  }
  // Log to webhook_events so the webhook-check/bug-watcher crons pick it up.
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SERVICE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/webhook_events`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,  'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          source: 'bug-report',
          event: 'bug.reported',
          payload: JSON.stringify({
            message: clean.slice(0, 100),
            email: (email || '').trim() || null,
            page: page || '',
            browser: (browser || '').slice(0, 300),
            device: (device || '').slice(0, 60),
            submittedAt: (submittedAt || '').slice(0, 60),
            ua: (ua || '').slice(0, 400),
          }),
        }),
      }).catch(() => {});
    }
  } catch {}
  res.json({ ok: true });
});

app.post('/api/get-orders', strictLimiter, async (req, res) => {
  const { email, orderNum } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const filter = orderNum ? `&order_num=eq.${encodeURIComponent(orderNum)}` : '';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?email=eq.${encodeURIComponent(email)}${filter}&order=created_at.desc&limit=20`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const orders = await response.json();
    res.json({ orders: orders || [] });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Could not fetch orders' });
  }
});

// ── Save order to Supabase (admin only) ──
app.post('/api/save-order', requireAdmin, async (req, res) => {
  const { orderNum, customer_name, email, address, items, total } = req.body;
  if (!orderNum) return res.status(400).json({ error: 'No order number' });
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/orders`,
      {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          order_num: orderNum,
          customer_name,
          email,
          address,
          items: JSON.stringify(items),
          total,
          status: 'pending',
        }),
      }
    );
    res.json({ ok: response.ok });
  } catch (err) {
    console.error('Save order error:', err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

// ── Run automated tests ──
app.get('/api/run-tests', requireAdmin, async (_req, res) => {
  try {
    const { runTests } = await import('../tests/button-test.js');
    const result = await runTests();
    res.json(result);
  } catch (err) {
    console.error('Test runner error:', err);
    res.status(500).json({ error: 'Test runner failed', passed: 0, failed: 1, total: 1, results: [{ name: 'Test runner', status: '❌', detail: 'Test execution failed' }] });
  }
});

const PORT = process.env.PORT || 3000;

// Stripe webhook — save order on payment success
app.post('/api/stripe-webhook', async (req, res) => {
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Payment succeeded — this is the live checkout path (Stripe Elements)
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { orderNum, email, name, address, itemsJson, promoCode, country } = pi.metadata || {};
    if (orderNum && email) {
      try {
        // Webhook idempotency: skip if order already exists
        const check = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_num=eq.${encodeURIComponent(orderNum)}&select=id`, {
          headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` },
        });
        const existing = await check.json();
        if (Array.isArray(existing) && existing.length > 0) {
          console.log('Order already exists (duplicate webhook):', orderNum);
        } else {
          const items = itemsJson ? JSON.parse(itemsJson) : [];
          const { subtotal, shipping, discountPrice } = await computeOrder(items, promoCode, country);
          const total = discountPrice + shipping;
          await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_num: orderNum, email, customer_name: name || '', address: address || '', items: JSON.stringify(items), total, status: 'pending', created_at: new Date().toISOString() }),
          });
          console.log('Order saved from PaymentIntent:', orderNum);

          // Decrement stock — atomic RPC
          await decrementStockByIds(items);

          // Mark promo as used after successful payment
          if (promoCode) {
            try {
              const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
              const upperCode = promoCode.toUpperCase().trim();
              // Fetch current promo to check max_uses
              const pcRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(upperCode)}&select=uses,max_uses,used`, {
                headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
              });
              const pcData = await pcRes.json();
              const promo = Array.isArray(pcData) ? pcData[0] : null;
              if (promo) {
                const nextUses = (promo.uses || 0) + 1;
                // Mark as used if max_uses reached or single-use, otherwise increment counter
                await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(upperCode)}`, {
                  method: 'PATCH',
                  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    uses: nextUses,
                    ...(promo.max_uses != null && nextUses >= promo.max_uses ? { used: true, used_at: new Date().toISOString() } : {}),
                  }),
                });
              }
            } catch (promoErr) {
              console.warn('Failed to mark promo used:', promoErr.message);
            }
          }

          // Confirmation email
          if (process.env.RESEND_API_KEY) {
            sendOrderConfirmationEmail({ email, name, items, total, address, orderNum })
              .then((result) => { if (!result.ok) console.warn('send-order failed:', result.error); })
              .catch((e) => console.warn('send-order call failed:', e.message));
          }

          // Fulfill referral
          try {
            await referralRouter.fulfillReferral(orderNum);
          } catch (refErr) {
            console.warn('Referral fulfill failed:', refErr.message);
          }
        }
      } catch (e) { console.error('Failed to fulfill from PaymentIntent:', e); }
    }
    // Notify Hermes about the new order
    try { await fetch(`${SUPABASE_URL}/rest/v1/webhook_events`, { method: 'POST', headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ source: 'stripe', event: 'payment.succeeded', payload: JSON.stringify({ orderNum, email, amount: pi.amount_received }), received_at: new Date().toISOString() }) }).catch(() => {}); } catch (e) { console.warn('webhook log failed:', e.message); }
  }
  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const session = event.data.object;
    const orderNum = session.metadata?.orderNum;
    if (orderNum) {
      try {
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (SUPABASE_URL && key) {
          await fetch(`${SUPABASE_URL}/rest/v1/orders?order_num=eq.${encodeURIComponent(orderNum)}`, {
            method: 'PATCH',
            headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'payment_failed' }),
          });
        }
      } catch {}
    }
    // Notify Hermes about the failed payment
    try { await fetch(`${SUPABASE_URL}/rest/v1/webhook_events`, { method: 'POST', headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ source: 'stripe', event: 'payment.failed', payload: JSON.stringify({ orderNum, email: session.metadata?.email }), received_at: new Date().toISOString() }) }).catch(() => {}); } catch {}
  }
  // Track refunds and disputes
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    try { await fetch(`${SUPABASE_URL}/rest/v1/webhook_events`, { method: 'POST', headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ source: 'stripe', event: 'charge.refunded', payload: JSON.stringify({ amount: charge.amount_refunded, currency: charge.currency }), received_at: new Date().toISOString() }) }).catch(() => {}); } catch {}
  }
  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object;
    try { await fetch(`${SUPABASE_URL}/rest/v1/webhook_events`, { method: 'POST', headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ source: 'stripe', event: 'dispute.created', payload: JSON.stringify({ amount: dispute.amount, reason: dispute.reason }), received_at: new Date().toISOString() }) }).catch(() => {}); } catch {}
  }

  res.json({ received: true });
});

// ── Analytics API ──
// Bot-burst guard: at most 10 track hits per IP per 60s window; extra hits are
// silently accepted (200) but not written — kills scraper bursts (saw 176 in 1 min).
const trackHits = new Map();
const TRACK_MAX = 10, TRACK_WINDOW = 60_000;
function trackAllowed(ip) {
  const now = Date.now();
  const hits = (trackHits.get(ip) || []).filter(t => now - t < TRACK_WINDOW);
  if (hits.length >= TRACK_MAX) { trackHits.set(ip, hits); return false; }
  hits.push(now);
  trackHits.set(ip, hits);
  return true;
}

app.post('/api/analytics/track', generalLimiter, async (req, res) => {
  try {
    const { page, referrer, screen_width, visitor_id, session_id, qa } = req.body || {};
    if (!page || !visitor_id || !session_id) return res.json({ ok: true }); // silent ignore malformed
    // QA/session-tagged verification traffic never counts
    if (qa) return res.json({ ok: true });
    // Never record the store owner's own visits (valid admin session cookie)
    if (req.cookies && req.cookies.admin_session) return res.json({ ok: true });
    // Rate-limit per IP — CF-Connecting-IP is Cloudflare's guaranteed real
    // client IP (req.ip can vary per request behind CF edge routing).
    const clientIp = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
    if (!trackAllowed(clientIp)) return res.json({ ok: true });

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SK = SERVICE_KEY;
    // Parse user-agent for browser/OS
    const ua = req.headers['user-agent'] || '';
    const browser = ua.includes('Chrome') && !ua.includes('Edg') ? 'Chrome'
      : ua.includes('Firefox') && !ua.includes('Seamonkey') ? 'Firefox'
      : ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari'
      : ua.includes('Edg') ? 'Edge'
      : 'Other';
    const os = ua.includes('Windows') ? 'Windows'
      : ua.includes('Mac') ? 'macOS'
      : ua.includes('iPhone') ? 'iOS'
      : ua.includes('Android') ? 'Android'
      : ua.includes('Linux') ? 'Linux'
      : 'Other';
    const device = screen_width > 1024 ? 'desktop'
      : screen_width > 768 ? 'tablet'
      : 'mobile';
    const country = req.headers['cf-ipcountry'] || '';
    const city = req.headers['cf-ipcity'] || '';
    const region = req.headers['cf-region-code'] || '';

    await fetch(`${SUPABASE_URL}/rest/v1/analytics_visits`, {
      method: 'POST',
      headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        page, referrer: referrer || '',
        country, city, region, browser, os, device,
        screen_width: screen_width || 0,
        visitor_id, session_id,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});

    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// ── Referral updates subscription (no verification code — syntax + MX + disposable check) ──
app.post('/api/referral-subscribe', generalLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  const domain = email.split('@')[1];
  const DISPOSABLE = new Set([
    'mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com',
    'guerrillamail.com', 'yopmail.com', 'trashmail.com', 'throwawaymail.com',
    'sharklasers.com', 'maildrop.cc', 'mytemp.email', 'getnada.com',
  ]);
  if (DISPOSABLE.has(domain)) return res.status(400).json({ error: 'Disposable email domains are not supported' });
  try {
    const mxs = await resolveMx(domain);
    if (!Array.isArray(mxs) || mxs.length === 0) return res.status(400).json({ error: "This email's domain can't receive mail — check for typos" });
  } catch {
    return res.status(400).json({ error: "This email's domain can't receive mail — check for typos" });
  }
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/referral_updates`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) throw new Error(`db ${r.status}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('Subscribe error:', e.message);
    res.status(500).json({ error: 'Subscription is temporarily unavailable — try again later' });
  }
});

// ── Admin: analytics query ──
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SK = SERVICE_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const period = req.query.period || '7d';
    const now = new Date();
    let since;
    if (period === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (period === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30d') since = new Date(now - 30 * 24 * 60 * 60 * 1000);
    else since = new Date('2020-01-01');
    const sinceStr = since.toISOString();

    const fetchDb = async (url) => {
      const r = await fetch(url, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
      return r.json();
    };

    // Day boundaries in Europe/Brussels (store timezone) — UTC midnight is 2h off
    const brusselsParts = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const getPart = (parts, t) => Number(parts.find(p => p.type === t).value);
    const brusselsDate = (d) => {
      const p = brusselsParts(d);
      return `${getPart(p, 'year')}-${String(getPart(p, 'month')).padStart(2, '0')}-${String(getPart(p, 'day')).padStart(2, '0')}`;
    };
    const todayParts = brusselsParts(now);
    const today = new Date(Date.UTC(getPart(todayParts, 'year'), getPart(todayParts, 'month') - 1, getPart(todayParts, 'day')));

    const [visits, pages, countries, browsers, oses, devices, todayVisits, sales] = await Promise.all([
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=visitor_id,timestamp&timestamp=gte.${encodeURIComponent(sinceStr)}&limit=2000`),
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=page&timestamp=gte.${encodeURIComponent(sinceStr)}&limit=2000`),
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=country&timestamp=gte.${encodeURIComponent(sinceStr)}&limit=2000`),
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=browser&timestamp=gte.${encodeURIComponent(sinceStr)}&limit=2000`),
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=os&timestamp=gte.${encodeURIComponent(sinceStr)}&limit=2000`),
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=device&timestamp=gte.${encodeURIComponent(sinceStr)}&limit=2000`),
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=visitor_id&timestamp=gte.${today.toISOString()}`),
      fetchDb(`${SUPABASE_URL}/rest/v1/orders?select=total,status,created_at&created_at=gte.${encodeURIComponent(sinceStr)}&limit=500`),
    ]);

    // Aggregate in Node — PostgREST group-by syntax was returning PGRST100
    const tally = (rows, key) => {
      const m = {};
      for (const r of rows) { const k = r[key] || 'Unknown'; m[k] = (m[k] || 0) + 1; }
      return Object.entries(m).map(([k, n]) => ({ [key]: k, count: n })).sort((a, b) => b.count - a.count);
    };
    const topPages = tally(pages, 'page').slice(0, 10);
    const byCountry = tally(countries, 'country').slice(0, 20);
    const byBrowser = tally(browsers, 'browser').slice(0, 10);
    const byOs = tally(oses, 'os').slice(0, 10);
    const byDevice = tally(devices, 'device').slice(0, 5);

    const allVisitors = Array.isArray(visits) ? visits.map(v => v.visitor_id) : [];
    const uniqueVisitors = new Set(allVisitors).size;
    const todayVisitors = Array.isArray(todayVisits) ? todayVisits.length : 0;

    // Daily series (last 14 days, Brussels-local days) for the visits chart
    const dailyMap = {};
    for (const v of visits) {
      const d = brusselsDate(new Date(v.timestamp));
      if (d) dailyMap[d] = (dailyMap[d] || 0) + 1;
    }
    const daily = [];
    for (let i = 13; i >= 0; i--) {
      const key = brusselsDate(new Date(now - i * 864e5));
      daily.push({ d: key, n: dailyMap[key] || 0 });
    }

    // Sales: non-cancelled orders + revenue in the period
    const salesRows = Array.isArray(sales) ? sales : [];
    const validOrders = salesRows.filter(o => o.status !== 'cancelled');
    const revenue = validOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);

    // Revenue per Brussels-local day (for the area chart)
    const revenueByDay = {};
    for (const o of validOrders) {
      const d = brusselsDate(new Date(o.created_at));
      if (d) revenueByDay[d] = (revenueByDay[d] || 0) + (Number(o.total) || 0);
    }
    const dailyRevenue = [];
    for (let i = 13; i >= 0; i--) {
      const key = brusselsDate(new Date(now - i * 864e5));
      dailyRevenue.push({ d: key, n: Math.round((revenueByDay[key] || 0) * 100) / 100 });
    }

    // Trend vs the previous equal-length period
    let revenueTrend = null;
    try {
      const prevLen = period === '24h' ? 24 * 3600e3 : period === '30d' ? 30 * 86400e3 : 7 * 86400e3;
      const prevStart = new Date(now - prevLen * 2);
      const prevEnd = new Date(now - prevLen);
      const prevRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=total,status&created_at=gte.${encodeURIComponent(prevStart.toISOString())}&created_at=lt.${encodeURIComponent(prevEnd.toISOString())}&limit=500`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const prevRows = await prevRes.json();
      const prevRevenue = (Array.isArray(prevRows) ? prevRows : [])
        .filter(o => o.status !== 'cancelled')
        .reduce((s, o) => s + (Number(o.total) || 0), 0);
      if (prevRevenue > 0) revenueTrend = Math.round(((revenue - prevRevenue) / prevRevenue) * 100);
      else if (revenue > 0) revenueTrend = 100;
      else revenueTrend = 0;
    } catch { revenueTrend = null; }

    res.json({
      stats: {
        total_visits: allVisitors.length,
        unique_visitors: uniqueVisitors,
        avg_per_visitor: uniqueVisitors > 0 ? (allVisitors.length / uniqueVisitors) : 0,
        today_visits: todayVisitors,
      },
      topPages: Array.isArray(topPages) ? topPages : [],
      byCountry: Array.isArray(byCountry) ? byCountry : [],
      byBrowser: Array.isArray(byBrowser) ? byBrowser : [],
      byOs: Array.isArray(byOs) ? byOs : [],
      byDevice: Array.isArray(byDevice) ? byDevice : [],
      daily,
      dailyRevenue,
      sales: { orders: validOrders.length, revenue, revenueTrend },
    });
  } catch (e) {
    console.error('Analytics query error:', e);
    res.json({ error: 'Failed to load analytics' });
  }
});

// ── Admin: blanket auth + no-cache for all /api/admin/* routes ──
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  requireAdmin(req, res, next);
});

// ── Admin: visitor locations (admin-only globe beside "Our reach") ──
// Countries aggregate from ALL visits (country code alone is enough to
// light up a country — coords are only used as a hover-panel anchor).
// Supports ?window=24h|7d|all to filter by visit recency.
app.get('/api/admin/visitor-locations', async (req, res) => {
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchDb = async (url) => {
      const r = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      return r.json();
    };
    const w = req.query.window || 'all';
    let since = '';
    if (w === '24h') since = new Date(Date.now() - 24 * 3600e3).toISOString();
    else if (w === '7d') since = new Date(Date.now() - 7 * 86400e3).toISOString();
    const sinceParam = since ? `&timestamp=gte.${encodeURIComponent(since)}` : '';
    const [visits, coords] = await Promise.all([
      fetchDb(`${SUPABASE_URL}/rest/v1/analytics_visits?select=country,city&limit=2000${sinceParam}`),
      fetchDb(`${SUPABASE_URL}/rest/v1/city_coords?select=city,country,lat,lng&limit=1000`),
    ]);
    const coordByCity = new Map((Array.isArray(coords) ? coords : []).map(c => [`${c.city}|${c.country}`, { lat: c.lat, lng: c.lng }]));
    const counts = {};
    const cityCounts = {};
    for (const v of visits) {
      if (!v.country) continue;
      counts[v.country] = (counts[v.country] || 0) + 1;
      if (v.city) {
        const k = `${v.city}|${v.country}`;
        cityCounts[k] = (cityCounts[k] || 0) + 1;
      }
    }
    const countries = Object.entries(counts)
      .map(([country, count]) => {
        let anchor = null;
        const cityKeys = Object.entries(cityCounts)
          .filter(([k]) => k.endsWith('|' + country))
          .sort((a, b) => b[1] - a[1]);
        for (const [k] of cityKeys) {
          const c = coordByCity.get(k);
          if (c) { anchor = c; break; }
        }
        return { country, count, lat: anchor ? anchor.lat : null, lng: anchor ? anchor.lng : null };
      })
      .sort((a, b) => b.count - a.count);
    res.json({ countries });
  } catch {
    res.json({ countries: [] });
  }
});

// ── Admin: referral-updates subscribers (registered after blanket auth) ──
app.get('/api/admin/referral-subscribers', async (req, res) => {
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/referral_updates?select=email,created_at&order=created_at.desc&limit=500`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error('bad response');
    res.json({ subscribers: rows });
  } catch (e) {
    console.error('Subscribers error:', e.message);
    res.json({ subscribers: [] });
  }
});

// ── Admin route modules (registered after blanket auth) ──
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

registerAdminOrdersRoutes({ app, SUPABASE_URL, resend, FROM_EMAIL, REPLY_TO, escapeHtml, auditLog, getAdminEmailFromToken, requireAdmin });
registerAdminBlockingRoutes({ app, SUPABASE_URL, SUPABASE_KEY: anonKey, resend, FROM_EMAIL, REPLY_TO, escapeHtml, auditLog, getAdminEmailFromToken, BLOCKED_IPS, BLOCKED_EMAILS });
registerAdminProductRoutes({ app, SUPABASE_URL, auditLog, getAdminEmailFromToken });
registerAdminAuditRoutes({ app, SUPABASE_URL, auditLog, getAdminEmailFromToken });

// ── Wishlist API (replaces direct Supabase client writes) ──
app.get('/api/wishlist', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SK = SERVICE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SK, Authorization: `Bearer ${SK}` },
    });
    const data = await r.json();
    res.json({ items: Array.isArray(data) ? data : [] });
  } catch { res.json({ items: [] }); }
});

app.post('/api/wishlist', generalLimiter, async (req, res) => {
  const { email, product_ids } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SK = SERVICE_KEY;
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SK, Authorization: `Bearer ${SK}` },
    }).then(r => r.json());
    if (Array.isArray(existing) && existing.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ product_ids, updated_at: new Date().toISOString() }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/wishlists`, {
        method: 'POST',
        headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ email, product_ids: product_ids || [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
    }
    res.json({ ok: true });
  } catch (e) { console.error('wishlist save error:', e); res.status(500).json({ error: 'Failed to save wishlist' }); }
});

// ── Wishlist sync to Supabase (upsert by email) ──
app.post('/api/wishlist/sync', async (req, res) => {
  const { email, product_ids } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!Array.isArray(product_ids)) return res.status(400).json({ error: 'product_ids must be an array' });
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}&select=id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).then(r => r.json());
    if (Array.isArray(existing) && existing.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ product_ids, updated_at: new Date().toISOString() }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/wishlists`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ email, product_ids, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Wishlist sync error:', e);
    res.status(500).json({ error: 'Failed to sync wishlist' });
  }
});

app.get('/api/wishlist/sync', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}&select=product_ids,updated_at`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    const entry = Array.isArray(data) && data.length > 0 ? data[0] : null;
    res.json({ wishlist: entry || { product_ids: [], updated_at: null } });
  } catch (e) {
    console.error('Wishlist sync fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// ── Cleanup test accounts (before admin blanket middleware, uses cron token) ──
app.post('/api/cleanup-test-emails', async (req, res) => {
  const token = (req.headers['x-cron-token'] || '').trim();
  const storedToken = (process.env.CRON_SECRET_TOKEN || '').trim();
  if (!storedToken) return res.status(500).json({ error: 'CRON_SECRET_TOKEN not configured' });
  if (!token || token.length !== storedToken.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(storedToken))) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  const testEmails = [
    'test-ai-working@example.com', 'fullerror@example.com', 'errorspy@example.com',
    'debug-save2@example.com', 'now-it-works@example.com', 'final-final@example.com',
    'check@example.com', 'new-test@example.com', 'final-truth@example.com',
    'debug-ai@example.com', 'final-real-test@example.com', 'real-test-now@example.com',
    'longwait@test.com', 'final-test@example.com', 'test-ai@example.com',
    'test-final@example.com', 'test999@example.com', 'test777@example.com',
    'test@example.com', 'spammer@example.com', 'spam@test.com',
  ];
  let removed = 0;
  try {
    for (const email of testEmails) {
      const encoded = encodeURIComponent(email);
      const blockRes = await fetch(SUPABASE_URL + '/rest/v1/blocked_emails?email=eq.' + encoded, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
      });
      if (blockRes.ok) removed++;
      const chatSessionsRes = await fetch(SUPABASE_URL + '/rest/v1/chat_sessions?customer_email=eq.' + encoded + '&select=session_id', {
        method: 'GET',
        headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
      });
      const sessionsData = await chatSessionsRes.json();
      const sessionIds = (Array.isArray(sessionsData) ? sessionsData : []).map(s => s.session_id).filter(Boolean);
      if (sessionIds.length > 0) {
        // Delete chat messages for these sessions
        await fetch(SUPABASE_URL + '/rest/v1/chat_messages?session_id=in.(' + sessionIds.map(id => encodeURIComponent(id)).join(',') + ')', {
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
        });
        // Delete sessions
        for (const sid of sessionIds) {
          await fetch(SUPABASE_URL + '/rest/v1/chat_sessions?session_id=eq.' + encodeURIComponent(sid), {
            method: 'DELETE',
            headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
          });
        }
      }
    }
    res.json({ ok: true, removed });
  } catch (e) {
    res.status(500).json({ error: 'Cleanup failed', detail: e.message });
  }
});

// ── Abandoned cart recovery — send "Still interested?" email ──
// Queries checkout.session.expired / payment.failed events from the
// webhook_events table, extracts the customer email (stored in the JSON
// payload), and sends a recovery email via Resend with a link back to the
// store. Protected by x-cron-token / CRON_SECRET_TOKEN.
app.post('/api/cron/abandoned-cart', async (req, res) => {
  const token = (req.headers['x-cron-token'] || '').trim();
  const CRON_TOKEN = (process.env.CRON_SECRET_TOKEN || '').trim();
  if (!CRON_TOKEN) return res.status(500).json({ error: 'CRON_SECRET_TOKEN not configured' });
  const a = Buffer.from(token);
  const b = Buffer.from(CRON_TOKEN);
  if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Unauthorized' });
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  if (!resend) return res.status(500).json({ error: 'Resend not configured' });
  try {
    // Query recent payment.failed events from Stripe (includes checkout.session.expired)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/webhook_events?source=eq.stripe&event=eq.payment.failed&received_at=gte.${encodeURIComponent(threeDaysAgo)}&order=received_at.desc&limit=50`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const events = await r.json();
    if (!Array.isArray(events)) return res.json({ ok: true, sent: 0, note: 'No events found' });
    let sent = 0;
    const seenEmails = new Set();
    for (const evt of events) {
      if (!evt.payload) continue;
      try {
        const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload;
        const email = payload.email;
        if (!email || seenEmails.has(email)) continue;
        seenEmails.add(email);
        // Skip if this email already completed an order after the expired session
        const orderCheck = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        const existingOrders = await orderCheck.json();
        if (Array.isArray(existingOrders) && existingOrders.length > 0) continue;
        // Send the recovery email
        await resend.emails.send({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: email,
          subject: 'Still interested? Your REWIND cart is waiting 🛒',
          html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF6EF">
<table width="100%" style="max-width:560px;margin:0 auto;padding:40px 20px">
<tr><td style="text-align:center;padding-bottom:20px">
  <h1 style="font-size:28px;color:#16130F;margin:0">REWIND<span style="color:#FF4D14">.</span></h1>
</td></tr>
<tr><td style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <h2 style="font-size:22px;color:#16130F;margin:0 0 6px">You left something behind ⏳</h2>
  <p style="color:#6E665A;font-size:15px;margin:0 0 12px">Hey there,</p>
  <p style="color:#6E665A;font-size:15px;margin:0 0 20px">We noticed you started checking out but didn't complete your order. No pressure — your cart is still saved.</p>
  <table width="100%"><tr>
    <td style="text-align:center;padding:16px 0">
      <a href="https://rewind-stores.com" style="display:inline-block;background:#FF4D14;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:700">Return to your cart →</a>
    </td>
  </tr></table>
  <p style="color:#6E665A;font-size:14px;margin:16px 0 0">Grab your pieces before they're gone — our vintage stock moves fast.</p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`,
        });
        sent++;
      } catch (parseErr) {
        console.warn('Failed to parse webhook event payload:', parseErr.message);
      }
    }
    res.json({ ok: true, sent, total: events.length });
  } catch (e) {
    console.error('Abandoned cart cron error:', e);
    res.status(500).json({ error: 'Abandoned cart cron failed', detail: e.message });
  }
});

// ── Create test order (protected by cron token for testing) ──
app.post('/api/create-test-order', async (req, res) => {
  const token = (req.headers['x-cron-token'] || '').trim();
  const CRON_TOKEN = (process.env.CRON_SECRET_TOKEN || '').trim();
  if (!CRON_TOKEN) return res.status(500).json({ error: 'CRON_SECRET_TOKEN not configured' });
  const a = Buffer.from(token);
  const b = Buffer.from(CRON_TOKEN);
  if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Unauthorized' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orderNum = 'RW-TEST-' + String(Date.now()).slice(-6);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_num: orderNum, email, customer_name: 'Test User', address: 'Test Street 1, Brussels', items: JSON.stringify([{ id: 'reward-hoodie', name: 'Rewind Hoodie', qty: 1, price: 50 }]), total: 50, status: 'pending', created_at: new Date().toISOString() }),
  });
  const saved = await r.json();
  if (saved.error) {
    res.status(500).json({ error: 'Supabase: ' + saved.error, details: saved.details });
  } else {
    res.json({ orderNum });
  }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Check if email is blocked (used at checkout and chat) ──
app.post('/api/check-blocked-email', generalLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ blocked: false });
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    const data = await r.json();
    res.json({ blocked: data && data.length > 0 });
  } catch { res.json({ blocked: false }); }
});

// ── Push VAPID public key ──
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: 'BNewrKRg9ASnQuZ5hBF-4I9_s-R9FKgh2CkhqZ9l9QFwJTnJyJByDfMM3-xvM8wDHCyAXnpbvkVqQdMDzmenNOw' });
});

// ── Push notification send — used by cron bots for escalation alerts ──
app.post('/api/push/send', requireCronToken, async (req, res) => {
  const { title, body, url } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const { sendPushNotification } = await import('./push-routes.js');
    await sendPushNotification(title, body || '', url || '/#admin');
    res.json({ ok: true });
  } catch (e) {
    console.error('Push send error:', e.message);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

app.post('/api/push/subscribe', strictLimiter, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'subscription required' });
  // Validate subscription structure — must have valid endpoint and keys
  if (typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) return res.status(400).json({ error: 'Invalid endpoint' });
  if (!sub.keys || typeof sub.keys !== 'object' || !sub.keys.p256dh || !sub.keys.auth) return res.status(400).json({ error: 'Missing push keys' });
  // Limit subscription data size to prevent abuse
  const bodyStr = JSON.stringify({ subscription: sub });
  if (bodyStr.length > 4096) return res.status(400).json({ error: 'Subscription too large' });
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const checkRes = await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint) + '&select=id', {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    });
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) return res.json({ ok: true });
    await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions', {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ subscription: sub }),
    });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to save subscription' }); }
});

// ── Referral routes ──
app.use('/api/referral', referralRouter);

// ── Chat router ──
app.use(buildChatRouter({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  resend: resend,
  FROM_EMAIL,
  REPLY_TO,
  notifyEmail: 'orders@rewind-stores.com',
  requireAdmin,
  requireCronToken,
}));

// ── Settings router ──
app.use('/api/settings', buildSettingsRouter({
  SUPABASE_URL,
  SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  requireAdmin,
}));

// ── Customer locations (world map) ──
const { buildLocationsRouter } = await import('./routes/orders-locations.js');
app.use('/api/orders', buildLocationsRouter({
  SUPABASE_URL,
  SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
}));

// ── Webhook event sink — accepts events from Stripe, GitHub, Railway ──
// Events are logged to Supabase webhook_events table for the Hermes cron
// to pick up and report.
app.post('/api/webhook/events', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const body = req.body || {};
  // Check headers first (GitHub sends event type as X-GitHub-Event header)
  const eventName = req.headers['x-github-event'] || req.headers['x-railway-event'] || body.event || body.type || 'unknown';
  // Ping events from GitHub are just connection tests — accept silently
  if (eventName === 'ping') return res.json({ ok: true });
  // Determine source from header or body
  const source = req.headers['user-agent']?.includes('GitHub') ? 'github'
    : req.headers['user-agent']?.includes('Railway') ? 'railway'
    : body.source || 'webhook';
  const payload = body.data || body;
  if (!eventName || eventName === 'unknown') return res.status(400).json({ error: 'event type required' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/webhook_events`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ source, event: eventName, payload: JSON.stringify(payload), received_at: new Date().toISOString() }),
    }).catch(() => {});
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// ── Dashboard API — aggregated store data for desktop plugin ──
app.get('/api/dashboard', async (req, res) => {
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const URL = process.env.VITE_SUPABASE_URL;
  if (!KEY || !URL) return res.json({ error: 'server not configured' });

  const today = new Date().toISOString().slice(0, 10);

  async function sfetch(path) {
    try {
      const r = await fetch(`${URL}/rest/v1/${path}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  }

  const [orders, lowStock, chatPending, events] = await Promise.all([
    sfetch(`orders?created_at=gte.${today}&select=total,status&order=created_at.desc`),
    sfetch(`custom_products?stock=lte.3&stock=gt.0&select=name,stock`),
    sfetch(`chat_messages?select=session_id,sender,message,created_at&order=created_at.desc&limit=200`),
    sfetch(`webhook_events?order=created_at.desc&limit=5&select=source,event,created_at`),
  ]);

  // Build per-session chat state from the message list
  const chatSessions = {};
  if (Array.isArray(chatPending)) {
    for (const m of chatPending) {
      if (!chatSessions[m.session_id]) chatSessions[m.session_id] = { messages: [], lastCustomerMsg: null, lastAdminMsg: null };
      chatSessions[m.session_id].messages.push(m);
    }
  }
  // Determine last message sender per session
  const pendingList = [];
  for (const [sid, data] of Object.entries(chatSessions)) {
    const msgs = data.messages;
    const lastMsg = msgs[msgs.length - 1];
    const prevMsg = msgs.length > 1 ? msgs[msgs.length - 2] : null;
    if (lastMsg && lastMsg.sender === 'customer') {
      pendingList.push({
        session_id: sid,
        last_message: lastMsg.message ? lastMsg.message.slice(0, 80) : '',
        last_time: lastMsg.created_at,
        has_reply: prevMsg && prevMsg.sender === 'admin',
      });
    }
  }
  // Sort by newest first
  pendingList.sort((a, b) => new Date(b.last_time) - new Date(a.last_time));

  const todayOrders = Array.isArray(orders) ? orders.filter(o => o.status !== 'cancelled') : [];
  const todayRevenue = todayOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

  res.json({
    status: 'ok',
    today: { orders: todayOrders.length, revenue: todayRevenue },
    pendingChats: pendingList.length,
    pendingChatList: pendingList.slice(0, 10),
    lowStock: Array.isArray(lowStock) ? lowStock.map(p => ({ name: p.name, stock: p.stock })) : [],
    recentEvents: Array.isArray(events) ? events.slice(0, 5).map(e => ({
      source: e.source, event: e.event, time: e.created_at,
    })) : [],
    timestamp: new Date().toISOString(),
  });
});

// ── SPA fallback — serve index.html for any non-API, non-static route ──
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// ── Global error handler — Express 5 default is HTML; return JSON instead ──
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err?.message || err);
  res.status(500).json({ error: 'Internal server error. Please try again or contact support.' });
});


// Export for Vercel serverless
export default app;

