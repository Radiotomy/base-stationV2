/* BASE Station service worker — v2.
 *
 * Deliberately minimal. The previous version intercepted navigations and could
 * resolve a fetch handler with something that wasn't a Response, which produced
 * "Failed to convert value to 'Response'" and turned page loads into network
 * errors — the app looked frozen and buttons stopped responding because the
 * document itself never settled.
 *
 * Rules now:
 *   - Navigations, API calls, entity traffic, websockets and anything
 *     cross-origin are NEVER intercepted. No respondWith, no opinion.
 *   - Only immutable build output (/assets/**, icons, manifest) is cached, and
 *     every path through the handler returns a real Response or falls back to
 *     the network.
 */

const CACHE = 'bs-static-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only Vite's content-hashed build output and static icons are safe to cache —
// they're immutable, so a cache hit can never serve a stale app.
function isCacheableAsset(url) {
  return url.pathname.startsWith('/assets/')
    || url.pathname === '/manifest.json'
    || /\.(?:woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Anything that isn't a plain same-origin GET for an immutable asset is left
  // completely alone — including page navigations, which is what was breaking.
  if (req.method !== 'GET' || req.mode === 'navigate') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin || !isCacheableAsset(url)) return;

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Only store complete, successful responses; never cache an error or an
        // opaque partial, and never let a cache write failure break the fetch.
        if (res && res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
      // No .catch here that returns undefined — if the network fails, the
      // rejection propagates as a normal fetch failure, exactly as it would
      // without a service worker.
    })
  );
});
