// Service worker: offline cache for the app shell (HTML, CSS, every JS module), the dictionary data and the course packs.
// VERSION is stamped, never bumped by hand: `node tools/stamp-sw.mjs` rewrites it as '<prefix>-<hash>', where the hash
// covers every SHELL file and this worker's own code, so the same content always gives the same VERSION and any change
// to a precached file or to this file gives a new one (old caches are dropped on activate). Run it after any change to
// the shell, the data or this file; tools/check-shell.mjs fails while the stamp is stale, and the deploy job stamps
// before publishing. Edit the readable prefix by hand only to label a release.
const VERSION = 'parola-v15-ac897ee7b59f';
// Downloaded lesson audio: kept across updates. Must equal AUDIO_CACHE in js/learning/course-v2-media.js (check-shell checks).
const AUDIO_CACHE = 'parola-course-audio-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/learn.css', './css/reference.css', './css/games.css', './css/views-a.css', './css/views-b.css', './css/views-c.css',
  './css/grammar-course.css', './css/adaptive.css', './css/course.css', './css/journey.css',
  './icons/icon.svg',
  './js/app.js', './js/components.js', './js/completion-menu.js', './js/conjugator.js', './js/data.js', './js/fx.js', './js/icons.js', './js/irregular.js', './js/source.js', './js/srs.js', './js/store.js', './js/sync.js', './js/ui.js',
  './js/views/addWord.js', './js/views/browse.js', './js/views/entry.js', './js/views/games.js', './js/views/grammar.js', './js/views/home.js', './js/views/learn.js', './js/views/learnVerb.js', './js/views/learnWord.js', './js/views/list.js', './js/views/lists.js', './js/views/play.js', './js/views/profile.js', './js/views/reference.js', './js/views/referenceEntry.js', './js/views/review.js', './js/views/scope.js', './js/views/search.js', './js/views/walkthrough.js', './js/views/words.js',
  './js/games/crossword.js', './js/games/engine.js', './js/games/flashcards.js', './js/games/hangman.js', './js/games/index.js', './js/games/matching.js', './js/games/questions.js', './js/games/sentence.js', './js/games/speed.js',
  './js/learning/model.js', './js/learning/curriculum.js', './js/learning/content.js', './js/learning/questions.js', './js/learning/diagnose.js', './js/learning/integration.js',
  './js/views/coursePlacement.js', './js/learning/course-v2-placement.js', './js/views/learnCourse.js', './js/learning/course-v2-engine.js', './js/learning/course-v2-state.js', './js/learning/course-v2-activities.js', './js/learning/course-v2-media.js',
  './js/views/learnGrammar.js', './js/views/courseSession.js',
  './js/learning/grammar-lexicon.js','./js/learning/course-v2-glosses.js', './js/learning/grammar-state.js', './js/learning/grammar-course.js', './js/learning/grammar-journey.js',
  './js/views/course.js', './js/views/learnAdaptive.js', './js/views/learnJourney.js',
  './js/learning/journey.js', './js/learning/lesson-content.js', './js/learning/lesson-questions.js', './js/learning/word-questions.js', './js/learning/sentence-lookup.js', './js/learning/sentence-panel.js', './js/learning/lesson-activities.js', './js/learning/activity-panel.js', './js/learning/lesson-overview.js', './js/learning/progressive-content.js', './js/learning/legacy-progressive-content.js', './js/learning/verb-progressive-data.js', './js/learning/verb-lexicon-extra.js', './js/learning/verb-lexicon.js',
  './data/grammar-course/A1.json', './data/grammar-course/A2.json', './data/grammar-course/B1.json', './data/grammar-course/B2.json', './data/grammar-course/C1.json', './data/grammar-course/C2.json',
  './data/course-v2/Foundations.json', './data/course-v2/A1.json', './data/course-v2/A2.json', './data/course-v2/B1.json', './data/course-v2/B2.json', './data/course-v2/C1.json', './data/course-v2/C2.json', './data/course-v2/audio.json',
  './data/vocab.json', './data/verbs.json', './data/stats.json', './data/grammar.json',
];
// Activate only when the complete shell is cached. A missing module must leave the
// prior working offline shell active instead of replacing it with an incomplete one.
// cache: 'no-cache' revalidates every file with the origin (GitHub Pages sends max-age=600, so a plain lookup could pin
// the previous build's copies under the new VERSION for ten minutes after a deploy) while an unchanged file still comes
// back as a 304 instead of a full re-download ('reload' would fetch the 3.4 MB dictionary a second time on first install)
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting())); });
// Pruning the audio cache runs after claim and outside waitUntil, so it never holds fetches behind activation.
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== AUDIO_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(() => { pruneAudio(); })); });
// A versioned shell is one compatible release. Updates replace it only after
// install has fetched every module and course pack successfully.
const shellURLs=new Set(SHELL.map(path=>new URL(path,self.location.href).href));
// Audio clips are named after a digest of what they say (tools/build-course-audio.py), so a re-voiced clip gets a new
// URL and a cached clip always says what the catalogue installed with this shell says. A clip that catalogue no longer
// lists can neither play nor be removed from the lesson menu, so it is deleted here. Best effort: a missing or unreadable
// catalogue leaves every download in place, and clips the catalogue lists are never touched.
async function pruneAudio() {
  try {
    const catalogue=await (await caches.open(VERSION)).match('./data/course-v2/audio.json');
    const assets=catalogue&&(await catalogue.json()).assets;
    if(!Array.isArray(assets)||!assets.length)return;
    const keep=new Set(assets.map(asset=>new URL(asset.src,self.location.href).href));
    const cache=await caches.open(AUDIO_CACHE);
    await Promise.all((await cache.keys()).filter(req=>!keep.has(req.url)).map(req=>cache.delete(req)));
  } catch { /* keep the downloads */ }
}
async function audioResponse(req) {
  const cache=await caches.open(AUDIO_CACHE);
  const hit=await cache.match(req.url);
  if(!hit)return fetch(req);
  const range=req.headers.get('range');
  if(!range)return hit;
  const bytes=await hit.arrayBuffer(),match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match)return hit;
  const start=match[1]?Number(match[1]):Math.max(0,bytes.byteLength-Number(match[2]));
  const end=match[1]?(match[2]?Math.min(Number(match[2]),bytes.byteLength-1):bytes.byteLength-1):bytes.byteLength-1;
  if(start>end||start>=bytes.byteLength)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.byteLength}`}});
  const headers=new Headers(hit.headers);headers.set('Content-Range',`bytes ${start}-${end}/${bytes.byteLength}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
  return new Response(bytes.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||!req.url.startsWith(self.location.origin))return;
  if(req.url.includes('/audio/course-v2/')){e.respondWith(audioResponse(req));return;}
  const url=new URL(req.url);url.search='';url.hash='';
  if(shellURLs.has(url.href)){
    e.respondWith(caches.open(VERSION).then(async cache=>{
      const hit=await cache.match(url.href);
      if(hit)return hit;
      const response=await fetch(req,{cache:'no-cache'});
      if(response.ok)await cache.put(url.href,response.clone());
      return response;
    }));
    return;
  }
  e.respondWith(fetch(req).catch(()=>caches.open(VERSION).then(cache=>req.mode==='navigate'?cache.match('./index.html'):Response.error())));
});
