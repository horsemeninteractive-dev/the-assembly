const CACHE_NAME = 'assembly-v0.10.1'; // Bumped: bypass /auth/ and /api/ routes
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up ALL old caches immediately
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Cleaning up old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
    ])
  );
});

// Paths that should ALWAYS bypass cache to ensure latest index and manifest
const skipCachePaths = ['/', '/index.html', '/manifest.json'];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Permanent Bypass for critical metadata/entry points
  if (skipCachePaths.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. ALWAYS bypass cache for auth callbacks and API routes.
  //    OAuth callback pages contain single-use exchange codes — caching them
  //    would replay a stale/consumed code on subsequent logins.
  //    API routes must never be served stale.
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Generic Cache-first Strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Hashed assets (Vite assets) are immutable and safe to return from cache.
        // Unhashed static assets are revalidated via sw.js version bump.
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache new successful requests for later offline use
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

// --- Push Notification Support ---

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Push data not JSON:', event.data.text());
    data = { title: 'The Assembly', body: event.data.text() };
  }

  const title = data.title || 'The Assembly';
  const options = {
    body: data.body || 'Incoming dispatch from the high council...',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.tag || 'general-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle data.url for redirection
  const targetUrl = event.notification.data.url 
    ? new URL(event.notification.data.url, self.location.origin).href 
    : self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this URL
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
