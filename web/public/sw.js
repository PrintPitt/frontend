// PrintPitt service worker (PWA): the app shell opens again without signal; hashed assets are cached.
// Same-origin GET only. Monad RPC, backend, Privy and /api are never cached (chain data must stay fresh).
const CACHE = 'printpitt-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/ikon/ikon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Pages (SPA): network-first so a new deploy is used right away; offline → last shell.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const salin = res.clone();
          caches.open(CACHE).then((c) => c.put('/', salin));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Hashed build assets (/assets/*) and icons/figures: cache-first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/ikon/') || url.pathname.startsWith('/figures/') || url.pathname.startsWith('/models/')) {
    e.respondWith(
      caches.match(req).then(
        (ada) =>
          ada ||
          fetch(req).then((res) => {
            if (res.ok) {
              const salin = res.clone();
              caches.open(CACHE).then((c) => c.put(req, salin));
            }
            return res;
          }),
      ),
    );
  }
});
