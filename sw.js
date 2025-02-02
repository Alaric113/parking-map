const CACHE_NAME = 'parking-map-v1';
const ASSETS = [
  '/parking-map/', // 確保這裡是完整路徑
  '/parking-map/index.html',
  '/parking-map/styles.css',
  '/parking-map/main.js',
  '/parking-map/icon-192x192.png',
  '/parking-map/icon-512x512.png'
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

// 攔截網絡請求並返回緩存內容
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});