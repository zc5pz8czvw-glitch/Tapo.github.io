/* Service worker LIFE RPG (versiunea web/PWA): jocul pornește și fără internet.
   Pagina: întâi rețeaua (ca actualizările să ajungă imediat), apoi copia din cache dacă nu e conexiune.
   Fișierele statice (iconițe, fonturi, manifest): din cache. Cererile către server (cont, AI) nu sunt niciodată puse în cache. */
const VERSION = 'liferpg-__BUILD_HASH__';
const SHELL = ['./', './index.html', './manifest.webmanifest', './fonts/montserrat.css', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './fonts/montserrat-cyrillic-400.woff2', './fonts/montserrat-cyrillic-500.woff2', './fonts/montserrat-cyrillic-600.woff2', './fonts/montserrat-cyrillic-700.woff2'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('liferpg-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // serverul jocului: direct la rețea
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
});
