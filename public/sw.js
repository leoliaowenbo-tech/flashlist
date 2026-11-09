// 闪念清单 (FlashList) 离线优先 Service Worker
const CACHE_NAME = 'flashlist-pwa-v1.1.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只处理 GET 请求，且跳过 Supabase API / Realtime 请求
  if (
    request.method !== 'GET' ||
    request.url.includes('supabase.co') ||
    request.url.startsWith('chrome-extension://')
  ) {
    return;
  }

  // 网络优先 + 离线缓存回退（确保有网时总是加载最新代码，断网/地铁里直接秒开缓存）
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
