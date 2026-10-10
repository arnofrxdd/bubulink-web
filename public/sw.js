// BubuLink Service Worker with Seamless Auto-Update & Push
const CACHE_NAME = 'bubulink-1791628504874';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs/standalone sessions to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Force update message handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Network-First for HTML/version.json to prevent stale iOS PWA screens
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for version check and manifest
  if (url.pathname.endsWith('version.json') || url.pathname.endsWith('manifest.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // For HTML navigation requests: Network first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
});

// Apple Web Push Notification Handler
self.addEventListener('push', (event) => {
  let data = { title: '💖 BubuLink Alert', body: 'New love moment received!' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'apple-touch-icon.png',
    badge: 'icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: self.registration.scope
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = self.registration.scope || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
