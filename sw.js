// Service worker: offline cache for the app shell (HTML, CSS, every JS module) and the dictionary data.
// Bump VERSION when a file is added to SHELL or the data schema changes (old caches are dropped on activate).
// Ordinary data updates need no bump: /data/ is served from the cache and refreshed in the background.
const VERSION = 'parola-v3';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/learn.css', './css/reference.css', './css/games.css', './css/views-a.css', './css/views-b.css', './css/views-c.css',
  './icons/icon.svg',
  './js/app.js', './js/components.js', './js/conjugator.js', './js/data.js', './js/fx.js', './js/icons.js', './js/irregular.js', './js/source.js', './js/srs.js', './js/store.js', './js/sync.js', './js/ui.js',
  './js/views/addWord.js', './js/views/browse.js', './js/views/entry.js', './js/views/games.js', './js/views/grammar.js', './js/views/home.js', './js/views/learn.js', './js/views/learnVerb.js', './js/views/learnWord.js', './js/views/list.js', './js/views/lists.js', './js/views/play.js', './js/views/profile.js', './js/views/reference.js', './js/views/referenceEntry.js', './js/views/review.js', './js/views/scope.js', './js/views/search.js', './js/views/walkthrough.js', './js/views/words.js',
  './js/games/crossword.js', './js/games/engine.js', './js/games/flashcards.js', './js/games/hangman.js', './js/games/index.js', './js/games/matching.js', './js/games/questions.js', './js/games/sentence.js', './js/games/speed.js',
  './data/vocab.json', './data/verbs.json', './data/stats.json', './data/grammar.json',
];
// files are added one by one so a single missing file cannot void the whole precache (addAll is all-or-nothing);
// cache: 'reload' bypasses the HTTP cache (GitHub Pages sends max-age=600), or a new worker could pin the previous
// build's copies under the new VERSION for the first ten minutes after a deploy
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// store only successful responses (a 404 or 5xx must never be served offline later)
function put(req, res) {
  if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => null); }
  return res;
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  // network first for JS/HTML/CSS (so updates arrive on the next launch); data: cache first, refreshed in the background
  const isData = req.url.includes('/data/');
  if (isData) {
    e.respondWith(caches.match(req).then(hit => {
      const refresh = fetch(req).then(res => put(req, res));
      if (hit) { e.waitUntil(refresh.catch(() => null)); return hit; }
      return refresh;
    }));
  } else {
    // offline: the cached copy; index.html only stands in for page navigations, never for a module or asset
    e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
  }
});
