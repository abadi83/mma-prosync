// MMA ProSync Service Worker — v2 (network-first, auto-update)
const CACHE_NAME = 'mma-prosync-v2';

// Hanya cache asset statis yang jarang berubah
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  // Langsung aktif, jangan nunggu tab lama ditutup
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  // Hapus semua cache versi lama
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
    ))
  );
  // Claim semua client biar SW baru langsung pegang
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Hanya tangani GET request
  if (event.request.method !== 'GET') return;

  // Untuk halaman HTML (navigasi) — selalu network first, jangan cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback: kalau offline, coba cache
        return caches.match(event.request);
      })
    );
    return;
  }

  // Untuk asset statis — cache first, network fallback
  const url = new URL(event.request.url);
  const isStatic = STATIC_ASSETS.some(a => url.pathname.endsWith(a.replace(/^\//, '')));

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      }))
    );
    return;
  }

  // Untuk JS/CSS chunks & lainnya — network only, jangan cache
  event.respondWith(fetch(event.request));
});
