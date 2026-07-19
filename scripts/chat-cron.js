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

    const results = [];
    for (const session of sessions) {
      const messages = await fetchSupabase(
        `/chat_messages?session_id=eq.${encodeURIComponent(session.session_id)}&order=created_at.desc&limit=5&select=sender,message,created_at`
      );

      if (!Array.isArray(messages) || messages.length === 0) continue;

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
