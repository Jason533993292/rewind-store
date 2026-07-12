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

      // Generate AI reply BEFORE sending response (Railway may close connection after res.json)
      let aiReply = null;
      try {
        aiReply = await getAiAutoReply(message.trim());
        if (aiReply) {
          await sfetch('/chat_messages', {
            method: 'POST',
            body: JSON.stringify({ session_id, sender: 'ai', message: aiReply }),
          });
          console.log('AI reply saved for', session_id);
        } else {
          console.warn('AI returned null reply for', session_id);
        }
      } catch (e) {
        console.error('AI auto-reply failed:', e.message);
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

  // ── Diagnostic endpoint to check AI configuration ──
  router.get('/api/chat/ai-status', async (req, res) => {
    const results = {
      openaiKeyPresent: !!process.env.OPENAI_API_KEY,
      geminiKeyPresent: !!process.env.GEMINI_API_KEY,
      nodeVersion: process.version,
      hasFetch: typeof fetch !== 'undefined',
      openaiTest: null,
      geminiTest: null,
    };
    // Actually test the OpenAI key with a minimal call AND a chat completion
    if (process.env.OPENAI_API_KEY) {
      try {
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        });
        results.openaiTest = { status: r.status };
        if (r.ok) {
          const data = await r.json();
          results.openaiTest.modelCount = data?.data?.length || 0;
        } else {
          const text = await r.text();
          results.openaiTest.error = text.slice(0, 150);
        }
        // Also test a real chat completion
        const chatR = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say hi' }], max_tokens: 5 }),
        });
        results.openaiChat = { status: chatR.status };
        if (chatR.ok) {
          const d = await chatR.json();
          results.openaiChat.reply = d?.choices?.[0]?.message?.content;
        } else {
          results.openaiChat.error = (await chatR.text()).slice(0, 200);
        }
      } catch (e) {
        results.openaiTest = { error: e.message };
      }
    }
    // Actually test the Gemini key with a minimal call
    if (process.env.GEMINI_API_KEY) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hi' }] }], generationConfig: { maxOutputTokens: 5 } }),
        });
        results.geminiTest = { status: r.status };
        if (r.ok) {
          const data = await r.json();
          results.geminiTest.reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          const text = await r.text();
          results.geminiTest.error = text.slice(0, 150);
        }
      } catch (e) {
        results.geminiTest = { error: e.message };
      }
    }
    // Test Gemini with the full REWIND prompt (same as getAiAutoReply uses)
    if (process.env.GEMINI_API_KEY) {
      try {
        const fullPrompt = `You are an AI assistant for REWIND vintage streetwear. Answer customer questions concisely (max 2-3 sentences) based on this knowledge:

- Shipping: EUR 8 flat rate within EU. Free shipping over EUR 150
- Returns: 14-day free returns
- Each item is unique (vintage, one of one)

Customer message: "What is your return policy?"

Reply helpfully but briefly. If you don't know, say "Contact orders@rewind-stores.com"`;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { maxOutputTokens: 100 } }),
        });
        results.geminiFullPrompt = { status: r.status };
        if (r.ok) {
          const d = await r.json();
          results.geminiFullPrompt.reply = d?.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 200);
        } else {
          results.geminiFullPrompt.error = (await r.text()).slice(0, 200);
        }
      } catch (e) {
        results.geminiFullPrompt = { error: e.message };
      }
    }
    // Also test with euro sign (€) instead of EUR — this is what getAiAutoReply uses
    try {
      const GEMINI_KEY = process.env.GEMINI_API_KEY;
      if (GEMINI_KEY) {
        const euroPrompt = `You are an AI assistant for REWIND vintage streetwear. Answer customer questions concisely (max 2-3 sentences) based on this knowledge:

- All product details (material, size, era, care) are listed in the product's info panel on the website
- If the customer asks about a specific item, tell them to check the item details in the product card
- Shipping: \u20AC8 flat rate within EU. Free shipping over \u20AC150
- Returns: 14-day free returns
- Each item is unique (vintage, one of one)
- Items ship within 24 hours
- Authenticated, steam-cleaned before shipping

Customer message: "How long does EU shipping take?"

Reply helpfully but briefly. If you don't know the answer, say "Contact the owner at orders@rewind-stores.com for more info."`;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: euroPrompt }] }], generationConfig: { maxOutputTokens: 300 } }),
        });
        results.euroPromptTest = { status: r.status };
        if (r.ok) {
          const d = await r.json();
          const reply = d?.candidates?.[0]?.content?.parts?.[0]?.text;
          results.euroPromptTest.reply = reply ? reply.slice(0, 200) : 'EMPTY';
          results.euroPromptTest.replyLength = reply ? reply.length : 0;
        } else {
          results.euroPromptTest.error = (await r.text()).slice(0, 200);
        }
      }
    } catch (e) {
      results.euroPromptTest = { error: e.message };
    }

    // Also call getAiAutoReply directly to test the exact function
    try {
      // Import as dynamic ESM import
      const mod = await import(/* webpackIgnore: true */ './chat-routes.js');
      const autoReply = await mod.getAiAutoReply('What material is the polo set made of?');
      results.getAiAutoReplyResult = autoReply || 'NULL';
    } catch (e) {
      results.getAiAutoReplyResult = 'IMPORT_ERROR: ' + e.message;
    }

    results.finalHealthCheck = 'ok';
    res.json(results);
  });

  return router;
}

// ── AI auto-reply for common questions ──
// Used by the chat system to auto-answer FAQs about products, sizing, shipping
// Falls back from OpenAI to Gemini so either works

/**
 * Try to get an AI reply from OpenAI, Gemini, or null if both fail.
 * OpenAI is tried first; if it fails (key missing, error response, etc.)
 * the function falls through to Gemini automatically.
 */
// Used by the chat system to auto-answer FAQs about products, sizing, shipping
// Uses OpenAI API (Gemini key is available as fallback)
export async function getAiAutoReply(messageText) {
  // Try OpenAI first (already set in Railway env)
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (OPENAI_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `You are an AI assistant for REWIND vintage streetwear. Answer customer questions concisely (max 2-3 sentences) based on this knowledge:

- All product details (material, size, era, care) are listed in the product's info panel on the website
- If the customer asks about a specific item, tell them to check the item details in the product card
- Shipping: €8 flat rate within EU. Free shipping over €150
- Returns: 14-day free returns
- Each item is unique (vintage, one of one)
- Items ship within 24 hours
- Authenticated, steam-cleaned before shipping

Reply helpfully but briefly. If you don't know the answer, say "Contact the owner at orders@rewind-stores.com for more info."` },
            { role: 'user', content: messageText },
          ],
          max_tokens: 300,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply) return reply;
      } else {
        console.warn('OpenAI API returned', res.status, (await res.text()).slice(0, 100));
      }
    } catch (e) {
      console.warn('OpenAI reply failed:', e.message);
    }
  }

  // Fallback: try Gemini
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (GEMINI_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are an AI assistant for REWIND vintage streetwear. Answer customer questions concisely (max 2-3 sentences) based on this knowledge:

- All product details (material, size, era, care) are listed in the product's info panel on the website
- If the customer asks about a specific item, tell them to check the item details in the product card
- Shipping: €8 flat rate within EU. Free shipping over €150
- Returns: 14-day free returns
- Each item is unique (vintage, one of one)
- Items ship within 24 hours
- Authenticated, steam-cleaned before shipping

Customer message: "${messageText}"

Reply helpfully but briefly. If you don't know the answer, say "Contact the owner at orders@rewind-stores.com for more info."` }] }],
          generationConfig: { maxOutputTokens: 300 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return reply;
      } else {
        console.warn('Gemini API returned', res.status);
      }
    } catch (e) {
      console.warn('Gemini reply failed:', e.message);
    }
  }

  return null;
}
