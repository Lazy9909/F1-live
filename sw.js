/* ─────────────────────────────────────────────────────────────────
   F1 Live Updates — Service Worker
   Strategy: cache-first for the app shell (HTML, fonts, icons),
   network-only for all API calls (data must always be fresh).
───────────────────────────────────────────────────────────────── */
const CACHE   = 'f1-live-v1';
const SHELL   = [
  './',
  './f1-live-updates.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

/* Install — pre-cache the app shell */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {})) // non-fatal if icons missing
      .then(() => self.skipWaiting())
  );
});

/* Activate — delete old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch — network-only for APIs, cache-first for everything else */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  /* Always go to network for live data — never serve stale API responses */
  if(url.includes('openf1.org') || url.includes('anthropic.com') || url.includes('fonts.googleapis')){
    return; // let browser handle normally
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
