import express from 'express';
import { Resend } from 'resend';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '50mb' }));

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
app.post('/api/send-campaign', async (req, res) => {
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

// ── Generate product description from image (Gemini or OpenAI) ──
const PRODUCT_DESCRIPTION_PROMPT = 'Describe this product for a vintage streetwear store. Include: item type, material guess, colors, era/style vibes, and who would wear it. Keep it to 2-3 sentences, professional but warm tone.';

// Helper: generate description via Google Gemini
async function describeViaGemini(imageBase64) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent([
    { text: 'Look at this product photo. Return ONLY valid JSON with exactly two fields: "title" (short product name, max 6 words) and "description" (2-3 sentences describing the item). No other text.' },
    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
  ]);
  const text = result.response.text();
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { title: '', description: text.replace(/```json|```/g, '').trim() };
  }
}

// Helper: generate description via OpenAI Vision (returns title + description)
async function describeViaOpenAI(imageBase64) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'You are helping a vintage streetwear store. Look at this product photo and respond in JSON format with exactly two fields: "title" (a short product name, max 6 words, e.g. "Vintage Nike Windbreaker") and "description" (2-3 sentences describing the item: material guess, era/style, colors, who would wear it). Only return valid JSON, nothing else.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ],
      }],
      max_tokens: 300,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
  const content = data?.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(content);
  } catch {
    return { title: '', description: content };
  }
}
async function describeViaHF(imageBase64) {
  const buffer = Buffer.from(imageBase64, 'base64');
  // Try multiple free HuggingFace models
  const models = [
    'Salesforce/blip-image-captioning-base',
    'nlpconnect/vit-gpt2-image-captioning',
    'microsoft/git-base-coco',
  ];
  for (const model of models) {
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const caption = data?.[0]?.generated_text || '';
      if (caption) return { title: caption.split(',')[0].trim(), description: caption };
    } catch {}
  }
  throw new Error('HuggingFace: all models failed');
}

app.post('/api/generate-description', async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  // Try providers in order: Free HuggingFace → OpenAI → Gemini → Fallback
  const errors = [];
  for (const tryFn of [describeViaHF, describeViaOpenAI, describeViaGemini]) {
    try {
      const result = await tryFn(imageBase64);
      if (result && (result.title || result.description)) {
        return res.json({ title: result.title || '', description: result.description || '' });
      }
    } catch (e) {
      errors.push(e.message?.slice(0, 100));
    }
  }
  // Final fallback: generate a basic description from nothing
  res.json({
    title: 'Vintage Streetwear Piece',
    description: 'Hand-picked vintage item. Authenticated, steam-cleaned, and ready to wear. One of one — when it\'s gone, it\'s gone.',
  });
});

// ── Background removal service ──
app.post('/api/remove-bg', async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image' });
  try {
    // Use sharp to detect edges and create a mask (basic approach)
    const buf = Buffer.from(imageBase64, 'base64');
    // Return the original image as-is for now (will improve with AI pipeline)
    // The frontend does the actual compositing
    const mask = await sharp(buf)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    res.json({ maskBase64: mask.toString('base64') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Enhance product image ──
app.post('/api/enhance-image', async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image' });
  try {
    const buf = Buffer.from(imageBase64, 'base64');
    const enhanced = await sharp(buf)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .sharpen()
      .normalize()
      .jpeg({ quality: 92 })
      .toBuffer();
    const resultBase64 = enhanced.toString('base64');
    res.json({ imageBase64: resultBase64 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI Enhance: remove creases, clean, white background ──
app.post('/api/enhance-product', async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image' });
  try {
    const buf = Buffer.from(imageBase64, 'base64');
    const enhanced = await sharp(buf)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // white background
      .blur(1)            // smooth creases
      .sharpen({ sigma: 1.2 }) // restore detail
      .normalize()         // auto contrast
      .modulate({ brightness: 1.05, saturation: 1.1 })
      .jpeg({ quality: 92 })
      .toBuffer();
    res.json({ imageBase64: enhanced.toString('base64') });
  } catch (err) {
    console.error('Enhance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Payment endpoints ──
import Stripe from 'stripe';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'STRIPE_SECRET_KEY not configured on Railway' });
  try {
    const { amount, currency, orderNum } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert euros to cents
      currency: currency || 'eur',
      metadata: { orderNum },
      payment_method_types: ['card', 'bancontact'],
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate promo code
app.post('/api/validate-promo', async (req, res) => {
  const ADMIN_CODE = process.env.ADMIN_SECRET_CODE || '74421';
  const { code } = req.body;
  if (code === ADMIN_CODE) return res.json({ admin: true });
  res.json({ admin: false, discount: code ? 0 : null });
});

// Admin management (add/remove admins)
app.post('/api/manage-admins', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
  const { action, email, adminEmail } = req.body;
  // Verify the requester is an admin
  const check = await fetch(`${process.env.SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(adminEmail)}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const admins = await check.json();
  if (!admins?.length) return res.status(403).json({ error: 'Not authorized' });

  if (action === 'add') {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admins`, {
      method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email, added_by: adminEmail }),
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
    const line_items = (items || []).map(it => ({
      price_data: {
        currency: 'eur',
        product_data: { name: `${it.name}${it.size ? ` (${it.size})` : ''}` },
        unit_amount: Math.round(it.price * 100),
      },
      quantity: it.qty || 1,
    }));
    const shipping = total - (items || []).reduce((s, it) => s + it.price * (it.qty || 1), 0);
    if (shipping > 0) {
      line_items.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Shipping' },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email,
      metadata: { orderNum, customer_name: name || '', address: address || '' },
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

// PayPal order creation
app.post('/api/create-paypal-order', async (req, res) => {
  const { amount, orderNum } = req.body;
  const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
  if (!PAYPAL_CLIENT || !PAYPAL_SECRET) return res.status(400).json({ error: 'PayPal keys not configured on Railway' });
  try {
    // Get PayPal access token
    const auth = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString('base64') },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = await auth.json();
    if (!access_token) throw new Error('PayPal auth failed');
    // Create order
    const order = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'EUR', value: amount.toFixed(2) }, reference_id: orderNum }],
      }),
    });
    const data = await order.json();
    res.json({ orderId: data.id });
  } catch (err) {
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
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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
      // Decrement stock for purchased items
      for (const it of items) {
        if (it.name && it.qty) {
          const name = it.name.replace(/\s*\(.*?\)\s*$/, '').trim(); // strip size from name
          await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/custom_products?name=eq.${encodeURIComponent(name)}`, {
            headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}` },
          }).then(async r => {
            const products = await r.json();
            if (products && products.length > 0) {
              const p = products[0];
              const newStock = Math.max(0, (p.stock || 1) - it.qty);
              await fetch(`${process.env.SUPABASE_URL || SUPABASE_URL}/rest/v1/custom_products?id=eq.${p.id}`, {
                method: 'PATCH',
                headers: { apikey: process.env.SUPABASE_KEY || SUPABASE_KEY, Authorization: `Bearer ${process.env.SUPABASE_KEY || SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock: newStock }),
              });
            }
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email)}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const data = await r.json();
    res.json({ blocked: data && data.length > 0 });
  } catch { res.json({ blocked: false }); }
});

// ── Admin: manage blocked emails ──
app.get('/api/admin/blocked-emails', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    res.json({ emails: await r.json() || [] });
  } catch { res.json({ emails: [] }); }
});

app.post('/api/admin/block-email', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase().trim(), created_at: new Date().toISOString() }) });
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

app.post('/api/admin/unblock-email', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  res.json({ ok: true });
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
