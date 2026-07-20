import webPush from 'web-push';
import express from 'express';

const VAPID_PUBLIC_KEY = 'BNewrKRg9ASnQuZ5hBF-4I9_s-R9FKgh2CkhqZ9l9QFwJTnJyJByDfMM3-xvM8wDHCyAXnpbvkVqQdMDzmenNOw';
const VAPID_PRIVATE_KEY = '0MTkN7XNh8OdWAXHUwhrW-5o5Nf94nhw-nbD1junI5s';
webPush.setVapidDetails('mailto:orders@rewind-stores.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export function getVapidPublicKey() { return VAPID_PUBLIC_KEY; }

export async function sendPushNotification(title, body, url) {
  url = url || '/#admin';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  if (!SERVICE_KEY || !SUPABASE_URL) return;
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?select=*', {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    });
    if (!res.ok) return;
    const subs = await res.json();
    if (!Array.isArray(subs)) return;
    const payload = JSON.stringify({ title, body, url, tag: 'rewind-chat' });
    for (const sub of subs) {
      if (!sub.subscription) continue;
      try {
        await webPush.sendNotification(sub.subscription, payload);
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?id=eq.' + sub.id, {
            method: 'DELETE',
            headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
          }).catch(() => {});
        }
      }
    }
  } catch {}
}

const router = express.Router();

router.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post('/api/push/subscribe', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'subscription required' });
  if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const checkRes = await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint) + '&select=id', {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    });
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) return res.json({ ok: true });
    await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions', {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ subscription: sub }),
    });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to save subscription' }); }
});

router.delete('/api/push/unsubscribe', async (req, res) => {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const { endpoint } = req.body;
  if (!endpoint || !SERVICE_KEY || !SUPABASE_URL) return res.status(400).json({ error: 'endpoint required' });
  try {
    await fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(endpoint), {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to unsubscribe' }); }
});

export default router;
