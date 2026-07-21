// Admin blocking routes — block/unblock email/IP, email-to-IP mapping
// Mounted AFTER the blanket requireAdmin middleware in server.js

export function registerAdminBlockingRoutes({ app, SUPABASE_URL, SUPABASE_KEY, resend, FROM_EMAIL, REPLY_TO, escapeHtml, auditLog, getAdminEmailFromToken, BLOCKED_IPS, BLOCKED_EMAILS }) {

  app.get('/api/admin/blocked-ips', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
      res.json({ ips: await r.json() || [] });
    } catch { res.status(500).json({ error: 'Operation failed' }); }
  });

  app.post('/api/admin/block-ip', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });
    await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, { method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ip_address: ip }) });
    if (BLOCKED_IPS) BLOCKED_IPS.set(ip, true);
    auditLog(getAdminEmailFromToken(req), 'block_ip', ip, req.ip);
    res.json({ ok: true });
  });

  app.post('/api/admin/unblock-ip', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP required' });
    await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips?ip_address=eq.${encodeURIComponent(ip)}`, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (BLOCKED_IPS) BLOCKED_IPS.delete(ip);
    auditLog(getAdminEmailFromToken(req), 'unblock_ip', ip, req.ip);
    res.json({ ok: true });
  });

  app.get('/api/admin/blocked-emails', async (req, res) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
      res.json({ emails: await r.json() || [] });
    } catch { res.json({ emails: [] }); }
  });

  app.post('/api/admin/block-email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, { method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase().trim(), created_at: new Date().toISOString() }) });
      const d = await r.json();
      if (d.error) return res.status(500).json({ error: d.error });
      auditLog(getAdminEmailFromToken(req), 'block_email', email, req.ip);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Operation failed' }); }
  });

  // ── Admin: block a chat customer (email + IP) ──
  app.post('/api/admin/block-customer', async (req, res) => {
    const { session_id, email, ip } = req.body;
    if (!session_id && !email) return res.status(400).json({ error: 'session_id or email required' });
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

    let targetEmail = email;
    let targetIp = ip;
    if (session_id && (!targetEmail || !targetIp)) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}&select=customer_email,customer_ip`, {
          headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        });
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          if (!targetEmail && data[0].customer_email) targetEmail = data[0].customer_email;
          if (!targetIp && data[0].customer_ip) targetIp = data[0].customer_ip;
        }
      } catch (e) { console.warn('Failed to look up session for blocking:', e.message); }
    }

    const results = { emailBlocked: false, ipBlocked: false };
    const errors = [];

    if (targetEmail) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails`, {
          method: 'POST',
          headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail.toLowerCase().trim(), created_at: new Date().toISOString() }),
        });
        if (r.ok) {
          if (BLOCKED_EMAILS) BLOCKED_EMAILS.add(targetEmail.toLowerCase().trim());
          results.emailBlocked = true;
        } else {
          const e = await r.json();
          if (e.error && !e.error.includes('duplicate')) errors.push('Email: ' + e.error);
        }
      } catch (e) { errors.push('Email: ' + e.message); }
    }

    if (targetIp) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/blocked_ips`, {
          method: 'POST',
          headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip_address: targetIp, created_at: new Date().toISOString() }),
        });
        if (r.ok) {
          if (BLOCKED_IPS) BLOCKED_IPS.set(targetIp, true);
          results.ipBlocked = true;
        } else {
          const e = await r.json();
          if (e.error && !e.error.includes('duplicate')) errors.push('IP: ' + e.error);
        }
      } catch (e) { errors.push('IP: ' + e.message); }
    }

    res.json({ ok: results.emailBlocked || results.ipBlocked, ...results, errors: errors.length > 0 ? errors : undefined });
  });

  app.post('/api/admin/unblock-email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/blocked_emails?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`, { method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
      auditLog(getAdminEmailFromToken(req), 'unblock_email', email, req.ip);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Operation failed' }); }
  });

  // ── Admin: get email-to-IP mappings ──
  app.get('/api/admin/email-ips', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY || !SUPABASE_URL) return res.json({ mappings: [] });
    try {
      const [chatRes, orderRes] = await Promise.all([
        fetch(SUPABASE_URL + '/rest/v1/chat_sessions?select=customer_email,customer_ip&order=last_message_at.desc&limit=500', {
          headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
        }),
        fetch(SUPABASE_URL + '/rest/v1/orders?select=email,ip_address&order=created_at.desc&limit=500', {
          headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
        }),
      ]);
      const [chatData, orderData] = await Promise.all([chatRes.json(), orderRes.json()]);
      const map = {};
      const add = (email, ip) => {
        if (email && ip) {
          if (!map[email]) map[email] = new Set();
          map[email].add(ip);
        }
      };
      (Array.isArray(chatData) ? chatData : []).forEach(s => add(s.customer_email, s.customer_ip));
      (Array.isArray(orderData) ? orderData : []).forEach(o => add(o.email, o.ip_address));
      const mappings = Object.entries(map).map(([email, ips]) => ({ email, ips: [...ips] }));
      mappings.sort((a, b) => b.ips.length - a.ips.length);
      res.json({ mappings });
    } catch { res.json({ mappings: [] }); }
  });
}
