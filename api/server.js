import express from 'express';
import { Resend } from 'resend';
import sharp from 'sharp';
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

// ── Verify admin email (server-side check — not client-side Supabase query) ──
app.post('/api/verify-admin', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ verified: false });
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
app.get('/api/run-tests', async (_req, res) => {
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
      // Decrement stock for purchased items — prefer product_ids from session metadata
      const productIdsFromMeta = session.metadata?.product_ids ? session.metadata.product_ids.split(',') : [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.name || !it.qty) continue;
        // Use product_id from metadata if available, otherwise try name match
        const productId = productIdsFromMeta[i] || null;
        let productName = it.name;
        if (!productId) {
          // Only strip trailing patterns that look like sizes (e.g. (M), (XL), (42)),
          // NOT general parenthetical content like (1990s) or (retro).
          productName = it.name.replace(/\s*\((\d{1,2}(\.\d)?|[Xx][SsXxLl]?[Ll]?|[Ss][Mm][Ll]?)\)\s*$/, '').trim();
        }
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
