// Disposable probe shell plus the runtime's own CacheStorage assets. This is
// not the production pack installer and does not claim independent hash checks.
const CACHE = 'parola-quality-probe-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    if (/\/(?:quality\.html|assets\/(?:quality-entry\.mjs|llm-worker\.mjs|manifest\.json))$/.test(url.pathname)) {
      const cache = await caches.open(CACHE);
      try { const response = await fetch(event.request); if (response.ok) await cache.put(event.request, response.clone()); return response; }
      catch { return (await cache.match(event.request)) || Response.error(); }
    }
    return (await caches.match(event.request)) || fetch(event.request);
  })());
});
