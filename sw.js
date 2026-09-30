// Service worker: offline cache for the app shell (HTML, CSS, every JS module) and the dictionary data.
// Bump VERSION when a file is added to SHELL or the data schema changes (old caches are dropped on activate).
// Ordinary data updates need no bump: /data/ is served from the cache and refreshed in the background.
const VERSION = 'parola-v10-iphone-completion';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/learn.css', './css/reference.css', './css/games.css', './css/views-a.css', './css/views-b.css', './css/views-c.css',
  './css/adaptive.css', './css/course.css', './css/journey.css',
  './icons/icon.svg',
  './js/app.js', './js/components.js', './js/completion-menu.js', './js/conjugator.js', './js/data.js', './js/fx.js', './js/icons.js', './js/irregular.js', './js/source.js', './js/srs.js', './js/store.js', './js/sync.js', './js/ui.js',
  './js/views/addWord.js', './js/views/browse.js', './js/views/entry.js', './js/views/games.js', './js/views/grammar.js', './js/views/home.js', './js/views/learn.js', './js/views/learnVerb.js', './js/views/learnWord.js', './js/views/list.js', './js/views/lists.js', './js/views/play.js', './js/views/profile.js', './js/views/reference.js', './js/views/referenceEntry.js', './js/views/review.js', './js/views/scope.js', './js/views/search.js', './js/views/walkthrough.js', './js/views/words.js',
  './js/games/crossword.js', './js/games/engine.js', './js/games/flashcards.js', './js/games/hangman.js', './js/games/index.js', './js/games/matching.js', './js/games/questions.js', './js/games/sentence.js', './js/games/speed.js',
  './js/learning/model.js', './js/learning/curriculum.js', './js/learning/content.js', './js/learning/questions.js', './js/learning/diagnose.js', './js/learning/integration.js',
  './js/views/course.js', './js/views/learnAdaptive.js', './js/views/learnJourney.js',
  './js/learning/journey.js', './js/learning/lesson-content.js', './js/learning/lesson-questions.js', './js/learning/word-questions.js', './js/learning/sentence-lookup.js', './js/learning/sentence-panel.js', './js/learning/lesson-activities.js', './js/learning/activity-panel.js', './js/learning/lesson-overview.js', './js/learning/progressive-content.js',
  './data/vocab.json', './data/verbs.json', './data/stats.json', './data/grammar.json',
];
// Activate only when the complete shell is cached. A missing module must leave the
// prior working offline shell active instead of replacing it with an incomplete one.
// cache: 'no-cache' revalidates every file with the origin (GitHub Pages sends max-age=600, so a plain lookup could pin
// the previous build's copies under the new VERSION for ten minutes after a deploy) while an unchanged file still comes
// back as a 304 instead of a full re-download ('reload' would fetch the 3.4 MB dictionary a second time on first install)
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// store only successful responses (a 404 or 5xx must never be served offline later)
function put(req, res) {
  if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => null); }
  return res;
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  // network first for JS/HTML/CSS (so updates arrive on the next launch); data: cache first, refreshed in the background.
  // Every network fetch revalidates with the origin (cache: 'no-cache'): a plain fetch would honour the browser HTTP cache
  // (max-age=600 on GitHub Pages), so a relaunch shortly after a deploy could mix modules of two builds — the ones fetched
  // over ten minutes ago from the new build, the rest stale from disk — and a screen would fail to import for the whole
  // session. A conditional request costs one 304 round trip per file and the data refresh sees a data-only deploy at once.
  const isData = req.url.includes('/data/');
  if (isData) {
    e.respondWith(caches.match(req).then(hit => {
      const refresh = fetch(req, { cache: 'no-cache' }).then(res => put(req, res));
      if (hit) { e.waitUntil(refresh.catch(() => null)); return hit; }
      return refresh;
    }));
  } else {
    // offline: the cached copy; index.html only stands in for page navigations, never for a module or asset
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => put(req, res)).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
  }
});
