/**
 * Minimal offline service worker (see issue #69).
 *
 * Strategy (no brittle precache of versioned ?v= assets):
 * - install: precache only stable URLs (offline page, manifest, icons)
 * - navigations: network-first, then cache, then offline.html
 * - same-origin GET: cache-first with background network update
 * - everything else (cross-origin, non-GET): network passthrough
 */
const CACHE_NAME = 'ajr-v1';
const PRECACHE_URLS = [
    '/offline.html',
    '/offline.css',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
            ))
            .then(() => self.clients.claim()),
    );
});

async function navigationResponse(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) cache.put(request, fresh.clone());
        return fresh;
    } catch (_err) {
        const cached = await cache.match(request, { ignoreSearch: false });
        if (cached) return cached;
        return cache.match('/offline.html');
    }
}

async function assetResponse(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: false });
    const network = fetch(request).then((fresh) => {
        if (fresh && fresh.ok) cache.put(request, fresh.clone());
        return fresh;
    }).catch(() => null);
    if (cached) return cached;
    const fresh = await network;
    if (fresh) return fresh;
    return cache.match('/offline.html');
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // fonts/CDN: passthrough
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(navigationResponse(request));
        return;
    }
    if (['script', 'style', 'image', 'font'].includes(request.destination) || url.pathname === '/sw.js') {
        event.respondWith(assetResponse(request));
        return;
    }
    // API calls and the rest: network passthrough (never cached)
});
