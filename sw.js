/* ─────────────────────────────────────────────────────────────────
   F1 Live Updates — Service Worker v2
   Strategy:
     • App shell (HTML, manifest, icons) → cache-first + offline fallback
     • API calls (openf1.org, anthropic.com, fonts) → network-only
     • Offline: serve the cached shell; show offline message if uncached
───────────────────────────────────────────────────────────────── */
const CACHE   = 'f1-live-v2';
const SHELL   = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

/* Inline offline fallback — shown when app shell isn't cached yet */
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="theme-color" content="#0a0a0a"/>
<title>F1 Live — Offline</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#f0f0f0;
    min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;}
  .wrap{max-width:320px;}
  .icon{font-size:56px;margin-bottom:20px;}
  h1{font-size:26px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#e10600;margin-bottom:8px;}
  p{font-size:14px;color:#666;line-height:1.6;margin-bottom:20px;}
  button{background:#e10600;border:none;color:#fff;font-size:14px;font-weight:700;
    padding:12px 28px;border-radius:6px;cursor:pointer;letter-spacing:.5px;text-transform:uppercase;}
  button:active{opacity:.85;}
</style>
</head>
<body>
<div class="wrap">
  <div class="icon">📡</div>
  <h1>No Connection</h1>
  <p>F1 Live Updates needs an internet connection to fetch race data. Check your connection and try again.</p>
  <button onclick="location.reload()">Try Again</button>
</div>
</body>
</html>`;

/* ── Install — pre-cache the app shell ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {})) // non-fatal if some assets missing
      .then(() => self.skipWaiting())
  );
});

/* ── Activate — delete stale caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  /* Network-only: live data endpoints — never serve stale responses */
  if(
    url.includes('openf1.org') ||
    url.includes('anthropic.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  ){
    return; // let the browser handle normally; no caching
  }

  /* App shell: cache-first, fall back to network, then offline page */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(resp => {
        /* Cache successful GET responses for the shell */
        if(resp && resp.status === 200 && e.request.method === 'GET'){
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => {
        /* Offline — return the inline fallback page for navigation requests */
        if(e.request.mode === 'navigate'){
          return new Response(OFFLINE_HTML, { headers:{ 'Content-Type':'text/html' } });
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
