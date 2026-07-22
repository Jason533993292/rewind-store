import express from 'express';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
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
import cookieParser from 'cookie-parser';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://luiqimsfvllgsmzedncw.supabase.co", "https://api.stripe.com", "https://api.resend.com", "https://generativelanguage.googleapis.com", "https://*.stripe.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://*.stripe.com"],
      scriptSrc: ["'self'", "https://js.stripe.com", "https://*.stripe.com"],
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
    headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (Array.isArray(ipData)) ipData.forEach(r => BLOCKED_IPS.set(r.ip_address, true));
  const emailData = await startupFetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/blocked_emails?select=email`, {
    headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
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
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
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


app.use(express.static(path.join(__dirname, '..', 'dist'), {
  maxAge: '1y',
  etag: true,
  setHeaders(res, p) {
    if (p.endsWith('.html')) {
      res.set('Cache-Control', 'no-store, must-revalidate');
    } else if (p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.woff2') || p.endsWith('.png') || p.endsWith('.webp')) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
console.log('[static]', path.join(__dirname, '..', 'dist'));

// ── Sitemap — generate dynamically from product catalog ──
app.get('/sitemap.xml', (_req, res) => {
  const urls = [
    'https://rewind-stores.com',
    'https://rewind-stores.com/#/track',
  ];
  // Add all product pages
  for (const p of SERVER_PRODUCTS) {
    urls.push(`https://rewind-stores.com/?product=${encodeURIComponent(p.id)}`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => '  <url><loc>' + u + '</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>').join('\n')}
</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.send(xml);
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
    env: process.env.VERCEL ? 'vercel' : process.env.RAILWAY_ENV ? 'railway' : 'local',
    dist: distStatus,
  });
});

// ── Rate limiting ──
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use(generalLimiter);
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });

// Load blocked IPs on startup

// Track failed login attempts per IP (5 → 1h ban)
const verifyAttempts = new Map();
// `token` is either the master secret (first login, typed by the admin) or a
// previously-issued session token (silent re-check on page load). Either way,
// the response hands back a fresh signed session token — that's what the
// client stores and replays, never the master secret itself.
app.post('/api/verify-admin', strictLimiter, async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.json({ verified: false });
  const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_SECRET_TOKEN;
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
    return res.json({ verified: false });
  }
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY || !SUPABASE_URL) return res.json({ verified: false });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    const verified = Array.isArray(data) && data.length > 0;
    if (!verified) return res.json({ verified: false });
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
    res.json({ verified: false });
  }
});

// ── Admin: check if session cookie is still valid (no localStorage needed) ──
app.get('/api/admin/check-auth', async (req, res) => {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ authed: false });
  if (verifyAdminSession(token)) {
    res.json({ authed: true });
  } else {
    res.clearCookie('admin_session');
    res.status(401).json({ authed: false });
  }
});

// ── Generate product description (fallback — AI was removed for security) ──
app.post('/api/generate-description', async (req, res) => {
  res.json({ title: 'Vintage Streetwear Piece', description: 'Hand-picked vintage item. Authenticated, steam-cleaned, and ready to wear.' });
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function orderHtml({ name, items, total, address, orderNum }) {
  const rows = items.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(it.name)} <span style="color:#888">(${escapeHtml(it.size || '')})</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">€${it.price}</td>
    </tr>`).join('');
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF6EF">
<table width="100%" style="max-width:560px;margin:0 auto;padding:40px 20px">
<tr><td style="text-align:center;padding-bottom:20px">
  <h1 style="font-size:28px;color:#16130F;margin:0">REWIND<span style="color:#FF4D14">.</span></h1>
</td></tr>
<tr><td style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <h2 style="font-size:22px;color:#16130F;margin:0 0 6px">Order confirmed ✅</h2>
  <p style="color:#6E665A;font-size:15px;margin:0 0 4px">Hi ${escapeHtml(name || 'there')},</p>
  <p style="color:#6E665A;font-size:15px;margin:0 0 20px">Your order <b>${escapeHtml(orderNum)}</b> has been placed.</p>
  <table width="100%">${rows}</table>
  <div style="border-top:2px solid #16130F;padding:12px 0;margin-top:8px">
    <table width="100%"><tr>
      <td style="font-weight:700;font-size:16px">Total</td>
      <td style="font-weight:700;font-size:16px;text-align:right">€${total}</td>
    </tr></table>
  </div>
  <p style="color:#6E665A;font-size:14px;margin:16px 0 0">
    Shipping to:<br>${escapeHtml(address || '(address provided)')}
  </p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0">We'll email you when it ships.</p>
  <p style="margin:8px 0 0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`;
}

function campaignHtml({ message }) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF6EF">
<table width="100%" style="max-width:560px;margin:0 auto;padding:40px 20px">
<tr><td style="text-align:center;padding-bottom:20px">
  <h1 style="font-size:28px;color:#16130F;margin:0">REWIND<span style="color:#FF4D14">.</span></h1>
</td></tr>
<tr><td style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <p style="color:#16130F;font-size:16px;line-height:1.6;margin:0;white-space:pre-wrap">${escapeHtml(message || '')}</p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0"><a href="https://rewind-stores.com/#admin" style="color:#FF4D14">Unsubscribe</a></p>
  <p style="margin:8px 0 0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`;
}

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
  const INTERNAL_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_SECRET_TOKEN;
  const clientToken = req.headers['x-internal-token'];
  if (INTERNAL_TOKEN && (!clientToken || clientToken !== INTERNAL_TOKEN)) {
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
  // 2. Check Supabase custom_products
  try {
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !key) return null;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(id)}&select=price`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0 && data[0].price != null) {
      return data[0].price;
    }
  } catch {}
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(upper)}&select=code,discount,label,used,expires_at`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
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
  const promoCode = code || 'REWIND-' + Math.random().toString(36).substring(2, 6).toUpperCase();
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
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
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
        headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
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

// Admin management — requires master token specifically, not just any admin session
app.post('/api/manage-admins', strictLimiter, async (req, res) => {
  const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_SECRET_TOKEN;
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
      method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
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
    const realPrice = pid ? await lookupProductPrice(pid) : null;
    // Never fall back to the client-supplied price. If the product ID
    // isn't found in the server catalog or custom_products, treat it as
    // free/ignored rather than trusting whatever price the client sent.
    subtotal += (realPrice ?? 0) * (it.qty || 1);
  }
  const zoneRate = SHIPPING_ZONES[resolveCountry(country)] || DEFAULT_SHIPPING;
  const shipping = subtotal >= 150 ? 0 : zoneRate;
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
    const pid = item.id || item.product_id;
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
  if (!stripe) return res.status(400).json({ error: 'STRIPE_SECRET_KEY not configured' });
  const { items, orderNum, email, name, address, promoCode, paymentMethod, country } = req.body;
  if (!items || !items.length || !orderNum || !email) return res.status(400).json({ error: 'Missing required fields' });
  
  // Validate items array — each must have a valid id and positive qty
  for (const it of items) {
    const pid = it.id || it.product_id;
    if (!pid || typeof pid !== 'string') return res.status(400).json({ error: 'Each item must have a valid product id' });
    const qty = it.qty || 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return res.status(400).json({ error: `Item "${pid}" has invalid quantity` });
  }
  
  // Check stock before creating PaymentIntent — prevents overselling
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const it of items) {
    const pid = it.id || it.product_id;
    const qty = it.qty || 1;
    try {
      // Check custom_products first (these have variable stock)
      const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(pid)}&select=stock,name`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        const product = data[0];
        if (product.stock != null && product.stock < qty) {
          return res.status(400).json({ error: `"${product.name || pid}" only has ${product.stock} in stock` });
        }
      }
      // If not found in custom_products, it's a static SERVER_PRODUCT — no stock to check
    } catch {}
  }

  // Server-side price recompute — never trust client amounts
  const { subtotal, discountPrice } = await computeOrder(items, promoCode, country);
  const finalTotal = Math.round(discountPrice * 100);

  // Map frontend payment method IDs to Stripe payment method types.
  // Apple Pay and Google Pay are NOT separate Stripe payment_method_types —
  // there is no 'apple_pay' or 'google_pay' value in Stripe's enum. Both
  // wallets produce a standard 'card' PaymentMethod under the hood via the
  // Payment Request Button, so they're covered by the 'card' fallback below.
  const methodTypes = paymentMethod === 'bancontact' ? ['bancontact']
    : paymentMethod === 'klarna' ? ['klarna']
    : paymentMethod === 'ideal' ? ['ideal']
    : paymentMethod === 'paypal' ? ['paypal']
    : ['card'];

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalTotal,
      currency: 'eur',
      metadata: { orderNum, email, name: name || '', address: (address || '').slice(0, 480), itemsJson: JSON.stringify(items.map(i => ({ id: i.id, qty: i.qty, price: i.price }))), promoCode: promoCode || '' },
      payment_method_types: methodTypes,
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error('PaymentIntent error:', e);
    res.status(500).json({ error: 'Could not create payment' });
  }
});

// ── Get orders by email ──
// ── Customer order lookup by email + order number ──
app.post('/api/lookup-order', strictLimiter, async (req, res) => {
  const { email, orderNum } = req.body;
  if (!email || !orderNum) return res.status(400).json({ error: 'Email and order number required' });
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
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
    const { orderNum, email, name, address, itemsJson, promoCode } = pi.metadata || {};
    if (orderNum && email) {
      try {
        // Webhook idempotency: skip if order already exists
        const check = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_num=eq.${encodeURIComponent(orderNum)}&select=id`, {
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
        const existing = await check.json();
        if (Array.isArray(existing) && existing.length > 0) {
          console.log('Order already exists (duplicate webhook):', orderNum);
        } else {
          const items = itemsJson ? JSON.parse(itemsJson) : [];
          const { subtotal, shipping, discountPrice } = await computeOrder(items, promoCode);
          const total = discountPrice + shipping;
          await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_num: orderNum, email, customer_name: name || '', address: address || '', items: JSON.stringify(items), total, shipping, status: 'pending', created_at: new Date().toISOString() }),
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
  }

  res.json({ received: true });
});

// ── Admin: blanket auth + no-cache for all /api/admin/* routes ──
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  requireAdmin(req, res, next);
});

// ── Public sitemap ──
app.get('/sitemap.xml', async (_req, res) => {
  res.set('Content-Type', 'application/xml');
  const STATIC = ['', '#shop', '#track'];
  const urls = STATIC.map(p => `<url><loc>https://rewind-stores.com${p}</loc></url>`).join('')
    + SERVER_PRODUCTS.map(p => `<url><loc>https://rewind-stores.com/${p.id}</loc></url>`).join('');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    res.json({ items: Array.isArray(data) ? data : [] });
  } catch { res.json({ items: [] }); }
});

app.post('/api/wishlist', async (req, res) => {
  const { email, product_ids } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?email=eq.${encodeURIComponent(email)}`, {
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
        body: JSON.stringify({ email, product_ids: product_ids || [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to save wishlist' }); }
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

// ── Create test order (protected by cron token for testing) ──
app.post('/api/create-test-order', async (req, res) => {
  const token = (req.headers['x-cron-token'] || '').trim();
  const CRON_TOKEN = (process.env.CRON_SECRET_TOKEN || '').trim();
  if (!token || !CRON_TOKEN || token !== CRON_TOKEN) return res.status(403).json({ error: 'Unauthorized' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orderNum = 'RW-TEST-' + String(Date.now()).slice(-6);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_num: orderNum, email, customer_name: 'Test User', address: 'Test Street 1, Brussels', items: JSON.stringify([{ id: 'reward-hoodie', name: 'Rewind Hoodie', qty: 1, price: 50 }]), total: 50, shipping: 0, status: 'pending', created_at: new Date().toISOString() }),
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
app.post('/api/check-blocked-email', async (req, res) => {
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

app.post('/api/push/subscribe', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'subscription required' });
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const checkRes = await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint) + '&select=id', {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    });
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) return res.json({ ok: true });
    await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions', {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
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

// ── SPA fallback — serve index.html for any non-API, non-static route ──
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Export for Vercel serverless
export default app;

