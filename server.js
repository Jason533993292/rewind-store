import express from 'express';
import { Resend } from 'resend';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Resend email setup
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ── Send order confirmation ──
app.post('/api/send-order', async (req, res) => {
  const { email, name, items, total, address, orderNum } = req.body;

  if (!resend) {
    return res.json({ ok: true, note: 'email not configured (no RESEND_API_KEY)' });
  }

  const itemsList = items.map((it) => `  • ${it.name} (${it.size}) — €${it.price}`).join('\n');

  try {
    await resend.emails.send({
      from: 'REWIND <orders@rewind-store.com>',
      to: email,
      subject: `Order confirmed — ${orderNum}`,
      text: `Hi ${name || 'there'},

Your order has been placed!

Order: ${orderNum}
${itemsList}

Subtotal: €${total}
Shipping to:
${address || '(address provided at checkout)'}

We'll send you a shipping confirmation once your items are on their way.

Thanks for shopping with REWIND.
https://rewind-store.com`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Send campaign email (admin panel) ──
app.post('/api/send-campaign', async (req, res) => {
  const { emails, subject, message } = req.body;

  if (!resend) {
    return res.json({ ok: true, sent: 0, note: 'Resend not configured' });
  }
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ ok: false, error: 'No recipients' });
  }

  const defaultSubject = 'New arrivals & exclusive offers — REWIND';
  const defaultMessage = `Hi,\n\nWe just got new pieces in. Check them out:\nhttps://rewind-store-production-2299.up.railway.app\n\nBest,\nREWIND`;

  let sent = 0;
  for (const email of emails) {
    try {
      await resend.emails.send({
        from: 'REWIND <orders@rewind-store.com>',
        to: email,
        subject: subject || defaultSubject,
        text: message || defaultMessage,
      });
      sent++;
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Failed to send to ${email}:`, err.message);
    }
  }

  res.json({ ok: true, sent, total: emails.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));
