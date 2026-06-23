import express from 'express';
import { Resend } from 'resend';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'dist')));

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'REWIND <orders@rewind-stores.com>';
const REPLY_TO = process.env.REPLY_TO || 'philippekojoanaman@gmail.com';
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

// ── Generate product description from image via Gemini ──
app.post('/api/generate-description', async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    return res.status(400).json({ error: 'GEMINI_API_KEY not configured' });
  }
  if (!imageBase64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Describe this product for a vintage streetwear store. Include: item type, material guess, colors, era/style vibes, and who would wear it. Keep it to 2-3 sentences, professional but warm tone.' },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
            ]
          }]
        })
      }
    );
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ description: text });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));

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

// ── Run automated tests ──
app.get('/api/run-tests', async (_req, res) => {
  try {
    const { runTests } = await import('./tests/button-test.js');
    const result = await runTests();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, passed: 0, failed: 1, total: 1, results: [{ name: 'Test runner', status: '❌', detail: err.message }] });
  }
});
