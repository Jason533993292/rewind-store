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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`REWIND server running on :${PORT}`));
