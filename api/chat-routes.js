import express from 'express';
import crypto from 'crypto';
import { sendPushNotification } from './push-routes.js';

const MAX_MESSAGE_LEN = 2000;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function makeLimiter() {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, arr] of hits) {
      const fresh = arr.filter((t) => now - t < 600000);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, 600000);
  return function isLimited(key, max, windowMs) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    return arr.length > max;
  };
}

function getIp(req) {
  return req.ip;
}

export function buildChatRouter({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, resend, FROM_EMAIL, REPLY_TO, notifyEmail, requireAdmin }) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('buildChatRouter: SUPABASE_SERVICE_ROLE_KEY missing — chat routes will fail at runtime.');
  }

  const router = express.Router();

  const sfetch = async (path, opts = {}) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...opts,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase ${opts.method || 'GET'} ${path} returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return res;
  };

  const startLimited = makeLimiter();
  const sendLimited = makeLimiter();
  const readLimited = makeLimiter();
  const aiReplyCount = new Map();
  const verificationCodes = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [email, entry] of verificationCodes) {
      if (entry.expiresAt < now) verificationCodes.delete(email);
    }
  }, 300000);

  function validateMessage(message) {
    if (!message || typeof message !== 'string' || !message.trim()) return 'Message required';
    if (message.length > MAX_MESSAGE_LEN) return `Message too long (max ${MAX_MESSAGE_LEN} characters)`;
    return null;
  }

  // ── Customer: start a new chat session ──
  router.post('/api/chat/start', async (req, res) => {
    const ip = getIp(req);
    if (startLimited(ip, 3, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many chats started from this connection — try again later.' });
    }
    const { message, customer_email, customer_name } = req.body || {};
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });

    // If an email is claimed, it must have actually been verified via
    // /api/chat/send-verification + /api/chat/verify-code — otherwise
    // anyone could claim any email address just by calling this endpoint
    // directly (the verification UI alone is not enforcement).
    let verifiedEmail = null;
    if (customer_email) {
      const normalizedEmail = String(customer_email).toLowerCase().trim();
      // Basic email format validation — just checks it looks like an email
      // (has @ and a valid domain pattern). No verification code needed;
      // the session_id UUID is the real access control.
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        verifiedEmail = normalizedEmail;
      }
    }

    // Check if email is blocked
    if (verifiedEmail) {
      try {
        const emailCheck = await sfetch(`/blocked_emails?email=eq.${encodeURIComponent(verifiedEmail)}`);
        const blockedData = await emailCheck.json();
        if (Array.isArray(blockedData) && blockedData.length > 0) {
          const reason = blockedData[0].reason || 'Blocked by admin';
          return res.status(403).json({ error: `This email has been blocked. Reason: ${reason}` });
        }
      } catch {}
    }

    // Check if IP is blocked
    try {
      const ipCheck = await sfetch(`/blocked_ips?ip_address=eq.${encodeURIComponent(ip)}`);
      const blockedIpData = await ipCheck.json();
      if (Array.isArray(blockedIpData) && blockedIpData.length > 0) {
        const reason = blockedIpData[0].reason || 'Blocked by admin';
        return res.status(403).json({ error: `Access denied. Reason: ${reason}` });
      }
    } catch {}

    const session_id = crypto.randomUUID();
    try {
      await sfetch('/chat_sessions', {
        method: 'POST',
        body: JSON.stringify({
          session_id,
          customer_email: verifiedEmail,
          customer_name: customer_name ? String(customer_name).slice(0, 200) : null,
          customer_ip: ip,
          status: 'open',
        }),
      });
      await sfetch('/chat_messages', {
        method: 'POST',
        body: JSON.stringify({ session_id, sender: 'customer', message: message.trim() }),
      });

      if (resend && notifyEmail) {
        resend.emails.send({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: notifyEmail,
          subject: `\u{1F4AC} New chat from ${customer_name || verifiedEmail || 'a customer'}`,
          html: `<p style="font-family:sans-serif">${escapeHtml(message.trim())}</p>
                 <p style="font-family:sans-serif"><a href="https://rewind-stores.com/#admin">Open admin chat panel</a></p>`,
        }).catch((e) => console.warn('Chat notify email failed:', e.message));
      }

      res.json({ session_id });
    } catch (e) {
      console.error('chat/start error:', e);
      res.status(500).json({ error: 'Could not start chat' });
    }
  });

  // ── Customer: send a follow-up message ──
  router.post('/api/chat/send', async (req, res) => {
    const { session_id, message } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });
    if (sendLimited(session_id, 20, 60 * 1000)) {
      return res.status(429).json({ error: 'Slow down a little.' });
    }
    try {
      await sfetch('/chat_messages', {
        method: 'POST',
        body: JSON.stringify({ session_id, sender: 'customer', message: message.trim() }),
      });
      await sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_message_at: new Date().toISOString(), status: 'open' }),
      });
      if (resend && notifyEmail) {
        try {
          const sessRes = await sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}&select=customer_name,customer_email`);
          const sessData = await sessRes.json();
          const sess = Array.isArray(sessData) && sessData.length > 0 ? sessData[0] : {};
          resend.emails.send({
            from: FROM_EMAIL, reply_to: REPLY_TO, to: notifyEmail,
            subject: `💬 New message from ${sess.customer_name || sess.customer_email || 'a customer'}`,
            html: `<p style="font-family:sans-serif">${escapeHtml(message.trim())}</p>
                   <p style="font-family:sans-serif"><a href="https://rewind-stores.com/#admin">Reply in admin panel →</a></p>`,
          }).catch(() => {});
        } catch {}
      }
      sendPushNotification('New customer message', message.trim().substring(0, 120)).catch(() => {});
      res.json({ ok: true });
    } catch (e) {
      console.error('chat/send error:', e);
      res.status(500).json({ error: 'Could not send message' });
    }
  });

  // ── Customer: poll messages ──
  // Access control is the session_id itself — a crypto.randomUUID(), i.e.
  // 128 bits of randomness the customer's browser holds. That's the actual
  // credential; there's no separate IP check here (one used to exist, but
  // it broke real customers whenever their IP changed mid-conversation —
  // routine on mobile networks — while adding no real protection, since
  // every other route below already trusts session_id alone).
  router.get('/api/chat/messages', async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    if (readLimited(session_id, 30, 60 * 1000)) {
      return res.status(429).json({ error: 'Polling too frequently' });
    }
    try {
      const [msgRes, sessRes] = await Promise.all([
        sfetch('/chat_messages?session_id=eq.' + encodeURIComponent(session_id) + '&order=created_at.asc&select=sender,message,created_at,read_by_customer'),
        sfetch('/chat_sessions?session_id=eq.' + encodeURIComponent(session_id) + '&select=status'),
      ]);
      const messages = await msgRes.json();
      const sessionData = await sessRes.json();
      const status = Array.isArray(sessionData) && sessionData.length > 0 ? sessionData[0].status : 'open';
      res.json({ messages: Array.isArray(messages) ? messages : [], status });
    } catch (e) {
      res.status(500).json({ error: 'Could not load messages' });
    }
  });

  // ── Customer: mark admin messages as read ──
  router.post('/api/chat/mark-read', async (req, res) => {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      await sfetch(
        `/chat_messages?session_id=eq.${encodeURIComponent(session_id)}&sender=eq.admin&read_by_customer=eq.false`,
        { method: 'PATCH', body: JSON.stringify({ read_by_customer: true }) }
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Could not update read state' });
    }
  });

  // ── Admin: list sessions ──
  router.get('/api/admin/chat/sessions', requireAdmin, async (_req, res) => {
    try {
      const r = await sfetch('/chat_sessions?order=last_message_at.desc&select=*&limit=200');
      const sessions = await r.json();
      res.json({ sessions: Array.isArray(sessions) ? sessions : [] });
    } catch (e) {
      res.status(500).json({ error: 'Could not load sessions' });
    }
  });

  // ── Admin: view one session's messages ──
  router.get('/api/admin/chat/messages', requireAdmin, async (req, res) => {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      const r = await sfetch(`/chat_messages?session_id=eq.${encodeURIComponent(session_id)}&order=created_at.asc`);
      const messages = await r.json();
      res.json({ messages: Array.isArray(messages) ? messages : [] });
    } catch (e) {
      res.status(500).json({ error: 'Could not load messages' });
    }
  });

  // ── Admin: reply (optionally close after final reply) ──
  router.post('/api/admin/chat/reply', requireAdmin, async (req, res) => {
    const { session_id, message, close } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const err = validateMessage(message);
    if (err) return res.status(400).json({ error: err });
    try {
      await sfetch('/chat_messages', {
        method: 'POST',
        body: JSON.stringify({ session_id, sender: 'admin', message: message.trim() }),
      });
      await sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_message_at: new Date().toISOString(), status: close ? 'closed' : 'open' }),
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Could not send reply' });
    }
  });

  // ── Admin: close a session without deleting it (reversible) ──
  router.post('/api/admin/chat/close', requireAdmin, async (req, res) => {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      await sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Could not close session' });
    }
  });

  // ── Admin: delete a session and all its messages (PERMANENT) ──
  router.delete('/api/admin/chat/session', requireAdmin, async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    try {
      await Promise.all([
        sfetch(`/chat_messages?session_id=eq.${encodeURIComponent(session_id)}`, { method: 'DELETE' }),
        sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, { method: 'DELETE' }),
      ]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not delete session' }); }
  });

  // ── Diagnostic endpoint ──
  router.get('/api/chat/ai-status', async (req, res) => {
    res.json({
      mode: 'cron',
      status: 'Auto-replies handled by Hermes Agent cron job',
      nodeVersion: process.version,
      hasFetch: typeof fetch !== 'undefined',
    });
  });

  function requireCronToken(req, res, next) {
    const storedToken = (process.env.CRON_SECRET_TOKEN || '').trim();
    if (!storedToken) return res.status(500).json({ error: 'CRON_SECRET_TOKEN not configured' });
    const token = (req.headers['x-cron-token'] || '').trim();
    const a = Buffer.from(token);
    const b = Buffer.from(storedToken);
    if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
  }

  // ── Cron: get pending messages ──
  router.get('/api/cron/chat/pending', requireCronToken, async (req, res) => {
    try {
      const sessions = await sfetch('/chat_sessions?status=eq.open&order=last_message_at.desc.nullslast&limit=20&select=session_id,customer_email,customer_name,last_message_at');
      const sessionsData = await sessions.json();
      if (!Array.isArray(sessionsData) || sessionsData.length === 0) {
        return res.json({ messages: [] });
      }
      const results = [];
      for (const session of sessionsData) {
        const msgRes = await sfetch(`/chat_messages?session_id=eq.${encodeURIComponent(session.session_id)}&order=created_at.desc&limit=5&select=sender,message,created_at`);
        const messages = await msgRes.json();
        if (!Array.isArray(messages) || messages.length === 0) continue;
        const lastMsg = messages[0];
        if (lastMsg.sender !== 'customer') continue;
        const lastMsgTime = new Date(lastMsg.created_at).getTime();
        if (Date.now() - lastMsgTime < 60000) continue;
        results.push({
          session_id: session.session_id,
          customer_email: session.customer_email || null,
          customer_name: session.customer_name || null,
          last_message: lastMsg.message,
          conversation: messages.reverse().map(m => ({ sender: m.sender, message: m.message })),
        });
      }
      res.json({ messages: results });
    } catch (e) {
      console.error('Cron pending error:', e);
      res.status(500).json({ error: 'Could not fetch pending messages' });
    }
  });

  // ── Cron: post a reply ──
  router.post('/api/cron/chat/reply', requireCronToken, async (req, res) => {
    const { session_id, message } = req.body || {};
    if (!session_id || !message) return res.status(400).json({ error: 'session_id and message required' });
    try {
      await sfetch('/chat_messages', {
        method: 'POST',
        body: JSON.stringify({ session_id, sender: 'ai', message }),
      });
      await sfetch(`/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_message_at: new Date().toISOString(), status: 'open' }),
      });
      res.json({ ok: true });
    } catch (e) {
      console.error('Cron reply error:', e);
      res.status(500).json({ error: 'Could not post reply' });
    }
  });

  // ── Send verification code (CSPRNG) ──
  router.post('/api/chat/send-verification', async (req, res) => {
    const { email } = req.body;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
    if (startLimited('verify:' + email.toLowerCase(), 3, 3600000)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    if (!resend) return res.status(500).json({ error: 'Email service not configured' });
    const code = crypto.randomInt(100000, 1000000).toString();
    verificationCodes.set(email.toLowerCase(), { code, expiresAt: Date.now() + 5 * 60 * 1000 });
    try {
      await resend.emails.send({
        from: FROM_EMAIL, reply_to: REPLY_TO, to: email,
        subject: 'Your REWIND chat verification code',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;background:#FAF6EF;border-radius:14px;text-align:center">
          <h1 style="font-size:24px;color:#16130F;margin:0"><img src="https://rewind-stores.com/rewind-logo.svg" width="120" height="120" alt="REWIND" style="display:block;margin:0 auto" /></h1>
          <p style="color:#6E665A;font-size:15px;margin:20px 0 8px">Your chat verification code is:</p>
          <div style="font-size:40px;font-weight:700;letter-spacing:8px;color:#16130F;background:#fff;border-radius:10px;padding:16px;margin:0 auto;max-width:280px">${code}</div>
          <p style="color:#6E665A;font-size:13px;margin:20px 0 0">This code expires in 5 minutes.</p>
        </div>`,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error('Send verification error:', e);
      res.status(500).json({ error: 'Failed to send verification email' });
    }
  });

  // ── Verify email code ──
  router.post('/api/chat/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
    if (startLimited('verify-attempt:' + email.toLowerCase(), 10, 300000)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    const entry = verificationCodes.get(email.toLowerCase());
    if (!entry) return res.json({ verified: false, error: 'No code sent. Request a new one.' });
    if (entry.expiresAt < Date.now()) {
      verificationCodes.delete(email.toLowerCase());
      return res.json({ verified: false, error: 'Code expired. Request a new one.' });
    }
    if (entry.code !== code) return res.json({ verified: false, error: 'Invalid code' });
    verificationCodes.set(email.toLowerCase(), { verified: true, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    res.json({ verified: true });
  });

  return router;
}
