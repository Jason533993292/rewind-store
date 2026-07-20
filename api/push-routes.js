export function getVapidPublicKey() {
  return 'BNewrKRg9ASnQuZ5hBF-4I9_s-R9FKgh2CkhqZ9l9QFwJTnJyJByDfMM3-xvM8wDHCyAXnpbvkVqQdMDzmenNOw';
}

export async function sendPushNotification(title, body, url) {
  url = url || '/#admin';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  if (!SERVICE_KEY || !SUPABASE_URL) return;
  // Lazy-import web-push only when needed (avoids crash if module fails to load)
  let webPush;
  try {
    webPush = (await import('web-push')).default;
    webPush.setVapidDetails('mailto:orders@rewind-stores.com', getVapidPublicKey(), '0MTkN7XNh8OdWAXHUwhrW-5o5Nf94nhw-nbD1junI5s');
  } catch { return; }
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
