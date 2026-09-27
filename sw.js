// Service worker: offline cache for the app shell and dictionary data.
const VERSION = 'parola-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/app.css', './icons/icon.svg', './data/vocab.json', './data/verbs.json', './data/stats.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => null)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  // network first for JS/HTML (so updates arrive), cache first for data
  const isData = req.url.includes('/data/');
  if (isData) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
  } else {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
  }
});
