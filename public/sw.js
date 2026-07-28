/**
 * wewed — service worker
 *
 * Strategies:
 *  - Navigation requests (HTML pages):  network-first, fallback to cached "/".
 *    This keeps the live countdown / RSVP data fresh when online, but still
 *    serves the app shell offline (critical for flaky venue Wi-Fi).
 *  - Static assets (images, css, js, fonts): cache-first, fallback to network.
 *    Stable assets rarely change and load instantly from cache.
 *  - API requests (/api/*):                network-only.
 *    Dynamic data (RSVPs, votes, messages) must never be served stale.
 *
 * Bump CACHE_VERSION to invalidate old caches on deploy.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `wewed-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `wewed-runtime-${CACHE_VERSION}`;

// Assets pre-cached at install time so the app is usable offline immediately.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/hero-wedding.png',
  '/icon-192.png',
  '/icon-512.png',
];

// ────────────────────────────────────────────────────────────────────────────
// Install — pre-cache the app shell.
// ────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Use individual put() calls so one missing asset doesn't fail the whole install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) {
              await cache.put(url, res.clone());
            }
          } catch (_err) {
            // Asset missing — skip silently, we'll lazy-cache on first fetch.
          }
        }),
      );
      // Activate immediately rather than waiting for old SW to die.
      await self.skipWaiting();
    })(),
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Activate — purge old caches from previous versions.
// ────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** True for same-origin GET requests only. */
function isCacheableMethod(request) {
  return request.method === 'GET';
}

/** Static-asset requests: images, stylesheets, scripts, fonts, etc. */
function isStaticAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|woff2?|ttf|otf)(?:\?.*)?$/i.test(
      url.pathname,
    )
  );
}

/** API calls — never cached. */
function isApiRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Fetch — route by request type.
// ────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GETs; let the browser handle POST/PUT/etc normally.
  if (!isCacheableMethod(request)) return;

  // 1. API → network only.
  if (isApiRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Navigation (HTML) → network-first, fallback to cache, fallback to "/".
  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // Cache a copy for future offline use.
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch (_err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/');
          if (fallback) return fallback;
          return new Response(
            '<h1>Offline</h1><p>wewed is unavailable until you reconnect.</p>',
            {
              status: 503,
              statusText: 'Offline',
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            },
          );
        }
      })(),
    );
    return;
  }

  // 3. Static assets → cache-first, fallback to network (and lazy-cache).
  if (isStaticAsset(request)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok && fresh.type === 'basic') {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (_err) {
          // Nothing we can do offline for an uncached asset.
          return Response.error();
        }
      })(),
    );
    return;
  }

  // 4. Everything else (same-origin or cross-origin XHRs) → try network, no cache.
  // Fall through to default browser behaviour by not calling respondWith.
});

// ────────────────────────────────────────────────────────────────────────────
// Message handler — allows the page to trigger an immediate update.
// ────────────────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'wewed:skip-waiting') {
    self.skipWaiting();
  }
});
