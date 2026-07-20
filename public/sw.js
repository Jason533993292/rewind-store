// Service Worker for REWIND push notifications
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(self.registration.showNotification(data.title || 'REWIND'), {
      body: data.body || '',
      icon: '/favicon.png',
      tag: data.tag || 'rewind-notification',
      data: { url: data.url || '/#admin' },
    });
  } catch {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/#admin';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const matchingClient = windowClients.find((c) => c.url === url);
      if (matchingClient) {
        matchingClient.focus();
      } else {
        clients.openWindow(url);
      }
    })
  );
});
