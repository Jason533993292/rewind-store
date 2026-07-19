// Service Worker for REWIND — push notifications & background sync
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// Listen for push events (for future use with push API)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    self.registration.showNotification(data.title || 'REWIND', {
      body: data.body || '',
      icon: data.icon || '/favicon.png',
      tag: data.tag || 'rewind-notification',
      data: { url: data.url || '/#admin' },
    });
  } catch {}
});

// Open the admin panel when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/#admin';
  event.waitUntil(clients.openWindow(url));
});
