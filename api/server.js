import express from 'express';
import { Resend } from 'resend';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, '..', 'dist')));

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
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: email,
      subject: `Order confirmed — ${orderNum}`,
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
  if (!resend) return res.json({ ok: true, sent: 0, note: 'Resend not configured' });
  const defaultMsg = "Hey,\n\nWe just got new pieces in.\n\nCheck them out:\nhttps://rewind-stores.com\n\nBest,\nREWIND";
  let sent = 0;
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
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Failed: ${email}:`, err.message);
    }
  }
  res.json({ ok: true, sent, total: emails.length });
});

// ── Generate product description from image (Gemini or OpenAI) ──
const PRODUCT_DESCRIPTION_PROMPT = 'Describe this product for a vintage streetwear store. Include: item type, material guess, colors, era/style vibes, and who would wear it. Keep it to 2-3 sentences, professional but warm tone.';

// Helper: generate description via Google Gemini
async function describeViaGemini(imageBase64) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent([
    { text: PRODUCT_DESCRIPTION_PROMPT },
    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
  ]);
  return result.response.text();
}

// Helper: generate description via OpenAI Vision
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
          { type: 'text', text: PRODUCT_DESCRIPTION_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }],
      max_tokens: 200,
    }),
  });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

app.post('/api/generate-description', async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    let text;
    if (process.env.GEMINI_API_KEY) {
      text = await describeViaGemini(imageBase64);
    } else if (process.env.OPENAI_API_KEY) {
      text = await describeViaOpenAI(imageBase64);
    } else {
      return res.status(400).json({ error: 'No AI provider configured — set GEMINI_API_KEY or OPENAI_API_KEY' });
    }
    res.json({ description: text });
  } catch (err) {
    console.error('Generate description error:', err);
    res.status(500).json({ error: err.message });
  }
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
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));
}

// Export for Vercel serverless
export default app;
