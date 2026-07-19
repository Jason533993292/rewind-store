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
  setHeaders(res, p) {
    if (p.endsWith('.html')) res.set('Cache-Control', 'no-store, must-revalidate');
  }
}));
console.log('[static]', path.join(__dirname, '..', 'dist'));

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

// ── Verify admin email + token (server-side check) ──
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
  if (!isMasterToken && !isValidSession) return res.json({ verified: false });
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
      path: '/',
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

  // Check database for generated promo codes
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(upper)}&used=eq.false&select=code,discount,label`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) {
      const p = data[0];
      return res.json({ valid: true, type: 'percent', value: p.discount, label: p.label || `${p.discount}% off` });
    }
  } catch {}

  res.json({ valid: false });
});

// Admin: create a promo code (stored in DB)
app.post('/api/admin/create-promo', requireAdmin, async (req, res) => {
  const { discount, label, code } = req.body;
  if (!discount || discount < 1 || discount > 100) return res.status(400).json({ error: 'Discount must be 1-100' });
  const promoCode = code || 'REWIND-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const promoRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ code: promoCode, discount, label: label || `${discount}% off`, created_by: 'admin' }),
    });
    if (!promoRes.ok) {
      return res.status(500).json({ error: 'Failed to create promo code' });
    }
    auditLog(getAdminEmailFromToken(req), 'create_promo', `${promoCode} (${discount}% off)`, req.ip);
    res.json({ code: promoCode, discount });
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
    try {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(promoCode)}&select=discount,discount_type,label,uses,max_uses`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        const promo = data[0];
        if (promo.max_uses == null || (promo.uses || 0) < promo.max_uses) {
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
app.post('/api/create-payment-intent', async (req, res) => {
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_num=eq.${encodeURIComponent(orderNum)}&email=eq.${encodeURIComponent(email)}&select=order_num,status,total,items,shipping,customer_name,created_at`, {
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
        shipping: order.shipping,
        customer_name: order.customer_name,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []),
        created_at: order.created_at,
      }
    });
  } catch { res.json({ found: false }); }
});

app.post('/api/get-orders', strictLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const response = await fetch(`${SUPABASE_URL || SUPABASE_URL}/rest/v1/orders?email=eq.${encodeURIComponent(email)}&order=created_at.desc`, {
      headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}` },
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

          // Increment promo uses if a promo was applied
          if (promoCode) {
            try {
              await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_promo_uses`, {
                method: 'POST',
                headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ p_code: promoCode }),
              });
            } catch (promoErr) {
              console.warn('Failed to increment promo uses:', promoErr.message);
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

app.get('/api/admin/blocked-ips', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    res.json({ ips: await r.json() || [] });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

app.post('/api/admin/block-ip', express.json(), async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ip_address: ip }) });
  BLOCKED_IPS.set(ip, true);
  auditLog(getAdminEmailFromToken(req), 'block_ip', ip, req.ip);
  res.json({ ok: true });
});

app.post('/api/admin/unblock-ip', express.json(), async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips?ip_address=eq.${encodeURIComponent(ip)}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  BLOCKED_IPS.delete(ip);
  auditLog(getAdminEmailFromToken(req), 'unblock_ip', ip, req.ip);
  res.json({ ok: true });
});

// ── Survey ──
app.post('/api/survey', express.json(), async (req, res) => {
  const { source } = req.body;
  if (!source) return res.json({ ok: false });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/survey_responses`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) });
  } catch {}
  res.json({ ok: true });
});

// ── Check blocked email ──
app.post('/api/check-blocked-email', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ blocked: false });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email)}`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    const data = await r.json();
    res.json({ blocked: data && data.length > 0 });
  } catch { res.json({ blocked: false }); }
});

// ── Admin: manage blocked emails ──
app.get('/api/admin/blocked-emails', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    res.json({ emails: await r.json() || [] });
  } catch { res.json({ emails: [] }); }
});

app.post('/api/admin/block-email', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, { method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase().trim(), created_at: new Date().toISOString() }) });
    const d = await r.json();
    if (d.error) return res.status(500).json({ error: d.error });
    auditLog(getAdminEmailFromToken(req), 'block_email', email, req.ip);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

// ── Admin: block a chat customer (email + IP) ──
app.post('/api/admin/block-customer', express.json(), async (req, res) => {
  const { session_id, email, ip } = req.body;
  if (!session_id && !email) return res.status(400).json({ error: 'session_id or email required' });
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  // If session_id given, look up the session to get email and IP
  let targetEmail = email;
  let targetIp = ip;
  if (session_id && (!targetEmail || !targetIp)) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}&select=customer_email,customer_ip`, {
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        if (!targetEmail && data[0].customer_email) targetEmail = data[0].customer_email;
        if (!targetIp && data[0].customer_ip) targetIp = data[0].customer_ip;
      }
    } catch (e) { console.warn('Failed to look up session for blocking:', e.message); }
  }

  const results = { emailBlocked: false, ipBlocked: false };
  const errors = [];

  // Block email
  if (targetEmail) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, {
        method: 'POST',
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail.toLowerCase().trim(), created_at: new Date().toISOString() }),
      });
      if (r.ok) {
        BLOCKED_EMAILS.add(targetEmail.toLowerCase().trim());
        results.emailBlocked = true;
      } else {
        const e = await r.json();
        if (e.error && !e.error.includes('duplicate')) errors.push('Email: ' + e.error);
      }
    } catch (e) { errors.push('Email: ' + e.message); }
  }

  // Block IP
  if (targetIp) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, {
        method: 'POST',
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_address: targetIp, created_at: new Date().toISOString() }),
      });
      if (r.ok) {
        BLOCKED_IPS.set(targetIp, true);
        results.ipBlocked = true;
      } else {
        const e = await r.json();
        if (e.error && !e.error.includes('duplicate')) errors.push('IP: ' + e.error);
      }
    } catch (e) { errors.push('IP: ' + e.message); }
  }

  res.json({ ok: results.emailBlocked || results.ipBlocked, ...results, errors: errors.length > 0 ? errors : undefined });
});

app.post('/api/admin/unblock-email', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`, { method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    auditLog(getAdminEmailFromToken(req), 'unblock_email', email, req.ip);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

// ── Admin: list all user emails from orders + wishlists ──
app.get('/api/admin/user-emails', async (req, res) => {
  try {
    const [ords, wls] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=email`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/wishlists?select=email`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }).then(r => r.json()),
    ]);
    const emailSet = new Set();
    (Array.isArray(ords) ? ords : []).forEach(o => { if (o.email) emailSet.add(o.email.toLowerCase().trim()); });
    (Array.isArray(wls) ? wls : []).forEach(w => { if (w.email) emailSet.add(w.email.toLowerCase().trim()); });
    res.json({ emails: [...emailSet].sort() });
  } catch { res.json({ emails: [] }); }
});

// ── Admin: product CRUD with input validation ──
app.post('/api/admin/products/add', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  const { name, cat, price, stock, sizes, ...rest } = req.body;
  if (!name || !cat || typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'name, cat, and non-negative price are required' });
  }
  if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
    return res.status(400).json({ error: 'stock must be a non-negative number' });
  }
  if (sizes !== undefined && !Array.isArray(sizes)) {
    return res.status(400).json({ error: 'sizes must be an array' });
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products`, {
      method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ name, cat, price, stock, sizes, ...rest }),
    });
    const data = await r.json();
    res.json({ ok: r.ok, data });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

app.post('/api/admin/products/update', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { product_id, ...updates } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(product_id)}`, {
      method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(updates),
    });
    const data = await r.json();
    res.json({ ok: r.ok, data });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

app.post('/api/admin/products/delete', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/custom_products?id=eq.${id}`, {
      method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

app.post('/api/admin/products/upload-image', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { productId, imageBase64, ext } = req.body;
    if (!productId || !imageBase64) return res.status(400).json({ error: 'productId and imageBase64 required' });
    const buf = Buffer.from(imageBase64, 'base64');
    const allowed = ['jpg','jpeg','png','webp'];
    const fileExt = ext && allowed.includes(ext) ? ext : 'webp';
    const filePath = `${productId}.${fileExt}`;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${filePath}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
      body: buf,
    });
    if (!r.ok) return res.status(500).json({ error: 'Upload failed' });
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/product-images/${filePath}`;
    res.json({ ok: true, url: publicUrl });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

// ── Admin: get all wishlist users ──
app.get('/api/admin/users', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?select=*&order=created_at.desc`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    res.json({ users: Array.isArray(data) ? data : [] });
  } catch {
    res.json({ users: [] });
  }
});

// ── Admin: preview cancellation email (generates text without sending) ──
app.post('/api/admin/preview-cancel-email', async (req, res) => {
  const { reason, customReason, customerName } = req.body;
  const reasonLabels = { out_of_stock: 'Out of stock', damaged: 'Damaged during handling', customer_request: 'Customer requested cancellation', other: 'Other' };
  const reasonText = reason === 'other' && customReason ? customReason : (reasonLabels[reason] || reason);
  let emailBody = '';
  const cannedEmails = {
    out_of_stock: `Hi ${customerName || 'there'},\n\nWe regret to inform you that your recent REWIND order has been cancelled due to the item being out of stock. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
    damaged: `Hi ${customerName || 'there'},\n\nWe regret to inform you that your recent REWIND order has been cancelled because the item was damaged during handling. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
    customer_request: `Hi ${customerName || 'there'},\n\nAs requested, your recent REWIND order has been cancelled. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
  };

  if (reason !== 'other' && cannedEmails[reason]) {
    emailBody = cannedEmails[reason];
  } else {
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Write a cancellation email for a REWIND vintage streetwear order. The customer's name is ${customerName || 'there'}. The reason is: "${reasonText}". Use this exact structure:

            1. Greeting: "Hi [customer name],"
            2. One sentence stating the cancellation and the specific reason
            3. "A full refund has been initiated and will appear in your account within 5-10 business days."
            4. "If you have any questions, reply to this email or contact us at orders@rewind-stores.com."
            5. Sign-off: "— REWIND team"

            Keep it concise and professional. No slang, no emoji, no exclamation marks. Max 5 short sentences. No subject line.`
          }]
        }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    });
    const aiData = await aiRes.json();
    emailBody = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  if (!emailBody) {
    const fallbacks = {
      out_of_stock: "Unfortunately, the item you ordered is out of stock and we're unable to fulfill it.",
      damaged: "Unfortunately, the item was damaged during handling and we cannot send it out.",
      customer_request: "You requested cancellation of this order.",
      other: "Your order has been cancelled as requested.",
    };
    emailBody = fallbacks[reason] || 'Your order has been cancelled.';
    if (reason === 'other' && customReason) emailBody = customReason;
  }
  res.json({ emailBody, reasonText });
});

// ── Admin: cancel order ──
app.post('/api/admin/cancel-order', async (req, res) => {
  const { orderId, reason, customReason } = req.body;
  if (!orderId || !reason) return res.status(400).json({ error: 'orderId and reason required' });
  try {
    // Update order status
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      console.error('Supabase PATCH failed:', errBody);
      return res.status(500).json({ error: 'Failed to update order in database. Check server logs.' });
    }
    // Fetch order details for the email
    const orderData = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).then(r => r.json());
    const order = Array.isArray(orderData) ? orderData[0] : null;
    // Send cancellation email
    if (order?.email && resend) {
      const reasonLabels = { out_of_stock: 'Out of stock', damaged: 'Damaged during handling', customer_request: 'Customer requested cancellation', other: 'Other' };
      // Use canned emails for predefined reasons, AI for "Other"
      let emailBody = '';
      const reasonText = reason === 'other' && customReason ? customReason : (reasonLabels[reason] || reason);
      const escapedName = escapeHtml(order.customer_name || 'there');
      const cannedEmails = {
        out_of_stock: `Hi ${escapedName},\n\nWe regret to inform you that your recent REWIND order has been cancelled due to the item being out of stock. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
        damaged: `Hi ${escapedName},\n\nWe regret to inform you that your recent REWIND order has been cancelled because the item was damaged during handling. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
        customer_request: `Hi ${escapedName},\n\nAs requested, your recent REWIND order has been cancelled. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
      };
      if (reason !== 'other' && cannedEmails[reason]) {
        emailBody = cannedEmails[reason];
      } else {
        try {
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Write a cancellation email for a REWIND vintage streetwear order. The customer's name is ${order.customer_name || 'there'}. The reason is: "${reasonText}". Use this exact structure:\n\n1. Greeting: "Hi [customer name],"\n2. One sentence stating the cancellation and the specific reason\n3. "A full refund has been initiated and will appear in your account within 5-10 business days."\n4. "If you have any questions, reply to this email or contact us at orders@rewind-stores.com."\n5. Sign-off: "— REWIND team"\n\nKeep it concise and professional. No slang, no emoji, no exclamation marks. Max 5 short sentences. No subject line.`
                }]
              }],
              generationConfig: { maxOutputTokens: 2000 },
            }),
          });
          const aiData = await aiRes.json();
          emailBody = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch {}
      }
      if (!emailBody) {
        // Fallback if AI fails
        const fallbacks = {
          out_of_stock: "Unfortunately, the item you ordered is out of stock and we're unable to fulfill it.",
          damaged: "Unfortunately, the item was damaged during handling and we cannot send it out.",
          customer_request: "You requested cancellation of this order.",
          other: "Your order has been cancelled as requested.",
        };
        emailBody = fallbacks[reason] || 'Your order has been cancelled.';
        if (reason === 'other' && customReason) emailBody = customReason;
      }
      await resend.emails.send({
        from: FROM_EMAIL, reply_to: REPLY_TO, to: order.email,
        subject: `Order ${order.order_num} cancelled — refund initiated`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#FAF6EF">
          <h1 style="font-size:24px;color:#16130F">REWIND<span style="color:#FF4D14">.</span></h1>
          <div style="background:#fff;border-radius:14px;padding:32px;margin-top:20px">
            <h2 style="font-size:20px;color:#16130F;margin:0 0 8px">Order cancelled</h2>
            <p style="color:#6E665A;font-size:15px;line-height:1.6">Hi ${escapeHtml(order.customer_name || 'there')},</p>
            <p style="color:#6E665A;font-size:15px;line-height:1.6">
              ${emailBody}<br/><br/>
              <b>Reason:</b> ${reasonText}<br/><br/>
              If you have any questions, reply to this email or contact us at orders@rewind-stores.com.
            </p>
            <p style="color:#6E665A;font-size:14px;margin-top:20px">— REWIND team</p>
          </div>
        </div>`,
      });
    }
    auditLog(getAdminEmailFromToken(req), 'cancel_order', orderNum || orderId, req.ip);
    res.json({ ok: true });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// ── Admin: undo cancellation (revert to pending) ──
app.post('/api/admin/undo-cancel-order', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Failed to undo' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Undo cancel error:', err);
    res.status(500).json({ error: 'Failed to undo cancellation' });
  }
});

// ── Admin: get all orders ──
app.get('/api/admin/orders', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;
    const [ordersRes, countRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?order=created_at.desc&limit=${limit}&offset=${offset}`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=count`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }),
    ]);
    const orders = await ordersRes.json();
    const count = Array.isArray(await countRes.json()) ? (await countRes.json())[0]?.count : 0;
    res.json({ orders: orders || [], total: count, limit, offset });
  } catch { res.json({ orders: [], total: 0 }); }
});

app.post('/api/admin/orders/update-status', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'id and status required' });
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`, {
      method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Operation failed' }); }
});

// ── Admin: mark order as shipped + send notification email ──
app.post('/api/admin/orders/ship', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { id, trackingNumber, courier, trackingUrl } = req.body;
  if (!id || !trackingNumber || !courier) return res.status(400).json({ error: 'id, trackingNumber, and courier required' });
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`, {
      method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped', tracking_number: trackingNumber, courier, tracking_url: trackingUrl || 'https://www.17track.net/en' }),
    });
    if (!updateRes.ok) return res.status(500).json({ error: 'Failed to update order' });
    const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}&select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const orderData = await orderRes.json();
    const order = Array.isArray(orderData) ? orderData[0] : null;
    if (order?.email && resend) {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
      const itemsList = items.map(it => `${it.name || ''} ${it.size ? '(' + it.size + ')' : ''}`).filter(Boolean).join(', ');
      await resend.emails.send({
        from: FROM_EMAIL, reply_to: REPLY_TO, to: order.email,
        subject: `Your REWIND order has shipped — ${order.order_num}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#FAF6EF">
          <h1 style="font-size:24px;color:#16130F">REWIND<span style="color:#FF4D14">.</span></h1>
          <div style="background:#fff;border-radius:14px;padding:32px;margin-top:20px">
            <h2 style="font-size:20px;color:#16130F;margin:0 0 8px">Your order is on the way! 📦</h2>
            <p style="color:#6E665A;font-size:15px">Hi ${escapeHtml(order.customer_name || 'there')},</p>
            <p style="color:#6E665A;font-size:15px">Order <b>${escapeHtml(order.order_num)}</b> has shipped.</p>
            ${itemsList ? `<p style="color:#6E665A;font-size:14px"><b>Items:</b> ${escapeHtml(itemsList)}</p>` : ''}
            <div style="background:#F5F0E8;border-radius:10px;padding:16px;margin:16px 0">
              <p style="margin:0 0 4px;font-size:13px;color:#6E665A"><b>Courier:</b> ${escapeHtml(courier)}</p>
              <p style="margin:0 0 4px;font-size:13px;color:#6E665A"><b>Tracking:</b> ${escapeHtml(trackingNumber)}</p>
              <p style="margin:0;font-size:13px"><a href="${escapeHtml(trackingUrl || 'https://www.17track.net/en')}" style="color:#FF4D14;font-weight:600" target="_blank">Track your package →</a></p>
            </div>
            <p style="color:#6E665A;font-size:14px;margin-top:16px">Thanks for shopping at REWIND.</p>
          </div></div>`,
      });
    }
    auditLog(getAdminEmailFromToken(req), 'ship_order', `${order?.order_num || id} via ${courier} (${trackingNumber})`, req.ip);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ship order error:', e);
    res.status(500).json({ error: 'Failed to ship order' });
  }
});

// ── Admin: audit log ──
app.get('/api/admin/audit-log', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return res.json({ entries: [] });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/audit_log?order=created_at.desc&limit=100`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    res.json({ entries: Array.isArray(data) ? data : [] });
  } catch { res.json({ entries: [] }); }
});

// The root server.js handles app.listen(). This file only exports the app.
// (Vercel imports this directly as a serverless function.)

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal error' });
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

