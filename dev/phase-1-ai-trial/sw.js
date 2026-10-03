const CACHE = 'parola-phase1-disposable-trial-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.op !== 'install') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE); let completed = 0;
    for (const asset of event.data.assets) {
      const url = new URL(asset.path, self.registration.scope).href;
      const old = await cache.match(url);
      if (!old || old.headers.get('x-trial-sha256') !== asset.sha256) {
        const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw Error(`Missing ${asset.path}`);
        const bytes = await response.arrayBuffer();
        if (asset.bytes != null && bytes.byteLength !== asset.bytes) throw Error(`Wrong size: ${asset.path}`);
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
        if (asset.sha256 && hash !== asset.sha256) throw Error(`Hash mismatch: ${asset.path}`);
        const headers = new Headers(response.headers); headers.set('x-trial-sha256', asset.sha256 || hash);
        await cache.put(url, new Response(bytes, { headers }));
      }
      event.ports[0]?.postMessage({ completed: ++completed, total: event.data.assets.length, path: asset.path });
    }
    event.ports[0]?.postMessage({ done: true });
  })().catch(error => event.ports[0]?.postMessage({ error: String(error.message || error) })));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.cache === 'no-store') { event.respondWith(fetch(event.request)); return; }
  const shell = /\/(?:app\.mjs|core\.mjs|index\.html|manifest\.webmanifest|cases\.json|assets\/manifest\.json)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith(caches.open(CACHE).then(async cache => shell ? fetch(event.request).catch(async () => (await cache.match(event.request)) || (url.pathname.endsWith('/') ? cache.match(new URL('index.html', self.registration.scope).href) : Response.error())) : (await cache.match(event.request)) || fetch(event.request)));
});
