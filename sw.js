/* ─────────────────────────────────────────────────────────────────
   F1 Live Updates — Service Worker v2
   · Cache-first for app shell (HTML, manifest, icons)
   · Network-only for all API / font calls
   · Offline fallback page for navigation requests
───────────────────────────────────────────────────────────────── */
const CACHE = 'f1-live-v2';

/* Core shell — must exist. Icons are optional (may not be deployed). */
const SHELL_REQUIRED = ['./', './index.html', './manifest.json'];
const SHELL_OPTIONAL = ['./icon-192.png', './icon-512.png'];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="theme-color" content="#0a0a0a"/>
  <title>F1 Live Updates — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#f0f0f0;
      min-height:100vh;display:flex;flex-direction:column;align-items:center;
      justify-content:center;padding:24px;text-align:center;}
    .logo{font-size:28px;font-weight:900;letter-spacing:2px;color:#e10600;
      text-transform:uppercase;margin-bottom:4px;}
    .logo span{color:#f0f0f0;}
    .ico{font-size:52px;margin:28px 0 16px;}
    h2{font-size:22px;font-weight:700;letter-spacing:.5px;margin-bottom:8px;}
    p{font-size:14px;color:#666;line-height:1.6;max-width:300px;}
    button{margin-top:28px;background:#e10600;color:#fff;border:none;
      border-radius:8px;padding:12px 28px;font-size:15px;font-weight:700;
      letter-spacing:.5px;cursor:pointer;text-transform:uppercase;}
    button:active{opacity:.85;}
  </style>
</head>
<body>
  <div class="logo">F1 <span>Live Updates</span></div>
  <div class="ico">📡</div>
  <h2>You're Offline</h2>
  <p>No internet connection detected. Connect to a network to get live race data, timings and team radio.</p>
  <button onclick="location.reload()">Try Again</button>
</body>
</html>`;

/* ── Install: cache required shell, attempt optional files individually ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      /* Required files — if any fail, install fails (intentional) */
      await c.addAll(SHELL_REQUIRED);
      /* Optional files — cache if available, silently skip if missing */
      await Promise.all(
        SHELL_OPTIONAL.map(url => c.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: network-only for APIs, cache-first for shell ── */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  /* Always network-only — never cache live data or external resources */
  if(
    url.includes('openf1.org') ||
    url.includes('anthropic.com') ||
    url.includes('fonts.googleapis') ||
    url.includes('fonts.gstatic')
  ) return;

  /* Navigation requests: cache-first, offline fallback */
  if(e.request.mode === 'navigate'){
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached || fetch(e.request))
        .catch(() => new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }))
    );
    return;
  }

  /* Sub-resources: cache-first, network fallback */
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
