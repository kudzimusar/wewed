/**
 * wewed — service worker
 *
 * Strategies:
 *  - Navigation requests (HTML pages):  network-first, fallback to cached "/".
 *  - Next.js build assets (JS/CSS):      network-first, fallback to cache.
 *  - Other static assets:                cache-first, fallback to network.
 *  - API requests (/api/*):              network-only.
 *
 * Push notifications are display-only projections of canonical Wewed notification
 * records. Opening a push always returns to a Wewed deep link where authorization
 * is checked again.
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `wewed-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `wewed-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/hero-wedding.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch (_err) {
            // Missing optional precache assets must not fail installation.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

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

function isCacheableMethod(request) {
  return request.method === 'GET';
}

function isNextBuildAsset(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return /\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|woff2?|ttf|otf)(?:\?.*)?$/i.test(url.pathname);
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isCacheableMethod(request)) return;

  if (isApiRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch (_err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/');
          if (fallback) return fallback;
          return new Response('<h1>Offline</h1><p>wewed is unavailable until you reconnect.</p>', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
      })(),
    );
    return;
  }

  if (isNextBuildAsset(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request, { cache: 'no-cache' });
          if (fresh && fresh.ok && fresh.type === 'basic') {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (_err) {
          const cached = await caches.match(request);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

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
          return Response.error();
        }
      })(),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'wewed:skip-waiting') self.skipWaiting();
});

function safePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch (_err) {
    return { body: event.data.text() };
  }
}

function pushDisplayPayload(payload) {
  if (payload && typeof payload.notification === 'object' && payload.notification !== null) {
    return payload.notification;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

function safeWewedDeepLink(value) {
  if (typeof value !== 'string' || !value.trim()) return '/notifications';
  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin) return '/notifications';
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/notifications';
  } catch (_err) {
    return '/notifications';
  }
}

self.addEventListener('push', (event) => {
  const payload = safePushPayload(event);
  const display = pushDisplayPayload(payload);
  const title = typeof display.title === 'string' && display.title.trim()
    ? display.title.trim()
    : 'Wewed';
  const body = typeof display.body === 'string' ? display.body : 'You have a new Wewed notification.';
  const deepLink = safeWewedDeepLink(display.deepLink || display.url || payload.deepLink || payload.url);
  const tag = typeof display.tag === 'string'
    ? display.tag
    : typeof payload.tag === 'string'
      ? payload.tag
      : undefined;
  const notificationId = typeof display.notificationId === 'string'
    ? display.notificationId
    : typeof payload.notificationId === 'string'
      ? payload.notificationId
      : null;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      renotify: false,
      data: {
        deepLink,
        notificationId,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink = safeWewedDeepLink(event.notification?.data?.deepLink);
  const destination = new URL(deepLink, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (!('focus' in client)) continue;
        try {
          await client.navigate(destination);
          return client.focus();
        } catch (_err) {
          // Try another window or open a fresh Wewed window below.
        }
      }
      return self.clients.openWindow(destination);
    })(),
  );
});
