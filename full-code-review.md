# REWIND — Full Codebase for Review

## Prompt for Claude

```
FULL CODEBASE REVIEW — REWIND vintage streetwear e-commerce store

I've shared a security audit of the admin panel. Now here's the ENTIRE codebase — server, frontend, config, DB layer. 

Give me a full security audit covering:

1. CRITICAL — any exploitable holes I missed (SQL injection, auth bypass, price tampering, data exposure)
2. SERVER-SIDE — CORS, rate limiting, error handling, route-level auth gaps, missing validation
3. CLIENT-SIDE — TDZ bugs, re-render issues, missing error boundaries, bundle size concerns
4. SUPABASE/DB — RLS gaps, anon key exposure, missing indexes, schema risks
5. CONFIG — env vars missing, Railway setup, build misconfigurations
6. DEPLOY — start command, static file serving, health check, restart behavior

Be specific — file names, line numbers, exact fixes. Don't hold back.
```

---

## FILE: api/server.js (full)

import express from 'express';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

app.use(express.static(path.join(__dirname, '..', 'dist')));

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

  const ADMIN_CODE = process.env.ADMIN_SECRET_CODE || '74421';
  if (code.toUpperCase().trim() === ADMIN_CODE.toUpperCase().trim()) {
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
  if (!token || token !== secret) {
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
app.post('/api/get-orders', async (req, res) => {
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

// ── Save order to Supabase ──
app.post('/api/save-order', async (req, res) => {
  const { orderNum, customer_name, email, address, items, total, status } = req.body;
  if (!orderNum) return res.status(400).json({ error: 'No order number' });
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
          status: status || 'pending',
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

// ── Admin: orders ──
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

// ── SPA fallback — serve index.html for any non-API, non-static route ──
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Export for Vercel serverless
export default app;


---
## FILE: src/App.jsx

1:import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
2:import { Banner, Header, Hero, Marquee, Toast, Footer, Icon, Photo } from './components/Shell';
3:import { ProductGrid, QuickView, CartDrawer, Checkout, SignupModal, WishlistDrawer } from './components/Shop';
4:import ClickSpark from './components/ClickSpark';
5:import { TweaksPanel, useTweaks, TweakSection, TweakToggle, TweakColor, TweakRadio } from './components/Tweaks';
6:import { REWIND_PRODUCTS, REWIND_CATS, BRANDS } from './data';
7:import { getWishlist, saveWishlist, signupUser, supabase, getCustomProducts, addCustomProduct, updateCustomProduct, uploadProductImage, saveOrder, getOrders, updateOrderStatus } from './lib/supabase';
8:import SizeGuide from './components/SizeGuide';
9:import InfoModal from './components/InfoModal';
10:import ProductPage from './components/ProductPage';
11:import RecentlyViewed from './components/RecentlyViewed';
12:import { money } from './hooks/useCountdown';
14:const TWEAK_DEFAULTS = {
15:  accent: '#FF4D14',
16:  headingFont: 'Bricolage Grotesque',
17:  showBanner: true,
18:  showCountdown: true,
19:  showCompare: true,
20:  showStock: true,
21:};
23:const VERSION = 'V7.3.1';
25:// Small reusable component — defined outside App() to prevent TDZ issues with
26:// the minifier reordering hoisted function declarations before state variables.
27:function SidebarBtn({ label, isOn, onClick, count }) {
28:  return (
29:    <button className={"rw-sb-btn" + (isOn ? " is-on" : "")} onClick={onClick}>
30:      <span className="rw-sb-label">{label}</span>
31:      {count !== undefined && <span className="rw-sb-count">{count}</span>}
32:    </button>
33:  );
34:}
36:export default function App() {
37:  // showSurvey MUST be the VERY FIRST state var so no TDZ error can occur
38:  // when the scroll-lock useEffect references it.
39:  const [showSurvey, setShowSurvey] = useState(false);
40:  // Ref-based guard against minifier TDZ — effects use showSurveyRef.current
41:  // instead of the raw `showSurvey` state variable so that even if esbuild
42:  // hoists the effect closures, they reference a stable object (ref) rather
43:  // than an uninitialized const binding.
44:  const showSurveyRef = useRef(showSurvey);
45:  useEffect(() => { showSurveyRef.current = showSurvey; }, [showSurvey]);
47:  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
48:  const [cat, setCat] = useState('All');
49:  const [query, setQuery] = useState('');
50:  const [cart, setCart] = useState(() => {
51:    try {
52:      const saved = localStorage.getItem('rw_cart');
53:      return saved ? JSON.parse(saved) : [];
54:    } catch { return []; }
55:  });
56:  // Save cart to localStorage whenever it changes
57:  useEffect(() => {
58:    localStorage.setItem('rw_cart', JSON.stringify(cart));
59:  }, [cart]);
60:  const [drawer, setDrawer] = useState(false);
61:  const [quick, setQuick] = useState(null);
62:  const [showSizes, setShowSizes] = useState(false);
63:  const [checkout, setCheckout] = useState(false);
64:  const [checkoutCount, setCheckoutCount] = useState(0);
65:  const [toast, setToast] = useState(null);
66:  const [infoPage, setInfoPage] = useState(null);
67:  const [promoOpen, setPromoOpen] = useState(false);
68:  const [promoClosing, setPromoClosing] = useState(false);
69:  const [promoCode, setPromoCode] = useState('');
70:  const [promoMsg, setPromoMsg] = useState('');
71:  const [promoLoading, setPromoLoading] = useState(false);
72:  const [brand, setBrand] = useState(null);
73:  const [signupOpen, setSignupOpen] = useState(false);
74:  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('rw_email') || '');
75:  const [wishlist, setWishlist] = useState([]);
76:  const [pendingWishlistId, setPendingWishlistId] = useState(null);
77:  const [wishlistOpen, setWishlistOpen] = useState(false);
78:  const [wishlistReady, setWishlistReady] = useState(false);
79:  const [customProducts, setCustomProducts] = useState([]);
80:  const [selectedProduct, setSelectedProduct] = useState(null);
81:  const [sortBy, setSortBy] = useState(() => {
82:    try {
83:      return localStorage.getItem('rw_sort') || '';
84:    } catch { return ''; }
85:  });
86:  const [orderNumber, setOrderNumber] = useState('');
87:  const [showTweaks, setShowTweaks] = useState(false);
88:  const [recentlyViewed, setRecentlyViewed] = useState(() => {
89:    try {
90:      const stored = localStorage.getItem('rw_recent');
91:      return stored ? JSON.parse(stored) : [];
92:    } catch { return []; }
93:  });
95:// ═══════════════════════════════════════════════════════════
96:// ⚡ TDZ GUARD — ALL callback/effect declarations below this
97:// line MUST reference only variables declared ABOVE this line.
98:// showToast is declared FIRST so every callback can use it.
99:// ═══════════════════════════════════════════════════════════
100:  const toastTimer = useRef(null);
101:  const showToast = useCallback((msg, action, duration = 2400) => {
102:    if (toastTimer.current) clearTimeout(toastTimer.current);
103:    setToast({ msg, k: Date.now(), action });
104:    toastTimer.current = setTimeout(() => setToast((cur) => (cur && cur.k && Date.now() - cur.k >= duration - 100 ? null : cur)), duration);
105:  }, []);
106:  const promoCloseTimerRef = useRef(null);
107:// ── ALL NEW useCallback/useEffect declarations go below ──
108:  // The scroll-lock useEffect (below) references these in its `anyOpen` check.
109:  // Adding a new state AFTER this point will break the site with a TDZ error.
110:  const customProductsRef = useRef(customProducts);
111:  useEffect(() => { customProductsRef.current = customProducts; }, [customProducts]);
112:  const wishlistRef = useRef(wishlist);
113:  useEffect(() => { wishlistRef.current = wishlist; }, [wishlist]);
114:  const recentlyViewedRef = useRef(recentlyViewed);
115:  useEffect(() => { recentlyViewedRef.current = recentlyViewed; }, [recentlyViewed]);
117:  // Load custom products from Supabase & re-check URL hash for direct product links
118:  useEffect(() => {
119:    getCustomProducts().then((prods) => {
120:      if (prods.length) setCustomProducts(prods);
121:      // Re-check the URL hash after custom products load — the hash-change
122:      // handler from the other effect only fires on *changes* to the hash,
123:      // so a direct navigation to #/product/<custom-id> on first page load
124:      // would miss custom products that hadn't loaded from Supabase yet.
125:      if (window.location.hash.startsWith('#/product/')) {
126:        const pid = window.location.hash.replace('#/product/', '');
127:        const allProds = [...REWIND_PRODUCTS, ...prods];
128:        const p = allProds.find(x => (x.id || x.product_id) === pid);
129:        if (p) setSelectedProduct(p);
130:      }
131:    });
132:  }, []);
134:  // Load wishlist from Supabase on mount / email change
135:  useEffect(() => {
136:    if (userEmail) {
137:      getWishlist(userEmail).then((ids) => {
138:        // Merge loaded IDs with any items already in state (e.g. a pending
139:        // wishlist item added by handleSignup during the signup flow, before
140:        // getWishlist resolves). Without merging, the async Supabase response
141:        // overwrites locally-added items and they silently disappear.
142:        setWishlist((prev) => {
143:          if (!ids.length) return prev;
144:          const merged = [...ids];
145:          prev.forEach((id) => {
146:            if (!merged.includes(id)) merged.push(id);
147:          });
148:          return merged;
149:        });
150:        setWishlistReady(true);
151:      });
152:    } else {
153:      // Load from localStorage cache immediately
154:      try {
155:        const cached = JSON.parse(localStorage.getItem('rw_wishlist') || '[]');
156:        if (cached.length) setWishlist(cached);
157:      } catch {}
158:      setWishlistReady(true);
159:    }
160:  }, [userEmail]);
162:  // Persist wishlist to Supabase — only after initial load
163:  useEffect(() => {
164:    if (!wishlistReady) return;
165:    if (userEmail) {
166:      saveWishlist(userEmail, wishlist);
167:    }
168:    localStorage.setItem('rw_wishlist', JSON.stringify(wishlist));
169:  }, [wishlist, userEmail, wishlistReady]);
171:  // Persist email
172:  useEffect(() => { if (userEmail) localStorage.setItem('rw_email', userEmail); }, [userEmail]);
174:  // Persist sort preference to localStorage
175:  useEffect(() => {
176:    if (sortBy) localStorage.setItem('rw_sort', sortBy);
177:    else localStorage.removeItem('rw_sort');
178:  }, [sortBy]);
180:  // Persist recently viewed to localStorage
181:  useEffect(() => {
182:    localStorage.setItem('rw_recent', JSON.stringify(recentlyViewed));
183:  }, [recentlyViewed]);
185:  // Reset brand when category changes
186:  useEffect(() => { setBrand(null); }, [cat]);
188:  // Apply style tweaks to :root
189:  useEffect(() => {
190:    const r = document.documentElement;
191:    r.style.setProperty('--accent', t.accent);
192:    r.style.setProperty('--font-head', `"${t.headingFont}", sans-serif`);
193:  }, [t.accent, t.headingFont]);
195:  // Lock body scroll when any modal/drawer is open
196:  // showSurvey is deliberately excluded from this effect.
197:  // The survey overlay uses pointer-events: none (clicks pass through).
198:  useEffect(() => {
199:    const anyOpen = quick !== null || drawer || checkout || signupOpen || showSizes || infoPage !== null || promoOpen || wishlistOpen;
200:    document.body.style.overflow = anyOpen ? 'hidden' : '';
201:    return () => { document.body.style.overflow = ''; };
202:  }, [quick, drawer, checkout, signupOpen, showSizes, infoPage, promoOpen, wishlistOpen]);
204:  // Mouse-following glow
205:  useEffect(() => {
206:    const glow = document.createElement('div');
207:    glow.style.cssText = `position:fixed;top:0;left:0;width:600px;height:600px;border-radius:50%;pointer-events:none;z-index:9999;background:radial-gradient(circle,color-mix(in oklab, var(--accent) 6%, transparent) 0%,transparent 70%);transform:translate(-50%,-50%);transition:opacity .3s`;
208:    document.body.appendChild(glow);
209:    const onMove = (e) => { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; glow.style.opacity = '1'; };
210:    const onLeave = () => { glow.style.opacity = '0'; };
211:    document.addEventListener('mousemove', onMove);
212:    document.addEventListener('mouseleave', onLeave);
213:    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseleave', onLeave); glow.remove(); };
214:  }, []);
216:  // Close modals/drawers on Escape key
217:  useEffect(() => {
218:    const onKey = (e) => {
219:      if (e.key !== 'Escape') return;
220:      if (promoOpen && !promoClosing) {
221:        setPromoClosing(true);
222:        promoCloseTimerRef.current = setTimeout(() => { setPromoOpen(false); setPromoClosing(false); promoCloseTimerRef.current = null; }, 300);
223:      }
224:      if (quick !== null)    setQuick(null);
225:      if (drawer)           setDrawer(false);
226:      if (checkout)         setCheckout(false);
227:      if (signupOpen)       setSignupOpen(false);
228:      if (showSizes)        setShowSizes(false);
229:      if (infoPage !== null) setInfoPage(null);
230:      if (wishlistOpen)     setWishlistOpen(false);
231:      // Dismiss survey on Escape only when it's actually visible — prevents
232:      // permanently hiding the first-visit survey for new users who press
233:      // Escape to close a modal/popup/drawer before the survey was dismissed.
234:      // NOTE: showSurvey deliberately omitted from deps to prevent the minifier
235:      // from hoisting this effect before showSurvey's state variable is initialized (TDZ bug).
236:      // showSurveyRef is used instead since refs are stable across hoisting.
237:      if (showSurveyRef.current) {
238:        localStorage.setItem('rw_survey_done', '1');
239:        setShowSurvey(false);
240:      }
241:      if (selectedProduct)  { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }
242:    };
243:    window.addEventListener('keydown', onKey);
244:    return () => {
245:      window.removeEventListener('keydown', onKey);
246:      if (promoCloseTimerRef.current) { clearTimeout(promoCloseTimerRef.current); promoCloseTimerRef.current = null; }
247:    };
248:  }, [promoOpen, quick, drawer, checkout, signupOpen, showSizes, infoPage, wishlistOpen, selectedProduct]);
250:  const products = useMemo(() => {
251:    const allProducts = [...REWIND_PRODUCTS, ...customProducts];
252:    return allProducts.filter((p) =>
253:      (cat === 'All' || p.cat === cat) &&
254:      (!brand || p.brand === brand) &&
255:      (query.trim() === '' || (p.name + ' ' + p.cat + ' ' + (p.brand || '') + ' ' + (p.note || '') + ' ' + (p.material || '')).toLowerCase().includes(query.toLowerCase()))
256:    );
257:  }, [cat, brand, query, customProducts]);
259:  // Compute categories that actually have products (including custom products)
260:  // Also appends any categories created via the admin panel's custom-category
261:  // input that aren't already in REWIND_CATS.
262:  const availableCats = useMemo(() => {
263:    const allProds = [...REWIND_PRODUCTS, ...customProducts];
264:    const available = new Set(allProds.map(p => p.cat).filter(Boolean));
265:    const base = REWIND_CATS.filter(c => c === 'All' || available.has(c));
266:    const extras = [...available].filter(c => !REWIND_CATS.includes(c));
267:    return [...base, ...extras];
268:  }, [customProducts]);
270:  const cartCount = cart.reduce((s, it) => s + it.qty, 0);
272:  // ── ALL new state vars for modals/panels MUST go above this line ──
273:  // succession so the final toast Undo restores ALL of them, not just the last.
274:  const pendingRestoreRef = useRef([]);
275:  const restoreTimerRef = useRef(null);
276:  // Buffered undo for wishlist removals — same pattern as cart undo above.
277:  const pendingWishlistRestoreRef = useRef([]);
278:  const wishlistRestoreTimerRef = useRef(null);
279:  // Buffered undo for recently-viewed "Clear" button — saves the full list so
280:  const recentlyViewedBufferRef = useRef([]);
281:  const recentlyViewedTimerRef = useRef(null);
282:  // Scroll position memory — saves the Y offset before opening a product
283:  // detail page so that clicking "Back" restores the user exactly where they
284:  // were in the grid, rather than snapping them to the top of the page.
285:  const scrollPosRef = useRef(0);
286:  // ── ALREADY DECLARED at top of TDZ guard — do not re-declare ──
287:  // Extract RecentlyViewed handlers to eliminate duplication between product-page and shop views
288:  const handleRecentlyViewedSelect = useCallback((p) => {
289:    const pid = p?.id || p?.product_id;
290:    if (p && pid) {
291:      setSelectedProduct(p);
292:    } else if (pid) {
293:      setRecentlyViewed(prev => prev.filter(x => (x.id || x.product_id) !== pid));
294:      showToast('This product is no longer available');
295:    }
296:  }, [showToast]);
298:  const handleRecentlyViewedClear = useCallback(() => {
299:    setRecentlyViewed((prev) => {
300:      // Buffer the ENTIRE list from state (not the child's filtered `items` arg)
301:      // so Undo can restore every item including the current product when the
302:      // user clicks "Clear" from the product detail page.
303:      recentlyViewedBufferRef.current = [...prev];
304:      return [];
305:    });
306:    if (recentlyViewedTimerRef.current) clearTimeout(recentlyViewedTimerRef.current);
307:    recentlyViewedTimerRef.current = setTimeout(() => { recentlyViewedBufferRef.current = []; }, 2800);
308:    showToast('Recently viewed cleared', {
309:      label: 'Undo',
310:      onClick: () => {
311:        setRecentlyViewed((prev) => {
312:          // Only restore items not already present (e.g. if user
313:          // navigated to a new product during the window)
314:          const saved = recentlyViewedBufferRef.current || [];
315:          const merged = [...prev];
316:          saved.forEach((item) => {
317:            const pid = item.id || item.product_id;
318:            if (pid && !merged.find(x => (x.id || x.product_id) === pid)) {
319:              merged.push(item);
320:            }
321:          });
322:          recentlyViewedBufferRef.current = [];
323:          if (recentlyViewedTimerRef.current) clearTimeout(recentlyViewedTimerRef.current);
324:          return merged;
325:        });
326:      },
327:    });
328:  }, [showToast]);
330:  const handleRecentlyViewedRemove = useCallback((pid, name) => {
331:    // Use ref instead of raw recentlyViewed to prevent stale closure;
332:    // follows the same ref pattern as showSurveyRef, customProductsRef, wishlistRef.
333:    const removedItem = recentlyViewedRef.current.find(p => (p.id || p.product_id) === pid);
334:    if (!removedItem) return;
335:    setRecentlyViewed((prev) => prev.filter(p => (p.id || p.product_id) !== pid));
336:    showToast((name || 'Item') + ' removed', {
337:      label: 'Undo',
338:      onClick: () => {
339:        setRecentlyViewed((prev) => {
340:          // Only restore if not already present
341:          if (prev.find(p => (p.id || p.product_id) === pid)) return prev;
342:          return [removedItem, ...prev];
343:        });
344:      },
345:    });
346:  }, [showToast]);
348:  const addToCart = useCallback((p, size, qty = 1) => {
349:    // Guard: don't allow adding out-of-stock items
350:    if (p.stock === 0) {
351:      showToast(p.name + ' is sold out');
352:      return;
353:    }
354:    const sz = size || p.sizes?.[0] || 'One size';
355:    const pid = p.id || p.product_id;
356:    const key = pid + '-' + sz;
357:    setCart((c) => {
358:      const found = c.find((it) => it.key === key);
359:      if (found) return c.map((it) => it.key === key ? { ...it, qty: it.qty + qty } : it);
360:      return [...c, { key, id: pid, name: p.name, price: p.price, was: p.was, hue: p.hue, size: sz, qty: qty }];
361:    });
362:    showToast((qty > 1 ? qty + '× ' : '') + p.name + ' added to bag');
363:  }, [showToast]);
365:  const quickAdd = useCallback((p) => { addToCart(p); setDrawer(true); }, [addToCart]);
366:  const addFromQuick = useCallback((p, size) => { addToCart(p, size); setQuick(null); setDrawer(true); }, [addToCart]);
367:  const changeQty = useCallback((key, d) => { setCart((c) => c.map((it) => it.key === key ? { ...it, qty: Math.max(1, it.qty + d) } : it)); }, []);
368:  const removeItem = useCallback((key, name) => { 
369:    // Capture the removed item so Undo always restores the right data,
370:    // regardless of subsequent cart changes before the user clicks Undo.
371:    const removedItem = cart.find(it => it.key === key);
372:    setCart((c) => c.filter((it) => it.key !== key));
373:    // Accumulate into the pending-restore buffer so rapid removals don't
374:    // silently drop earlier undo actions (showToast replaces the current toast).
375:    if (removedItem) {
376:      pendingRestoreRef.current = [...pendingRestoreRef.current, removedItem];
377:    }
378:    // Clear the buffer when the toast auto-dismisses (slightly after the toast
379:    // duration so there's no race with a user clicking Undo in the final ms).
380:    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
381:    restoreTimerRef.current = setTimeout(() => { pendingRestoreRef.current = []; }, 2600);
382:    const count = pendingRestoreRef.current.length;
383:    const msg = count > 1
384:      ? `${count} items removed`
385:      : (name || 'Item') + ' removed';
386:    showToast(msg, {
387:      label: 'Undo',
388:      onClick: () => {
389:        setCart((c) => {
390:          let next = [...c];
391:          pendingRestoreRef.current.forEach(item => {
392:            if (item && !next.find(i => i.key === item.key)) {
393:              next.push(item);
394:            }
395:          });
396:          pendingRestoreRef.current = [];
397:          if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
398:          return next;
399:        });
400:      },
401:    });
402:  }, [cart, showToast]);
403:  const goCheckout = useCallback(() => { setDrawer(false); setCheckout(true); setCheckoutCount(c => c + 1); setPromoOpen(false); setPromoClosing(false); setOrderNumber(''); }, []);
404:  const orderPlaced = useCallback(() => { setCart([]); setCheckout(false); setOrderNumber(''); }, []);
406:  const handleWishlist = useCallback((p) => {
407:    const pid = p.id || p.product_id;
408:    if (!pid) return;
409:    if (!userEmail) {
410:      setPendingWishlistId(pid);
411:      setSignupOpen(true);
412:      return;
413:    }
414:    // Read current state directly — using wishlistRef (one render behind)
415:    // would show the wrong toast when the user clicks rapidly
416:    // (e.g. double-clicking the heart before the previous state commit).
417:    const alreadyHeld = wishlist.includes(pid);
418:    setWishlist((prev) => {
419:      const exists = prev.includes(pid);
420:      return exists ? prev.filter((id) => id !== pid) : [...prev, pid];
421:    });
422:    // Show toast outside the updater — React StrictMode invokes updaters twice in dev
423:    if (!alreadyHeld) {
424:      showToast(p.name + ' saved', {
425:        label: 'Show',
426:        onClick: () => setWishlistOpen(true),
427:      });
428:    } else {
429:      showToast(p.name + ' removed', {
430:        label: 'Undo',
431:        onClick: () => setWishlist((inner) => inner.includes(pid) ? inner : [...inner, pid]),
432:      });
433:    }
434:  }, [userEmail, showToast, wishlist]);
436:  const handleSignup = useCallback(({ email, acceptMarketing }) => {
437:    setUserEmail(email);
438:    setSignupOpen(false);
439:    signupUser(email, acceptMarketing);
440:    if (pendingWishlistId) {
441:      setWishlist((prev) => prev.includes(pendingWishlistId) ? prev : [...prev, pendingWishlistId]);
442:      // Look up product name for a personalised toast
443:      const allProds = [...REWIND_PRODUCTS, ...customProducts];
444:      const pendingProduct = allProds.find(p => (p.id || p.product_id) === pendingWishlistId);
445:      setPendingWishlistId(null);
446:      showToast((pendingProduct?.name || 'Item') + ' saved', {
447:        label: 'Show',
448:        onClick: () => setWishlistOpen(true),
449:      });
450:    }
451:  }, [pendingWishlistId, showToast, customProducts]);
453:  const applyPromo = useCallback(async () => {
454:    if (!promoCode || promoLoading) return;
455:    setPromoLoading(true);
456:    setPromoMsg('');
457:    try {
458:      const r = await fetch('/api/validate-promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode }) });
459:      const d = await r.json();
460:      if (d.admin) { window.location.hash = 'admin'; }
461:      else { setPromoMsg('✅ Promo applied!'); }
462:    } catch {
463:      setPromoMsg('❌ Network error — try again');
464:    }
465:    setPromoLoading(false);
466:  }, [promoCode, promoLoading]);
468:  const headingId = 'the-drop';
469:  const scrollToGrid = useCallback(() => {
470:    const el = document.getElementById(headingId);
471:    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
472:  }, []);
474:  // Wrap setQuery so that the first keystroke scrolled to the product grid,
475:  // consistent with every other filter method (sidebar, header nav, hero, footer).
476:  const handleQueryChange = useCallback((value) => {
477:    if (value && !query) scrollToGrid();
478:    setQuery(value);
479:  }, [query, scrollToGrid]);
481:  // Count products per category and brand for sidebar badges
482:  const allProducts = useMemo(() => [...REWIND_PRODUCTS, ...customProducts], [customProducts]);
483:  const catCounts = useMemo(() => {
484:    const counts = {};
485:    allProducts.forEach(p => {
486:      if (p.cat) counts[p.cat] = (counts[p.cat] || 0) + 1;
487:    });
488:    counts['All'] = allProducts.length;
489:    return counts;
490:  }, [allProducts]);
491:  const brandCounts = useMemo(() => {
492:    if (cat === 'All') return {};
493:    const counts = {};
494:    allProducts.filter(p => p.cat === cat).forEach(p => {
495:      if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
496:    });
497:    return counts;
498:  }, [allProducts, cat]);
500:  const currentBrands = useMemo(() => {
501:    if (cat === 'All') return [];
502:    const hardcoded = BRANDS[cat] || [];
503:    const actualBrands = Object.keys(brandCounts);
504:    const extras = actualBrands.filter(b => !hardcoded.includes(b));
505:    return [...hardcoded, ...extras];
506:  }, [cat, brandCounts]);
508:  // Reconcile recently viewed with fresh product data when custom products load/update.
509:  // Prevents stale names/prices in the recently viewed mini-cards after editing a
510:  // custom product in the admin panel. The click handler already resolves fresh data,
511:  // but the mini-card display now updates automatically.
512:  useEffect(() => {
513:    if (!allProducts.length || !recentlyViewed.length) return;
514:    setRecentlyViewed((prev) => {
515:      let changed = false;
516:      const updated = prev.map((p) => {
517:        const pid = p.id || p.product_id;
518:        if (!pid) return p;
519:        const fresh = allProducts.find(x => (x.id || x.product_id) === pid);
520:        if (fresh && fresh !== p) { changed = true; return fresh; }
521:        return p;
522:      });
523:      return changed ? updated : prev;
524:    });
525:    // eslint-disable-next-line react-hooks/exhaustive-deps
526:  }, [allProducts]);
528:  // ── Admin mode ──
529:  // Only activate admin mode if the user has a verified admin email saved,
530:  // NOT just because #admin is in the URL (security: prevents full admin
531:  // panel access by anyone who navigates to /#admin).
532:  const [adminMode, setAdminMode] = useState(false);
533:  const [blocked, setBlocked] = useState(false);
535:  // Handle Stripe success redirect — show confirmation view instead of just a toast
536:  useEffect(() => {
537:    const params = new URLSearchParams(window.location.search);
538:    if (params.get('order') === 'success') {
539:      const orderNum = params.get('orderNum');
540:      const msg = orderNum ? `✅ ${orderNum} confirmed!` : '✅ Order confirmed!';
541:      showToast(msg);
542:      setCart([]);
543:      // Keep checkout open and pass the order number so the confirmation view
544:      // (with confetti, copy button, and Continue shopping CTA) is shown.
545:      setOrderNumber(orderNum || '');
546:      setCheckout(true);
547:      window.history.replaceState({}, '', window.location.pathname);
548:    }
549:  }, [showToast]);
550:  
551:  // First-visit questionnaire — moved closer to the other state vars above
552:  
553:  useEffect(() => {
554:    if (!localStorage.getItem('rw_survey_done')) {
555:      setShowSurvey(true);
556:    }
557:    // Check if this user's email is blocked (API path — e.g. blocked_emails table)
558:    const stored = localStorage.getItem('rw_email');
559:    if (stored) {
560:      fetch('/api/check-blocked-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: stored }) })
561:        .then(r => r.json())
562:        .then(d => { if (d.blocked) setBlocked(true); })
563:        .catch(() => {});
564:    }
565:    // Listen for logo click to reset store
566:    const handler = () => { setCat('All'); setBrand(null); setQuery(''); };
567:    window.addEventListener('reset-store', handler);
568:    return () => window.removeEventListener('reset-store', handler);
569:  }, []);
571:  // Auto-dismiss survey when any other modal/drawer or product detail page opens
572:  // — prevents the survey overlay from remaining visible on top of product content.
573:  useEffect(() => {
574:    // Use ref instead of raw showSurvey to prevent minifier TDZ
575:    if (showSurveyRef.current && (signupOpen || quick !== null || drawer || checkout || showSizes || infoPage !== null || promoOpen || wishlistOpen || selectedProduct !== null)) {
576:      localStorage.setItem('rw_survey_done', '1');
577:      setShowSurvey(false);
578:    }
579:  }, [showSurvey, signupOpen, quick, drawer, checkout, showSizes, infoPage, promoOpen, wishlistOpen, selectedProduct]);
581:  // Auto-close promo popup with animation when any drawer/checkout opens
582:  useEffect(() => {
583:    if ((drawer || wishlistOpen || checkout) && promoOpen && !promoClosing) {
584:      setPromoClosing(true);
585:      const tid = setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300);
586:      promoCloseTimerRef.current = tid;
587:      return () => { clearTimeout(tid); if (promoCloseTimerRef.current === tid) promoCloseTimerRef.current = null; };
588:    }
589:  }, [drawer, wishlistOpen, checkout, promoOpen, promoClosing]);
591:  // Auto-dismiss survey when user scrolls down past the hero — prevents
592:  // the survey card from covering the product grid area.
593:  useEffect(() => {
594:    // Use ref instead of raw showSurvey to prevent minifier TDZ
595:    if (!showSurveyRef.current) return;
596:    const onScroll = () => {
597:      if (window.scrollY > 200) {
598:        localStorage.setItem('rw_survey_done', '1');
599:        setShowSurvey(false);
600:      }
601:    };
602:    window.addEventListener('scroll', onScroll, { passive: true });
603:    return () => window.removeEventListener('scroll', onScroll);
604:  }, [showSurvey]);
606:  useEffect(() => {
607:    const onPop = () => {
608:      if (!window.location.hash.startsWith('#/product/')) {
609:        setSelectedProduct(null);
610:      }
611:    };
612:    window.addEventListener('popstate', onPop);
613:    return () => window.removeEventListener('popstate', onPop);
614:  }, []);
616:  // When selectedProduct changes, update the URL hash and scroll to top.
617:  // Saves the grid scroll position before opening a product and restores it
618:  // on return so the user lands exactly where they left off browsing.
619:  useEffect(() => {
620:    if (selectedProduct) {
621:      const id = selectedProduct.id || selectedProduct.product_id;
622:      window.history.pushState({ product: id }, '', '#/product/' + id);
623:      scrollPosRef.current = window.scrollY;
624:      window.scrollTo({ top: 0, behavior: 'smooth' });
625:    } else if (scrollPosRef.current > 0) {
626:      window.scrollTo({ top: scrollPosRef.current, behavior: 'smooth' });
627:    }
628:  }, [selectedProduct]);
630:  // Set document title to product name when viewing a product detail page,
631:  // and restore the default title when returning to the shop.
632:  useEffect(() => {
633:    const DEFAULT_TITLE = 'REWIND — Curated Vintage & Retro Sportswear';
634:    if (selectedProduct) {
635:      document.title = selectedProduct.name + ' — REWIND';
636:    } else {
637:      document.title = DEFAULT_TITLE;
638:    }
639:    return () => { document.title = DEFAULT_TITLE; };
640:  }, [selectedProduct]);
642:  // Track recently viewed products (only full-page views, not quickview)
643:  useEffect(() => {
644:    if (!selectedProduct) return;
645:    const pid = selectedProduct.id || selectedProduct.product_id;
646:    if (!pid) return;
647:    setRecentlyViewed((prev) => {
648:      const filtered = prev.filter((p) => (p.id || p.product_id) !== pid);
649:      return [selectedProduct, ...filtered].slice(0, 5);
650:    });
651:  }, [selectedProduct]);
652:  useEffect(() => {
653:    const onHash = () => {
654:      const isAdminHash = window.location.hash === '#admin';
655:      if (isAdminHash) {
656:        // Show the AdminPanel component — it handles its own auth internally
657:        // via server-verified email check + admin API token.
658:        // The AdminPanel will show a login form until the user authenticates.
659:        setAdminMode(true);
660:      } else if (window.location.hash === '') {
661:        setAdminMode(false);
662:      }
663:      if (window.location.hash.startsWith('#/product/')) {
664:        const pid = window.location.hash.replace('#/product/', '');
665:        const allProds = [...REWIND_PRODUCTS, ...customProductsRef.current];
666:        const p = allProds.find(x => (x.id || x.product_id) === pid);
667:        if (p) setSelectedProduct(p);
668:      }
669:    };
670:    // Handle initial URL hash immediately (direct navigation to #/product/xxx)
671:    onHash();
672:    window.addEventListener('hashchange', onHash);
673:    return () => window.removeEventListener('hashchange', onHash);
674:  }, []);
676:  // Check if current user is blocked
677:  useEffect(() => {
678:    if (!supabase || adminMode) return;
679:    const email = localStorage.getItem('rw_email');
680:    if (!email) return;
681:    supabase.from('wishlists').select('blocked').eq('email', email).single()
682:      .then(({ data }) => {
683:        if (data?.blocked) setBlocked(true);
684:      });
685:  }, [adminMode]);
687:  if (adminMode) return <AdminPanel onExit={() => { window.location.hash = ''; }} onSelect={setSelectedProduct} customProducts={customProducts} setCustomProducts={setCustomProducts} />;
689:  // Blocked screen
690:  if (blocked) {
691:    return (
692:      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '40px', textAlign: 'center' }}>
693:        <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</h1>
694:        <h2 style={{ fontSize: '24px', color: 'var(--ink)', marginBottom: '8px' }}>Access restricted</h2>
695:        <p style={{ fontSize: '16px', color: 'var(--muted)', maxWidth: '400px' }}>This account has been blocked from accessing REWIND. If you think this is a mistake, please contact us.</p>
696:      </div>
697:    );
698:  }
700:  const curPid = selectedProduct?.id || selectedProduct?.product_id;
702:  // Show product detail page instead of shop
703:  const viewContent = selectedProduct ? (
704:    <div className="rw-app" key="product-page">
705:      <Header cat={cat} setCat={(c) => { setCat(c); setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); scrollPosRef.current = 0; scrollToGrid(); }} cartCount={cartCount}
706:        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
707:        onWishlistOpen={() => setWishlistOpen(true)}
708:        query={query} setQuery={handleQueryChange} cats={availableCats} version={VERSION}
709:        onVersionClick={() => setShowTweaks(v => !v)} />
710:      <main className="rw-shop">
711:      <ProductPage key={curPid} p={selectedProduct}
712:        onBack={() => { setSelectedProduct(null); window.history.replaceState({}, '', window.location.pathname); }}
713:        onAdd={(p, size, qty) => { addToCart(p, size, qty); setDrawer(true); }}
714:        onWishlist={handleWishlist}
715:        wishlisted={wishlist.includes(curPid)}
716:        showCompare={t.showCompare}
717:        showStock={t.showStock}
718:        onSizeGuide={() => setShowSizes(true)} />
720:      {/* ── Recently viewed (on product page, excluding current product) ── */}
721:      <RecentlyViewed
722:        items={recentlyViewed.filter(p => (p.id || p.product_id) !== curPid)}
723:        allProducts={allProducts}
724:        onSelect={handleRecentlyViewedSelect}
725:        onClear={handleRecentlyViewedClear}
726:        onRemoveItem={handleRecentlyViewedRemove}
727:        showToast={showToast}
728:      />
729:      </main>
730:      <Footer onSizes={() => setShowSizes(true)} onInfo={(p) => setInfoPage(p)} onSetCat={(c) => { setCat(c); scrollToGrid(); }} />
731:    </div>
732:  ) : (
733:    <div className="rw-app" key="shop">
734:      {t.showBanner && <Banner showCountdown={t.showCountdown} />}
735:      <Header cat={cat} setCat={(c) => { setCat(c); scrollToGrid(); }} cartCount={cartCount}
736:        onCart={() => setDrawer(true)} wishlistCount={wishlist.length}
737:        onWishlistOpen={() => setWishlistOpen(true)}
738:        query={query} setQuery={handleQueryChange} cats={availableCats} version={VERSION}
739:        onVersionClick={() => setShowTweaks(v => !v)} />
740:      <Hero onShop={(filterCat) => { setCat(filterCat || 'All'); scrollToGrid(); }} />
741:      <Marquee />
743:      <main className="rw-shop">
744:        <div className="rw-shop-head" id={headingId}>
745:          <div className="rw-shop-headl">
746:            <h2 className="rw-shop-title">{cat === 'All' ? 'The drop' : cat}</h2>
747:            <p className="rw-shop-sub">{products.length} piece{products.length !== 1 ? 's' : ''} · one of each</p>
748:          </div>
749:        </div>
751:        <div className="rw-shop-layout">
752:          <aside id="rw-sidebar" style={{
753:            width: '200px',
754:            flexShrink: 0,
755:            background: 'var(--bg)',
756:            borderRadius: '12px',
757:            padding: '20px 16px',
758:            position: 'sticky',
759:            top: '20px',
760:            alignSelf: 'flex-start',
761:          }}>
762:            <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Categories</h3>
763:            {availableCats.map((c) => (
764:              <SidebarBtn key={c} label={c === 'All' ? 'All' : c} count={catCounts[c] || 0} isOn={cat === c} onClick={() => { setCat(c); scrollToGrid(); }} />
765:            ))}
767:            {cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand) && (
768:              <>
769:                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Brands</h3>
770:                <SidebarBtn label="All" isOn={!brand} count={catCounts[cat] || 0} onClick={() => { setBrand(null); scrollToGrid(); }} />
771:                {currentBrands.map((b) => (
772:                  <SidebarBtn key={b} label={b} isOn={brand === b} count={brandCounts[b] || 0} onClick={() => { setBrand(b); scrollToGrid(); }} />
773:                ))}
774:              </>
775:            )}
776:          </aside>
777:          <div className="rw-shop-content">
778:            {products.length > 0 && (
779:            <>
780:            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand)) ? '8px' : '16px', gap: '10px', flexWrap: 'wrap' }}>
781:              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1 1 auto' }}>
782:              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
783:                aria-label="Sort products"
784:                className="rw-sort">
785:                <option value="">Featured</option>
786:                <option value="name-asc">Name: A → Z</option>
787:                <option value="name-desc">Name: Z → A</option>
788:                <option value="price-asc">Price: Low → High</option>
789:                <option value="price-desc">Price: High → Low</option>
790:              </select>
791:              <select id="rw-mobile-cat" value={cat} onChange={e => { setCat(e.target.value); scrollToGrid(); }}
792:                aria-label="Select category"
793:                className="rw-sort">
794:                {availableCats.map((c) => (
795:                  <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>
796:                ))}
797:              </select>
798:              </div>
799:              {(cat !== 'All' || brand !== null || query !== '' || sortBy !== '') && (
800:                <button onClick={() => { setQuery(''); setCat('All'); setBrand(null); setSortBy(''); scrollToGrid(); }}
801:                  aria-label="Clear all filters"
802:                  className="rw-txt-btn"
803:                  style={{ fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
804:                  ✕ Clear all
805:                </button>
806:              )}
807:            </div>
808:            {cat !== 'All' && currentBrands.length > 0 && allProducts.some(p => p.cat === cat && p.brand) && (
809:              <select className="rw-sort rw-mobile-brand" value={brand || ''} onChange={e => { setBrand(e.target.value || null); scrollToGrid(); }}
810:                aria-label="Filter by brand"
811:                style={{ width: '100%', marginBottom: '16px' }}>
812:                <option value="">All brands</option>
813:                {currentBrands.map(b => (
814:                  <option key={b} value={b}>{b} ({brandCounts[b] || 0})</option>
815:                ))}
816:              </select>
817:            )}
818:            </>
819:            )}
820:            <ProductGrid products={products} sort={sortBy} query={query} showCompare={t.showCompare} showStock={t.showStock}
821:              onQuick={setQuick} onAdd={quickAdd}
822:              wishlist={wishlist} onWishlist={handleWishlist} onSelect={setSelectedProduct}
823:              activeCat={cat} activeBrand={brand}
824:              onCart={() => setDrawer(true)}
825:              onClearSearch={() => { setQuery(''); setCat('All'); setBrand(null); setSortBy(''); scrollToGrid(); }} />
826:          </div>
827:        </div>
829:        {/* ── Recently viewed ── */}
830:        <RecentlyViewed
831:          items={recentlyViewed}
832:          allProducts={allProducts}
833:          onSelect={handleRecentlyViewedSelect}
834:          onClear={handleRecentlyViewedClear}
835:          onRemoveItem={handleRecentlyViewedRemove}
836:          showToast={showToast}
837:        />
838:      </main>
840:      <Footer onSizes={() => setShowSizes(true)} onInfo={(p) => setInfoPage(p)} onSetCat={(c) => { setCat(c); scrollToGrid(); }} />
841:    </div>
842:  );
844:  return (
845:    <ClickSpark sparkColor="#FF4D14" sparkSize={8} sparkRadius={16} sparkCount={10}>
846:      {viewContent}
848:      {/* ── Shared overlays (rendered in BOTH product page view AND shop view) ── */}
849:      {/* These must stay here so header cart/wishlist icons work on the product detail page. */}
850:      {showSizes && <SizeGuide onClose={() => setShowSizes(false)} />}
851:      {infoPage && <InfoModal page={infoPage} onClose={() => setInfoPage(null)} />}
853:      <QuickView p={quick} showCompare={t.showCompare} showStock={t.showStock}
854:        onClose={() => setQuick(null)} onAdd={addFromQuick} />
855:      <CartDrawer open={drawer} items={cart} onClose={() => setDrawer(false)}
856:        onQty={changeQty} onRemove={removeItem} onCheckout={goCheckout} />
857:      <Checkout key={checkoutCount} open={checkout} items={cart} onClose={() => setCheckout(false)} onPlaced={orderPlaced} userEmail={userEmail} showToast={showToast} orderNumber={orderNumber} />
858:      <Toast toast={toast} onDismiss={() => setToast(null)} />
859:      <SignupModal open={signupOpen} onClose={() => { setSignupOpen(false); setPendingWishlistId(null); }} onSignup={handleSignup} />
860:      <WishlistDrawer open={wishlistOpen} items={wishlist} customProducts={customProducts}
861:        onClose={() => setWishlistOpen(false)}
862:        onRemove={(ids) => {
863:          const removeIds = Array.isArray(ids) ? ids : [ids];
864:          pendingWishlistRestoreRef.current = [...pendingWishlistRestoreRef.current, ...removeIds];
865:          setWishlist((prev) => prev.filter((i) => !removeIds.includes(i)));
866:          if (wishlistRestoreTimerRef.current) clearTimeout(wishlistRestoreTimerRef.current);
867:          wishlistRestoreTimerRef.current = setTimeout(() => { pendingWishlistRestoreRef.current = []; }, 2600);
868:          const count = pendingWishlistRestoreRef.current.length;
869:          showToast(count > 1 ? `${count} items removed` : 'Item removed', {
870:            label: 'Undo',
871:            onClick: () => {
872:              setWishlist((prev) => {
873:                const toRestore = pendingWishlistRestoreRef.current.filter(id => !prev.includes(id));
874:                pendingWishlistRestoreRef.current = [];
875:                if (wishlistRestoreTimerRef.current) clearTimeout(wishlistRestoreTimerRef.current);
876:                return [...prev, ...toRestore];
877:              });
878:            },
879:          });
880:        }}
881:        onAddToCart={(p, size) => { addToCart(p, size); }}
882:        onSelect={(p) => { setSelectedProduct(p); setWishlistOpen(false); }}
883:        onCartOpen={() => { setWishlistOpen(false); setDrawer(true); }}
884:        showToast={showToast} />
886:      {showSurvey && selectedProduct === null && !signupOpen && quick === null && !drawer && !checkout && !showSizes && infoPage === null && !promoOpen && !wishlistOpen && (
887:        <div className="rw-survey-overlay" onClick={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }}>
888:          <div className="rw-survey-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '100%', padding: '32px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--r)', position: 'relative', boxShadow: '0 30px 80px -20px rgba(22,19,15,.5)' }}>
889:            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Welcome to REWIND 👋</h2>
890:            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Where did you hear about us?</p>
891:            <Survey onDone={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} onSkip={() => { localStorage.setItem('rw_survey_done', '1'); setShowSurvey(false); }} />
892:          </div>
893:        </div>
894:      )}
896:      {/* ── Promo code button ── */}
897:      {!drawer && !wishlistOpen && !checkout && (
898:      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
899:        <button onClick={() => { if (promoOpen) { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); } else { setPromoOpen(true); setPromoCode(''); setPromoMsg(''); } }}
900:          aria-label="Promo code"
901:          style={{
902:            width: '44px', height: '44px', borderRadius: '50%',
903:            background: 'var(--ink)', color: '#fff', border: 'none',
904:            cursor: 'pointer', fontSize: '18px', fontWeight: 700,
905:            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
906:            transition: 'transform 0.15s',
907:          }}
908:          onMouseOver={e => e.target.style.transform = 'scale(1.1)'}
909:          onMouseOut={e => e.target.style.transform = ''}>
910:          💬
911:        </button>
912:      </div>
913:      )}
915:      {(promoOpen || promoClosing) && (
916:        <div onClick={() => { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); }}
917:          style={{
918:            position: 'fixed', inset: 0, zIndex: 100,
919:            animation: promoClosing ? 'fadeOut 0.25s ease forwards' : 'fadeIn 0.15s ease',
920:          }}>
921:          <div onClick={e => { e.stopPropagation(); }}
922:            style={{
923:              pointerEvents: 'auto',
924:              position: 'fixed', bottom: '80px', right: '24px',
925:              background: 'var(--surface)', borderRadius: '14px', padding: '24px',
926:              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
927:              width: '280px', zIndex: 1001,
928:              animation: promoClosing ? 'genieDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'genieUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
929:              transformOrigin: 'bottom right',
930:            }}>
931:            <button onClick={() => { setPromoClosing(true); setTimeout(() => { setPromoOpen(false); setPromoClosing(false); }, 300); }}
932:              className="rw-modal-x"
933:              style={{
934:                position: 'absolute', top: '10px', right: '10px',
935:                width: '28px', height: '28px',
936:                background: 'color-mix(in oklab, var(--surface) 85%, transparent)', backdropFilter: 'blur(6px)',
937:              }}
938:              aria-label="Close">
939:              <Icon name="close" size={16} />
940:            </button>
941:            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Got a code?</div>
942:            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--muted)' }}>Enter it below and get a discount.</p>
943:            <input className="rw-input" placeholder="Enter code" value={promoCode}
944:              onChange={e => { setPromoCode(e.target.value); setPromoMsg(''); }}
945:              onKeyDown={e => { if (e.key === 'Enter') applyPromo(); }}
946:              disabled={promoLoading}
947:              style={{ marginBottom: '8px' }} />
948:            <button onClick={applyPromo} disabled={promoLoading}
949:              style={{
950:                padding: '8px 20px', borderRadius: '999px',
951:                background: promoLoading ? 'var(--line-2)' : 'var(--ink)',
952:                color: '#fff', border: 'none', cursor: promoLoading ? 'default' : 'pointer',
953:                fontSize: '13px', fontWeight: 600, transition: 'background 0.15s, transform 0.15s, opacity 0.15s',
954:              }}
955:              onMouseOver={e => { if (!promoLoading) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
956:              onMouseOut={e => { if (!promoLoading) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
957:              {promoLoading ? '⏳ Applying…' : 'Apply'}
958:            </button>
959:            {promoMsg && <p style={{ fontSize: '12px', marginTop: '8px', color: 'var(--accent)' }}>{promoMsg}</p>}
960:          </div>
961:        </div>
962:      )}
964:      {(showTweaks || window.location.search.includes('tweaks')) && <TweaksPanel>
965:        <TweakSection label="Urgency & social proof" />
966:        <TweakToggle label="Announcement bar" value={t.showBanner} onChange={(v) => setTweak('showBanner', v)} />
967:        <TweakToggle label="Live sale countdown" value={t.showCountdown} onChange={(v) => setTweak('showCountdown', v)} />
968:        <TweakToggle label='"Was" pricing & % off' value={t.showCompare} onChange={(v) => setTweak('showCompare', v)} />
969:        <TweakToggle label="Low-stock badges" value={t.showStock} onChange={(v) => setTweak('showStock', v)} />
970:        <TweakSection label="Look" />
971:        <TweakColor label="Accent" value={t.accent}
972:          options={['#FF4D14', '#2E5BFF', '#E11D74', '#0E9F6E']}
973:          onChange={(v) => setTweak('accent', v)} />
974:        <TweakRadio label="Headline font" value={t.headingFont}
975:          options={['Bricolage Grotesque', 'Space Grotesk']}
976:          onChange={(v) => setTweak('headingFont', v)} />
977:      </TweaksPanel>}
978:    </ClickSpark>
979:  );
980:}
982:/* ══════════════════════════════════════════════
983:   ADMIN PANEL — accessible at /#admin
984:   ══════════════════════════════════════════════ */
985:function AdminPanel({ onExit, onSelect, customProducts, setCustomProducts }) {
986:  const [users, setUsers] = useState([]);
987:  const [loading, setLoading] = useState(true);
988:  const [selectedUser, setSelectedUser] = useState(null);
989:  const [emailText, setEmailText] = useState('');
990:  const [productSearch, setProductSearch] = useState('');
991:  const [adminTab, setAdminTab] = useState('users');
992:  const [editProduct, setEditProduct] = useState(null); // direct product for editing
993:  const [adminEmail, setAdminEmail] = useState('');
994:  const [adminToken, setAdminToken] = useState('');
995:  const [showToken, setShowToken] = useState(false);
996:  const [adminAuthed, setAdminAuthed] = useState(false);
997:  const [adminChecking, setAdminChecking] = useState(true);
998:  const [orders, setOrders] = useState([]);
999:  const [adminMsg, setAdminMsg] = useState('');
1000:  const [savedVersion, setSavedVersion] = useState(0);
1002:  // Separated admin auth check from data loading so that expensive Supabase
1003:  // queries (users, custom products, orders) only fire after authentication
1004:  // is confirmed — prevents unnecessary API calls and potential data exposure
1005:  // when non-admin visitors land on #admin.
1006:  useEffect(() => {
1007:    if (!supabase) {
1008:      setLoading(false);
1009:      setAdminChecking(false);
1010:      return;
1011:    }
1012:    const saved = localStorage.getItem('rw_admin_email');
1013:    if (saved) {
1014:      setAdminEmail(saved);
1015:      // Verify via server endpoint — NOT direct Supabase query with anon key
1016:      fetch('/api/verify-admin', {
1017:        method: 'POST',
1018:        headers: { 'Content-Type': 'application/json' },
1019:        body: JSON.stringify({ email: saved, token: localStorage.getItem('rw_admin_token') })
1020:      }).then(r => r.json()).then(d => {
1021:        if (d.verified) setAdminAuthed(true);
1022:        setAdminChecking(false);
1023:      }).catch(() => setAdminChecking(false));
1024:    } else {
1025:      setAdminChecking(false);
1026:    }
1027:  }, []);
1029:  // Only load users, orders, and custom products after admin auth is confirmed
1030:  useEffect(() => {
1031:    if (!adminAuthed || !supabase) return;
1032:    supabase.from('wishlists').select('*').order('created_at', { ascending: false })
1033:      .then(({ data, error }) => {
1034:        if (!error && data) setUsers(data);
1035:        setLoading(false);
1036:      })
1037:      .catch(() => setLoading(false));
1038:    getCustomProducts().then(setCustomProducts).catch(() => {});
1039:    getOrders().then(setOrders).catch(() => {});
1040:  }, [adminAuthed]);
1042:  // Check if we were directed here to edit a specific product (from QuickView or ProductPage "Edit" button)
1043:  useEffect(() => {
1044:    const editId = localStorage.getItem('rw_edit_product');
1045:    if (editId) {
1046:      localStorage.removeItem('rw_edit_product');
1047:      const allProds = [...REWIND_PRODUCTS, ...customProducts];
1048:      const found = allProds.find(p => (p.id || p.product_id) === editId);
1049:      if (found) {
1050:        setEditProduct(found);
1051:        setAdminTab('edit');
1052:      }
1053:    }
1054:  }, [customProducts]);
1056:  async function toggleBlockUser(email, blocked) {
1057:    const msg = blocked ? 'Block this user from the store?' : 'Unblock this user?';
1058:    if (!window.confirm(msg)) return;
1059:    try {
1060:      if (blocked) {
1061:        await fetch('/api/admin/block-email', {
1062:          method: 'POST',
1063:          headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
1064:          body: JSON.stringify({ email })
1065:        });
1066:      } else {
1067:        await fetch('/api/admin/unblock-email', {
1068:          method: 'POST',
1069:          headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
1070:          body: JSON.stringify({ email })
1071:        });
1072:      }
1073:    } catch {}
1074:    // Optimistic UI update — reload data from server
1075:    setUsers(prev => prev.map(u => u.email === email ? { ...u, blocked } : u));
1076:  }
1078:  // Stats
1079:  const totalFavs = users.reduce((s, u) => s + (u.product_ids?.length || 0), 0);
1081:  const allEmails = users.map((u) => u.email).join(', ');
1082:  const marketingEmails = users.filter((u) => u.marketing_optin).map((u) => u.email).join(', ');
1084:  return (
1085:    <div style={{ padding: '40px 24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
1086:      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
1087:        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>REWIND Admin</h1>
1088:        <button onClick={onExit}
1089:          style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: 'var(--ink)', transition: 'all 0.15s' }}
1090:          onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.transform = 'translateY(-1px)'; }}
1091:          onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; }}>
1092:          ← Back to store
1093:        </button>
1094:      </div>
1095:      <div style={{ position: 'absolute', top: '44px', right: '24px', fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>{VERSION}</div>
1097:      {/* ── Admin login ── */}
1098:      {adminChecking && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Checking access...</p>}
1100:      {!adminChecking && !adminAuthed && (
1101:        <div style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center' }}>
1102:          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>🔐 Admin Access</h2>
1103:        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Enter your admin email and secret token.</p>
1104:        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
1105:          <input className="rw-input" placeholder="your@email.com" value={adminEmail}
1106:            onChange={e => setAdminEmail(e.target.value)}
1107:            onKeyDown={e => { if (e.key === 'Enter') { document.getElementById('rw-admin-verify-btn')?.click(); } }}
1108:            style={{ flex: 1 }} />
1109:            {localStorage.getItem('rw_admin_email') && (
1110:              <button onClick={() => {
1111:                localStorage.removeItem('rw_admin_email');
1112:                localStorage.removeItem('rw_admin_saved');
1113:                localStorage.removeItem('rw_admin_token');
1114:                setAdminEmail('');
1115:                setAdminMsg('✅ Stored email cleared');
1116:              }}
1117:                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
1118:                onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.color = 'var(--ink)'; }}
1119:                onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.color = 'var(--muted)'; }}
1120:                title="Clear saved email and try again">
1121:                ✕ Clear stored
1122:              </button>
1123:            )}
1124:          </div>
1125:          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
1126:            <input className="rw-input" type={showToken ? 'text' : 'password'} placeholder="Admin secret token" value={adminToken}
1127:              onChange={e => setAdminToken(e.target.value)}
1128:              onKeyDown={e => { if (e.key === 'Enter') { document.getElementById('rw-admin-verify-btn')?.click(); } }}
1129:              style={{ flex: 1, marginBottom: 0 }} />
1130:            <button onClick={() => setShowToken(!showToken)}
1131:              type="button"
1132:              aria-label={showToken ? 'Hide token' : 'Show token'}
1133:              style={{
1134:                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line-2)',
1135:                background: 'var(--surface)', cursor: 'pointer', fontSize: '15px', lineHeight: 1,
1136:                color: showToken ? 'var(--accent)' : 'var(--muted)',
1137:                transition: 'all 0.15s', flexShrink: 0,
1138:              }}
1139:              onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; }}
1140:              onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; }}>
1141:              {showToken ? (
1142:                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
1143:                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
1144:                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
1145:                  <line x1="1" y1="1" x2="23" y2="23"/>
1146:                </svg>
1147:              ) : (
1148:                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
1149:                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
1150:                  <circle cx="12" cy="12" r="3"/>
1151:                </svg>
1152:              )}
1153:            </button>
1154:          </div>
1155:          <button id="rw-admin-verify-btn" onClick={async () => {
1156:            if (!adminEmail) return;
1157:            if (!adminToken) { setAdminMsg('❌ Please enter your admin secret token.'); return; }
1158:            setAdminMsg('');
1159:            try {
1160:              const r = await fetch('/api/verify-admin', {
1161:                method: 'POST',
1162:                headers: { 'Content-Type': 'application/json' },
1163:                body: JSON.stringify({ email: adminEmail, token: adminToken })
1164:              });
1165:              const d = await r.json();
1166:              if (d.verified) {
1167:                localStorage.setItem('rw_admin_email', adminEmail);
1168:                localStorage.setItem('rw_admin_token', adminToken);
1169:                setAdminAuthed(true);
1170:              } else {
1171:                setAdminMsg('❌ Access denied. This email is not on the admin list.');
1172:              }
1173:            } catch {
1174:              setAdminMsg('❌ Could not verify — try again');
1175:            }
1176:          }}
1177:            style={{ padding: '10px 24px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
1178:            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
1179:            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
1180:            Enter admin panel
1181:          </button>
1182:          <p style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '8px' }}>{adminMsg}</p>
1183:        </div>
1184:      )}
1186:      {adminAuthed && (<>
1187:      {/* ── Tab navigation ── */}
1188:      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
1189:        {[
1190:          { id: 'users', label: '📊 Users' },
1191:          { id: 'email', label: '📧 Email' },
1192:          { id: 'orders', label: '📦 Orders' },
1193:          { id: 'saved', label: '⭐ Saved' },
1194:          { id: 'blocked', label: '🚫 Blocked' },
1195:          { id: 'products', label: '🛍️ Products' },
1196:          { id: 'edit', label: editProduct ? '✏️ ' + editProduct.name : null },
1197:        ].filter(t => t.label).map((t) => (
1198:          <button key={t.id} onClick={() => setAdminTab(t.id)}
1199:            style={{
1200:              padding: '10px 20px', borderRadius: '999px', border: 'none',
1201:              background: adminTab === t.id ? 'var(--ink)' : 'var(--line)',
1202:              color: adminTab === t.id ? 'var(--surface)' : 'var(--ink)',
1203:              cursor: 'pointer', fontWeight: 600, fontSize: '14px',
1204:              transition: 'all 0.15s',
1205:            }}
1206:            onMouseOver={e => { if (adminTab !== t.id) { e.target.style.background = 'var(--line-2)'; e.target.style.transform = 'translateY(-1px)'; } }}
1207:            onMouseOut={e => { if (adminTab !== t.id) { e.target.style.background = 'var(--line)'; e.target.style.transform = ''; } }}>
1208:            {t.label}
1209:          </button>
1210:        ))}
1211:      </div>
1213:      {!supabase && (
1214:        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', background: 'var(--line)', borderRadius: '12px' }}>
1215:          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Supabase not connected</p>
1216:          <p style={{ fontSize: '14px' }}>Set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then redeploy.</p>
1217:        </div>
1218:      )}
1220:      {supabase && loading && <p>Loading users...</p>}
1222:      {supabase && !loading && users.length === 0 && (
1223:        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
1224:          <p>No users signed up yet. Sign up on the storefront to see data here.</p>
1225:        </div>
1226:      )}
1228:      {supabase && !loading && users.length > 0 && adminTab === 'users' && (
1229:        <>
1230:          {/* ── User table ── */}
1231:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
1232:            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
1233:              <thead>
1234:                <tr style={{ background: 'var(--line)', textAlign: 'left' }}>
1235:                  <th style={{ padding: '12px 16px' }}>Email</th>
1236:                  <th style={{ padding: '12px 16px' }}>Wishlist</th>
1237:                  <th style={{ padding: '12px 16px' }}>Marketing</th>
1238:                  <th style={{ padding: '12px 16px' }}>Signed up</th>
1239:                  <th style={{ padding: '12px 16px' }}></th>
1240:                </tr>
1241:              </thead>
1242:              <tbody>
1243:                {users.map((u) => (
1244:                  <tr key={u.email} style={{ borderTop: '1px solid var(--line)', background: u.blocked ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent' }}
1245:                    onContextMenu={(e) => {
1246:                      e.preventDefault();
1247:                      setSelectedUser(selectedUser?.email === u.email ? null : u);
1248:                    }}>
1249:                    <td style={{ padding: '12px 16px', fontWeight: 600, cursor: 'context-menu' }}>
1250:                      {u.email} {u.blocked && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>🚫</span>}
1251:                    </td>
1252:                    <td style={{ padding: '12px 16px' }}>
1253:                      {u.product_ids?.length || 0} items
1254:                      {u.product_ids?.length > 0 && (
1255:                        <button onClick={() => setSelectedUser(selectedUser?.email === u.email ? null : u)}
1256:                          style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px' }}>
1257:                          {selectedUser?.email === u.email ? 'Hide' : 'View'}
1258:                        </button>
1259:                      )}
1260:                    </td>
1261:                    <td style={{ padding: '12px 16px' }}>{u.marketing_optin ? '✅' : '—'}</td>
1262:                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '13px' }}>
1263:                      {new Date(u.created_at).toLocaleDateString()}
1264:                    </td>
1265:                    <td style={{ padding: '12px 16px' }}>
1266:                      <a href={`mailto:${u.email}`} style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '16px' }}>✉️</a>
1267:                      <button onClick={() => toggleBlockUser(u.email, !u.blocked)}
1268:                        style={{
1269:                          marginLeft: '8px',
1270:                          padding: '8px 16px',
1271:                          borderRadius: '8px',
1272:                          border: 'none',
1273:                          background: u.blocked ? 'color-mix(in oklab, var(--accent) 30%, transparent)' : 'var(--accent)',
1274:                          color: 'var(--surface)',
1275:                          cursor: 'pointer',
1276:                          fontSize: '13px',
1277:                          fontWeight: 700,
1278:                          transition: 'transform 0.15s, box-shadow 0.15s',
1279:                        }}
1280:                        onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)'; }}
1281:                        onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
1282:                        {u.blocked ? '✅ Unblock' : '🚫 Block'}
1283:                      </button>
1284:                    </td>
1285:                  </tr>
1286:                ))}
1287:              </tbody>
1288:            </table>
1289:          </div>
1291:          {/* ── Selected user's wishlist ── */}
1292:          {selectedUser && (
1293:            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
1294:              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
1295:                {selectedUser.email}'s wishlist
1296:              </h3>
1297:              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
1298:                {selectedUser.product_ids?.map((pid) => {
1299:                  const product = [...REWIND_PRODUCTS, ...customProducts].find((p) => p.id === pid || p.product_id === pid);
1300:                  return (
1301:                    <a key={pid} href="#"
1302:                      onClick={(e) => { e.preventDefault(); window.location.hash = ''; onSelect(product); }}
1303:                      style={{ padding: '6px 12px', background: 'var(--line)', borderRadius: '6px', fontSize: '13px', textDecoration: 'none', color: 'var(--ink)', display: 'inline-block', cursor: 'pointer', transition: 'background 0.15s' }}
1304:                      onMouseOver={e => e.target.style.background = 'var(--line-2)'}
1305:                      onMouseOut={e => e.target.style.background = 'var(--line)'}
1306:                      title={`${product?.name || pid} — ${product?.brand || 'no brand'} — ${product?.cat || ''}`}>
1307:                      {product?.name || pid} {product ? `— ${product.cat}` : ''}
1308:                    </a>
1309:                  );
1310:                })}
1311:              </div>
1312:            </div>
1313:          )}
1315:          {/* ── Stats ── */}
1316:          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
1317:            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
1318:              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.length}</div>
1319:              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total users</div>
1320:            </div>
1321:            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
1322:              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.filter(u => u.marketing_optin).length}</div>
1323:              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Marketing opt-in</div>
1324:            </div>
1325:            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
1326:              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.reduce((s, u) => s + (u.product_ids?.length || 0), 0)}</div>
1327:              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Saved items</div>
1328:            </div>
1329:          </div>
1331:          {/* ── Admin manager ── */}
1332:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
1333:            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🔑 Admin management</h3>
1334:            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
1335:              <input placeholder="Email to add as admin" id="new-admin-email"
1336:                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px' }} />
1337:              <button onClick={async () => {
1338:                const input = document.getElementById('new-admin-email');
1339:                const email = input.value.trim();
1340:                if (!email) return;
1341:                const r = await fetch('/api/manage-admins', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ action: 'add', email, adminEmail }) });
1342:                const d = await r.json();
1343:                alert(d.ok ? `✅ ${email} added as admin` : `❌ ${d.error}`);
1344:                if (d.ok) input.value = '';
1345:              }}
1346:                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}
1347:                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
1348:                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
1349:                Add admin
1350:              </button>
1351:            </div>
1352:            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
1353:              Enter a team member's email above to grant them admin access
1354:            </div>
1355:          </div>
1357:          {/* ── Run Tests ── */}
1358:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
1359:            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🧪 Automated tests</h3>
1360:            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
1361:              Tests every button and page on the site using Playwright browser automation.
1362:            </p>
1363:            <button onClick={async () => {
1364:              const btn = document.activeElement;
1365:              btn.textContent = '🔄 Running tests...';
1366:              btn.disabled = true;
1367:              try {
1368:                const r = await fetch('/api/run-tests', {
1369:                  headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') }
1370:                });
1371:                const d = await r.json();
1372:                if (d.error) throw new Error(d.error);
1373:                btn.textContent = `✅ ${d.passed}/${d.total} passed`;
1374:                // Show results inline
1375:                const resultsDiv = document.getElementById('test-results');
1376:                if (resultsDiv) {
1377:                  resultsDiv.innerHTML = d.results.map(r =>
1378:                    `<div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
1379:                      <span>${r.status}</span>
1380:                      <span style="font-weight:600;margin:0 8px">${r.name}</span>
1381:                      <span style="color:var(--muted);font-size:12px">${r.detail}</span>
1382:                    </div>`
1383:                  ).join('');
1384:                }
1385:              } catch (e) {
1386:                btn.textContent = '❌ Tests failed';
1387:              }
1388:              setTimeout(() => { btn.textContent = '🧪 Run tests'; btn.disabled = false; }, 5000);
1389:            }}
1390:              style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
1391:              onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
1392:              onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
1393:              🧪 Run tests
1394:            </button>
1395:            <div id="test-results" style={{ marginTop: '16px', maxHeight: '300px', overflow: 'auto' }} />
1396:          </div>
1397:          </>)
1398:}
1400:          {/* ── Email tool ── */}
1401:          {adminTab === 'email' && (
1402:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
1403:            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📧 Email users about discounts / sales</h3>
1404:            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)}
1405:              placeholder="Write your email message here... (or leave blank for default)"
1406:              rows={5}
1407:              style={{ width: '100%', padding: '12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', marginBottom: '8px' }} />
1408:            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
1409:              Emails are sent via Resend. Leave message blank for a default template.
1410:            </p>
1411:            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
1412:              <button onClick={async () => {
1413:                const btn = document.activeElement;
1414:                const orig = btn.textContent;
1415:                btn.textContent = 'Sending...';
1416:                btn.disabled = true;
1417:                const r = await fetch('/api/send-campaign', {
1418:                  method: 'POST',
1419:                  headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
1420:                  body: JSON.stringify({ emails: users.map((u) => u.email), subject: '', message: emailText || '' }),
1421:                });
1422:                const d = await r.json();
1423:                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
1424:                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
1425:              }}
1426:                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
1427:                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
1428:                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
1429:                📩 Email all users ({users.length})
1430:              </button>
1431:              <button onClick={async () => {
1432:                const btn = document.activeElement;
1433:                const orig = btn.textContent;
1434:                btn.textContent = 'Sending...';
1435:                btn.disabled = true;
1436:                const marketingUsers = users.filter((u) => u.marketing_optin);
1437:                const r = await fetch('/api/send-campaign', {
1438:                  method: 'POST',
1439:                  headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
1440:                  body: JSON.stringify({ emails: marketingUsers.map((u) => u.email), subject: '', message: emailText || '' }),
1441:                });
1442:                const d = await r.json();
1443:                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
1444:                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
1445:              }}
1446:                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
1447:                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
1448:                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
1449:                📩 Email opted-in only ({users.filter((u) => u.marketing_optin).length})
1450:              </button>
1451:              <button onClick={() => { navigator.clipboard?.writeText(users.map((u) => u.email).join(', ')); }}
1452:                style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s' }}
1453:                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
1454:                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
1455:                📋 Copy all emails
1456:              </button>
1457:            </div>
1458:          </div>
1459:          )}
1461:          {/* ── Orders ── */}
1462:          {adminTab === 'orders' && (
1463:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
1464:            {/* ── Order stats chart ── */}
1465:            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
1466:              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
1467:                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.length}</div>
1468:                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total</div>
1469:              </div>
1470:              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
1471:                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'pending').length}</div>
1472:                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>⏳ Pending</div>
1473:              </div>
1474:              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
1475:                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'ordered').length}</div>
1476:                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>📦 Ordered</div>
1477:              </div>
1478:              <div style={{ background: 'color-mix(in oklab, var(--ink) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
1479:                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'shipped').length}</div>
1480:                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>🚚 Shipped</div>
1481:              </div>
1482:            </div>
1484:            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
1485:              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📦 Orders to fulfill</h3>
1486:              <div style={{ display: 'flex', gap: '8px' }}>
1487:                {orders.length > 0 && (
1488:                  <button onClick={() => {
1489:                    const csv = ["Order,Customer,Email,Items,Total,Status,Address"];
1490:                    orders.forEach(o => {
1491:                      const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size})`).join('; ');
1492:                      csv.push(`"${o.order_num}","${o.customer_name}","${o.email}","${items}","€${o.total}","${o.status}","${o.address}"`);
1493:                    });
1494:                    navigator.clipboard.writeText(csv.join('\n'));
1495:                    alert('📋 Orders CSV copied! Paste into Shopify or Excel.');
1496:                  }}
1497:                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}
1498:                    onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
1499:                    onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
1500:                            📋 Export CSV
1501:                  </button>
1502:                )}
1503:              </div>
1504:            </div>
1505:            {orders.length === 0 ? (
1506:              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No orders yet. When a customer checks out, orders appear here.</p>
1507:            ) : (
1508:              <>
1509:                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
1510:                  {orders.filter(o => o.status === 'pending').length} pending · {orders.filter(o => o.status === 'ordered').length} ordered · {orders.filter(o => o.status === 'shipped').length} shipped
1511:                </p>
1512:                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
1513:                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
1514:                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
1515:                      <th style={{ padding: '8px 10px' }}>Order</th>
1516:                      <th style={{ padding: '8px 10px' }}>Customer</th>
1517:                      <th style={{ padding: '8px 10px' }}>Items</th>
1518:                      <th style={{ padding: '8px 10px' }}>Total</th>
1519:                      <th style={{ padding: '8px 10px' }}>Status</th>
1520:                      <th style={{ padding: '8px 10px' }}>Supplier</th>
1521:                    </tr></thead>
1522:                    <tbody>
1523:                      {orders.map(o => (
1524:                        <tr key={o.id} style={{ borderTop: '1px solid var(--line)', background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent' }}>
1525:                          <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: '12px' }}>{o.order_num}</td>
1526:                          <td style={{ padding: '8px 10px' }}>
1527:                            <div>{o.customer_name}</div>
1528:                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.email}</div>
1529:                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.address}</div>
1530:                          </td>
1531:                          <td style={{ padding: '8px 10px', fontSize: '12px' }}>
1532:                            {(Array.isArray(o.items) ? o.items : []).map((it, i) => (
1533:                              <div key={i}>{typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`}</div>
1534:                            ))}
1535:                          </td>
1536:                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{money(o.total)}</td>
1537:                          <td style={{ padding: '8px 10px' }}>
1538:                            <select value={o.status} onChange={async (e) => {
1539:                              await updateOrderStatus(o.id, e.target.value);
1540:                              setOrders(prev => prev.map(ord => ord.id === o.id ? { ...ord, status: e.target.value } : ord));
1541:                            }}
1542:                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', fontWeight: 600,
1543:                                background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 20%, transparent)' : o.status === 'ordered' ? 'color-mix(in oklab, var(--accent) 40%, transparent)' : 'color-mix(in oklab, var(--ink) 20%, transparent)' }}>
1544:                              <option value="pending">⏳ Pending</option>
1545:                              <option value="ordered">📦 Ordered</option>
1546:                              <option value="shipped">🚚 Shipped</option>
1547:                            </select>
1548:                          </td>
1549:                          <td style={{ padding: '8px 10px' }}>
1550:                            <button onClick={() => {
1551:                              const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`).join(', ');
1552:                              const msg = `NEW ORDER\n━━━━━━━━━━━\nOrder: ${o.order_num}\nItem: ${items}\nCustomer: ${o.customer_name}\nAddress: ${o.address}\nEmail: ${o.email}\n━━━━━━━━━━━\nPlease ship to the address above.`;
1553:                              navigator.clipboard.writeText(msg);
1554:                              alert('✅ Order info copied! Paste it into your Alibaba / WhatsApp / DSers chat.');
1555:                            }}
1556:                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
1557:                              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.transform = 'translateY(-1px)'; }}
1558:                              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}>
1559:                              📋 Copy for supplier
1560:                            </button>
1561:                          </td>
1562:                        </tr>
1563:                      ))}
1564:                    </tbody>
1565:                  </table>
1566:                </div>
1567:              </>
1568:            )}
1569:          </div>
1570:          )}
1572:          {/* ── Stock bar chart ── */}
1573:          {adminTab === 'orders' && (
1574:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
1575:            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Stock levels</h3>
1576:            {(() => {
1577:              const allProds = [...REWIND_PRODUCTS, ...customProducts];
1578:              const maxStock = Math.max(...allProds.map(p => p.stock || 0), 1);
1579:              return (
1580:                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
1581:                  {allProds.map(p => (
1582:                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
1583:                      <span style={{ width: '160px', fontSize: '12px', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
1584:                      <div style={{ flex: 1, height: '22px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
1585:                        <div style={{
1586:                          width: `${Math.round(((p.stock || 0) / maxStock) * 100)}%`,
1587:                          height: '100%',
1588:                          background: (p.stock || 0) <= 5 ? 'var(--accent)' : (p.stock || 0) <= 15 ? 'color-mix(in oklab, var(--accent) 60%, var(--ink))' : 'color-mix(in oklab, var(--ink) 40%, transparent)',
1589:                          borderRadius: '4px',
1590:                          transition: 'width 0.3s',
1591:                        }} />
1592:                      </div>
1593:                      <span style={{ width: '30px', fontSize: '12px', fontWeight: 700, color: (p.stock || 0) <= 5 ? 'var(--accent)' : 'var(--muted)' }}>{p.stock || 0}</span>
1594:                    </div>
1595:                  ))}
1596:                </div>
1597:              );
1598:            })()}
1599:          </div>
1600:          )}
1602:          {/* ── Stock alerts ── */}
1603:          {adminTab === 'orders' && (
1604:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
1605:            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📉 Stock alerts</h3>
1606:            {(() => {
1607:              const allProds = [...REWIND_PRODUCTS, ...customProducts];
1608:              const low = allProds.filter(p => p.stock !== undefined && p.stock <= 5);
1609:              if (low.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>All products have sufficient stock.</p>;
1610:              return (
1611:                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
1612:                  {low.map(p => (
1613:                    <span key={p.id || p.product_id} style={{ padding: '6px 12px', background: 'color-mix(in oklab, var(--accent) 15%, transparent)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
1614:                      {p.name} — only {p.stock} left
1615:                    </span>
1616:                  ))}
1617:                </div>
1618:              );
1619:            })()}
1620:          </div>
1621:          )}
1623:          {/* ── Edit product panel ── */}
1624:          {adminTab === 'edit' && editProduct && (
1625:            <EditProductPanel key={editProduct.id || editProduct.product_id} product={editProduct} onDone={() => { setEditProduct(null); setAdminTab('saved'); }}
1626:              setCustomProducts={setCustomProducts} />
1627:          )}
1629:          {/* ── Blocked IPs ── */}
1630:          {adminTab === 'blocked' && <BlockedPanel />}
1632:          {/* ── Saved products ── */}
1633:          {adminTab === 'saved' && (
1634:          <div key={savedVersion} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
1635:            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>⭐ Saved products</h3>
1636:            {(() => {
1637:              const allProds = [...REWIND_PRODUCTS, ...customProducts];
1638:              const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
1639:              const saved = allProds.filter(p => savedIds.includes(p.id || p.product_id));
1640:              if (saved.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No saved products yet. Click ⋮ on any product and select Save.</p>;
1641:              return (
1642:                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
1643:                  {saved.map(p => (
1644:                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--line)', borderRadius: '8px' }}>
1645:                      <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: p.hue ? `hsl(${p.hue},60%,80%)` : 'var(--line-2)', overflow: 'hidden', flexShrink: 0 }}>
1646:                        {p.img && <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
1647:                      </div>
1648:                      <div style={{ flex: 1 }}>
1649:                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</div>
1650:                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p.brand}{p.brand && p.cat ? ' · ' : ''}{p.cat}</div>
1651:                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{money(p.price)}</div>
1652:                      </div>
1653:                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
1654:                        <button onClick={() => { onSelect(p); }}
1655:                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
1656:                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
1657:                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
1658:                          👁 View
1659:                        </button>
1660:                        <button onClick={() => {
1661:                          setEditProduct(p);
1662:                          setAdminTab('edit');
1663:                        }}
1664:                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
1665:                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
1666:                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--line-2)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
1667:                          ✏️ Edit
1668:                        </button>
1669:                        <button onClick={() => {
1670:                          const savedIds = JSON.parse(localStorage.getItem('rw_admin_saved') || '[]');
1671:                          const newIds = savedIds.filter(id => id !== (p.id || p.product_id));
1672:                          localStorage.setItem('rw_admin_saved', JSON.stringify(newIds));
1673:                          setSavedVersion(v => v + 1);
1674:                        }}
1675:                          onMouseOver={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
1676:                          onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}
1677:                          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'transform 0.15s' }}>
1678:                          ✕ Remove
1679:                        </button>
1680:                      </div>
1681:                    </div>
1682:                  ))}
1683:                </div>
1684:              );
1685:            })()}
1686:          </div>
1687:          )}
1689:          {/* ── Product stats ── */}
1690:          {adminTab === 'products' && (
1691:          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
1692:            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Product stats</h3>
1693:            <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
1694:              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }} />
1695:            {(() => {
1696:              // Count favorites per product from all users
1697:              const favCounts = {};
1698:              users.forEach(u => {
1699:                (u.product_ids || []).forEach(pid => {
1700:                  if (!favCounts[pid]) favCounts[pid] = { count: 0, users: [] };
1701:                  favCounts[pid].count++;
1702:                  if (!favCounts[pid].users.includes(u.email)) favCounts[pid].users.push(u.email);
1703:                });
1704:              });
1705:              // Build product list from all products + custom products
1706:              const allProds = [...REWIND_PRODUCTS, ...customProducts];
1707:              const productStats = allProds.filter(p => {
1708:                const name = p.name?.toLowerCase() || '';
1709:                const brand = p.brand?.toLowerCase() || '';
1710:                const q = productSearch.toLowerCase();
1711:                return !q || name.includes(q) || brand.includes(q);
1712:              }).map(p => ({
1713:                ...p,
1714:                favs: favCounts[p.id || p.product_id]?.count || 0,
1715:                favUsers: favCounts[p.id || p.product_id]?.users || [],
1716:              })).sort((a, b) => b.favs - a.favs);
1718:              if (productStats.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No products found.</p>;
1719:              return (
1720:                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
1721:                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
1722:                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
1723:                      <th style={{ padding: '8px 12px' }}>Product</th>
1724:                      <th style={{ padding: '8px 12px' }}>Brand</th>
1725:                      <th style={{ padding: '8px 12px' }}>Category</th>
1726:                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>⭐ Favs</th>
1727:                      <th style={{ padding: '8px 12px' }}>Users</th>
1728:                    </tr></thead>
1729:                    <tbody>
1730:                      {productStats.map(p => (
1731:                        <tr key={p.id || p.product_id} style={{ borderTop: '1px solid var(--line)' }}>
1732:                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name || 'Unnamed'}</td>
1733:                          <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.brand || '—'}</td>
1734:                          <td style={{ padding: '8px 12px' }}>{p.cat}</td>
1735:                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{p.favs}</td>
1736:                          <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.favUsers.join(', ') || '—'}</td>
1737:                        </tr>
1738:                      ))}
1739:                    </tbody>
1740:                  </table>
1741:                </div>
1742:              );
1743:            })()}
1744:          </div>
1745:          )}
1747:          {adminTab === 'products' && (
1748:          <ProductForm editProduct={editProduct} onClearEdit={() => setEditProduct(null)}
1749:            customProducts={customProducts} setCustomProducts={setCustomProducts} />
1750:          )}
1751:        </>
1752:      )}
1753:    </div>
1754:  );
1755:}
1757:/* ── Blocked Emails Panel ── */
1758:function BlockedPanel() {
1759:  const [emails, setEmails] = useState([]);
1760:  const [newEmail, setNewEmail] = useState('');
1761:  const [loading, setLoading] = useState(true);
1762:  const [allUsers, setAllUsers] = useState([]);
1764:  const loadAll = async () => {
1765:    try {
1766:      const [re, ru] = await Promise.all([
1767:        fetch('/api/admin/blocked-emails', { headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') } }).then(r => r.json()),
1768:        fetch('/api/admin/user-emails', { headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') } }).then(r => r.json()),
1769:      ]);
1770:      setEmails(re.emails || []);
1771:      setAllUsers(ru.emails || []);
1772:    } catch {}
1773:    setLoading(false);
1774:  };
1776:  React.useEffect(() => { loadAll(); }, []);
1778:  const blockEmail = async (email) => {
1779:    if (!email) return;
1780:    await fetch('/api/admin/block-email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ email }) });
1781:    setNewEmail(''); loadAll();
1782:  };
1784:  const unblockEmail = async (email) => {
1785:    await fetch('/api/admin/unblock-email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ email }) });
1786:    loadAll();
1787:  };
1789:  const blockedEmails = new Set(emails.map(e => e.email));
1790:  const unblockedUsers = allUsers.filter(email => !blockedEmails.has(email));
1792:  return (
1793:    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
1794:      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
1795:        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🚫 Blocked Emails</h3>
1796:        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>Blocked users will see a permanent notice when they try to checkout: <em>"Contact orders@rewind-stores.com to appeal."</em></p>
1797:        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>


---
## FILE: vite.config.js



---
## FILE: package.json

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


---
## FILE: railway.json



---
## FILE: server.js (entry point)

// Local development entry point — delegates to api/server.js
// For Vercel deployment, api/server.js is used directly.
import app from './api/server.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));


---
## FILE: .env (template — variables only, no values)

# Railway env vars used:
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


---
## FILE: src/lib/supabase.js

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


---
## FILE: src/components/Shell.jsx (first 50 lines + key components)

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


---
## FILE: .gitignore

