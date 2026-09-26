// Spectrum Outfitters Service Worker
importScripts(new URL('./pushNotificationPayload.js', self.location.href).href);

const CACHE_VERSION = 'v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  const rawText = event.data ? event.data.text() : '';
  const note = parsePushEventData(rawText);
  event.waitUntil(
    self.registration.showNotification(note.title, {
      body: note.body,
      icon: '/spectrum-icon.png',
      badge: '/spectrum-icon.png',
      tag: note.tag,
      data: { url: note.url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = notificationClickUrl(event.notification.data);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
