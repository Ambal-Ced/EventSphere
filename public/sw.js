/**
 * Service Worker for offline support and caching
 */
const CACHE_NAME = 'eventsphere-v1';
const STATIC_ASSETS = [
  '/',
  '/images/event.webp',
  '/images/tech-conf.webp',
  '/images/music-fest.webp',
  '/images/food-expo.webp',
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache static assets
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // Cache static assets (images, fonts, etc.)
  if (
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    event.request.url.includes('/_next/static')
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request).then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
        );
      })
    );
  }
});

