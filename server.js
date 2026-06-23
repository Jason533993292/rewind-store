import express from 'express';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Resend setup
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'orders@rewind-stores.com';
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

// ── Send order confirmation ──
app.post('/api/send-order', async (req, res) => {
  const { email, name, items, total, address, orderNum } = req.body;
  if (!resend) return res.json({ ok: true, note: 'Resend not configured' });

  const itemsList = items.map((it) => `  • ${it.name} (${it.size}) — €${it.price}`).join('\n');
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Order confirmed — ${orderNum}`,
      text: `Hi ${name || 'there'},

Your order has been placed!

Order: ${orderNum}
${itemsList}

Total: €${total}
Shipping to: ${address || '(address provided)'}

We'll email you when it ships.

Thanks,
REWIND`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Send campaign (admin panel) ──
app.post('/api/send-campaign', async (req, res) => {
  const { emails, subject, message } = req.body;
  if (!resend) return res.json({ ok: true, sent: 0, note: 'Resend not configured' });

  const defaultMsg = `Hi,\n\nWe just got new pieces in. Check them out:\nhttps://rewind-stores.com\n\nBest,\nREWIND`;
  let sent = 0;
  for (const email of emails) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: subject || 'New arrivals & exclusive offers — REWIND',
        text: message || defaultMsg,
      });
      sent++;
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Failed: ${email}:`, err.message);
    }
  }
  res.json({ ok: true, sent, total: emails.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));
