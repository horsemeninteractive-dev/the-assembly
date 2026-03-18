const CACHE_NAME = 'assembly-v0.9.7-' + Date.now(); // Dynamic cache name to force update on redeploy
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
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
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

const networkFirstPaths = [
  '/manifest.json'
];

// NEVER cache the index.html or root to ensure we always get latest hashed assets
const skipCachePaths = [
  '/',
  '/index.html'
];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (skipCachePaths.includes(url.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (networkFirstPaths.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Use Cache-First strategy for other assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
