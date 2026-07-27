#!/usr/bin/env node
/**
 * Chat Cron — Polls unanswered chat messages for Hermes Agent to reply to.
 * 
 * Mode 1 (read):  node chat-cron.js          -> outputs unanswered messages as JSON
 * Mode 2 (reply): node chat-cron.js SESSION_ID "reply text"  -> posts reply to Supabase
 *
 * Environment variables (from Railway):
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

async function main() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(JSON.stringify({ error: 'Supabase not configured' }));
    process.exit(1);
  }

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  async function fetchSupabase(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    return r.json();
  }

  async function postSupabase(path, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Supabase POST ${r.status}: ${await r.text()}`);
  }

  // ── Mode 2: Post a reply ──
  if (process.argv[2] && process.argv[3]) {
    const session_id = process.argv[2];
    const message = process.argv[3];
    try {
      await postSupabase('/chat_messages', { session_id, sender: 'ai', message });
      await fetch(`${SUPABASE_URL}/rest/v1/chat_sessions?session_id=eq.${encodeURIComponent(session_id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ last_message_at: new Date().toISOString(), status: 'open' }),
      });
      console.log(JSON.stringify({ ok: true, session_id }));
    } catch (e) {
      console.error(JSON.stringify({ error: e.message }));
      process.exit(1);
    }
    return;
  }

  // ── Mode 1: Read unanswered messages ──
  try {
    const sessions = await fetchSupabase(
      '/chat_sessions?status=eq.open&order=last_message_at.desc.nullslast&limit=20&select=session_id,customer_email,customer_name,last_message_at'
    );

    if (!Array.isArray(sessions) || sessions.length === 0) {
      console.log(JSON.stringify({ messages: [] }));
      return;
    }

    // Batch: one query for all candidate sessions' recent messages instead
    // of one sequential fetch per session (up to 20 round-trips before),
    // then group client-side by session_id.
    const ids = sessions.map(s => s.session_id);
    const allMessages = await fetchSupabase(
      `/chat_messages?session_id=in.(${ids.map(encodeURIComponent).join(',')})&order=created_at.desc&select=session_id,sender,message,created_at`
    );

    const bySession = new Map();
    if (Array.isArray(allMessages)) {
      for (const m of allMessages) {
        if (!bySession.has(m.session_id)) bySession.set(m.session_id, []);
        const bucket = bySession.get(m.session_id);
        if (bucket.length < 5) bucket.push(m);
      }
    }

    const results = [];
    for (const session of sessions) {
      const messages = bySession.get(session.session_id) || [];
      if (messages.length === 0) continue;

      const lastMsg = messages[0];
      if (lastMsg.sender !== 'customer') continue;

      const lastMsgTime = new Date(lastMsg.created_at).getTime();
      if (Date.now() - lastMsgTime < 60000) continue;

      results.push({
        session_id: session.session_id,
        customer_email: session.customer_email || null,
        customer_name: session.customer_name || null,
        last_message_at: session.last_message_at,
        last_message: lastMsg.message,
        conversation: messages.reverse().map(m => ({
          sender: m.sender,
          message: m.message,
        })),
      });
    }

    if (results.length === 0) {
      console.log(JSON.stringify({ messages: [] }));
      return;
    }

    console.log(JSON.stringify({ messages: results }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
}

main();
