// Spectrum Outfitters Service Worker

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Spectrum Outfitters', body: event.data ? event.data.text() : '' };
  }

  const {
    title = 'Spectrum Outfitters',
    body = '',
    icon = '/spectrum-icon.png',
    badge = '/spectrum-icon.png',
    url = '/',
    tag
  } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: tag || 'spectrum-notification',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find(
          (c) => c.url.startsWith(self.location.origin) && 'focus' in c
        );
        if (existing) {
          existing.focus();
          if ('navigate' in existing) existing.navigate(url);
        } else {
          self.clients.openWindow(url);
        }
      })
  );
});
