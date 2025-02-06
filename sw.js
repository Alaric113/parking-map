// Cache configuration
const CACHE_VERSION = 'v3.2.0';
const CACHE_NAME = `parking-map-${CACHE_VERSION}`;

// Assets to be cached
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/fav.css',
  './manifest.json',
  './js/app.js',
  './js/api.js',
  './js/map.js',
  './js/settings.js',
  './js/storage.js',
  './js/favorite.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Cache management functions
async function deleteOldCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => {
      if (cacheName !== CACHE_NAME) {
        return caches.delete(cacheName);
      }
    })
  );
}

async function cacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  return cache.addAll(ASSETS);
}

// Install event handler
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      await deleteOldCaches();
      await cacheAssets();
      await self.skipWaiting();
    })()
  );
});

// Activate event handler
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      await deleteOldCaches();
      await self.clients.claim();
    })()
  );
});

// Fetch event handler - Network first, fallback to cache
self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        
        // Cache successful GET requests
        if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        
        return response;
      } catch (error) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      }
    })()
  );
});

// Version check message handler
self.addEventListener('message', event => {
  if (event.data === 'get-version') {
    event.source.postMessage({ version: CACHE_VERSION });
  }
});

// Push notification handler
self.addEventListener('push', event => {
  const payload = event.data ? event.data.text() : '新通知';
  
  const notificationOptions = {
    body: payload,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png'
  };
  
  event.waitUntil(
    self.registration.showNotification('停車地圖通知', notificationOptions)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});