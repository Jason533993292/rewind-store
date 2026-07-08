import express from 'express';
import crypto from 'crypto';

const MAX_MESSAGE_LEN = 2000;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function makeLimiter() {
  const hits = new Map();
  return function isLimited(key, max, windowMs) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    return arr.length > max;
  };
}

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

/**
 * @param {object} opts
 * @param {string} opts.SUPABASE_URL
 * @param {string} opts.SUPABASE_SERVICE_ROLE_KEY
 * @param {object|null} opts.resend
 * @param {string} opts.FROM_EMAIL
 * @param {string} opts.REPLY_TO
 * @param {string} opts.notifyEmail
 * @param {function} opts.requireAdmin - the admin auth middleware function
 */
export function buildChatRouter({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, resend, FROM_EMAIL, REPLY_TO, notifyEmail, requireAdmin }) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('buildChatRouter: SUPABASE_SERVICE_ROLE_KEY missing — chat routes will fail at runtime.');
  }

  const router = express.Router();

  const sfetch = (path, opts = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...opts,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });

  const startLimited = makeLimiter();
  const sendLimited = makeLimiter();
  const readLimited = makeLimiter();
  // Daily AI reply cap per IP (resets on server restart — fine for solo shop)
  const aiReplyCount = new Map();

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

    // Check if email is blocked
    if (customer_email) {
      try {
        const emailCheck = await sfetch(`/blocked_emails?email=eq.${encodeURIComponent(customer_email.toLowerCase().trim())}`);
        const blockedData = await emailCheck.json();
        if (Array.isArray(blockedData) && blockedData.length > 0) {
          return res.status(403).json({ error: 'This email has been blocked.' });
        }
      } catch {}
    }

    // Check if IP is blocked
    try {
      const ipCheck = await sfetch(`/blocked_ips?ip_address=eq.${encodeURIComponent(ip)}`);
      const blockedIpData = await ipCheck.json();
      if (Array.isArray(blockedIpData) && blockedIpData.length > 0) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    } catch {}

    const session_id = crypto.randomUUID();
    try {
      await sfetch('/chat_sessions', {
        method: 'POST',
        body: JSON.stringify({
          session_id,
          customer_email: customer_email ? String(customer_email).slice(0, 200) : null,
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
          subject: `\u{1F4AC} New chat from ${customer_name || customer_email || 'a customer'}`,
          html: `<p style="font-family:sans-serif">${escapeHtml(message.trim())}</p>
                 <p style="font-family:sans-serif"><a href="https://rewind-stores.com/#admin">Open admin chat panel</a></p>`,
        }).catch((e) => console.warn('Chat notify email failed:', e.message));
      }

      res.json({ session_id });

      // Auto-reply with AI (fire-and-forget, separate try/catch so it never touches res)
      (async () => {
        const GEMINI_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_KEY) return;
        // Daily AI reply cap: 15 per IP
        const ip = getIp(req);
        const aiKey = `ai:${ip}`;
        const aiDay = Math.floor(Date.now() / 86400000);
        const aiPrev = aiReplyCount.get(aiKey);
        if (aiPrev && aiPrev.day === aiDay && aiPrev.count >= 15) return;
        aiReplyCount.set(aiKey, { day: aiDay, count: (aiPrev?.count || 0) + 1 });
        try {
          const reply = await getAiAutoReply(message, GEMINI_KEY);
          if (reply) {
            await sfetch('/chat_messages', {
              method: 'POST',
              body: JSON.stringify({ session_id, sender: 'ai', message: reply }),
            });
          }
        } catch (e) {
          console.warn('AI auto-reply failed:', e.message);
        }
      })();
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
      res.json({ ok: true });
    } catch (e) {
      console.error('chat/send error:', e);
      res.status(500).json({ error: 'Could not send message' });
    }
  });

  // ── Customer: poll messages ──
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

  // ── Admin: reply ──
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

  // ── Admin: delete a session and all its messages ──
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

  return router;
}

// ── AI auto-reply for common questions ──
// Used by the chat system to auto-answer FAQs about products, sizing, shipping
export async function getAiAutoReply(messageText, GEMINI_API_KEY) {
  try {
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an AI assistant for REWIND vintage streetwear. Answer customer questions concisely (max 2-3 sentences) based on this knowledge:

- All product details (material, size, era, care) are listed in the product's info panel on the website
- If the customer asks about a specific item, tell them to check the item details in the product card
- Shipping: €8 flat rate within EU. Free shipping over €150
- Returns: 14-day free returns
- Each item is unique (vintage, one of one)
- Items ship within 24 hours
- Authenticated, steam-cleaned before shipping

Customer message: "${messageText}"

Reply helpfully but briefly. If you don't know the answer, say "Contact the owner at orders@rewind-stores.com for more info."`
          }]
        }],
        generationConfig: { maxOutputTokens: 300 },
      }),
    });
    const aiData = await aiRes.json();
    return aiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}
