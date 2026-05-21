// SkinScan AI — Service Worker v1
// Vanilla JS service worker — no Workbox dependency required.
// Handles offline caching, asset caching, and PWA install.

const CACHE_VERSION = 'skinscan-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;
const FONT_CACHE    = `${CACHE_VERSION}-fonts`;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
];

// ── Install: precache shell assets ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, IMAGE_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !validCaches.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: caching strategies ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests
  if (request.method !== 'GET') return;

  // 2. Skip Supabase API — always network
  if (url.hostname.includes('supabase.co')) return;

  // 3. Skip chrome-extension and non-http
  if (!url.protocol.startsWith('http')) return;

  // 4. Google Fonts — cache first, 1 year
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE, 365));
    return;
  }

  // 5. Images — cache first, 30 days
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 30));
    return;
  }

  // 6. JS/CSS/fonts from same origin — stale-while-revalidate
  if (
    url.origin === self.location.origin &&
    (request.destination === 'script' ||
     request.destination === 'style' ||
     request.destination === 'font')
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // 7. Navigation (HTML pages) — network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match('/').then((cached) =>
            cached ?? new Response('Offline — please reconnect.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          )
        )
    );
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName, maxAgeDays) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    const date = cached.headers.get('date');
    if (date) {
      const age = (Date.now() - new Date(date).getTime()) / 1000 / 60 / 60 / 24;
      if (age < maxAgeDays) return cached;
    } else {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached ?? new Response('', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached ?? fetchPromise;
}
