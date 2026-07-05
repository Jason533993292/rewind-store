# REWIND — Full Codebase Audit Bundle (V7.3.0)

Use this with any AI for a complete security/code-quality review.

## Prompt (paste to Claude, ChatGPT, Gemini, etc.)

```
FULL CODEBASE SECURITY AUDIT — REWIND vintage streetwear store

I run a one-person e-commerce store built with React + Vite + Express + Supabase + Stripe. Deployed on Railway. 

I've done several rounds of fixes already (rate limiting, requireAdmin middleware, timing-safe comparisons, 
removed direct Supabase browser calls, locked down save-order, etc.). 

I need you to do ONE LAST PASS on the ENTIRE codebase below and tell me:

1. CRITICAL — any exploitable holes I STILL have (auth bypass, price tampering, data exposure, SQL injection)
2. SECURITY — any remaining unprotected routes, missing auth, exposed secrets or patterns
3. PERFORMANCE — bundle size, re-render issues, slow queries, unused dependencies
4. UX — checkout friction, confusing flows, mobile issues
5. CODE QUALITY — dead code, anti-patterns, messy architecture, repeated inline styles
6. DEPLOY — Railway config issues, health check, build problems, missing env vars

Be SPECIFIC. File names. Line numbers. Exact code snippets. Don't hold back — this is my last pass before launch.
```

---


---
## FILE: api/server.js (Express backend — all routes, auth, middleware)
```js
import express from 'express';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

// ── IP blocker middleware ──
const BLOCKED_IPS = new Map(); // in-memory cache, cleared on restart

app.use(async (req, res, next) => {
  // Only check non-API routes (block page load, not API calls)
  if (!req.path.startsWith('/api/')) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress;
    if (BLOCKED_IPS.has(ip)) {
      return res.status(403).send(`
        <html><body style="background:#FAF6EF;display:grid;place-items:center;height:100vh;margin:0;font-family:sans-serif">
        <div style="text-align:center"><h1 style="font-size:48px;color:#16130F;margin:0">403</h1>
        <p style="color:#6E665A;margin-top:8px">You don't have access to this site.</p></div></body></html>`);
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'dist')));

// ── Rate limiting ──
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use(generalLimiter);
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });

// Load blocked IPs on startup

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.VERCEL ? 'vercel' : process.env.RAILWAY_ENV ? 'railway' : 'local',
  });
});

// ── Verify admin email + token (server-side check) ──
app.post('/api/verify-admin', async (req, res) => {
  const { email, token } = req.body;
  if (!email) return res.json({ verified: false });
  // Always require a valid admin API token — even for email verification.
  // Prevents email-only enumeration/brute-forcing of admin accounts.
  const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;
  if (!ADMIN_TOKEN || !token || ADMIN_TOKEN !== token) return res.json({ verified: false });
  try {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.VITE_SUPABASE_URL;
    if (!SERVICE_KEY || !url) return res.json({ verified: false });
    const r = await fetch(`${url}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    res.json({ verified: Array.isArray(data) && data.length > 0 });
  } catch {
    res.json({ verified: false });
  }
});

// ── Generate product description (fallback — AI was removed for security) ──
app.post('/api/generate-description', requireAdmin, async (req, res) => {
  res.json({ title: 'Vintage Streetwear Piece', description: 'Hand-picked vintage item. Authenticated, steam-cleaned, and ready to wear.' });
});

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'REWIND <orders@rewind-stores.com>';
const REPLY_TO = process.env.REPLY_TO || 'philippekojoanaman@gmail.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

function orderHtml({ name, items, total, address, orderNum }) {
  const rows = items.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee">${it.name} <span style="color:#888">(${it.size})</span></td>
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
  <p style="color:#6E665A;font-size:15px;margin:0 0 4px">Hi ${name || 'there'},</p>
  <p style="color:#6E665A;font-size:15px;margin:0 0 20px">Your order <b>${orderNum}</b> has been placed.</p>
  <table width="100%">${rows}</table>
  <div style="border-top:2px solid #16130F;padding:12px 0;margin-top:8px">
    <table width="100%"><tr>
      <td style="font-weight:700;font-size:16px">Total</td>
      <td style="font-weight:700;font-size:16px;text-align:right">€${total}</td>
    </tr></table>
  </div>
  <p style="color:#6E665A;font-size:14px;margin:16px 0 0">
    Shipping to:<br>${address || '(address provided)'}
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
  <p style="color:#16130F;font-size:16px;line-height:1.6;margin:0;white-space:pre-wrap">${message}</p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0"><a href="https://rewind-stores.com/#admin" style="color:#FF4D14">Unsubscribe</a></p>
  <p style="margin:8px 0 0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`;
}

// ── Order confirmation ──
app.post('/api/send-order', async (req, res) => {
  const { email, name, items, total, address, orderNum } = req.body;
  if (!resend) return res.json({ ok: true, note: 'Resend not configured' });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'No items provided' });
  }
  if (!email) {
    return res.status(400).json({ ok: false, error: 'No recipient email provided' });
  }
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: email,
      subject: `Order confirmed — ${orderNum || 'N/A'}`,
      html: orderHtml({ name, items, total, address, orderNum }),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
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
  { id: "brasil02", name: "Brasil '02 Jersey", price: 42 },
  { id: "azzurri", name: "Azzurri Retro Jersey", price: 45 },
  { id: "meshtop", name: "Mesh Training Top", price: 34 },
  { id: "terrypolo", name: "Terry Polo Set", price: 52 },
  { id: "cottonpolo", name: "Cotton Pique Polo", price: 38 },
  { id: "stripedpolo", name: "Striped Rugby Polo", price: 44 },
  { id: "vintageknit", name: "Vintage Knit Jumper", price: 55 },
  { id: "crewneck", name: "Retro Crewneck", price: 48 },
  { id: "cardigan", name: "Argyle Cardigan", price: 58 },
  { id: "velour94", name: "Velour Tracksuit '94", price: 68 },
  { id: "shellcobalt", name: "Shell Suit — Cobalt", price: 54 },
  { id: "halfzip", name: "Windbreaker Half-Zip", price: 58 },
  { id: "courtlo", name: "Court Classic Lo", price: 72 },
  { id: "suede88", name: "Suede Runner '88", price: 85 },
  { id: "hitop", name: "Hi-Top Retro", price: 78 },
];

async function lookupProductPrice(id) {
  // 1. Check hardcoded server catalog
  const found = SERVER_PRODUCTS.find(p => p.id === id);
  if (found) return found.price;
  // 2. Check Supabase custom_products
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const r = await fetch(`${url}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(id)}&select=price`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0 && data[0].price != null) {
      return data[0].price;
    }
  } catch {}
  return null;
}

// Validate promo code
app.post('/api/validate-promo', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ valid: false });

  const PROMO_CODES = {
    'REWIND10': { valid: true, type: 'percent', value: 10 },
    'FREESHIP': { valid: true, type: 'free_shipping', value: 0 },
  };

  const ADMIN_CODE = process.env.ADMIN_SECRET_CODE;
  if (code && ADMIN_CODE && code.toUpperCase().trim() === ADMIN_CODE.toUpperCase().trim()) {
    return res.json({ admin: true });
  }

  const promo = PROMO_CODES[code.toUpperCase().trim()];
  if (promo) return res.json(promo);

  res.json({ valid: false });
});

// ── Admin: require admin token middleware ──
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  const secret = process.env.ADMIN_SECRET_TOKEN;
  if (!secret) {
    return res.status(500).json({ error: 'ADMIN_SECRET_TOKEN not configured on server' });
  }
  if (!secret || !token || token.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// Admin management (add/remove admins)
app.post('/api/manage-admins', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  const { action, email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  if (action === 'add') {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admins`, {
      method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email, added_by: 'admin' }),
    });
    res.json({ ok: true });
  } else if (action === 'remove') {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// ── Stripe Checkout Session ──
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'STRIPE_SECRET_KEY not configured on Railway' });
  const { items, total, orderNum, email, name, address } = req.body;
  // Check if email is blocked
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const bd = await br.json();
    if (Array.isArray(bd) && bd.length > 0) return res.status(403).json({ error: 'Email is blocked' });
  } catch {}
  try {
    // Look up real prices server-side — never trust the client-supplied price.
    const line_items = [];
    const productIds = [];
    for (const it of (items || [])) {
      const pid = it.id || it.product_id;
      const realPrice = pid ? await lookupProductPrice(pid) : null;
      if (realPrice === null) {
        return res.status(400).json({ error: `Unknown product: ${it.name || pid}` });
      }
      productIds.push(pid);
      line_items.push({
        price_data: {
          currency: 'eur',
          product_data: { name: `${it.name}${it.size ? ` (${it.size})` : ''}` },
          unit_amount: Math.round(realPrice * 100),
        },
        quantity: it.qty || 1,
      });
    }
    // Calculate subtotal from server-looked-up prices — never trust client-supplied prices
    const realSubtotal = line_items.reduce((s, li) => {
      return s + (li.price_data.unit_amount / 100) * li.quantity;
    }, 0);
    const shipping = total - realSubtotal;
    // Only add shipping if it genuinely exists and makes sense
    if (shipping > 0 && shipping < 100) {
      line_items.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    } else if ((items || []).length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email,
      metadata: {
        orderNum,
        customer_name: name || '',
        address: address || '',
        product_ids: productIds.join(','),
      },
      success_url: `${process.env.BASE_URL || 'https://rewind-stores.com'}?order=success&orderNum=${orderNum}`,
      cancel_url: `${process.env.BASE_URL || 'https://rewind-stores.com'}?order=cancelled`,
      payment_method_types: ['card'],
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Get orders by email ──
app.post('/api/get-orders', requireAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const response = await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/orders?email=eq.${encodeURIComponent(email)}&order=created_at.desc`, {
      headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}` },
    });
    const orders = await response.json();
    res.json({ orders: orders || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Save order to Supabase (admin only) ──
app.post('/api/save-order', requireAdmin, async (req, res) => {
  const { orderNum, customer_name, email, address, items, total } = req.body;
  if (!orderNum) return res.status(400).json({ error: 'No order number' });
  // Force status to 'pending' — never trust client-supplied status
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/orders`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
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
    res.status(500).json({ error: err.message });
  }
});

// ── Run automated tests ──
app.get('/api/run-tests', requireAdmin, async (_req, res) => {
  try {
    const { runTests } = await import('../tests/button-test.js');
    const result = await runTests();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, passed: 0, failed: 1, total: 1, results: [{ name: 'Test runner', status: '❌', detail: err.message }] });
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
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { orderNum, customer_name, address } = session.metadata || {};
    const email = session.customer_details?.email || session.customer_email || '';
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const items = lineItems.data.map(it => ({ name: it.description, price: it.amount_total / 100, qty: it.quantity }));
      const total = session.amount_total / 100;
      // Save order to Supabase
      await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_num: orderNum, customer_name, email, address: address || '', items, total, status: 'paid' }),
      });
      // Decrement stock for purchased items — use product_ids from metadata if available
      const productIds = session.metadata?.product_ids ? session.metadata.product_ids.split(',').filter(Boolean) : [];
      if (productIds.length > 0 && productIds.length === items.length) {
        for (let i = 0; i < productIds.length; i++) {
          const pid = productIds[i];
          const qty = items[i]?.qty || 1;
          if (!pid) continue;
          const res = await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(pid)}`, {
            headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}` },
          });
          const products = await res.json();
          if (!products || products.length === 0) {
            console.warn(`Webhook: no custom_product found for product_id "${pid}" — skipping stock decrement`);
            continue;
          }
          const p = products[0];
          const currentStock = p.stock ?? 0;
          if (qty > currentStock) {
            console.warn(`Webhook: insufficient stock for "${pid}" (have ${currentStock}, need ${qty}) — clamping to 0`);
          }
          const newStock = Math.max(0, currentStock - qty);
          await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/custom_products?id=eq.${p.id}`, {
            method: 'PATCH',
            headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock: newStock }),
          });
        }
      } else {
        for (const it of items) {
          if (!it.name || !it.qty) continue;
          const productName = it.name.replace(/\s*\(.*?\)\s*$/, '').trim();
          const res = await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/custom_products?name=eq.${encodeURIComponent(productName)}`, {
            headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}` },
          });
          const products = await res.json();
          if (!products || products.length === 0) {
            console.warn(`Webhook: no custom_product found for "${productName}" — skipping stock decrement`);
            continue;
          }
          const p = products[0];
          const currentStock = p.stock ?? 0;
          if (it.qty > currentStock) {
            console.warn(`Webhook: insufficient stock for "${productName}" (have ${currentStock}, need ${it.qty}) — clamping to 0`);
          }
          const newStock = Math.max(0, currentStock - it.qty);
          await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/custom_products?id=eq.${p.id}`, {
            method: 'PATCH',
            headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock: newStock }),
          });
        }
      }
      if (process.env.RESEND_API_KEY) {
        await fetch(`http://localhost:${PORT}/api/send-order`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: customer_name, items, total, address, orderNum }),
        });
      }
    } catch (e) { console.error('Webhook error:', e); }
  }
  res.json({ received: true });
});

// ── Admin: manage blocked IPs ──
app.use('/api/admin', requireAdmin);

app.get('/api/admin/blocked-ips', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    res.json({ ips: await r.json() || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/block-ip', express.json(), async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ip_address: ip }) });
  BLOCKED_IPS.set(ip, true);
  res.json({ ok: true });
});

app.post('/api/admin/unblock-ip', express.json(), async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips?ip_address=eq.${encodeURIComponent(ip)}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  BLOCKED_IPS.delete(ip);
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
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/unblock-email', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`, { method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    const d = await r.json();
    if (d.error) return res.status(500).json({ error: d.error });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// ── Admin: product CRUD ──
app.post('/api/admin/products/add', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!SERVICE_KEY || !url) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const r = await fetch(`${url}/rest/v1/custom_products`, {
      method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.json({ ok: r.ok, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/products/update', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  const { product_id, ...updates } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  if (!SERVICE_KEY || !url) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const r = await fetch(`${url}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(product_id)}`, {
      method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(updates),
    });
    const data = await r.json();
    res.json({ ok: r.ok, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/products/delete', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!SERVICE_KEY || !url) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    await fetch(`${url}/rest/v1/custom_products?id=eq.${id}`, {
      method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/products/upload-image', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!SERVICE_KEY || !url) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { productId, imageBase64, ext } = req.body;
    if (!productId || !imageBase64) return res.status(400).json({ error: 'productId and imageBase64 required' });
    const buf = Buffer.from(imageBase64, 'base64');
    const fileExt = ext || 'webp';
    const filePath = `${productId}.${fileExt}`;
    const r = await fetch(`${url}/storage/v1/object/product-images/${filePath}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
      body: buf,
    });
    if (!r.ok) return res.status(500).json({ error: 'Upload failed' });
    const publicUrl = `${url}/storage/v1/object/public/product-images/${filePath}`;
    res.json({ ok: true, url: publicUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: get all wishlist users ──
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/wishlists?select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const data = await r.json();
    res.json({ users: Array.isArray(data) ? data : [] });
  } catch {
    res.json({ users: [] });
  }
});

// ── Admin: get all orders ──
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!SERVICE_KEY || !url) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const r = await fetch(`${url}/rest/v1/orders?order=created_at.desc`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const data = await r.json();
    res.json({ orders: data || [] });
  } catch { res.json({ orders: [] }); }
});

app.post('/api/admin/orders/update-status', requireAdmin, async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'id and status required' });
  if (!SERVICE_KEY || !url) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    await fetch(`${url}/rest/v1/orders?id=eq.${id}`, {
      method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));
}

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal error' });
});

// ── SPA fallback — serve index.html for any non-API, non-static route ──
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Export for Vercel serverless
export default app;
```


---
## FILE: src/App.jsx (React app — state, routing, admin panel, checkout)
```jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Banner, Header, Hero, Marquee, Toast, Footer, Icon, Photo } from './components/Shell';
import { ProductGrid, QuickView, CartDrawer, Checkout, SignupModal, WishlistDrawer } from './components/Shop';
import ClickSpark from './components/ClickSpark';
import { TweaksPanel, useTweaks, TweakSection, TweakToggle, TweakColor, TweakRadio } from './components/Tweaks';
import { REWIND_PRODUCTS, REWIND_CATS, BRANDS } from './data';
import { getWishlist, saveWishlist, signupUser, supabase, getCustomProducts, addCustomProduct, updateCustomProduct, uploadProductImage, saveOrder, getOrders, updateOrderStatus } from './lib/supabase';
import SizeGuide from './components/SizeGuide';
import InfoModal from './components/InfoModal';
import ProductPage from './components/ProductPage';
import RecentlyViewed from './components/RecentlyViewed';
import { money } from './hooks/useCountdown';

const TWEAK_DEFAULTS = {
  accent: '#FF4D14',
  headingFont: 'Bricolage Grotesque',
  showBanner: true,
  showCountdown: true,
  showCompare: true,
  showStock: true,
};

const VERSION = 'V7.3.1';

// Small reusable component — defined outside App() to prevent TDZ issues with
// the minifier reordering hoisted function declarations before state variables.
function SidebarBtn({ label, isOn, onClick, count }) {
  return (
    <button className={"rw-sb-btn" + (isOn ? " is-on" : "")} onClick={onClick}>
      <span className="rw-sb-label">{label}</span>
      {count !== undefined && <span className="rw-sb-count">{count}</span>}
    </button>
  );
}

export default function App() {
  // showSurvey MUST be the VERY FIRST state var so no TDZ error can occur
  // when the scroll-lock useEffect references it.
  const [showSurvey, setShowSurvey] = useState(false);
  // Ref-based guard against minifier TDZ — effects use showSurveyRef.current
  // instead of the raw `showSurvey` state variable so that even if esbuild
  // hoists the effect closures, they reference a stable object (ref) rather
  // than an uninitialized const binding.
  const showSurveyRef = useRef(showSurvey);
  useEffect(() => { showSurveyRef.current = showSurvey; }, [showSurvey]);

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('rw_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('rw_cart', JSON.stringify(cart));
  }, [cart]);
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(null);
  const [showSizes, setShowSizes] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [checkoutCount, setCheckoutCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [infoPage, setInfoPage] = useState(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoClosing, setPromoClosing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [brand, setBrand] = useState(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('rw_email') || '');
  const [wishlist, setWishlist] = useState([]);
  const [pendingWishlistId, setPendingWishlistId] = useState(null);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [wishlistReady, setWishlistReady] = useState(false);
  const [customProducts, setCustomProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sortBy, setSortBy] = useState(() => {
    try {
      return localStorage.getItem('rw_sort') || '';
    } catch { return ''; }
  });
  const [orderNumber, setOrderNumber] = useState('');
  const [showTweaks, setShowTweaks] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      const stored = localStorage.getItem('rw_recent');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

// ═══════════════════════════════════════════════════════════
// ⚡ TDZ GUARD — ALL callback/effect declarations below this
// line MUST reference only variables declared ABOVE this line.
// showToast is declared FIRST so every callback can use it.
// ═══════════════════════════════════════════════════════════
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, action, duration = 2400) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, k: Date.now(), action });
    toastTimer.current = setTimeout(() => setToast((cur) => (cur && cur.k && Date.now() - cur.k >= duration - 100 ? null : cur)), duration);
  }, []);
  const promoCloseTimerRef = useRef(null);
// ── ALL NEW useCallback/useEffect declarations go below ──
  // The scroll-lock useEffect (below) references these in its `anyOpen` check.
  // Adding a new state AFTER this point will break the site with a TDZ error.
  const customProductsRef = useRef(customProducts);
  useEffect(() => { customProductsRef.current = customProducts; }, [customProducts]);
  const wishlistRef = useRef(wishlist);
  useEffect(() => { wishlistRef.current = wishlist; }, [wishlist]);
  const recentlyViewedRef = useRef(recentlyViewed);
  useEffect(() => { recentlyViewedRef.current = recentlyViewed; }, [recentlyViewed]);

  // Load custom products from Supabase & re-check URL hash for direct product links
  useEffect(() => {
    getCustomProducts().then((prods) => {
      if (prods.length) setCustomProducts(prods);
      // Re-check the URL hash after custom products load — the hash-change
      // handler from the other effect only fires on *changes* to the hash,
      // so a direct navigation to #/product/<custom-id> on first page load
      // would miss custom products that hadn't loaded from Supabase yet.
      if (window.location.hash.startsWith('#/product/')) {
        const pid = window.location.hash.replace('#/product/', '');
        const allProds = [...REWIND_PRODUCTS, ...prods];
        const p = allProds.find(x => (x.id || x.product_id) === pid);
        if (p) setSelectedProduct(p);
      }
    });
  }, []);

  // Load wishlist from Supabase on mount / email change
  useEffect(() => {
    if (userEmail) {
      getWishlist(userEmail).then((ids) => {
        // Merge loaded IDs with any items already in state (e.g. a pending
        // wishlist item added by handleSignup during the signup flow, before
        // getWishlist resolves). Without merging, the async Supabase response
        // overwrites locally-added items and they silently disappear.
        setWishlist((prev) => {
          if (!ids.length) return prev;
          const merged = [...ids];
          prev.forEach((id) => {
            if (!merged.includes(id)) merged.push(id);
          });
          return merged;
        });
        setWishlistReady(true);
      });
    } else {
      // Load from localStorage cache immediately
      try {
        const cached = JSON.parse(localStorage.getItem('rw_wishlist') || '[]');
        if (cached.length) setWishlist(cached);
      } catch {}
      setWishlistReady(true);
    }
  }, [userEmail]);

  // Persist wishlist to Supabase — only after initial load
  useEffect(() => {
    if (!wishlistReady) return;
    if (userEmail) {
      saveWishlist(userEmail, wishlist);
    }
    localStorage.setItem('rw_wishlist', JSON.stringify(wishlist));
  }, [wishlist, userEmail, wishlistReady]);

  // Persist email
  useEffect(() => { if (userEmail) localStorage.setItem('rw_email', userEmail); }, [userEmail]);

  // Persist sort preference to localStorage
  useEffect(() => {
    if (sortBy) localStorage.setItem('rw_sort', sortBy);
    else localStorage.removeItem('rw_sort');
  }, [sortBy]);

  // Persist recently viewed to localStorage
  useEffect(() => {
    localStorage.setItem('rw_recent', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  // Reset brand when category changes
  useEffect(() => { setBrand(null); }, [cat]);

  // Apply style tweaks to :root
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--font-head', `"${t.headingFont}", sans-serif`);
  }, [t.accent, t.headingFont]);

  // Lock body scroll when any modal/drawer is open
  // showSurvey is deliberately excluded from this effect.
  // The survey overlay uses pointer-events: none (clicks pass through).
  useEffect(() => {
    const anyOpen = quick !== null || drawer || checkout || signupOpen || showSizes || infoPage !== null || promoOpen || wishlistOpen;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [quick, drawer, checkout, signupOpen, showSizes, infoPage, promoOpen, wishlistOpen]);

  // Mouse-following glow
  useEffect(() => {
    const glow = document.createElement('div');
    glow.style.cssText = `position:fixed;top:0;left:0;width:600px;height:600px;border-radius:50%;pointer-events:none;z-index:9999;background:radial-gradient(circle,color-mix(in oklab, var(--accent) 6%, transparent) 0%,transparent 70%);transform:translate(-50%,-50%);transition:opacity .3s`;
    document.body.appendChild(glow);
    const onMove = (e) => { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; glow.style.opacity = '1'; };
    const onLeave = () => { glow.style.opacity = '0'; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseleave', onLeave); glow.remove(); };
  }, []);

  // Close modals/drawers on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (promoOpen && !promoClosing) {
        setPromoClosing(true);
        promoCloseTimerRef.current = setTimeout(() => { setPromoOpen(false); setPromoClosing(false); promoCloseTimerRef.current = null; }, 300);
      }
      if (quick !== null)    setQuick(null);
      if (drawer)           setDrawer(false);
      if (checkout)         setCheckout(false);
      if (signupOpen)       setSignupOpen(false);
      if (showSizes)        setShowSizes(false);
      if (infoPage !== null) setInfoPage(null);
      if (wishlistOpen)     setWishlistOpen(false);
      // Dismiss survey on Escape only when it's actually visible — prevents
      // permanently hiding the first-visit survey for new users who press
      // Escape to close a modal/popup/drawer before the survey was dismissed.
      // NOTE: showSurvey deliberately omitted from deps to prevent the minifier
      // from hoisting this effect before showSurvey's state variable is initialized (TDZ bug).
      // showSurveyRef is used instead since refs are stable across hoisting.
      if (showSurveyRef.current) {
        localStorage.setItem('rw_survey_done', '1');
        setShowSurvey(false);
      }
      if (selectedProduct)  { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (promoCloseTimerRef.current) { clearTimeout(promoCloseTimerRef.current); promoCloseTimerRef.current = null; }
    };
  }, [promoOpen, quick, drawer, checkout, signupOpen, showSizes, infoPage, wishlistOpen, selectedProduct]);

  const products = useMemo(() => {
    const allProducts = [...REWIND_PRODUCTS, ...customProducts];
    return allProducts.filter((p) =>
      (cat === 'All' || p.cat === cat) &&
      (!brand || p.brand === brand) &&
      (query.trim() === '' || (p.name + ' ' + p.cat + ' ' + (p.brand || '') + ' ' + (p.note || '') + ' ' + (p.material || '')).toLowerCase().includes(query.toLowerCase()))
    );
  }, [cat, brand, query, customProducts]);

  // Compute categories that actually have products (including custom products)
  // Also appends any categories created via the admin panel's custom-category
  // input that aren't already in REWIND_CATS.
  const availableCats = useMemo(() => {
    const allProds = [...REWIND_PRODUCTS, ...customProducts];
    const available = new Set(allProds.map(p => p.cat).filter(Boolean));
    const base = REWIND_CATS.filter(c => c === 'All' || available.has(c));
    const extras = [...available].filter(c => !REWIND_CATS.includes(c));
    return [...base, ...extras];
  }, [customProducts]);

  const cartCount = cart.reduce((s, it) => s + it.qty, 0);

  // ── ALL new state vars for modals/panels MUST go above this line ──
  // succession so the final toast Undo restores ALL of them, not just the last.
  const pendingRestoreRef = useRef([]);
  const restoreTimerRef = useRef(null);
  // Buffered undo for wishlist removals — same pattern as cart undo above.
  const pendingWishlistRestoreRef = useRef([]);
  const wishlistRestoreTimerRef = useRef(null);
  // Buffered undo for recently-viewed "Clear" button — saves the full list so
  const recentlyViewedBufferRef = useRef([]);
  const recentlyViewedTimerRef = useRef(null);
  // Scroll position memory — saves the Y offset before opening a product
  // detail page so that clicking "Back" restores the user exactly where they
  // were in the grid, rather than snapping them to the top of the page.
  const scrollPosRef = useRef(0);
  // ── ALREADY DECLARED at top of TDZ guard — do not re-declare ──
  // Extract RecentlyViewed handlers to eliminate duplication between product-page and shop views
  const handleRecentlyViewedSelect = useCallback((p) => {
    const pid = p?.id || p?.product_id;
    if (p && pid) {
      setSelectedProduct(p);
    } else if (pid) {
      setRecentlyViewed(prev => prev.filter(x => (x.id || x.product_id) !== pid));
      showToast('This product is no longer available');
    }
  }, [showToast]);

  const handleRecentlyViewedClear = useCallback(() => {
    setRecentlyViewed((prev) => {
      // Buffer the ENTIRE list from state (not the child's filtered `items` arg)
      // so Undo can restore every item including the current product when the
      // user clicks "Clear" from the product detail page.
      recentlyViewedBufferRef.current = [...prev];
      return [];
    });
    if (recentlyViewedTimerRef.current) clearTimeout(recentlyViewedTimerRef.current);
    recentlyViewedTimerRef.current = setTimeout(() => { recentlyViewedBufferRef.current = []; }, 2800);
    showToast('Recently viewed cleared', {
      label: 'Undo',
      onClick: () => {
        setRecentlyViewed((prev) => {
          // Only restore items not already present (e.g. if user
          // navigated to a new product during the window)
          const saved = recentlyViewedBufferRef.current || [];
          const merged = [...prev];
          saved.forEach((item) => {
            const pid = item.id || item.product_id;
            if (pid && !merged.find(x => (x.id || x.product_id) === pid)) {
              merged.push(item);
            }
          });
          recentlyViewedBufferRef.current = [];
          if (recentlyViewedTimerRef.current) clearTimeout(recentlyViewedTimerRef.current);
          return merged;
        });
      },
    });
  }, [showToast]);

  const handleRecentlyViewedRemove = useCallback((pid, name) => {
    // Use ref instead of raw recentlyViewed to prevent stale closure;
    // follows the same ref pattern as showSurveyRef, customProductsRef, wishlistRef.
    const removedItem = recentlyViewedRef.current.find(p => (p.id || p.product_id) === pid);
    if (!removedItem) return;
    setRecentlyViewed((prev) => prev.filter(p => (p.id || p.product_id) !== pid));
    showToast((name || 'Item') + ' removed', {
      label: 'Undo',
      onClick: () => {
        setRecentlyViewed((prev) => {
          // Only restore if not already present
          if (prev.find(p => (p.id || p.product_id) === pid)) return prev;
          return [removedItem, ...prev];
        });
      },
    });
  }, [showToast]);

  const addToCart = useCallback((p, size, qty = 1) => {
    // Guard: don't allow adding out-of-stock items
    if (p.stock === 0) {
      showToast(p.name + ' is sold out');
      return;
    }
    const sz = size || p.sizes?.[0] || 'One size';
    const pid = p.id || p.product_id;
    const key = pid + '-' + sz;
    setCart((c) => {
      const found = c.find((it) => it.key === key);
      if (found) return c.map((it) => it.key === key ? { ...it, qty: it.qty + qty } : it);
      return [...c, { key, id: pid, name: p.name, price: p.price, was: p.was, hue: p.hue, size: sz, qty: qty }];
    });
    showToast((qty > 1 ? qty + '× ' : '') + p.name + ' added to bag');
  }, [showToast]);

  const quickAdd = useCallback((p) => { addToCart(p); setDrawer(true); }, [addToCart]);
  const addFromQuick = useCallback((p, size) => { addToCart(p, size); setQuick(null); setDrawer(true); }, [addToCart]);
  const changeQty = useCallback((key, d) => { setCart((c) => c.map((it) => it.key === key ? { ...it, qty: Math.max(1, it.qty + d) } : it)); }, []);
  const removeItem = useCallback((key, name) => { 
    // Capture the removed item so Undo always restores the right data,
    // regardless of subsequent cart changes before the user clicks Undo.
    const removedItem = cart.find(it => it.key === key);
    setCart((c) => c.filter((it) => it.key !== key));
    // Accumulate into the pending-restore buffer so rapid removals don't
    // silently drop earlier undo actions (showToast replaces the current toast).
    if (removedItem) {
      pendingRestoreRef.current = [...pendingRestoreRef.current, removedItem];
    }
    // Clear the buffer when the toast auto-dismisses (slightly after the toast
    // duration so there's no race with a user clicking Undo in the final ms).
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = setTimeout(() => { pendingRestoreRef.current = []; }, 2600);
    const count = pendingRestoreRef.current.length;
    const msg = count > 1
      ? `${count} items removed`
      : (name || 'Item') + ' removed';
    showToast(msg, {
      label: 'Undo',
      onClick: () => {
        setCart((c) => {
          let next = [...c];
          pendingRestoreRef.current.forEach(item => {
            if (item && !next.find(i => i.key === item.key)) {
              next.push(item);
            }
          });
          pendingRestoreRef.current = [];
          if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
          return next;
        });
      },
    });
  }, [cart, showToast]);
  const goCheckout = useCallback(() => { setDrawer(false); setCheckout(true); setCheckoutCount(c => c + 1); setPromoOpen(false); setPromoClosing(false); setOrderNumber(''); }, []);
  const orderPlaced = useCallback(() => { setCart([]); setCheckout(false); setOrderNumber(''); }, []);

  const handleWishlist = useCallback((p) => {
    const pid = p.id || p.product_id;
    if (!pid) return;
    if (!userEmail) {
      setPendingWishlistId(pid);
      setSignupOpen(true);
      return;
    }
    // Read current state directly — using wishlistRef (one render behind)
    // would show the wrong toast when the user clicks rapidly
    // (e.g. double-clicking the heart before the previous state commit).
    const alreadyHeld = wishlist.includes(pid);
    setWishlist((prev) => {
      const exists = prev.includes(pid);
      return exists ? prev.filter((id) => id !== pid) : [...prev, pid];
    });
    // Show toast outside the updater — React StrictMode invokes updaters twice in dev
    if (!alreadyHeld) {
      showToast(p.name + ' saved', {
        label: 'Show',
        onClick: () => setWishlistOpen(true),
      });
    } else {
      showToast(p.name + ' removed', {
        label: 'Undo',
        onClick: () => setWishlist((inner) => inner.includes(pid) ? inner : [...inner, pid]),
      });
    }
  }, [userEmail, showToast, wishlist]);

  const handleSignup = useCallback(({ email, acceptMarketing }) => {
    setUserEmail(email);
    setSignupOpen(false);
    signupUser(email, acceptMarketing);
    if (pendingWishlistId) {
      setWishlist((prev) => prev.includes(pendingWishlistId) ? prev : [...prev, pendingWishlistId]);
      // Look up product name for a personalised toast
      const allProds = [...REWIND_PRODUCTS, ...customProducts];
      const pendingProduct = allProds.find(p => (p.id || p.product_id) === pendingWishlistId);
      setPendingWishlistId(null);
      showToast((pendingProduct?.name || 'Item') + ' saved', {
        label: 'Show',
        onClick: () => setWishlistOpen(true),
      });
    }
  }, [pendingWishlistId, showToast, customProducts]);

  const applyPromo = useCallback(async () => {
    if (!promoCode || promoLoading) return;
    setPromoLoading(true);
    setPromoMsg('');
    try {
      const r = await fetch('/api/validate-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode }) });
      const d = await r.json();
      if (d.admin) { window.location.hash = 'admin'; }
      else { setPromoMsg('✅ Promo applied!'); }
    } catch {
      setPromoMsg('❌ Network error — try again');
    }
    setPromoLoading(false);
  }, [promoCode, promoLoading]);

  const headingId = 'the-drop';
  const scrollToGrid = useCallback(() => {
    const el = document.getElementById(headingId);
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
  }, []);

  // Wrap setQuery so that the first keystroke scrolled to the product grid,
  // consistent with every other filter method (sidebar, header nav, hero, footer).
  const handleQueryChange = useCallback((value) => {
    if (value && !query) scrollToGrid();
    setQuery(value);
  }, [query, scrollToGrid]);

  // Count products per category and brand for sidebar badges
  const allProducts = useMemo(() => [...REWIND_PRODUCTS, ...customProducts], [customProducts]);
  const catCounts = useMemo(() => {
    const counts = {};
    allProducts.forEach(p => {
      if (p.cat) counts[p.cat] = (counts[p.cat] || 0) + 1;
    });
    counts['All'] = allProducts.length;
    return counts;
  }, [allProducts]);
  const brandCounts = useMemo(() => {
    if (cat === 'All') return {};
    const counts = {};
    allProducts.filter(p => p.cat === cat).forEach(p => {
      if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
    });
    return counts;
  }, [allProducts, cat]);

  const currentBrands = useMemo(() => {
    if (cat === 'All') return [];
    const hardcoded = BRANDS[cat] || [];
    const actualBrands = Object.keys(brandCounts);
    const extras = actualBrands.filter(b => !hardcoded.includes(b));
    return [...hardcoded, ...extras];
  }, [cat, brandCounts]);

  // Reconcile recently viewed with fresh product data when custom products load/update.
  // Prevents stale names/prices in the recently viewed mini-cards after editing a
  // custom product in the admin panel. The click handler already resolves fresh data,
  // but the mini-card display now updates automatically.
  useEffect(() => {
    if (!allProducts.length || !recentlyViewed.length) return;
    setRecentlyViewed((prev) => {
      let changed = false;
      const updated = prev.map((p) => {
        const pid = p.id || p.product_id;
        if (!pid) return p;
        const fresh = allProducts.find(x => (x.id || x.product_id) === pid);
        if (fresh && fresh !== p) { changed = true; return fresh; }
        return p;
      });
      return changed ? updated : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts]);

  // ── Admin mode ──
  // Only activate admin mode if the user has a verified admin email saved,
  // NOT just because #admin is in the URL (security: prevents full admin
  // panel access by anyone who navigates to /#admin).
  const [adminMode, setAdminMode] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Handle Stripe success redirect — show confirmation view instead of just a toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('order') === 'success') {
      const orderNum = params.get('orderNum');
      const msg = orderNum ? `✅ ${orderNum} confirmed!` : '✅ Order confirmed!';
      showToast(msg);
      setCart([]);
      // Keep checkout open and pass the order number so the confirmation view
      // (with confetti, copy button, and Continue shopping CTA) is shown.
      setOrderNumber(orderNum || '');
      setCheckout(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);
  
  // First-visit questionnaire — moved closer to the other state vars above
  
  useEffect(() => {
    if (!localStorage.getItem('rw_survey_done')) {
      setShowSurvey(true);
    }
    // Check if this user's email is blocked (API path — e.g. blocked_emails table)
    const stored = localStorage.getItem('rw_email');
    if (stored) {
      fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: stored }) })
        .then(r => r.json())
        .then(d => { if (d.blocked) setBlocked(true); })
        .catch(() => {});
    }
    // Listen for logo click to reset store
    const handler = () => { setCat('All'); setBrand(null); setQuery(''); };
    window.addEventListener('reset-store', handler);
    return () => window.removeEventListener('reset-store', handler);
  }, []);

  // Auto-dismiss survey when any other modal/drawer or product detail page opens
  // — prevents the survey overlay from remaining visible on top of product content.
  useEffect(() => {
    // Use ref instead of raw showSurvey to prevent minifier TDZ
    if (showSurveyRef.current && (signupOpen || quick !== null || drawer || checkout || showSizes || infoPage !== null || promoOpen || wishlistOpen || selectedProduct !== null)) {
      localStorage.setItem('rw_survey_done', '1');
      setShowSurvey(false);
    }
  }, [showSurvey, signupOpen, quick, drawer, checkout, showSizes, infoPage, promoOpen, wishlistOpen, selectedProduct]);

  // Auto-close promo popup with animation when any drawer/checkout opens
  useEffect(() => {
    if ((drawer || wishlistOpen || checkout) && promoOpen && !promoClosing) {
      setPromoClosing(true);
      const tid = setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300);
      promoCloseTimerRef.current = tid;
      return () => { clearTimeout(tid); if (promoCloseTimerRef.current === tid) promoCloseTimerRef.current = null; };
    }
  }, [drawer, wishlistOpen, checkout, promoOpen, promoClosing]);

  // Auto-dismiss survey when user scrolls down past the hero — prevents
  // the survey card from covering the product grid area.
  useEffect(() => {
    // Use ref instead of raw showSurvey to prevent minifier TDZ
    if (!showSurveyRef.current) return;
    const onScroll = () => {
      if (window.scrollY > 200) {
        localStorage.setItem('rw_survey_done', '1');
        setShowSurvey(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showSurvey]);

  useEffect(() => {
    const onPop = () => {
      if (!window.location.hash.startsWith('#/product/')) {
        setSelectedProduct(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // When selectedProduct changes, update the URL hash and scroll to top.
  // Saves the grid scroll position before opening a product and restores it
  // on return so the user lands exactly where they left off browsing.
  useEffect(() => {
    if (selectedProduct) {
      const id = selectedProduct.id || selectedProduct.product_id;
      window.history.pushState({ product: id }, '', '#/product/' + id);
      scrollPosRef.current = window.scrollY;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (scrollPosRef.current > 0) {
      window.scrollTo({ top: scrollPosRef.current, behavior: 'smooth' });
    }
  }, [selectedProduct]);

  // Set document title to product name when viewing a product detail page,
  // and restore the default title when returning to the shop.
  useEffect(() => {
    const DEFAULT_TITLE = 'REWIND — Curated Vintage & Retro Sportswear';
    if (selectedProduct) {
      document.title = selectedProduct.name + ' — REWIND';
    } else {
      document.title = DEFAULT_TITLE;
    }
    return () => { document.title = DEFAULT_TITLE; };
  }, [selectedProduct]);

  // Track recently viewed products (only full-page views, not quickview)
  useEffect(() => {
    if (!selectedProduct) return;
    const pid = selectedProduct.id || selectedProduct.product_id;
    if (!pid) return;
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((p) => (p.id || p.product_id) !== pid);
      return [selectedProduct, ...filtered].slice(0, 5);
    });
  }, [selectedProduct]);
  useEffect(() => {
    const onHash = () => {
      const isAdminHash = window.location.hash === '#admin';
      if (isAdminHash) {
        // Show the AdminPanel component — it handles its own auth internally
        // via server-verified email check + admin API token.
        // The AdminPanel will show a login form until the user authenticates.
        setAdminMode(true);
      } else if (window.location.hash === '') {
        setAdminMode(false);
      }
      if (window.location.hash.startsWith('#/product/')) {
        const pid = window.location.hash.replace('#/product/', '');
        const allProds = [...REWIND_PRODUCTS, ...customProductsRef.current];
        const p = allProds.find(x => (x.id || x.product_id) === pid);
        if (p) setSelectedProduct(p);
      }
    };
    // Handle initial URL hash immediately (direct navigation to #/product/xxx)
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Check if current user is blocked via server endpoint
  useEffect(() => {
    const email = localStorage.getItem('rw_email');
    if (!email || adminMode) return;
    fetch('/api/check-blocked-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).then(r => r.json()).then(d => {
      if (d.blocked) setBlocked(true);
    }).catch(() => {});
  }, [adminMode]);

  if (adminMode) return <AdminPanel onExit={() => { window.location.hash = ''; }} onSelect={setSelectedProduct} customProducts={customProducts} setCustomProducts={setCustomProducts} />;

  // Blocked screen
  if (blocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</h1>
        <h2 style={{ fontSize: '24px', color: 'var(--ink)', marginBottom: '8px' }}>Access restricted</h2>
        <p style={{ fontSize: '16px', color: 'var(--muted)', maxWidth: '400px' }}>This account has been blocked from accessing REWIND. If you think this is a mistake, please contact us.</p>
      </div>
    );
  }

  const curPid = selectedProduct?.id || selectedProduct?.product_id;

  // Show product detail page instead of shop
  const viewContent = selectedProduct ? (
    <div className="rw-app" key="product-page">
      <Header cat={cat} setCat={(c) => { setCat(c); setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); scrollPosRef.current = 0; scrollToGrid(); }} cartCount={cartCount}
        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
        onWishlistOpen={() => setWishlistOpen(true)}
        query={query} setQuery={handleQueryChange} cats={availableCats} version={VERSION}
        onVersionClick={() => setShowTweaks(v => !v)} />
      <main className="rw-shop">
      <ProductPage key={curPid} p={selectedProduct}
        onBack={() => { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }}
        onAdd={(p, size, qty) => { addToCart(p, size, qty); setDrawer(true); }}
        onWishlist={handleWishlist}
        wishlisted={wishlist.includes(curPid)}
        showCompare={t.showCompare}
        showStock={t.showStock}
        onSizeGuide={() => setShowSizes(true)} />

      {/* ── Recently viewed (on product page, excluding current product) ── */}
      <RecentlyViewed
        items={recentlyViewed.filter(p => (p.id || p.product_id) !== curPid)}
        allProducts={allProducts}
        onSelect={handleRecentlyViewedSelect}
        onClear={handleRecentlyViewedClear}
        onRemoveItem={handleRecentlyViewedRemove}
        showToast={showToast}
      />
      </main>
      <Footer onSizes={() => setShowSizes(true)} onInfo={(p) => setInfoPage(p)} onSetCat={(c) => { setCat(c); scrollToGrid(); }} />
    </div>
  ) : (
    <div className="rw-app" key="shop">
      {t.showBanner && <Banner showCountdown={t.showCountdown} />}
      <Header cat={cat} setCat={(c) => { setCat(c); scrollToGrid(); }} cartCount={cartCount}
        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
        onWishlistOpen={() => setWishlistOpen(true)}
        query={query} setQuery={handleQueryChange} cats={availableCats} version={VERSION}
        onVersionClick={() => setShowTweaks(v => !v)} />
      <Hero onShop={(filterCat) => { setCat(filterCat || 'All'); scrollToGrid(); }} />
      <Marquee />

      <main className="rw-shop">
        <div className="rw-shop-head" id={headingId}>
          <div className="rw-shop-headl">
            <h2 className="rw-shop-title">{cat === 'All' ? 'The drop' : cat}</h2>
            <p className="rw-shop-sub">{products.length} piece{products.length !== 1 ? 's' : ''} · one of each</p>
          </div>
        </div>

        <div className="rw-shop-layout">
          <aside id="rw-sidebar" style={{
            width: '200px',
            flexShrink: 0,
            background: 'var(--bg)',
            borderRadius: '12px',
            padding: '20px 16px',
            position: 'sticky',
            top: '20px',
            alignSelf: 'flex-start',
          }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Categories</h3>
            {availableCats.map((c) => (
              <SidebarBtn key={c} label={c === 'All' ? 'All' : c} count={catCounts[c] || 0} isOn={cat === c} onClick={() => { setCat(c); scrollToGrid(); }} />
            ))}

            {cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand) && (
              <>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Brands</h3>
                <SidebarBtn label="All" isOn={!brand} count={catCounts[cat] || 0} onClick={() => { setBrand(null); scrollToGrid(); }} />
                {currentBrands.map((b) => (
                  <SidebarBtn key={b} label={b} isOn={brand === b} count={brandCounts[b] || 0} onClick={() => { setBrand(b); scrollToGrid(); }} />
                ))}
              </>
            )}
          </aside>
          <div className="rw-shop-content">
            {products.length > 0 && (
            <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand)) ? '8px' : '16px', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1 1 auto' }}>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                aria-label="Sort products"
                className="rw-sort">
                <option value="">Featured</option>
                <option value="name-asc">Name: A → Z</option>
                <option value="name-desc">Name: Z → A</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
              </select>
              <select id="rw-mobile-cat" value={cat} onChange={e => { setCat(e.target.value); scrollToGrid(); }}
                aria-label="Select category"
                className="rw-sort">
                {availableCats.map((c) => (
                  <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>
                ))}
              </select>
              </div>
              {(cat !== 'All' || brand !== null || query !== '' || sortBy !== '') && (
                <button onClick={() => { setQuery(''); setCat('All'); setBrand(null); setSortBy(''); scrollToGrid(); }}
                  aria-label="Clear all filters"
                  className="rw-txt-btn"
                  style={{ fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ✕ Clear all
                </button>
              )}
            </div>
            {cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand) && (
              <select className="rw-sort rw-mobile-brand" value={brand || ''} onChange={e => { setBrand(e.target.value || null); scrollToGrid(); }}
                aria-label="Filter by brand"
                style={{ width: '100%', marginBottom: '16px' }}>
                <option value="">All brands</option>
                {currentBrands.map(b => (
                  <option key={b} value={b}>{b} ({brandCounts[b] || 0})</option>
                ))}
              </select>
            )}
            </>
            )}
            <ProductGrid products={products} sort={sortBy} query={query} showCompare={t.showCompare} showStock={t.showStock}
              onQuick={setQuick} onAdd={quickAdd}
              wishlist={wishlist} onWishlist={handleWishlist} onSelect={setSelectedProduct}
              activeCat={cat} activeBrand={brand}
              onCart={() => setDrawer(true)}
              onClearSearch={() => { setQuery(''); setCat('All'); setBrand(null); setSortBy(''); scrollToGrid(); }} />
          </div>
        </div>

        {/* ── Recently viewed ── */}
        <RecentlyViewed
          items={recentlyViewed}
          allProducts={allProducts}
          onSelect={handleRecentlyViewedSelect}
          onClear={handleRecentlyViewedClear}
          onRemoveItem={handleRecentlyViewedRemove}
          showToast={showToast}
        />
      </main>

      <Footer onSizes={() => setShowSizes(true)} onInfo={(p) => setInfoPage(p)} onSetCat={(c) => { setCat(c); scrollToGrid(); }} />
    </div>
  );

  return (
    <ClickSpark sparkColor="#FF4D14" sparkSize={8} sparkRadius={16} sparkCount={10}>
      {viewContent}

      {/* ── Shared overlays (rendered in BOTH product page view AND shop view) ── */}
      {/* These must stay here so header cart/wishlist icons work on the product detail page. */}
      {showSizes && <SizeGuide onClose={() => setShowSizes(false)} />}
      {infoPage && <InfoModal page={infoPage} onClose={() => setInfoPage(null)} />}

      <QuickView p={quick} showCompare={t.showCompare} showStock={t.showStock}
        onClose={() => setQuick(null)} onAdd={addFromQuick} />
      <CartDrawer open={drawer} items={cart} onClose={() => setDrawer(false)}
        onQty={changeQty} onRemove={removeItem} onCheckout={goCheckout} />
      <Checkout key={checkoutCount} open={checkout} items={cart} onClose={() => setCheckout(false)} onPlaced={orderPlaced} userEmail={userEmail} showToast={showToast} orderNumber={orderNumber} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <SignupModal open={signupOpen} onClose={() => { setSignupOpen(false); setPendingWishlistId(null); }} onSignup={handleSignup} />
      <WishlistDrawer open={wishlistOpen} items={wishlist} customProducts={customProducts}
        onClose={() => setWishlistOpen(false)}
        onRemove={(ids) => {
          const removeIds = Array.isArray(ids) ? ids : [ids];
          pendingWishlistRestoreRef.current = [...pendingWishlistRestoreRef.current, ...removeIds];
          setWishlist((prev) => prev.filter((i) => !removeIds.includes(i)));
          if (wishlistRestoreTimerRef.current) clearTimeout(wishlistRestoreTimerRef.current);
          wishlistRestoreTimerRef.current = setTimeout(() => { pendingWishlistRestoreRef.current = []; }, 2600);
          const count = pendingWishlistRestoreRef.current.length;
          showToast(count > 1 ? `${count} items removed` : 'Item removed', {
            label: 'Undo',
            onClick: () => {
              setWishlist((prev) => {
                const toRestore = pendingWishlistRestoreRef.current.filter(id => !prev.includes(id));
                pendingWishlistRestoreRef.current = [];
                if (wishlistRestoreTimerRef.current) clearTimeout(wishlistRestoreTimerRef.current);
                return [...prev, ...toRestore];
              });
            },
          });
        }}
        onAddToCart={(p, size) => { addToCart(p, size); }}
        onSelect={(p) => { setSelectedProduct(p); setWishlistOpen(false); }}
        onCartOpen={() => { setWishlistOpen(false); setDrawer(true); }}
        showToast={showToast} />

      {showSurvey && selectedProduct === null && !signupOpen && quick === null && !drawer && !checkout && !showSizes && infoPage === null && !promoOpen && !wishlistOpen && (
        <div className="rw-survey-overlay" onClick={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }}>
          <div className="rw-survey-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', padding: '32px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--r)', position: 'relative', boxShadow: '0 30px 80px -20px rgba(22,19,15,.5)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Welcome to REWIND 👋</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Where did you hear about us?</p>
            <Survey onDone={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} onSkip={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} />
          </div>
        </div>
      )}

      {/* ── Promo code button ── */}
      {!drawer && !wishlistOpen && !checkout && (
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
        <button onClick={() => { if (promoOpen) { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); } else { setPromoOpen(true); setPromoCode(''); setPromoMsg(''); } }}
          aria-label="Promo code"
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'var(--ink)', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: '18px', fontWeight: 700,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            transition: 'transform 0.15s',
          }}
          onMouseOver={e => e.target.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.target.style.transform = ''}>
          💬
        </button>
      </div>
      )}

      {(promoOpen || promoClosing) && (
        <div onClick={() => { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            animation: promoClosing ? 'fadeOut 0.25s ease forwards' : 'fadeIn 0.15s ease',
          }}>
          <div onClick={e => { e.stopPropagation(); }}
            style={{
              pointerEvents: 'auto',
              position: 'fixed', bottom: '80px', right: '24px',
              background: 'var(--surface)', borderRadius: '14px', padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              width: '280px', zIndex: 1001,
              animation: promoClosing ? 'genieDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'genieUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transformOrigin: 'bottom right',
            }}>
            <button onClick={() => { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); }}
              className="rw-modal-x"
              style={{
                position: 'absolute', top: '10px', right: '10px',
                width: '28px', height: '28px',
                background: 'color-mix(in oklab, var(--surface) 85%, transparent)', backdropFilter: 'blur(6px)',
              }}
              aria-label="Close">
              <Icon name="close" size={16} />
            </button>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Got a code?</div>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--muted)' }}>Enter it below and get a discount.</p>
            <input className="rw-input" placeholder="Enter code" value={promoCode}
              onChange={e => { setPromoCode(e.target.value); setPromoMsg(''); }}
              onKeyDown={e => { if (e.key === 'Enter') applyPromo(); }}
              disabled={promoLoading}
              style={{ marginBottom: '8px' }} />
            <button onClick={applyPromo} disabled={promoLoading}
              style={{
                padding: '8px 20px', borderRadius: '999px',
                background: promoLoading ? 'var(--line-2)' : 'var(--ink)',
                color: '#fff', border: 'none', cursor: promoLoading ? 'default' : 'pointer',
                fontSize: '13px', fontWeight: 600, transition: 'background 0.15s, transform 0.15s, opacity 0.15s',
              }}
              onMouseOver={e => { if (!promoLoading) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
              onMouseOut={e => { if (!promoLoading) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
              {promoLoading ? '⏳ Applying…' : 'Apply'}
            </button>
            {promoMsg && <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--accent)' }}>{promoMsg}</p>}
          </div>
        </div>
      )}

      {(showTweaks || window.location.search.includes('tweaks')) && <TweaksPanel>
        <TweakSection label="Urgency & social proof" />
        <TweakToggle label="Announcement bar" value={t.showBanner} onChange={(v) => setTweak('showBanner', v)} />
        <TweakToggle label="Live sale countdown" value={t.showCountdown} onChange={(v) => setTweak('showCountdown', v)} />
        <TweakToggle label='"Was" pricing & % off' value={t.showCompare} onChange={(v) => setTweak('showCompare', v)} />
        <TweakToggle label="Low-stock badges" value={t.showStock} onChange={(v) => setTweak('showStock', v)} />
        <TweakSection label="Look" />
        <TweakColor label="Accent" value={t.accent}
          options={['#FF4D14', '#2E5BFF', '#E11D74', '#0E9F6E']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakRadio label="Headline font" value={t.headingFont}
          options={['Bricolage Grotesque', 'Space Grotesk']}
          onChange={(v) => setTweak('headingFont', v)} />
      </TweaksPanel>}
    </ClickSpark>
  );
}

/* ══════════════════════════════════════════════
   ADMIN PANEL — accessible at /#admin
   ══════════════════════════════════════════════ */
function AdminPanel({ onExit, onSelect, customProducts, setCustomProducts }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [emailText, setEmailText] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [adminTab, setAdminTab] = useState('users');
  const [editProduct, setEditProduct] = useState(null); // direct product for editing
  const [adminEmail, setAdminEmail] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [orders, setOrders] = useState([]);
  const [adminMsg, setAdminMsg] = useState('');
  const [savedVersion, setSavedVersion] = useState(0);

  // Separated admin auth check from data loading so that expensive Supabase
  // queries (users, custom products, orders) only fire after authentication
  // is confirmed — prevents unnecessary API calls and potential data exposure
  // when non-admin visitors land on #admin.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setAdminChecking(false);
      return;
    }
    const saved = localStorage.getItem('rw_admin_email');
    if (saved) {
      setAdminEmail(saved);
      // Verify via server endpoint — NOT direct Supabase query with anon key
      fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: saved, token: localStorage.getItem('rw_admin_token') })
      }).then(r => r.json()).then(d => {
        if (d.verified) setAdminAuthed(true);
        setAdminChecking(false);
      }).catch(() => setAdminChecking(false));
    } else {
      setAdminChecking(false);
    }
  }, []);

  // Only load users, orders, and custom products after admin auth is confirmed
  useEffect(() => {
    if (!adminAuthed) return;
    // Fetch users, products, and orders through server API (not direct Supabase)
    fetch('/api/admin/users', {
      headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') }
    }).then(r => r.json()).then(d => {
      if (d.users) setUsers(d.users);
      setLoading(false);
    }).catch(() => setLoading(false));
    getCustomProducts().then(setCustomProducts).catch(() => {});
    getOrders().then(setOrders).catch(() => {});
  }, [adminAuthed]);

  // Check if we were directed here to edit a specific product (from QuickView or ProductPage "Edit" button)
  useEffect(() => {
    const editId = localStorage.getItem('rw_edit_product');
    if (editId) {
      localStorage.removeItem('rw_edit_product');
      const allProds = [...REWIND_PRODUCTS, ...customProducts];
      const found = allProds.find(p => (p.id || p.product_id) === editId);
      if (found) {
        setEditProduct(found);
        setAdminTab('edit');
      }
    }
  }, [customProducts]);

  async function toggleBlockUser(email, blocked) {
    const msg = blocked ? 'Block this user from the store?' : 'Unblock this user?';
    if (!window.confirm(msg)) return;
    try {
      if (blocked) {
        await fetch('/api/admin/block-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
          body: JSON.stringify({ email })
        });
      } else {
        await fetch('/api/admin/unblock-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
          body: JSON.stringify({ email })
        });
      }
    } catch {}
    // Optimistic UI update — reload data from server
    setUsers(prev => prev.map(u => u.email === email ? { ...u, blocked } : u));
  }

  // Stats
  const totalFavs = users.reduce((s, u) => s + (u.product_ids?.length || 0), 0);

  const allEmails = users.map((u) => u.email).join(', ');
  const marketingEmails = users.filter((u) => u.marketing_optin).map((u) => u.email).join(', ');

  return (
    <div style={{ padding: '40px 24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>REWIND Admin</h1>
        <button onClick={onExit}
          style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: 'var(--ink)', transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; }}>
          ← Back to store
        </button>
      </div>
      <div style={{ position: 'absolute', top: '44px', right: '24px', fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>{VERSION}</div>

      {/* ── Admin login ── */}
      {adminChecking && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Checking access...</p>}

      {!adminChecking && !adminAuthed && (
        <div style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>🔐 Admin Access</h2>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Enter your admin email and secret token.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <input className="rw-input" placeholder="your@email.com" value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { document.getElementById('rw-admin-verify-btn')?.click(); } }}
            style={{ flex: 1 }} />
            {localStorage.getItem('rw_admin_email') && (
              <button onClick={() => {
                localStorage.removeItem('rw_admin_email');
                localStorage.removeItem('rw_admin_saved');
                localStorage.removeItem('rw_admin_token');
                setAdminEmail('');
                setAdminMsg('✅ Stored email cleared');
              }}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.color = 'var(--ink)'; }}
                onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.color = 'var(--muted)'; }}
                title="Clear saved email and try again">
                ✕ Clear stored
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <input className="rw-input" type={showToken ? 'text' : 'password'} placeholder="Admin secret token" value={adminToken}
              onChange={e => setAdminToken(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { document.getElementById('rw-admin-verify-btn')?.click(); } }}
              style={{ flex: 1, marginBottom: 0 }} />
            <button onClick={() => setShowToken(!showToken)}
              type="button"
              aria-label={showToken ? 'Hide token' : 'Show token'}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line-2)',
                background: 'var(--surface)', cursor: 'pointer', fontSize: '15px', lineHeight: 1,
                color: showToken ? 'var(--accent)' : 'var(--muted)',
                transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; }}
              onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; }}>
              {showToken ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <button id="rw-admin-verify-btn" onClick={async () => {
            if (!adminEmail) return;
            if (!adminToken) { setAdminMsg('❌ Please enter your admin secret token.'); return; }
            setAdminMsg('');
            try {
              const r = await fetch('/api/verify-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: adminEmail, token: adminToken })
              });
              const d = await r.json();
              if (d.verified) {
                localStorage.setItem('rw_admin_email', adminEmail);
                localStorage.setItem('rw_admin_token', adminToken);
                setAdminAuthed(true);
              } else {
                setAdminMsg('❌ Access denied. This email is not on the admin list.');
              }
            } catch {
              setAdminMsg('❌ Could not verify — try again');
            }
          }}
            style={{ padding: '10px 24px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
            Enter admin panel
          </button>
          <p style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '8px' }}>{adminMsg}</p>
        </div>
      )}

      {adminAuthed && (<>
      {/* ── Tab navigation ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: '📊 Users' },
          { id: 'email', label: '📧 Email' },
          { id: 'orders', label: '📦 Orders' },
          { id: 'saved', label: '⭐ Saved' },
          { id: 'blocked', label: '🚫 Blocked' },
          { id: 'products', label: '🛍️ Products' },
          { id: 'edit', label: editProduct ? '✏️ ' + editProduct.name : null },
        ].filter(t => t.label).map((t) => (
          <button key={t.id} onClick={() => setAdminTab(t.id)}
            style={{
              padding: '10px 20px', borderRadius: '999px', border: 'none',
              background: adminTab === t.id ? 'var(--ink)' : 'var(--line)',
              color: adminTab === t.id ? 'var(--surface)' : 'var(--ink)',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (adminTab !== t.id) { e.target.style.background = 'var(--line-2)'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (adminTab !== t.id) { e.target.style.background = 'var(--line)'; e.target.style.transform = ''; } }}>
            {t.label}
          </button>
        ))}
      </div>

      {!supabase && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', background: 'var(--line)', borderRadius: '12px' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Supabase not connected</p>
          <p style={{ fontSize: '14px' }}>Set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then redeploy.</p>
        </div>
      )}

      {supabase && loading && <p>Loading users...</p>}

      {supabase && !loading && users.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          <p>No users signed up yet. Sign up on the storefront to see data here.</p>
        </div>
      )}

      {supabase && !loading && users.length > 0 && adminTab === 'users' && (
        <>
          {/* ── User table ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Email</th>
                  <th style={{ padding: '12px 16px' }}>Wishlist</th>
                  <th style={{ padding: '12px 16px' }}>Marketing</th>
                  <th style={{ padding: '12px 16px' }}>Signed up</th>
                  <th style={{ padding: '12px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} style={{ borderTop: '1px solid var(--line)', background: u.blocked ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent' }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedUser(selectedUser?.email === u.email ? null : u);
                    }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, cursor: 'context-menu' }}>
                      {u.email} {u.blocked && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>🚫</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.product_ids?.length || 0} items
                      {u.product_ids?.length > 0 && (
                        <button onClick={() => setSelectedUser(selectedUser?.email === u.email ? null : u)}
                          style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px' }}>
                          {selectedUser?.email === u.email ? 'Hide' : 'View'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{u.marketing_optin ? '✅' : '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <a href={`mailto:${u.email}`} style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '16px' }}>✉️</a>
                      <button onClick={() => toggleBlockUser(u.email, !u.blocked)}
                        style={{
                          marginLeft: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: u.blocked ? 'color-mix(in oklab, var(--accent) 30%, transparent)' : 'var(--accent)',
                          color: 'var(--surface)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 700,
                          transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)'; }}
                        onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
                        {u.blocked ? '✅ Unblock' : '🚫 Block'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Selected user's wishlist ── */}
          {selectedUser && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                {selectedUser.email}'s wishlist
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedUser.product_ids?.map((pid) => {
                  const product = [...REWIND_PRODUCTS, ...customProducts].find((p) => p.id === pid || p.product_id === pid);
                  return (
                    <a key={pid} href="#"
                      onClick={(e) => { e.preventDefault(); window.location.hash = ''; onSelect(product); }}
                      style={{ padding: '6px 12px', background: 'var(--line)', borderRadius: '6px', fontSize: '13px', textDecoration: 'none', color: 'var(--ink)', display: 'inline-block', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseOver={e => e.target.style.background = 'var(--line-2)'}
                      onMouseOut={e => e.target.style.background = 'var(--line)'}
                      title={`${product?.name || pid} — ${product?.brand || 'no brand'} — ${product?.cat || ''}`}>
                      {product?.name || pid} {product ? `— ${product.cat}` : ''}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total users</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.filter(u => u.marketing_optin).length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Marketing opt-in</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.reduce((s, u) => s + (u.product_ids?.length || 0), 0)}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Saved items</div>
            </div>
          </div>

          {/* ── Admin manager ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🔑 Admin management</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input placeholder="Email to add as admin" id="new-admin-email"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px' }} />
              <button onClick={async () => {
                const input = document.getElementById('new-admin-email');
                const email = input.value.trim();
                if (!email) return;
                const r = await fetch('/api/manage-admins', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ action: 'add', email, adminEmail }) });
                const d = await r.json();
                alert(d.ok ? `✅ ${email} added as admin` : `❌ ${d.error}`);
                if (d.ok) input.value = '';
              }}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                Add admin
              </button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
              Enter a team member's email above to grant them admin access
            </div>
          </div>

          {/* ── Run Tests ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🧪 Automated tests</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
              Tests every button and page on the site using Playwright browser automation.
            </p>
            <button onClick={async () => {
              const btn = document.activeElement;
              btn.textContent = '🔄 Running tests...';
              btn.disabled = true;
              try {
                const r = await fetch('/api/run-tests', {
                  headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') }
                });
                const d = await r.json();
                if (d.error) throw new Error(d.error);
                btn.textContent = `✅ ${d.passed}/${d.total} passed`;
                // Show results inline
                const resultsDiv = document.getElementById('test-results');
                if (resultsDiv) {
                  resultsDiv.innerHTML = d.results.map(r =>
                    `<div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
                      <span>${r.status}</span>
                      <span style="font-weight:600;margin:0 8px">${r.name}</span>
                      <span style="color:var(--muted);font-size:12px">${r.detail}</span>
                    </div>`
                  ).join('');
                }
              } catch (e) {
                btn.textContent = '❌ Tests failed';
              }
              setTimeout(() => { btn.textContent = '🧪 Run tests'; btn.disabled = false; }, 5000);
            }}
              style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
              🧪 Run tests
            </button>
            <div id="test-results" style={{ marginTop: '16px', maxHeight: '300px', overflow: 'auto' }} />
          </div>
          </>)
}

          {/* ── Email tool ── */}
          {adminTab === 'email' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📧 Email users about discounts / sales</h3>
            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)}
              placeholder="Write your email message here... (or leave blank for default)"
              rows={5}
              style={{ width: '100%', padding: '12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', marginBottom: '8px' }} />
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
              Emails are sent via Resend. Leave message blank for a default template.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.textContent = 'Sending...';
                btn.disabled = true;
                const r = await fetch('/api/send-campaign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
                  body: JSON.stringify({ emails: users.map((u) => u.email), subject: '', message: emailText || '' }),
                });
                const d = await r.json();
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
              }}
                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                📩 Email all users ({users.length})
              </button>
              <button onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.textContent = 'Sending...';
                btn.disabled = true;
                const marketingUsers = users.filter((u) => u.marketing_optin);
                const r = await fetch('/api/send-campaign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
                  body: JSON.stringify({ emails: marketingUsers.map((u) => u.email), subject: '', message: emailText || '' }),
                });
                const d = await r.json();
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
              }}
                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                📩 Email opted-in only ({users.filter((u) => u.marketing_optin).length})
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(users.map((u) => u.email).join(', ')); }}
                style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                📋 Copy all emails
              </button>
            </div>
          </div>
          )}

          {/* ── Orders ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            {/* ── Order stats chart ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'pending').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>⏳ Pending</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'ordered').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>📦 Ordered</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--ink) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'shipped').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>🚚 Shipped</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📦 Orders to fulfill</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {orders.length > 0 && (
                  <button onClick={() => {
                    const csv = ["Order,Customer,Email,Items,Total,Status,Address"];
                    orders.forEach(o => {
                      const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size})`).join('; ');
                      csv.push(`"${o.order_num}","${o.customer_name}","${o.email}","${items}","€${o.total}","${o.status}","${o.address}"`);
                    });
                    navigator.clipboard.writeText(csv.join('\n'));
                    alert('📋 Orders CSV copied! Paste into Shopify or Excel.');
                  }}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}
                    onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                            📋 Export CSV
                  </button>
                )}
              </div>
            </div>
            {orders.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No orders yet. When a customer checks out, orders appear here.</p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                  {orders.filter(o => o.status === 'pending').length} pending · {orders.filter(o => o.status === 'ordered').length} ordered · {orders.filter(o => o.status === 'shipped').length} shipped
                </p>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Order</th>
                      <th style={{ padding: '8px 10px' }}>Customer</th>
                      <th style={{ padding: '8px 10px' }}>Items</th>
                      <th style={{ padding: '8px 10px' }}>Total</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                      <th style={{ padding: '8px 10px' }}>Supplier</th>
                    </tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} style={{ borderTop: '1px solid var(--line)', background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: '12px' }}>{o.order_num}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div>{o.customer_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.email}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.address}</div>
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '12px' }}>
                            {(Array.isArray(o.items) ? o.items : []).map((it, i) => (
                              <div key={i}>{typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`}</div>
                            ))}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{money(o.total)}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <select value={o.status} onChange={async (e) => {
                              await updateOrderStatus(o.id, e.target.value);
                              setOrders(prev => prev.map(ord => ord.id === o.id ? { ...ord, status: e.target.value } : ord));
                            }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', fontWeight: 600,
                                background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 20%, transparent)' : o.status === 'ordered' ? 'color-mix(in oklab, var(--accent) 40%, transparent)' : 'color-mix(in oklab, var(--ink) 20%, transparent)' }}>
                              <option value="pending">⏳ Pending</option>
                              <option value="ordered">📦 Ordered</option>
                              <option value="shipped">🚚 Shipped</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button onClick={() => {
                              const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`).join(', ');
                              const msg = `NEW ORDER\n━━━━━━━━━━━\nOrder: ${o.order_num}\nItem: ${items}\nCustomer: ${o.customer_name}\nAddress: ${o.address}\nEmail: ${o.email}\n━━━━━━━━━━━\nPlease ship to the address above.`;
                              navigator.clipboard.writeText(msg);
                              alert('✅ Order info copied! Paste it into your Alibaba / WhatsApp / DSers chat.');
                            }}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.transform = 'translateY(-1px)'; }}
                              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}>
                              📋 Copy for supplier
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          )}

          {/* ── Stock bar chart ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Stock levels</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const maxStock = Math.max(...allProds.map(p => p.stock || 0), 1);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {allProds.map(p => (
                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '160px', fontSize: '12px', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <div style={{ flex: 1, height: '22px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${Math.round(((p.stock || 0) / maxStock) * 100)}%`,
                          height: '100%',
                          background: (p.stock || 0) <= 5 ? 'var(--accent)' : (p.stock || 0) <= 15 ? 'color-mix(in oklab, var(--accent) 60%, var(--ink))' : 'color-mix(in oklab, var(--ink) 40%, transparent)',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ width: '30px', fontSize: '12px', fontWeight: 700, color: (p.stock || 0) <= 5 ? 'var(--accent)' : 'var(--muted)' }}>{p.stock || 0}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Stock alerts ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📉 Stock alerts</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const low = allProds.filter(p => p.stock !== undefined && p.stock <= 5);
              if (low.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>All products have sufficient stock.</p>;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {low.map(p => (
                    <span key={p.id || p.product_id} style={{ padding: '6px 12px', background: 'color-mix(in oklab, var(--accent) 15%, transparent)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                      {p.name} — only {p.stock} left
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Edit product panel ── */}
          {adminTab === 'edit' && editProduct && (
            <EditProductPanel key={editProduct.id || editProduct.product_id} product={editProduct} onDone={() => { setEditProduct(null); setAdminTab('saved'); }}
              setCustomProducts={setCustomProducts} />
          )}

          {/* ── Blocked IPs ── */}
          {adminTab === 'blocked' && <BlockedPanel />}

          {/* ── Saved products ── */}
          {adminTab === 'saved' && (
          <div key={savedVersion} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>⭐ Saved products</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
              const saved = allProds.filter(p => savedIds.includes(p.id || p.product_id));
              if (saved.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No saved products yet. Click ⋮ on any product and select Save.</p>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {saved.map(p => (
                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--line)', borderRadius: '8px' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: p.hue ? `hsl(${p.hue},60%,80%)` : 'var(--line-2)', overflow: 'hidden', flexShrink: 0 }}>
                        {p.img && <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p.brand}{p.brand && p.cat ? ' · ' : ''}{p.cat}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{money(p.price)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => { onSelect(p); }}
                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
                          👁 View
                        </button>
                        <button onClick={() => {
                          setEditProduct(p);
                          setAdminTab('edit');
                        }}
                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => {
                          const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
                          const newIds = savedIds.filter(id => id !== (p.id || p.product_id));
                          localStorage.setItem('rw_admin_saved', JSON.stringify(newIds));
                          setSavedVersion(v => v + 1);
                        }}
                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Product stats ── */}
          {adminTab === 'products' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Product stats</h3>
            <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }} />
            {(() => {
              // Count favorites per product from all users
              const favCounts = {};
              users.forEach(u => {
                (u.product_ids || []).forEach(pid => {
                  if (!favCounts[pid]) favCounts[pid] = { count: 0, users: [] };
                  favCounts[pid].count++;
                  if (!favCounts[pid].users.includes(u.email)) favCounts[pid].users.push(u.email);
                });
              });
              // Build product list from all products + custom products
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const productStats = allProds.filter(p => {
                const name = p.name?.toLowerCase() || '';
                const brand = p.brand?.toLowerCase() || '';
                const q = productSearch.toLowerCase();
                return !q || name.includes(q) || brand.includes(q);
              }).map(p => ({
                ...p,
                favs: favCounts[p.id || p.product_id]?.count || 0,
                favUsers: favCounts[p.id || p.product_id]?.users || [],
              })).sort((a, b) => b.favs - a.favs);

              if (productStats.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No products found.</p>;
              return (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Product</th>
                      <th style={{ padding: '8px 12px' }}>Brand</th>
                      <th style={{ padding: '8px 12px' }}>Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>⭐ Favs</th>
                      <th style={{ padding: '8px 12px' }}>Users</th>
                    </tr></thead>
                    <tbody>
                      {productStats.map(p => (
                        <tr key={p.id || p.product_id} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name || 'Unnamed'}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.brand || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>{p.cat}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{p.favs}</td>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.favUsers.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
          )}

          {adminTab === 'products' && (
          <ProductForm editProduct={editProduct} onClearEdit={() => setEditProduct(null)}
            customProducts={customProducts} setCustomProducts={setCustomProducts} />
          )}
        </>
      )}
    </div>
  );
}

/* ── Blocked Emails Panel ── */
function BlockedPanel() {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  const loadAll = async () => {
    try {
      const [re, ru] = await Promise.all([
        fetch('/api/admin/blocked-emails', { headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') } }).then(r => r.json()),
        fetch('/api/admin/user-emails', { headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') } }).then(r => r.json()),
      ]);
      setEmails(re.emails || []);
      setAllUsers(ru.emails || []);
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { loadAll(); }, []);

  const blockEmail = async (email) => {
    if (!email) return;
    await fetch('/api/admin/block-email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ email }) });
    setNewEmail(''); loadAll();
  };

  const unblockEmail = async (email) => {
    await fetch('/api/admin/unblock-email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ email }) });
    loadAll();
  };

  const blockedEmails = new Set(emails.map(e => e.email));
  const unblockedUsers = allUsers.filter(email => !blockedEmails.has(email));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🚫 Blocked Emails</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>Blocked users will see a permanent notice when they try to checkout: <em>"Contact orders@rewind-stores.com to appeal."</em></p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input className="rw-input" placeholder="user@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newEmail.trim()) blockEmail(newEmail.trim()); }} />
          <button onClick={() => blockEmail(newEmail.trim())} disabled={!newEmail.trim()}
            style={{ padding: '10px 20px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>Block</button>
        </div>
        {loading ? <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</p> : emails.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No blocked emails.</p>
        ) : emails.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: '13px' }}>{e.email}</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(e.created_at).toLocaleDateString()}</span>
            <button onClick={() => unblockEmail(e.email)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.borderColor = 'var(--accent)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.borderColor = 'var(--line-2)'; }}>Unblock</button>
          </div>
        ))}
      </div>
      {unblockedUsers.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>👥 All Users</h3>
          {unblockedUsers.map(email => (
            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: '13px' }}>{email}</span>
              <button onClick={() => blockEmail(email)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.borderColor = 'var(--accent)'; }}
                onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.borderColor = 'var(--line-2)'; }}>Block</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Edit Product Panel ── */
function EditProductPanel({ product, onDone, setCustomProducts }) {
  const isCustomCat = product.cat && product.cat !== 'Other' && !REWIND_CATS.includes(product.cat);
  const [form, setForm] = React.useState(() => ({
    name: product.name || '', brand: product.brand || '', cat: product.cat || '',
    price: product.price?.toString() || '', was: product.was?.toString() || '',
    stock: product.stock?.toString() || '10', sizes: (product.sizes || ['S','M','L','XL']).join(','),
    material: product.material || '', note: product.note || '', hue: product.hue ?? 128,
  }));
  const [showCustomCat, setShowCustomCat] = React.useState(form.cat === 'Other' || isCustomCat);
  const [catCustom, setCatCustom] = React.useState(isCustomCat ? form.cat : '');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const result = await updateCustomProduct(product.product_id || product.id, {
      name: form.name, brand: form.brand, cat: form.cat,
      price: parseFloat(form.price) || 0, was: form.was ? parseFloat(form.was) : null,
      stock: (() => { const n = parseInt(form.stock); return isNaN(n) ? 10 : n; })(),
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
      material: form.material || '', note: form.note || '', hue: form.hue,
    });
    setSaving(false);
    if (result) {
      setMsg('✅ Updated');
      getCustomProducts().then(setCustomProducts);
      setTimeout(onDone, 600);
    } else {
      setMsg('❌ Failed');
    }
  };

  const labelStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' };
  const inputStyle = { display: 'block', width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const btnStyle = { padding: '14px 28px', borderRadius: '999px', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' };

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Edit product</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{product.name}</h3>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{product.brand}{product.brand && product.cat ? ' · ' : ''}{product.cat}</div>
        </div>
        <button onClick={onDone}
          style={{ padding: '10px 18px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>← Back to saved
        </button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: 600,
          background: msg.includes('✅') ? 'color-mix(in oklab, var(--ink) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 10%, transparent)', color: msg.includes('✅') ? 'var(--ink)' : 'var(--accent)' }}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Image */}
        <div style={{ marginBottom: '28px' }}>
          <div style={labelStyle}>Product photo</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
            <div style={{ width: '160px', height: '200px', borderRadius: '12px', overflow: 'hidden', background: product.hue ? `hsl(${product.hue},50%,88%)` : 'var(--line)', flexShrink: 0 }}>
              {product.img
                ? <img src={product.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '13px', color: 'var(--muted)' }}>No photo</div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
                To change the photo, you'll need to delete this product and re-add it with the new image. All other fields can be edited here.
              </p>
            </div>
          </div>
        </div>

        {/* Name + Brand row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={labelStyle}>Product name</div>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} placeholder="e.g. Vintage Nike Windbreaker" />
          </div>
          <div>
            <div style={labelStyle}>Brand</div>
            <input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} style={inputStyle} placeholder="e.g. Ralph Lauren" />
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Category</div>
          {(() => {
            const catOptions = [...REWIND_CATS.filter(c => c !== 'All')];
            if (isCustomCat) catOptions.push(product.cat);
            catOptions.push('Other');
            return (<>
            <select value={showCustomCat ? 'Other' : form.cat}
              onChange={e => {
                const newCat = e.target.value;
                // Reset sizes when switching between Shoes and other categories
                const sizesBefore = form.cat;
                const isNowShoes = newCat === 'Shoes';
                const wasShoes = sizesBefore === 'Shoes';
                const sizes = (isNowShoes !== wasShoes)
                  ? (isNowShoes ? '36,37,38,39,40,41,42,43,44,45,46,47' : 'S,M,L,XL')
                  : form.sizes;
                setForm({...form, cat: newCat, sizes});
                setShowCustomCat(newCat === 'Other');
                if (newCat !== 'Other') setCatCustom('');
              }}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
              {catOptions.map(c => <option key={c} value={c === product.cat && isCustomCat ? 'Other' : c}>{c}</option>)}
            </select>
            {showCustomCat && (
              <input style={{ marginTop: '8px', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', width: '100%' }}
                placeholder="Custom category name"
                value={catCustom}
                onChange={e => { setCatCustom(e.target.value); setForm({...form, cat: e.target.value}); }} />
            )}
            </>);
          })()}
        </div>

        {/* Price row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={labelStyle}>Current price (€)</div>
            <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} style={inputStyle} placeholder="95.00" />
          </div>
          <div>
            <div style={labelStyle}>Original price (€)</div>
            <input type="number" step="0.01" value={form.was} onChange={e => setForm({...form, was: e.target.value})} style={inputStyle} placeholder="120.00" />
          </div>
        </div>

        {/* Stock */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Stock (shows "Only X left" when ≤ 5)</div>
          <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} style={{...inputStyle, maxWidth: '120px'}} />
        </div>

        {/* Sizes */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Sizes</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(form.cat === 'Shoes' ? ['36','37','38','39','40','41','42','43','44','45','46','47'] : ['XS','S','M','L','XL','XXL']).map(s => {
              const active = form.sizes.split(',').map(x => x.trim()).includes(s);
              return (
                <button key={s} type="button" onClick={() => {
                  const current = form.sizes.split(',').map(x => x.trim()).filter(Boolean);
                  const next = active ? current.filter(x => x !== s) : [...current, s];
                  setForm({...form, sizes: next.join(',')});
                }}
                  style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    border: active ? '2px solid var(--ink)' : '1px solid var(--line-2)',
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? 'var(--bg)' : 'var(--muted)',
                    cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!active) { e.target.style.borderColor = 'var(--line)'; e.target.style.transform = 'scale(1.05)'; } }}
                  onMouseOut={e => { if (!active) { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; } }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hue color picker */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Color swatch</div>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--muted)' }}>Background tint for the product card & page</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 20, 38, 96, 128, 158, 188, 200, 210, 232, 248, 280, 300, 330, 350].map(h => (
              <button key={h} type="button" onClick={() => setForm({...form, hue: h})}
                title={`Hue ${h}°`}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: form.hue === h ? '3px solid var(--ink)' : '2px solid transparent',
                  background: `hsl(${h},60%,80%)`,
                  cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s',
                  transform: form.hue === h ? 'scale(1.15)' : 'scale(1)',
                  outline: 'none',
                }}
                onMouseOver={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1.12)'; e.target.style.borderColor = 'var(--line-2)'; } }}
                onMouseOut={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1)'; e.target.style.borderColor = 'transparent'; } }} />
            ))}
          </div>
          <div style={{ marginTop: '6px', width: '48px', height: '12px', borderRadius: '4px', background: `hsl(${form.hue},60%,80%)` }} />
        </div>

        {/* Material */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Material</div>
          <input value={form.material} onChange={e => setForm({...form, material: e.target.value})} style={inputStyle} placeholder="e.g. 100% cotton pique, fleece" />
        </div>

        {/* Description / note */}
        <div style={{ marginBottom: '28px' }}>
          <div style={labelStyle}>Description</div>
          <textarea value={form.note} onChange={e => setForm({...form, note: e.target.value})}
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
            placeholder="Product description shown on the product detail page. e.g. Vintage argyle pattern, button front." />
        </div>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button type="submit" disabled={saving}
            style={{...btnStyle, background: saving ? 'var(--line-2)' : 'var(--ink)', cursor: saving ? 'default' : 'pointer', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button type="button" onClick={onDone}
            style={{ padding: '14px 28px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── First-visit survey ── */
function Survey({ onDone, onSkip }) {
  const [step, setStep] = useState('choose');
  const [source, setSource] = useState('');
  const [otherText, setOtherText] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (answer) => {
    const ans = answer || (source === 'Other' ? otherText : source);
    try { await fetch('/api/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: ans }) }); } catch {}
    setDone(true);
    setTimeout(() => onDone(), 1500);
  };

  const options = ['Social media', 'Vinted', 'Grailed', 'Google', 'From a friend', 'Other'];
  return (
    <div>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🙏</div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', margin: '0' }}>Thanks for letting us know!</p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>Enjoy browsing REWIND.</p>
        </div>
      ) : (
      <>
      {options.map(o => (
        <button key={o} onClick={() => { if (o === 'Other') { setSource(o); setStep('other'); } else { submit(o); } }}
          style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '8px', borderRadius: '8px', border: '1px solid var(--line)', background: source === o ? 'var(--ink)' : 'var(--surface)', color: source === o ? 'var(--surface)' : 'var(--ink)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', textAlign: 'center', transition: 'all 0.15s' }}
          onMouseOver={e => { if (source !== o) { e.target.style.background = 'var(--line)'; e.target.style.transform = 'translateY(-1px)'; } }}
          onMouseOut={e => { if (source !== o) { e.target.style.background = 'var(--surface)'; e.target.style.transform = ''; } }}>
          {o}
        </button>
      ))}
      {step === 'other' && (
        <div style={{ marginTop: '12px' }}>
          <input className="rw-input" placeholder="Tell us where..." value={otherText} onChange={e => setOtherText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && otherText.trim()) submit(otherText.trim()); }} autoFocus />
          <button onClick={() => submit(otherText.trim())} disabled={!otherText.trim()}
            style={{ marginTop: '8px', padding: '10px 20px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 600, width: '100%', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
            Submit
          </button>
        </div>
      )}
      <button onClick={onSkip} className="rw-txt-btn" style={{ marginTop: '12px', padding: '8px', fontSize: '12px' }}>Skip</button>
      </>)}
    </div>
  );
}


function ProductForm({ editProduct, onClearEdit, customProducts, setCustomProducts }) {
  const [form, setForm] = React.useState({
    name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360)
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [showCustomCat, setShowCustomCat] = React.useState(false);
  const [showProduct, setShowProduct] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const fileRef = React.useRef(null);
  const catOptions = [...REWIND_CATS.filter(c => c !== 'All'), 'Other'];

  // Memoize the preview blob URL so it's not recreated on every keystroke.
  // Without this, each form-field change re-renders the component and calls
  // URL.createObjectURL() again, leaking blob URLs until the page is reloaded.
  const previewUrl = React.useMemo(() => {
    return form.file ? URL.createObjectURL(form.file) : null;
  }, [form.file]);
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Load product for editing when editProduct prop changes
  React.useEffect(() => {
    if (editProduct) {
      setForm({
        name: editProduct.name || '', brand: editProduct.brand || '', cat: editProduct.cat || '',
        catCustom: '', price: editProduct.price?.toString() || '', was: editProduct.was?.toString() || '',
        stock: editProduct.stock?.toString() || '10', sizes: (editProduct.sizes || ['S','M','L','XL']).join(','),
        material: editProduct.material || '', note: editProduct.note || '', file: null, files: [],
        hue: editProduct.hue ?? Math.floor(Math.random() * 360),
      });
      setEditingId(editProduct.product_id || editProduct.id);
      setMsg('✏️ Editing: ' + editProduct.name);
    }
  }, [editProduct]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const cat = form.cat === 'Other' ? form.catCustom : form.cat;
    if (!form.name || !cat || !form.price) {
      setMsg('❌ Name, category, and price are required'); setSaving(false); return;
    }
    const productId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const product = {
      product_id: productId, name: form.name, brand: form.brand || '', cat,
      price: parseFloat(form.price), was: form.was ? parseFloat(form.was) : null,
      stock: (() => { const n = parseInt(form.stock); return isNaN(n) ? 5 : n; })(), hue: form.hue ?? Math.floor(Math.random() * 360), img: '', note: form.note || '',
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean), material: form.material || '',
    };
    // Upload images if selected
    if (form.files?.length) {
      const url = await uploadProductImage(form.files[0], productId);
      if (url) product.img = url;
      // Upload additional images if any
      for (let i = 1; i < form.files.length; i++) {
        await uploadProductImage(form.files[i], `${productId}-${i}`);
      }
    }
    // Save or update
    if (editingId) {
      const result = await updateCustomProduct(editingId, { name: form.name, brand: form.brand, cat, price: parseFloat(form.price), was: form.was ? parseFloat(form.was) : null, stock: (() => { const n = parseInt(form.stock); return isNaN(n) ? 10 : n; })(), sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean), material: form.material || '', note: form.note || '' });
      if (result) {
        setMsg(`✅ "${form.name}" updated!`);
        setEditingId(null);
        if (onClearEdit) onClearEdit();
        setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360) });
        getCustomProducts().then(setCustomProducts);
      } else { setMsg('❌ Failed to update.'); }
    } else {
      const result = await addCustomProduct(product);
      if (result) {
        setMsg(`✅ "${form.name}" added! `);
        setShowProduct(productId);
        setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360) });
        if (fileRef.current) fileRef.current.value = '';
        getCustomProducts().then(setCustomProducts);
      } else { setMsg('❌ Failed to save.'); }
    }
    setSaving(false);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
        {editingId ? '✏️ Edit product' : '📦 Add new product'}
        {editingId && <button onClick={() => { setEditingId(null); setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360) }); if (onClearEdit) onClearEdit(); }}
          style={{ marginLeft: '10px', padding: '4px 10px', borderRadius: '6px', background: 'var(--line)', border: 'none', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>Cancel edit</button>}
      </h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <input className="rw-input" placeholder="Product name *" value={form.name}
            onChange={e => setForm({...form, name: e.target.value})} required />
          <input className="rw-input" placeholder="Brand (e.g. Nike)" value={form.brand}
            onChange={e => setForm({...form, brand: e.target.value})} />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <select className="rw-input"
            value={showCustomCat ? 'Other' : form.cat}
            onChange={e => {
              const newCat = e.target.value;
              // Reset sizes when switching between Shoes and other categories
              // so the size picker buttons match the visible options
              const sizesBefore = form.cat;
              const isNowShoes = newCat === 'Shoes';
              const wasShoes = sizesBefore === 'Shoes';
              const sizes = (isNowShoes !== wasShoes)
                ? (isNowShoes ? '36,37,38,39,40,41,42,43,44,45,46,47' : 'S,M,L,XL')
                : form.sizes;
              setForm({...form, cat: newCat, sizes});
              setShowCustomCat(newCat === 'Other');
            }}>
            <option value="">Select category *</option>
            {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {showCustomCat && (
            <input className="rw-input" placeholder="New category name" value={form.catCustom}
              onChange={e => setForm({...form, catCustom: e.target.value})} />
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <input className="rw-input" type="number" step="0.01" placeholder="Price * (€)" value={form.price}
            onChange={e => setForm({...form, price: e.target.value})} required />
          <input className="rw-input" type="number" step="0.01" placeholder="Original price (€)" value={form.was}
            onChange={e => setForm({...form, was: e.target.value})} />
        </div>
        <input className="rw-input" type="number" min="0" placeholder="Stock (e.g. 3)" value={form.stock}
          onChange={e => setForm({...form, stock: e.target.value})} style={{ marginBottom: '12px' }} />
        {/* ── Size picker buttons ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>Sizes — click to toggle</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(form.cat === 'Shoes' ? ['36','37','38','39','40','41','42','43','44','45','46','47'] : ['XS','S','M','L','XL','XXL']).map(s => {
              const active = form.sizes.split(',').map(x => x.trim()).includes(s);
              return (
                <button key={s} type="button" onClick={() => {
                  const current = form.sizes.split(',').map(x => x.trim()).filter(Boolean);
                  const next = active ? current.filter(x => x !== s) : [...current, s];
                  setForm({...form, sizes: next.join(',')});
                }}
                  style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    border: active ? '2px solid var(--ink)' : '1px solid var(--line-2)',
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? 'var(--bg)' : 'var(--muted)',
                    cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!active) { e.target.style.borderColor = 'var(--line)'; e.target.style.transform = 'scale(1.05)'; } }}
                  onMouseOut={e => { if (!active) { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; } }}>
                  {s}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            {form.sizes.split(',').map(x => x.trim()).filter(Boolean).length || 0} size{form.sizes.split(',').filter(Boolean).length !== 1 ? 's' : ''} selected
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
          <input className="rw-input" placeholder="Material (e.g. 100% cotton, fleece)" value={form.material}
            onChange={e => setForm({...form, material: e.target.value})} />
        </div>
        {/* ── Hue color picker ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Color swatch</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>— pick the background tint for the product card</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 20, 38, 96, 128, 158, 188, 200, 210, 232, 248, 280, 300, 330, 350].map(h => (
              <button key={h} type="button" onClick={() => setForm({...form, hue: h})}
                title={`Hue ${h}°`}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: form.hue === h ? '2px solid var(--ink)' : '2px solid transparent',
                  background: `hsl(${h},60%,80%)`,
                  cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s',
                  transform: form.hue === h ? 'scale(1.2)' : 'scale(1)',
                  outline: 'none',
                }}
                onMouseOver={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1.15)'; e.target.style.borderColor = 'var(--line-2)'; } }}
                onMouseOut={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1)'; e.target.style.borderColor = 'transparent'; } }} />
            ))}
          </div>
        </div>
        <textarea className="rw-input" placeholder="Description / product notes (appears on product page)"
          value={form.note}
          onChange={e => setForm({...form, note: e.target.value})}
          rows={3}
          style={{ marginBottom: '12px', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
          {form.file && (<div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button"
              onClick={async () => {
                const reader = new FileReader();
                reader.onload = () => {
                  const prompt = "I'm listing a vintage streetwear item. Look at this photo and describe only the product. Do NOT mention the filename, 'WhatsApp', 'image', or any file metadata. Respond with:\n\nTITLE: (short product name, max 6 words)\nDESCRIPTION: (2-3 sentences describing the item — material, era, colors, style, brand clues)\n\nOnly respond with the title and description, nothing else.";
                  navigator.clipboard.writeText(prompt);
                  window.open('https://gemini.google.com/app', '_blank');
                  setMsg('✅ Prompt copied! Paste it into Gemini (tab opened). Then copy the response back here.');
                };
                reader.readAsDataURL(form.file);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}>
              📋 Copy to Gemini
            </button>
            <button type="button"
              onClick={async () => {
                const reader = new FileReader();
                reader.onload = () => {
                  const prompt = "Enhance this product photo for a streetwear store listing. Remove any creases and wrinkles from the fabric. Make the background pure white (#FAF6EF). Improve contrast and lighting so the item pops. Keep the product exactly as it is — just make it look professionally photographed.";
                  navigator.clipboard.writeText(prompt);
                  window.open('https://gemini.google.com/app', '_blank');
                  setMsg('✅ Enhancement prompt copied! Paste into Gemini (tab opened) along with your photo.');
                };
                reader.readAsDataURL(form.file);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid color-mix(in oklab, var(--ink) 30%, transparent)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; e.target.style.transform = ''; }}>
              🎨 Enhance photo
            </button>
            <button type="button"
              onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.disabled = true;
                btn.textContent = '⏳ Generating...';
                try {
                  const img = new Image();
                  const url = URL.createObjectURL(form.file);
                  const base64 = await new Promise((resolve) => {
                    img.onload = () => {
                      const c = document.createElement('canvas');
                      let w = img.width, h = img.height;
                      const m = 1200;
                      if (w > m || h > m) { if (w > h) { h = Math.round(h*m/w); w = m; } else { w = Math.round(w*m/h); h = m; } }
                      c.width = w; c.height = h;
                      c.getContext('2d').drawImage(img, 0, 0, w, h);
                      resolve(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                  });
                  const r = await fetch('/api/generate-description', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64 }) });
                  const d = await r.json();
                  if (d.description || d.title) {
                    setForm(prev => ({ ...prev, name: d.title || prev.name, note: d.description || '' }));
                    btn.textContent = '✅ Generated';
                  } else {
                    btn.textContent = '❌ ' + ((d.error || '').slice(0, 30) || 'Failed');
                    setMsg('❌ AI Error: ' + (d.error || 'Failed'));
                  }
                } catch (e) {
                  btn.textContent = '❌ Error';
                  setMsg('❌ Network Error: ' + e.message);
                }
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
              ✨ Generate from photo
            </button>
            </div>
          </div>)}
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'inline-block',
            padding: '10px 20px',
            borderRadius: '999px',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 4px 12px color-mix(in oklab, var(--accent) 40%, transparent)'; }}
            onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
            📁 Choose files
            <input ref={fileRef} type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.pdf,.svg"
              multiple
              onChange={e => {
                const files = Array.from(e.target.files);
                setForm({...form, file: files[0] || null, files});
              }}
              style={{ display: 'none' }} />
          </label>
          {form.files?.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
              {form.files.length} file{form.files.length > 1 ? 's' : ''} selected
              {form.files.map((f, i) => (
                <span key={i} style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {form.file && (
          <div style={{ marginTop: '16px', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', background: 'var(--bg)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>📱 Storefront preview</p>
            <div style={{ background: 'var(--surface)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ background: form.hue ? `hsl(${form.hue},60%,85%)` : 'var(--line)', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
              </div>
              <div style={{ padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px' }}>{form.cat?.toUpperCase() || 'CATEGORY'}</span>
                {form.brand && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>— {form.brand}</span>}
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--ink)' }}>{form.name || 'Product name'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>{form.price ? `€${form.price}` : '€--'}</span>
                  {form.was && <span style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'line-through' }}>€{form.was}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {form.sizes.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '11px', color: 'var(--muted)' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            {form.note && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontStyle: 'italic' }}>{form.note}</p>}
          </div>
        )}
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600,
            background: msg.includes('✅') ? 'color-mix(in oklab, var(--ink) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 10%, transparent)',
            color: msg.includes('✅') ? 'var(--ink)' : 'var(--accent)',
          }}>
            {msg}
          {showProduct && <button onClick={() => { window.location.hash = '/product/' + showProduct; }}
            style={{ marginLeft: '8px', padding: '4px 10px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
            👁 View on store
          </button>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button type="submit" disabled={saving}
        style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
        onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
        onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
        {saving ? 'Saving...' : editingId ? '💾 Save changes' : '➕ Add product'}
        </button>
        </div>
      </form>
    </div>
  );
}
```


---
## FILE: src/lib/supabase.js (Supabase client + API functions)
```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// If no keys, return a mock client that falls back to localStorage
const useLocalFallback = !supabaseUrl || !supabaseAnonKey;

export const supabase = useLocalFallback
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);

/* ── Table schema (run this in Supabase SQL Editor once) ──
create table if not exists wishlists (
  id bigint generated by default as identity primary key,
  email text unique not null,
  product_ids jsonb default '[]'::jsonb,
  marketing_optin boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Allow anonymous read/upsert by email
alter table wishlists enable row level security;
create policy "anon can read by email" on wishlists
  for select to anon using (true);
create policy "anon can upsert by email" on wishlists
  for insert to anon with check (true);
create policy "anon can update by email" on wishlists
  for update to anon using (true);
*/

/* ── Wishlist API ── */

export async function getWishlist(email) {
  if (!email) return [];
  if (useLocalFallback) {
    try { return JSON.parse(localStorage.getItem('rw_wishlist') || '[]'); }
    catch { return []; }
  }
  const { data, error } = await supabase
    .from('wishlists')
    .select('product_ids')
    .eq('email', email)
    .single();
  if (error && error.code !== 'PGRST116') console.warn('Supabase getWishlist:', error.message);
  return data?.product_ids || [];
}

export async function saveWishlist(email, productIds, marketingOptin) {
  if (useLocalFallback) {
    localStorage.setItem('rw_wishlist', JSON.stringify(productIds));
    return;
  }
  const { error } = await supabase
    .from('wishlists')
    .upsert({ email, product_ids: productIds, marketing_optin: marketingOptin ?? false, updated_at: new Date().toISOString() },
      { onConflict: 'email' });
  if (error) console.warn('Supabase setWishlist:', error.message);
}

export async function signupUser(email, marketingOptin) {
  if (useLocalFallback) {
    localStorage.setItem('rw_email', email);
    return;
  }
  // IMPORTANT: Do NOT include product_ids in the upsert — that would reset
  // the user's existing wishlist to empty when a returning user signs in
  // again (e.g. after clearing localStorage). Supabase preserves the
  // existing product_ids when they're omitted, and for new rows the DB
  // default `'[]'::jsonb` is used.
  const { error } = await supabase
    .from('wishlists')
    .upsert({ email, marketing_optin: marketingOptin ?? false, updated_at: new Date().toISOString() },
      { onConflict: 'email' });
  if (error) console.warn('Supabase signup:', error.message);
}

/* ── Custom Products API (read-only public; write operations route through server API) ── */

export async function getCustomProducts() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('custom_products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.warn('getCustomProducts:', error.message); return []; }
  return data || [];
}

/* ── Admin-only operations (route through server API with admin token) ── */

function getAdminToken() {
  try {
    return localStorage.getItem('rw_admin_token') || '';
  } catch { return ''; }
}

export async function addCustomProduct(product) {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const r = await fetch('/api/admin/products/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(product),
    });
    const d = await r.json();
    return d.data || null;
  } catch { return null; }
}

export async function updateCustomProduct(productId, updates) {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const r = await fetch('/api/admin/products/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ product_id: productId, ...updates }),
    });
    const d = await r.json();
    return d.data || null;
  } catch { return null; }
}

export async function deleteCustomProduct(id) {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const r = await fetch('/api/admin/products/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ id }),
    });
    const d = await r.json();
    return d.ok === true;
  } catch { return false; }
}

export async function uploadProductImage(file, productId) {
  const token = getAdminToken();
  if (!token) return null;
  try {
    // Convert file to base64 on the client
    const b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // Strip data: URL prefix if present
        const base64 = typeof result === 'string' ? result.split(',')[1] || result : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const ext = file.name.split('.').pop() || 'webp';
    const r = await fetch('/api/admin/products/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ productId, imageBase64: b64, ext }),
    });
    const d = await r.json();
    return d.url || null;
  } catch { return null; }
}

/* ── Orders API (admin-only, route through server API) ── */

export async function saveOrder(order) {
  // This is called from the checkout flow — route through server API
  try {
    const r = await fetch('/api/save-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const d = await r.json();
    return d.ok ? order : null;
  } catch { return null; }
}

export async function getOrders() {
  const token = getAdminToken();
  if (!token) return [];
  try {
    const r = await fetch('/api/admin/orders', {
      headers: { 'x-admin-token': token },
    });
    const d = await r.json();
    return d.orders || [];
  } catch { return []; }
}

export async function updateOrderStatus(id, status) {
  const token = getAdminToken();
  if (!token) return;
  try {
    await fetch('/api/admin/orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ id, status }),
    });
  } catch {}
}
```


---
## FILE: src/components/Shell.jsx
```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useCountdown, pad, money } from '../hooks/useCountdown';
import { IMG_BASE_URL } from '../data';

/* ---------- Icon ---------- */
export function Icon({ name, size = 20 }) {
  const p = {
    cart:   <><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2.5 3h2.2l2 12h10.3l1.8-9H6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    close:  <><path d="M5 5l14 14M19 5L5 19"/></>,
    plus:   <><path d="M12 5v14M5 12h14"/></>,
    minus:  <><path d="M5 12h14"/></>,
    arrow:  <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check:  <><path d="M4 12l5 5L20 6"/></>,
    chev:   <><path d="M6 9l6 6 6-6"/></>,
    bag:    <><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
    bolt:   <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></>,
    truck:  <><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></>,
    retrn:  <><path d="M3 8h11a5 5 0 0 1 0 10H8"/><path d="M6 5 3 8l3 3"/></>,
    heart:  <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></>,
    heartFilled: <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="currentColor"/></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
  );
}

/* ---------- Photo ---------- */
export function Photo({ id, hue, label, h = 320, img }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);
  const src = img || (IMG_BASE_URL ? `${IMG_BASE_URL}/${id}.webp` : null);

  useEffect(() => {
    if (!imgRef.current || !src) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src;
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src]);

  if (!src) {
    // Colour-block placeholder
    const bg = `linear-gradient(150deg, oklch(0.72 0.17 ${hue}) 0%, oklch(0.55 0.2 ${(hue + 40) % 360}) 100%)`;
    return (
      <div className="rw-photo" style={{ height: h }}>
        <div className="rw-photo-bg" style={{ background: bg }}>
          <span className="rw-photo-word">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rw-photo" style={{ height: h, overflow: 'hidden', position: 'relative' }}>
      {!loaded && <div className="rw-skeleton" style={{ position: 'absolute', inset: 0 }} />}
      <img ref={imgRef} className={`rw-img ${loaded ? 'loaded' : ''}`}
        alt={label} onLoad={() => setLoaded(true)}
        style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

/* ---------- Banner ---------- */
export function Banner({ showCountdown }) {
  const msgs = [
    "Summer drop is live — curated vintage, restocked weekly",
    "Free returns within 14 days · Ships from EU in 24h",
    "Every piece authenticated & steam-cleaned before it ships",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % msgs.length), 4200);
    return () => clearInterval(t);
  }, []);
  const c = useCountdown();
  return (
    <div className="rw-banner">
      <div className="rw-banner-track" key={i}>
        <Icon name="bolt" size={14} /> <span>{msgs[i]}</span>
      </div>
      {showCountdown && (
        <div className="rw-banner-count" title="Sale ends Sunday 23:59">
          Sale ends in
          <b>{c.d}d&nbsp;{pad(c.h)}h&nbsp;{pad(c.m)}m&nbsp;{pad(c.s)}s</b>
        </div>
      )}
    </div>
  );
}

/* ---------- Header ---------- */
export function Header({ cat, setCat, cartCount, onCart, wishlistCount, onWishlistOpen, query, setQuery, cats, version, onVersionClick }) {
  return (
    <header className="rw-header">
      <div className="rw-header-row">
        <div className="rw-logo" style={{ cursor: 'pointer' }}
          onClick={() => { window.location.hash = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); window.dispatchEvent(new CustomEvent('reset-store')); }}>REWIND<span>.</span></div>
        <nav className="rw-nav">
          {cats.map((c) => (
            <button key={c} className={"rw-navlink" + (cat === c ? " is-on" : "")}
              onClick={() => setCat(c)}>{c === "All" ? "New in" : c}</button>
          ))}
        </nav>
        <div className="rw-header-actions">
          <div className="rw-search" style={{position:'relative'}}>
            <Icon name="search" size={17} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.target.blur(); setQuery(''); } }} placeholder="Search" />
            {query && (
            <button onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px', display: 'grid', placeItems: 'center',
                color: 'var(--muted)', opacity: 0.7,
                transition: 'opacity 0.15s',
              }}
              onMouseOver={e => e.target.style.opacity = '1'}
              onMouseOut={e => e.target.style.opacity = '0.7'}>
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <button className="rw-iconbtn" onClick={onWishlistOpen} aria-label="Wishlist">
            <Icon name="heart" size={17} />
            {wishlistCount > 0 && <span className="rw-badge">{wishlistCount}</span>}
          </button>
          <button className="rw-iconbtn" onClick={onCart} aria-label="Cart">
            <Icon name="bag" />
            {cartCount > 0 && <span className="rw-badge">{cartCount}</span>}
          </button>
          {version && <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '10px', fontWeight: 600, cursor: 'pointer' }} onClick={onVersionClick} title="Toggle tweaks panel">{version}</span>}
        </div>
      </div>
    </header>
  );
}

/* ---------- TypingText (inline for no import breakage) ---------- */
export function TypingText({ texts, typingSpeed = 80, deleteSpeed = 40, pauseDuration = 2500 }) {
  const [text, setText] = useState('');
  const [ti, setTi] = useState(0);
  const [ci, setCi] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!texts?.length) return;
    const current = texts[ti];
    const speed = deleting ? deleteSpeed : typingSpeed;
    const t = setTimeout(() => {
      if (!deleting) {
        if (ci < current.length) { setText(current.slice(0, ci + 1)); setCi(c => c + 1); }
        else setTimeout(() => setDeleting(true), pauseDuration);
      } else {
        if (ci > 0) { setText(current.slice(0, ci - 1)); setCi(c => c - 1); }
        else { setDeleting(false); setTi((ti + 1) % texts.length); }
      }
    }, speed);
    return () => clearTimeout(t);
  }, [ci, deleting, ti, texts, typingSpeed, deleteSpeed, pauseDuration]);
  return <span className="type-wrap">{text}<span className="type-cursor">|</span></span>;
}

/* ---------- Hero ---------- */
export function Hero({ onShop }) {
  return (
    <section className="rw-hero">
      <div className="rw-hero-copy">
        <div className="rw-hero-kicker"><Icon name="bolt" size={13} /> Summer '26 · Vol. 04</div>
        <h1 className="rw-hero-title">Worn once.<br/>Loved again.</h1>
        <p className="rw-hero-sub">
          Hand-picked vintage tracksuits, retro jerseys & summer sets. Authenticated,
          cleaned, and shipped in 24 hours. One of each — when it's gone, it's gone.
        </p>
        <div className="rw-hero-cta">
          <button className="rw-btn rw-btn-pri" onClick={() => onShop()}>Shop the drop <Icon name="arrow" size={17} /></button>
          <button className="rw-btn rw-btn-ghost" onClick={() => onShop('Jerseys')}>Browse jerseys</button>
        </div>
        <div className="rw-hero-stats">
          <div><b>4.9</b><span>★ 2,300+ reviews</span></div>
          <div><b>24h</b><span>EU dispatch</span></div>
          <div><b>14d</b><span>free returns</span></div>
        </div>
      </div>
      <div className="rw-hero-art">
        <div className="rw-hero-loop">
          <Photo id="hero-b" hue={210} label="DETAIL" h={420} />
        </div>
      </div>
    </section>
  );
}

/* ---------- Marquee ---------- */
export function Marquee() {
  const items = ["Ships in 24h", "Free EU returns", "One of each", "Restocked weekly", "Authenticated", "Steam-cleaned"];
  // Triple-repeat ensures there's always visible content during the animation
  // loop, preventing any cutoff on narrow viewports.
  const row = [...items, ...items, ...items];
  return (
    <div className="rw-marquee">
      <div className="rw-marquee-track">
        {row.map((t, k) => <span key={k} className="rw-marquee-item"><Icon name="bolt" size={13} /> {t}</span>)}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="rw-toast" key={toast.k}>
      <Icon name="check" size={16} /> <span>{toast.msg}</span>
      {toast.action && (
        <button className="rw-toast-btn" onClick={() => { toast.action.onClick(); onDismiss(); }}>
          {toast.action.label}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss"
        className="rw-toast-close">
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}

/* ---------- Footer ---------- */
export function Footer({ onSizes, onInfo, onSetCat }) {
  return (
    <footer className="rw-footer">
      <div className="rw-footer-top">
        <div className="rw-logo rw-logo-lg">REWIND<span>.</span></div>
        <p>Curated vintage & retro sportswear. Each piece is one of one — sourced,
          authenticated, and sent on within a day.</p>
      </div>
      <div className="rw-footer-cols">
        <div><h4>Shop</h4><a onClick={() => onSetCat('Tracksuits')}>Tracksuits</a><a onClick={() => onSetCat('Jerseys')}>Jerseys</a><a onClick={() => onSetCat('Polos')}>Polos</a><a onClick={() => onSetCat('Shoes')}>Kicks</a></div>
        <div><h4>Help</h4><a onClick={onSizes} style={{ cursor: 'pointer' }}>Sizing</a><a onClick={() => onInfo('shipping')} style={{ cursor: 'pointer' }}>Shipping</a><a onClick={() => onInfo('returns')} style={{ cursor: 'pointer' }}>Returns</a><a onClick={() => onInfo('tracking')} style={{ cursor: 'pointer' }}>Track order</a><a onClick={() => onInfo('orders')} style={{ cursor: 'pointer' }}>Orders</a></div>
        <div><h4>Pay with</h4><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>PayPal</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Payconiq</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Apple Pay</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Bancontact</a><a onClick={() => onInfo('payments')} style={{ cursor: 'pointer' }}>Klarna</a></div>
      </div>
      <div className="rw-footer-base">© 2026 REWIND. Vintage streetwear — curated, authenticated, shipped in 24h.</div>
    </footer>
  );
}
```


---
## FILE: src/components/Shop.jsx
```jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { money, discountPct } from '../hooks/useCountdown';
import { Icon, Photo } from './Shell';
import { REWIND_PAYMENTS, REWIND_PRODUCTS } from '../data';
import { deleteCustomProduct } from '../lib/supabase';

/* ---------- ProductCard ---------- */
export function ProductCard({ p, showCompare, showStock, onQuick, onAdd, wishlisted, onWishlist, onSelect, onCart }) {
  const low = p.stock > 0 && p.stock <= 5;
  const soldOut = p.stock === 0;
  const [added, setAdded] = useState(false);
  return (
    <article className="rw-card" style={{ opacity: soldOut ? 0.5 : 1 }}>
      <div className="rw-card-media" style={{ cursor: 'pointer' }} onClick={() => onSelect ? onSelect(p) : onQuick(p)}>
        <Photo id={p.id || p.product_id} hue={p.hue} label={p.name.toUpperCase()} h={340} img={p.img} />
        <div className="rw-card-tags">
          {showCompare && discountPct(p) > 0 && <span className="rw-tag rw-tag-sale">-{discountPct(p)}%</span>}
          {showStock && soldOut && <span className="rw-tag rw-tag-low">Sold out</span>}
          {showStock && low && !soldOut && <span className="rw-tag rw-tag-low">Only {p.stock} left</span>}
        </div>
        <button className="rw-card-quick" onClick={(e) => { e.stopPropagation(); onQuick(p); }}>Quick view</button>
        <button className={"rw-card-fav" + (wishlisted ? ' is-wishlisted' : '')}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          style={{ color: wishlisted ? 'var(--accent)' : undefined }}
          onClick={(e) => { e.stopPropagation(); onWishlist(p); const btn = e.currentTarget; btn.classList.add('wiggle'); setTimeout(() => btn.classList.remove('wiggle'), 500); }}>
          <Icon name={wishlisted ? 'heartFilled' : 'heart'} size={17} />
        </button>
      </div>
      <div className="rw-card-body">
        <div className="rw-card-head">
          <h3 onClick={() => onSelect ? onSelect(p) : onQuick(p)} style={{ cursor: 'pointer' }}>{p.name}</h3>
          <span className="rw-card-cat">{p.cat}</span>
        </div>
        <div className="rw-card-foot">
          <div className="rw-price">
            <span className="rw-price-now">{money(p.price)}</span>
            {showCompare && p.was && <span className="rw-price-was">{money(p.was)}</span>}
          </div>
          {added ? (
            <button className="rw-add" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
              onClick={onCart} aria-label="View in bag">
              <Icon name="bag" size={16} />
            </button>
          ) : (
          <button className="rw-add" onClick={() => { onAdd(p); setAdded(true); setTimeout(() => setAdded(false), 2000); }} aria-label={"Add " + p.name}>
            <Icon name="plus" size={18} />
          </button>
          )}
        </div>
        {soldOut ? (
          <div className="rw-card-ship" style={{color:'var(--muted)',fontSize:'12px',textAlign:'center',padding:'8px 0'}}>Unavailable</div>
        ) : (
        <div className="rw-card-ship">
          <Icon name="retrn" size={13} /> Free returns <span className="rw-price-was">€8</span>
        </div>
        )}
      </div>
    </article>
  );
}

/* ---------- ProductGrid ---------- */
export function ProductGrid({ products, wishlist, onWishlist, sort, query, onClearSearch, activeCat, activeBrand, onCart, ...rest }) {
  if (products.length === 0) {
    const hasQuery = query && query.trim();
    const hasBrand = activeBrand;
    const hasCat = activeCat && activeCat !== 'All';
    let msg;
    if (hasQuery && hasBrand) {
      msg = `Nothing matched "${query.trim()}" for ${activeBrand}${hasCat ? ' in ' + activeCat : ''} — try a different term?`;
    } else if (hasQuery && hasCat) {
      msg = `Nothing matched "${query.trim()}" in ${activeCat} — try a different term?`;
    } else if (hasQuery) {
      msg = `Nothing matched "${query.trim()}" — try a different term?`;
    } else if (hasBrand) {
      msg = `No ${activeBrand} products${hasCat ? ' in ' + activeCat : ''} — try a different brand or category?`;
    } else if (hasCat) {
      msg = 'Nothing here in this category yet — try browsing all or checking back soon.';
    } else {
      msg = 'Nothing here yet — check back soon for new drops.';
    }
    const showClearFilters = hasQuery || hasBrand || hasCat;
    return (
      <div className="rw-empty">
        <span>{msg}</span>
        {showClearFilters && (
          <div style={{ marginTop: '14px' }}>
            <button className="rw-btn rw-btn-ghost" onClick={onClearSearch}
              style={{ fontSize: '13px', padding: '10px 18px' }}>
              ✕ Clear filters & show all
            </button>
          </div>
        )}
      </div>
    );
  }
  // Sort products
  let sorted = [...products];
  const isSorting = sort === 'price-asc' || sort === 'price-desc' || sort === 'name-asc' || sort === 'name-desc';
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'name-asc') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (sort === 'name-desc') sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));

  // When sorting is active, render a single flat grid so the sort order is respected globally.
  if (isSorting) {
    return (
      <div>
        <div className="rw-grid">
          {sorted.map((p) => (
            <ProductCard key={p.id || p.product_id} p={p} wishlisted={wishlist?.includes(p.id || p.product_id)} onWishlist={onWishlist}
              showCompare={rest.showCompare} showStock={rest.showStock} onQuick={rest.onQuick} onAdd={rest.onAdd} onSelect={rest.onSelect} onCart={onCart} />
          ))}
        </div>
      </div>
    );
  }

  // Group products by brand → category, then flatten with headers (Featured view)
  const grouped = {};
  sorted.forEach(p => {
    const brand = p.brand || '';
    const cat = p.cat || 'Other';
    if (!grouped[brand]) grouped[brand] = {};
    if (!grouped[brand][cat]) grouped[brand][cat] = [];
    grouped[brand][cat].push(p);
  });

  const sections = [];
  Object.entries(grouped).forEach(([brand, cats]) => {
    Object.entries(cats).forEach(([cat, items]) => {
      // When browsing a specific category (not "All"), the category is already
      // shown in the page title — omit it from section headers to reduce noise.
      const isCurrentCat = activeCat && activeCat !== 'All' && cat === activeCat;
      const label = isCurrentCat ? brand : [brand, cat].filter(Boolean).join(' — ');
      sections.push({ label, items });
    });
  });

  return (
    <div>
      {sections.map((s, i) => (
        <div key={i}>
          {s.label && (
            <h3 className="rw-section-head">
              {s.label}
            </h3>
          )}
          <div className="rw-grid" style={{ marginBottom: '8px' }}>
            {s.items.map((p) => (
              <ProductCard key={p.id || p.product_id} p={p} wishlisted={wishlist?.includes(p.id || p.product_id)} onWishlist={onWishlist}
                showCompare={rest.showCompare} showStock={rest.showStock} onQuick={rest.onQuick} onAdd={rest.onAdd} onSelect={rest.onSelect} onCart={onCart} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- QuickView ---------- */
export function QuickView({ p, showCompare, showStock, onClose, onAdd }) {
  const [size, setSize] = useState(null);
  // Reset size selection when the product changes — prevents stale size
  // from a previous product (e.g. shoe size "42" persisting after switching
  // to a jersey with S/M/L/XL sizes).
  useEffect(() => { setSize(null); }, [p?.id || p?.product_id]);
  if (!p) return null;
  const low = p.stock > 0 && p.stock <= 5;
  const soldOut = p.stock === 0;
  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        {!!localStorage.getItem('rw_admin_email') && (
        <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 20 }}>
          <button onClick={(e) => { e.stopPropagation();
            const menu = e.target.nextElementSibling;
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
          }}
            style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
            ⋮
          </button>
          <div onClick={e => e.stopPropagation()}
            style={{ display: 'none', position: 'absolute', top: '32px', left: 0, background: 'var(--surface)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '120px', zIndex: 30 }}>
            <button onClick={() => {
              const id = p.id || p.product_id;
              const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
              if (savedIds.includes(id)) { localStorage.setItem('rw_admin_saved', JSON.stringify(savedIds.filter(x => x !== id))); alert('Removed from saved'); }
              else { localStorage.setItem('rw_admin_saved', JSON.stringify([...savedIds, id])); alert('Saved!'); }
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              ⭐ Save
            </button>
            <button onClick={() => {
              if (confirm('Delete this product?')) {
                deleteCustomProduct(p.id || p.product_id);
                window.location.reload();
              }
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              🗑 Delete
            </button>
            <button onClick={() => {
              localStorage.setItem('rw_edit_product', p.id || p.product_id);
              window.location.hash = '#admin';
            }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'transparent'}
              style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.1s' }}>
              ✏️ Edit
            </button>
          </div>
        </div>
        )}
        <div className="rw-modal-media">
          <Photo id={(p.id || p.product_id) + "-qv"} hue={p.hue} label={p.name.toUpperCase()} h={500} img={p.img} />
        </div>
        <div className="rw-modal-info">
          <span className="rw-card-cat">{p.cat}</span>
          <h2>{p.name}</h2>
          <div className="rw-price rw-price-lg">
            <span className="rw-price-now">{money(p.price)}</span>
            {showCompare && p.was && <span className="rw-price-was">{money(p.was)}</span>}
          </div>
          <p className="rw-modal-note">{p.note}</p>
          {showStock && soldOut && <div className="rw-stockline"><Icon name="bolt" size={15} /> Sold out — check back soon</div>}
          {showStock && low && !soldOut && <div className="rw-stockline"><Icon name="bolt" size={15} /> Only {p.stock} left</div>}
          <div className="rw-sizes">
            <div className="rw-sizes-label">Size</div>
            <div className="rw-sizes-row">
              {p.sizes.map((s) => (
                <button key={s} className={"rw-size" + (size === s ? " is-on" : "")}
                  onClick={() => setSize(s)}>{s}</button>
              ))}
            </div>
          </div>
          <button className="rw-btn rw-btn-pri rw-btn-full" disabled={!size || soldOut} onClick={() => onAdd(p, size)}>
            {soldOut ? 'Sold out' : size ? 'Add to bag — ' + money(p.price) : 'Select a size'}
          </button>
          <div className="rw-modal-perks">
            <span><Icon name="truck" size={15} /> Ships in 24h</span>
            <span><Icon name="retrn" size={15} /> Free returns</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- CartDrawer ---------- */
export function CartDrawer({ open, items, onClose, onQty, onRemove, onCheckout, showToast }) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const FREE_THRESHOLD = 150;
  const freeProgress = Math.min(100, (subtotal / FREE_THRESHOLD) * 100);
  const freeLeft = Math.max(0, FREE_THRESHOLD - subtotal);

  return (
    <>
      <div className={"rw-scrim" + (open ? " is-on" : "")} onClick={onClose} />
      <div className={"rw-drawer" + (open ? " is-on" : "")}>
        <div className="rw-drawer-head">
          <h3>Bag</h3>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        {items.length > 0 && subtotal < FREE_THRESHOLD ? (
          <div className="rw-freebar">
            <Icon name="truck" size={14} /> Add <b>{money(freeLeft)}</b> more for free shipping
            <div className="rw-freebar-track"><div style={{ width: freeProgress + '%' }} /></div>
          </div>
        ) : subtotal >= FREE_THRESHOLD && items.length > 0 && (
          <div className="rw-freebar" style={{ color: 'var(--ink)' }}>
            <Icon name="check" size={14} /> <b>Free shipping unlocked!</b> 🎉
          </div>
        )}
        {items.length === 0 ? (
          <div className="rw-drawer-empty">
            <Icon name="bag" size={36} />
            <p>Your bag is empty</p>
          </div>
        ) : (
          <div className="rw-drawer-items">
            {items.map((it) => (
              <div key={it.key} className="rw-line">
                <div className="rw-line-media">
                  <Photo id={it.id + "-cart"} hue={it.hue} label="" h={74} />
                </div>
                <div className="rw-line-info">
                  <div className="rw-line-top">
                    <h4>{it.name}</h4>
                    <button className="rw-line-x" onClick={() => onRemove(it.key, it.name)} aria-label="Remove">
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                  <div className="rw-line-meta">{it.size}</div>
                  <div className="rw-line-bot">
                    <div className="rw-qty">
                      <button onClick={() => onQty(it.key, -1)} aria-label="Decrease"><Icon name="minus" size={13} /></button>
                      <span>{it.qty}</span>
                      <button onClick={() => onQty(it.key, 1)} aria-label="Increase"><Icon name="plus" size={13} /></button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {it.was && (
                        <span style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'line-through' }}>
                          {money(it.was * it.qty)}
                        </span>
                      )}
                      <span className="rw-line-price">{money(it.price * it.qty)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="rw-drawer-foot">
            <div className="rw-subtotal">
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <button className="rw-btn rw-btn-pri rw-btn-full" onClick={onCheckout}>
              Checkout <Icon name="arrow" size={16} />
            </button>
            <div className="rw-paystrip">
              {REWIND_PAYMENTS.map((pm) => (
                <span key={pm.id} className="rw-paychip">{pm.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Checkout ---------- */
export function Checkout({ open, items, onClose, onPlaced, userEmail, showToast, orderNumber: orderNumberProp }) {
  const [payment, setPayment] = useState('card');
  const [placed, setPlaced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [orderNum, setOrderNum] = useState('');
  const [payError, setPayError] = useState('');
  const [promo, setPromo] = useState('');
  const [promoData, setPromoData] = useState(null);
  const [promoValidating, setPromoValidating] = useState(false);

  // Validate promo code with debounce
  useEffect(() => {
    if (!promo.trim()) { setPromoData(null); setPromoValidating(false); return; }
    setPromoValidating(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch('/api/validate-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: promo.trim() }),
        });
        setPromoData(await r.json());
      } catch { setPromoData(null); }
      setPromoValidating(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [promo]);

  // When ordernumber is passed via prop (Stripe success redirect), show confirmation immediately
  useEffect(() => {
    if (orderNumberProp) {
      setOrderNum(orderNumberProp);
      setPlaced(true);
    }
  }, [orderNumberProp]);
  // Save-my-info feature — persists delivery fields to localStorage
  const [saveInfo, setSaveInfo] = useState(() => {
    const stored = localStorage.getItem('rw_checkout_save_info');
    return stored !== null ? stored === 'true' : true;
  });
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('rw_checkout_info') || '{}'); }
    catch { return {}; }
  }, []);
  // Controlled form fields — prevents defaultValue reset bug when payment method buttons re-render the component
  const [formFields, setFormFields] = useState(() => ({
    email: userEmail || '',
    name: saved.name || '',
    address: saved.address || '',
    postal: saved.postal || '',
    city: saved.city || '',
    country: saved.country || '',
  }));
  const setField = (field) => (e) => setFormFields(prev => ({ ...prev, [field]: e.target.value }));

  // Auto-save delivery fields to localStorage as user types (when saveInfo is enabled)
  // Previously only saved on Pay click — users who closed checkout lost their data.
  // Also clears saved data immediately when the user unchecks "Save my info",
  // preventing stale pre-filled fields on the next checkout session.
  const hasInfo = formFields.name || formFields.address || formFields.postal || formFields.city || formFields.country;
  useEffect(() => {
    if (!saveInfo) {
      localStorage.removeItem('rw_checkout_info');
      localStorage.setItem('rw_checkout_save_info', 'false');
      return;
    }
    if (hasInfo) {
      const { name, address, postal, city, country } = formFields;
      localStorage.setItem('rw_checkout_info', JSON.stringify({ name, address, postal, city, country }));
    } else {
      localStorage.removeItem('rw_checkout_info');
    }
  }, [formFields.name, formFields.address, formFields.postal, formFields.city, formFields.country, saveInfo]);

  // Launch confetti burst (CSS-based, no external lib needed)
  useEffect(() => {
    if (!orderNum) return;
    const colors = [getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF4D14', '#FF6B8A', '#FFD700', '#00C853', '#2979FF', '#E040FB'];
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
    document.body.appendChild(container);
    for (let i = 0; i < 150; i++) {
      const c = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const delay = Math.random() * 1.5;
      const size = 4 + Math.random() * 10;
      const drift = (Math.random() - 0.5) * 200;
      c.style.cssText = `position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size * 0.6}px;background:${color};border-radius:2px;animation:confettiFall 5s ${delay}s ease-out forwards;--drift:${drift}px`;
      container.appendChild(c);
    }
    const timer = setTimeout(() => { if (container.parentNode) container.parentNode.removeChild(container); }, 8000);
    return () => {
      clearTimeout(timer);
      if (container.parentNode) container.parentNode.removeChild(container);
    };
  }, [orderNum]);

  if (!open) return null;
  if (placed) {
    return (
      <div className="rw-checkout">
        <div className="rw-checkout-bar">
          <div className="rw-logo" style={{ cursor: 'pointer' }}
            onClick={() => { window.location.hash = ''; window.dispatchEvent(new CustomEvent('reset-store')); onPlaced(); }}>REWIND<span>.</span></div>
          <button className="rw-btn rw-btn-ghost" onClick={onPlaced}>Close</button>
        </div>
        <div className="rw-confirm">
          <div className="rw-confirm-mark"><Icon name="check" size={36} /></div>
          <h2>Order confirmed</h2>
          <p>Thanks for your order! We'll send you a shipping confirmation once your items are on their way.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '4px' }}>
            <div className="rw-confirm-num">{orderNum}</div>
            <button onClick={(e) => { const btn = e.currentTarget; navigator.clipboard.writeText(orderNum).then(() => { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⎘'; }, 1200); }).catch(() => { btn.textContent = '✗'; setTimeout(() => { btn.textContent = '⎘'; }, 1200); }); }}
              style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', display: 'grid', placeItems: 'center', color: 'var(--muted)', transition: 'background 0.15s' }}
              onMouseOver={e => e.target.style.background = 'var(--line)'}
              onMouseOut={e => e.target.style.background = 'var(--surface)'}>
              ⎘
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>A confirmation has been sent to your email</p>
          <button className="rw-btn rw-btn-pri" onClick={onPlaced}>Continue shopping</button>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipping = subtotal >= 150 ? 0 : 8;
  let discountPrice = subtotal;
  let discountShipping = shipping;
  let discountLabel = null;
  if (promoData?.valid) {
    if (promoData.type === 'percent') {
      discountPrice = Math.round(subtotal * (100 - promoData.value)) / 100;
      discountLabel = `${promoData.value}% off`;
    } else if (promoData.type === 'free_shipping') {
      discountShipping = 0;
      discountLabel = 'Free shipping';
    }
  }
  const finalTotal = discountPrice + discountShipping;

  async function handlePay() {
    setProcessing(true);
    setPayError('');
    // Client-side field validation before hitting the API
    const missing = [];
    if (!formFields.email?.trim()) missing.push('Email');
    else if (!/^\S+@\S+\.\S+$/.test(formFields.email.trim())) {
      setPayError('Please enter a valid email address');
      setProcessing(false);
      return;
    }
    if (!formFields.name?.trim()) missing.push('Full name');
    if (!formFields.address?.trim()) missing.push('Address');
    if (!formFields.postal?.trim()) missing.push('Postal code');
    if (!formFields.city?.trim()) missing.push('City');
    if (!formFields.country?.trim()) missing.push('Country');
    if (missing.length > 0) {
      setPayError('Please fill in: ' + missing.join(', '));
      setProcessing(false);
      return;
    }
    const email = formFields.email;
    // Check if email is blocked BEFORE persisting any data to localStorage —
    // prevents blocked users' personal info from being saved locally.
    try {
      const br = await fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const bd = await br.json();
      if (bd.blocked) {
        setProcessing(false);
        if (showToast) {
          showToast('🚫 Your email has been blocked. Contact orders@rewind-stores.com to appeal.', null, 8000);
        } else {
          alert('🚫 Your email has been blocked.\nPlease contact orders@rewind-stores.com to appeal.');
        }
        return;
      }
    } catch {}
    // Save delivery info to localStorage if checkbox is checked
    if (saveInfo) {
      localStorage.setItem('rw_checkout_save_info', 'true');
      const { name, address, postal, city, country } = formFields;
      if (name || address || postal || city || country) {
        localStorage.setItem('rw_checkout_info', JSON.stringify({ name, address, postal, city, country }));
      }
    } else {
      localStorage.setItem('rw_checkout_save_info', 'false');
      localStorage.removeItem('rw_checkout_info');
    }
    const orderNum = 'RW-' + String(Date.now()).slice(-8);
    try {
      const r = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(it => ({ name: it.name, size: it.size, price: it.price, qty: it.qty })),
          total: finalTotal,
          orderNum,
          email,
          name: formFields.name,
          address: [formFields.address, formFields.postal, formFields.city, formFields.country].filter(Boolean).join(', '),
        }),
      });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
      } else {
        setPayError(d.error || 'Checkout failed — please try again');
        setProcessing(false);
      }
    } catch (e) {
      setProcessing(false);
      setPayError('Payment could not be processed — please check your details and try again.');
      console.warn('Payment error:', e);
    }
  }

  return (
    <div className="rw-checkout">
      <div className="rw-checkout-bar">
        <div className="rw-logo" style={{ cursor: 'pointer' }}
          onClick={() => { window.location.hash = ''; window.dispatchEvent(new CustomEvent('reset-store')); onClose(); }}>REWIND<span>.</span></div>
        <button className="rw-btn rw-btn-ghost" onClick={onClose}>Back</button>
      </div>
      <div className="rw-checkout-grid">
        <div className="rw-checkout-main">
          <div className="rw-co-sec">
            <h3>Contact</h3>
            <input className="rw-input" type="email" placeholder="Email" value={formFields.email} onChange={setField('email')} autoComplete="email" />
          </div>
          <div className="rw-co-sec">
            <h3>Promo code</h3>
            <div style={{ position: 'relative' }}>
              <input className="rw-input" placeholder="Enter code" value={promo} onChange={e => setPromo(e.target.value)}
                style={{ paddingRight: promo ? '32px' : undefined }} />
              {promo && (
                <button onClick={() => setPromo('')}
                  aria-label="Clear promo code"
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', display: 'grid', placeItems: 'center',
                    color: 'var(--muted)', opacity: 0.7,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={e => e.target.style.opacity = '1'}
                  onMouseOut={e => e.target.style.opacity = '0.7'}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
            {promoValidating && (
              <span style={{color: 'var(--muted)', fontSize: '13px', marginTop: '6px', display: 'block', fontWeight: 500}}>
                ⏳ Validating...
              </span>
            )}
            {promoData?.valid && (
              <span style={{color: 'var(--ink)', fontSize: '13px', marginTop: '6px', display: 'block', fontWeight: 600}}>
                ✓ {promoData.type === 'percent' ? `${promoData.value}% off applied!` : 'Free shipping applied!'}
              </span>
            )}
            {promoData && !promoData.valid && promo.trim() && !promoValidating && (
              <span style={{color: 'var(--accent)', fontSize: '13px', marginTop: '6px', display: 'block'}}>
                Invalid promo code
              </span>
            )}
          </div>
          <div className="rw-co-sec">
            <h3>Delivery</h3>
            <input className="rw-input" type="text" placeholder="Full name" value={formFields.name} onChange={setField('name')} autoComplete="name" />
            <input className="rw-input" type="text" placeholder="Address" value={formFields.address} onChange={setField('address')} autoComplete="street-address" />
            <div className="rw-input-row">
              <input className="rw-input" type="text" placeholder="Postal code" value={formFields.postal} onChange={setField('postal')} autoComplete="postal-code" />
              <input className="rw-input" type="text" placeholder="City" value={formFields.city} onChange={setField('city')} autoComplete="address-level2" />
            </div>
            <input className="rw-input" type="text" placeholder="Country" value={formFields.country} onChange={setField('country')} autoComplete="country-name" />
          </div>
          <div className="rw-co-sec">
            <h3>Payment</h3>
            <div className="rw-pay-grid">
              {REWIND_PAYMENTS.map((pm) => (
                <button key={pm.id} className={"rw-pay" + (payment === pm.id ? " is-on" : "")}
                  onClick={() => setPayment(pm.id)}>
                  <div className="rw-pay-radio">{payment === pm.id && <Icon name="check" size={13} />}</div>
                  <div className="rw-pay-label">
                    {pm.label}
                    <small>{pm.sub}</small>
                  </div>
                </button>
              ))}
            </div>
            {payment === 'card' && (
              <div className="rw-card-fields" style={{ fontSize: '13px', color: 'var(--muted)', padding: '12px 0', lineHeight: '1.6' }}>
                <Icon name="check" size={14} /> Payment handled securely by <strong>Stripe</strong> — you'll complete card entry on their checkout page.
              </div>
            )}
            <div className="rw-co-config">
              {payment === 'payconiq' && 'Scan the QR code with Payconiq to complete payment.'}
              {payment === 'applepay' && 'Complete payment with Face ID or Touch ID.'}
              {payment === 'klarna' && 'Pay in 3 interest-free instalments.'}
              {payment === 'bancontact' && 'You will be redirected to your bank to confirm.'}
              {payment === 'paypal' && 'You will be redirected to PayPal to complete your purchase.'}
            </div>
            <label className="rw-check">
              <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} /> Save my info for next time
            </label>
          </div>
        </div>
        <div className="rw-checkout-summary">
          <h3>Order summary</h3>
          <div className="rw-sum-items">
            {items.map((it) => (
              <div key={it.key} className="rw-sum-line">
                <div className="rw-sum-media">
                  <Photo id={it.id + "-sum"} hue={it.hue} label="" h={52} />
                  {it.qty > 1 && <span className="rw-sum-qty">{it.qty}</span>}
                </div>
                <div className="rw-sum-info">
                  <h4>{it.name}</h4>
                  <span>{it.size}</span>
                </div>
                <span className="rw-sum-price">{money(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="rw-sum-rows">
            <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {promoData?.valid && promoData.type === 'percent' && (
              <div style={{color: 'var(--ink)', fontSize: '13px', fontWeight: 600}}>
                <span>{discountLabel}</span><span>-{money(subtotal - discountPrice)}</span>
              </div>
            )}
            <div><span>Shipping</span><span>{discountShipping === 0 ? (promoData?.valid && promoData.type === 'free_shipping' ? 'Free 🎉' : 'Free') : money(discountShipping)}</span></div>
          </div>
          <div className="rw-sum-total">
            <div><span>Total</span><b>{money(finalTotal)}</b></div>
          </div>
          {payError && (
            <div style={{
              fontSize: '13px', color: 'var(--accent)', marginBottom: '10px',
              padding: '10px 12px', background: 'color-mix(in oklab, var(--accent) 10%, transparent)',
              borderRadius: '8px', lineHeight: '1.4', textAlign: 'center',
            }}>
              {payError}
            </div>
          )}
          <button className="rw-btn rw-btn-pri rw-btn-full" disabled={processing}
            onClick={handlePay}>
            {processing ? <><i className="rw-spinner" /> Processing…</> : `Pay ${money(finalTotal)}`}
          </button>
          <div className="rw-co-trust">
            <Icon name="check" size={13} /> Secured with 256-bit SSL
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Wishlist Signup Modal ---------- */
const POLICY_TEXT = `REWIND Privacy Policy

1. Information We Collect
• Email address (when you create a wishlist or place an order)
• Shipping address and name (when you place an order)
• Payment information is processed securely by Stripe — we never store card details

2. How We Use Your Data
• To manage your wishlist and save your favorite items
• To process and fulfill your orders
• To send order confirmations and shipping updates
• With your consent, to send emails about new drops and exclusive offers

3. Data Storage & Security
• Your data is stored securely in our database
• We use industry-standard encryption for data transmission
• You can request deletion of your data at any time by emailing orders@rewind-stores.com

4. Third-Party Services
• Stripe: Payment processing (view their privacy policy at stripe.com/privacy)
• Supabase: Database hosting
• Resend: Order confirmation emails

5. Your Rights (GDPR)
• Right to access your personal data
• Right to rectification — correct inaccurate data
• Right to erasure — delete your account and data at any time
• Right to restrict processing
• Right to data portability
• To exercise any of these rights, email orders@rewind-stores.com

6. Cookies
• We use essential cookies for cart functionality
• No tracking or advertising cookies are used
• Stripe may set cookies during payment processing

7. Marketing Emails
• You can opt in to marketing emails when creating your wishlist
• You can unsubscribe at any time via the link in any email
• Opting out will not affect your orders or wishlist

8. Contact
• Email: orders@rewind-stores.com
• Response time: within 48 hours

Last updated: July 2026`;

export function SignupModal({ open, onClose, onSignup }) {
  const [email, setEmail] = useState('');
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState('');
  const [showPolicy, setShowPolicy] = useState(false);

  // Reset form fields whenever the modal opens — prevents stale data from a
  // previous session persisting when the user reopens the signup modal.
  useEffect(() => {
    if (open) {
      setEmail('');
      setAgreePolicy(false);
      setAcceptMarketing(false);
      setError('');
      setShowPolicy(false);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!agreePolicy) {
      setError('Please agree to the privacy policy');
      return;
    }
    onSignup({ email: email.trim(), acceptMarketing });
  }

  return (
    <div className="rw-modal-wrap" onClick={onClose}>
      <div className="rw-modal rw-modal--signup" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px', gridTemplateColumns: '1fr' }}>
        <button className="rw-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        {showPolicy ? (
          <div className="rw-modal-info">
            <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Privacy Policy</h2>
            <div style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
              {POLICY_TEXT}
            </div>
            <button className="rw-btn rw-btn-pri rw-btn-full" style={{ marginTop: '20px' }}
              onClick={() => setShowPolicy(false)}>Back</button>
          </div>
        ) : (
          <div className="rw-modal-info">
            <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>Save to wishlist</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              Sign up with your email to save items and come back later.
            </p>
            <form onSubmit={handleSubmit}>
              <input className="rw-input" type="email" placeholder="Your email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ marginBottom: '14px' }} autoFocus />
              <label className="rw-check" style={{ marginBottom: '10px' }}>
                <input type="checkbox" checked={agreePolicy}
                  onChange={(e) => setAgreePolicy(e.target.checked)} />
                <span>I agree to the <button type="button" onClick={() => setShowPolicy(true)}
                  style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--ink)', fontWeight: 600, padding: 0, fontSize: 'inherit' }}>
                  privacy policy</button></span>
              </label>
              <label className="rw-check" style={{ marginBottom: '16px' }}>
                <input type="checkbox" checked={acceptMarketing}
                  onChange={(e) => setAcceptMarketing(e.target.checked)} />
                <span>Email me about new drops & exclusive offers</span>
              </label>
              {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
              <button type="submit" className="rw-btn rw-btn-pri rw-btn-full">
                Sign up & save <Icon name="heart" size={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Wishlist Drawer ---------- */
export function WishlistDrawer({ open, items, customProducts, onClose, onRemove, onAddToCart, onSelect, onCartOpen, showToast }) {
  const allProducts = useMemo(() => [...REWIND_PRODUCTS, ...(customProducts || [])], [customProducts]);
  const wishlistItems = items.map((id) => allProducts.find((p) => p.id === id || p.product_id === id)).filter(Boolean);
  const [selected, setSelected] = useState([]);
  // Track which wishlist item has its inline size picker open (stored as product id)
  const [choosingSize, setChoosingSize] = useState(null);
  // Reset size picker when drawer opens — prevents a stale open picker from a
  // previous session (where the user opened a size picker then closed the drawer
  // without selecting a size) from persisting when the drawer is reopened.
  useEffect(() => {
    if (open) setChoosingSize(null);
  }, [open]);

  // Custom products (from Supabase) use product_id as their key, not id.
  // Always use getId(p) to get the canonical wishlist identifier.
  const getId = (p) => p.id || p.product_id;

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const addSelectedToCart = () => {
    const toAdd = wishlistItems.filter(p => selected.includes(getId(p)));
    if (toAdd.length === 0) return;
    // Single item: open inline size picker instead of silently defaulting size
    if (toAdd.length === 1) {
      setChoosingSize(getId(toAdd[0]));
      setSelected([]);
      return;
    }
    // Multiple items: add all with default sizes but warn explicitly
    if (onAddToCart) {
      toAdd.forEach(p => onAddToCart(p));
      setSelected([]);
      if (onCartOpen) onCartOpen();
      if (showToast) {
        setTimeout(() => showToast(toAdd.length + ' items added — each used the first available size'), 50);
      }
    }
  };

  return (
    <>
      <div className={"rw-scrim" + (open ? " is-on" : "")} onClick={onClose} />
      <div className={"rw-drawer" + (open ? " is-on" : "")} style={{ width: '400px' }}>
        <div className="rw-drawer-head">
          <h3>Wishlist <span>({wishlistItems.length})</span></h3>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        {wishlistItems.length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={selected.length === wishlistItems.length && wishlistItems.length > 0}
              onChange={() => { if (selected.length === wishlistItems.length) { setSelected([]); } else { setSelected(wishlistItems.map(p => getId(p))); } }}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}
              onClick={() => { if (selected.length === wishlistItems.length) { setSelected([]); } else { setSelected(wishlistItems.map(p => getId(p))); } }}>
              {selected.length === wishlistItems.length && wishlistItems.length > 0 ? 'Deselect all' : 'Select all'}
            </span>
          </div>
        )}
        {selected.length > 0 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
            <button className="rw-btn rw-btn-pri" style={{ padding: '8px 14px', fontSize: '13px' }}
              onClick={addSelectedToCart}>
              {`Add ${selected.length} to cart`}
            </button>
            <button style={{ marginLeft: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--line)'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.transform = ''; }}
              onClick={() => setSelected([])}>Cancel</button>
            <button style={{ marginLeft: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--accent)', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}
              onClick={() => {
                const ids = [...selected];
                setSelected([]);
                // Remove immediately — App.jsx shows an undo toast
                onRemove(ids);
              }}>Delete all</button>
          </div>
        )}
        {wishlistItems.length === 0 ? (
          <div className="rw-drawer-empty">
            <Icon name="heart" size={36} />
            <p>Your wishlist is empty</p>
          </div>
        ) : (
          <div className="rw-drawer-items">
            {wishlistItems.map((p) => (
              <div key={p.id || p.product_id} className="rw-line" style={{ alignItems: 'flex-start', paddingTop: '12px' }}>
                <div style={{ paddingTop: '4px' }}>
                  <input type="checkbox" checked={selected.includes(getId(p))}
                    onChange={() => toggleSelect(getId(p))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
                </div>
                <div className="rw-line-media">
                  <Photo id={(p.id || p.product_id) + "-wish"} hue={p.hue} label="" h={74} />
                </div>
                <div className="rw-line-info">
                <div className="rw-line-top">
                  <h4>{p.name}</h4>
                  <button className="rw-line-x" onClick={() => onRemove(getId(p))} aria-label="Remove from wishlist">
                    <Icon name="close" size={15} />
                  </button>
                </div>
                <div className="rw-line-meta">{p.cat}</div>
                <div className="rw-line-bot">
                  <span className="rw-line-price">{money(p.price)}</span>
                  {choosingSize === getId(p) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {p.sizes.map(s => (
                        <button key={s} onClick={() => { if (onAddToCart) onAddToCart(p, s); setChoosingSize(null); if (onCartOpen) onCartOpen(); }}
                          style={{
                            minWidth: '30px', height: '26px', borderRadius: '5px', border: '1px solid var(--line-2)',
                            background: 'var(--surface)', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                            color: 'var(--ink)', transition: 'all 0.1s',
                          }}
                          onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.background = 'var(--ink)'; e.target.style.color = 'var(--surface)'; }}
                          onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; }}>{s}</button>
                      ))}
                      <button onClick={() => setChoosingSize(null)}
                        style={{ width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}
                        onMouseOver={e => e.target.style.color = 'var(--ink)'}
                        onMouseOut={e => e.target.style.color = 'var(--muted)'}>
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  ) : (
                  <button onClick={() => setChoosingSize(prev => prev === getId(p) ? null : getId(p))}
                    aria-label={"Add " + p.name + " to bag"}
                    style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      border: '1.5px solid var(--line-2)', background: 'var(--surface)',
                      cursor: 'pointer', display: 'grid', placeItems: 'center',
                      color: 'var(--ink)', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = 'var(--surface)'; e.target.style.borderColor = 'var(--ink)'; }}
                    onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; e.target.style.borderColor = 'var(--line-2)'; }}>
                    <Icon name="plus" size={14} />
                  </button>
                  )}
                </div>
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```


---
## FILE: server.js (entry point)
```js
// Local development entry point — delegates to api/server.js
// For Vercel deployment, api/server.js is used directly.
import app from './api/server.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));
```


---
## FILE: package.json
```json
{
  "name": "rewind-store",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "node server.js",
    "test": "npx playwright install chromium && npx playwright test tests/comprehensive.spec.js",
    "test:headed": "BROWSER=1 npx playwright test --headed tests/comprehensive.spec.js",
    "test:local": "TEST_URL=http://localhost:3000 npx playwright test tests/comprehensive.spec.js",
    "test:old": "node tests/button-test.js",
    "stress": "python3 stress-test.py"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "@playwright/test": "^1.61.0",
    "@stripe/react-stripe-js": "^6.6.0",
    "@stripe/stripe-js": "^9.8.0",
    "@supabase/supabase-js": "^2.108.2",
    "canvas-confetti": "^1.9.4",
    "express": "^5.2.1",
    "express-rate-limit": "^8.5.2",
    "framer-motion": "^12.42.2",
    "motion": "^12.42.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "resend": "^6.17.1",
    "sharp": "^0.35.3",
    "stripe": "^22.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.2"
  }
}
```


---
## FILE: vite.config.js
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
  },
  server: {
    open: true,
    port: 3000,
  },
});
```


---
## FILE: railway.json
```json
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
```


---
## FILE: .gitignore
```
node_modules/
dist/
.env
*.local
.DS_Store
.vercel
.env*
test-results.json
test-results/
uptime-errors.log
dist/
```


---
## Railway env vars used (names only):
process.env.ADMIN_API_TOKEN
process.env.ADMIN_SECRET_CODE
process.env.ADMIN_SECRET_TOKEN
process.env.BASE_URL
process.env.FROM_EMAIL
process.env.PORT
process.env.RAILWAY_ENV
process.env.REPLY_TO
process.env.RESEND_API_KEY
process.env.STRIPE_SECRET_KEY
process.env.STRIPE_WEBHOOK_SECRET
process.env.SUPABASE_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.SUPABASE_URL
process.env.VERCEL
process.env.VITE_SUPABASE_ANON_KEY
process.env.VITE_SUPABASE_URL
