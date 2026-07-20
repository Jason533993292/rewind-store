// Admin audit, users, and support routes
// Mounted AFTER the blanket requireAdmin middleware in server.js

export function registerAdminAuditRoutes({ app, SUPABASE_URL, auditLog, getAdminEmailFromToken }) {

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

  // ── Admin: list all user emails from orders + wishlists ──
  app.get('/api/admin/user-emails', async (req, res) => {
    const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
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
      try {
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Write a cancellation email for a REWIND vintage streetwear order. The customer's name is ${customerName || 'there'}. The reason is: "${reasonText}". Use this exact structure:\n\n1. Greeting: "Hi [customer name],"\n2. One sentence stating the cancellation and the specific reason\n3. "A full refund has been initiated and will appear in your account within 5-10 business days."\n4. "If you have any questions, reply to this email or contact us at orders@rewind-stores.com."\n5. Sign-off: "— REWIND team"\n\nKeep it concise and professional. No slang, no emoji, no exclamation marks. Max 5 short sentences. No subject line.` }] }],
            generationConfig: { maxOutputTokens: 2000 },
          }),
        });
        const aiData = await aiRes.json();
        emailBody = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch {}
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
}
