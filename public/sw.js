// BASE Station service worker — app shell caching + offline library support.
// Strategy:
//  - Navigations & static assets: network-first, falling back to cache when offline.
//  - Entity/API GET reads: cache-first-refresh — serve the last cached response
//    instantly if offline, otherwise fetch fresh and update cache.
// This lets the app shell load offline and lets pages that already fetched a
// user's library, tracks, etc. re-render from cache when there's no connection.

const CACHE_VERSION = 'base-station-v2';
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('base-station-') && key !== RUNTIME_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.includes('/api/apps/') && url.pathname.includes('/entities/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin navigations/assets + our own API reads; let
  // everything else (third-party audio CDNs, analytics, etc.) pass through untouched.
  if (url.origin !== self.location.origin && !isApiRequest(url)) return;

  if (isApiRequest(url)) {
    // Entity list/get reads — cache for offline library browsing.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === 'navigate') {
    // App shell — network-first so users always get the latest build when online.
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets (js/css/images) — network-first, cache fallback for offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
