const CACHE_VERSION = 'v3.0.5'; // 每次更新時修改版本號
const CACHE_NAME = `parking-map-${CACHE_VERSION}`;

// 需要缓存的资源列表
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/fav.css',
  './main.js',
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

// 安裝時清除舊緩存並緩存新資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS));
    })
  );
  self.skipWaiting(); // 强制新 Service Worker 立即激活
});

// 激活時清理舊緩存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // 立即控制所有客户端
});

// 優先從網路獲取，失敗時回退緩存
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 如果是靜態資源，更新緩存
        if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// 监听来自页面的消息
self.addEventListener('message', (event) => {
  if (event.data === 'get-version') {
    event.source.postMessage({ version: CACHE_VERSION });
  }
});


// sw.js
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.text() : '新通知';
  const title = '停車地圖通知';

  const options = {
      body: payload,
      icon: '/icons/icon-192x192.png', // 替换为你的图标路径
      badge: '/icons/badge-72x72.png', // 替换为你的徽章路径
  };

  event.waitUntil(
      self.registration.showNotification(title, options)
  );
});

// 处理通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // 关闭通知

  // 打开应用页面
  event.waitUntil(
      clients.openWindow('/') // 替换为你的应用首页路径
  );
});