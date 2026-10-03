// Service worker: offline cache for the app shell (HTML, CSS, every JS module), the dictionary data and the course packs.
// VERSION is stamped, never bumped by hand: `node tools/stamp-sw.mjs` rewrites it as '<prefix>-<hash>', where the hash
// covers every SHELL file and this worker's own code, so the same content always gives the same VERSION and any change
// to a precached file or to this file gives a new one (old caches are dropped on activate). Run it after any change to
// the shell, the data or this file; tools/check-shell.mjs fails while the stamp is stale, and the deploy job stamps
// before publishing. Edit the readable prefix by hand only to label a release.
const VERSION = 'parola-v15-5fc5537c8d14';
// Downloaded lesson audio: kept across updates. Must equal AUDIO_CACHE in js/learning/course-v2-media.js (check-shell checks).
const AUDIO_CACHE = 'parola-course-audio-v2';
// Compatibility for an already-installed retired fit experiment. Its original
// source, model and license remain in the repository; new sites do not publish them.
// Keep the exact previous cache so an already-open old client can finish safely.
const FIT_CACHE = 'parola-fit-scorer-v1';
const AI_PACK_CACHE_PREFIX = 'parola-ai-pack-v1:';
// The experimental assistant (sentence workshop layer 3, js/learning/assistant.js, docs/ASSISTANT-EXPERIMENT.md): WebLLM
// keeps its downloaded weights, model library and config in Cache API caches named 'webllm/model', 'webllm/wasm' and
// 'webllm/config' on this origin. They are kept across updates too (check-shell checks); the files themselves are
// cross-origin, so the fetch handler below never sees them.
const ASSISTANT_CACHE_PREFIX = 'webllm/';
const ASSISTANT_RUNTIME_CACHE = 'parola-assistant-runtime-v1';
const ASSISTANT_RUNTIME_FILES = {"./vendor/webllm/webllm-0.2.85.7e7917ff4d322fe7.mjs":"7e7917ff4d322fe727bcdb11325690e59051d68f0d364b071eba5e76c275df99"};
const SHELL = [
  './js/focus.js',
  './js/learning/practice-authored-sources.js',
  './js/learning/journey-form.js',
  './js/learning/verb-question-history.js',
  './js/learning/verb-question-history-data.js',
  './js/learning/journey-scene.js', './js/learning/practice-sources.js', './js/ai/practice-grounding.js', './js/ai/source-fingerprint.js',
  './js/learning/ai-assistance.js', './js/learning/ai-assistance-panel.js', './js/learning/practice-help.js',
  './js/learning/conversation-continuation.js',
  './js/learning/grammar-evidence.js',
  './js/conversations/study.js',
  './js/ai/language-policy.js', './js/ai/language-scope.js',
  './js/views/learningHistory.js', './js/views/offlineAI.js', './js/learning/course-sense-links.js',
  './', './index.html', './manifest.webmanifest',
  './css/fonts.css',
  './fonts/066710ce7ed235a3.woff2',
  './fonts/0a557721b1f8b36d.woff2',
  './fonts/23af38108404d4b0.woff2',
  './fonts/2fb2e8cbfd52ae46.woff2',
  './fonts/3911b66d9f2e005a.woff2',
  './fonts/4983926d3a16544e.woff2',
  './fonts/62213be8a78b42f1.woff2',
  './fonts/6bbb044ab420e07e.woff2',
  './fonts/7234ed860a9cc830.woff2',
  './fonts/83c005d49d8a6a50.woff2',
  './fonts/a2930b27d13a228b.woff2',
  './fonts/a30ddcd349703aff.woff2',
  './fonts/c268b459a9329e59.woff2',
  './fonts/c89b9cc0bc6262bd.woff2',
  './fonts/db5ff4db83e58042.woff2',
  './fonts/de37de877dc17e45.woff2',
  './fonts/e17cfd15fb96909d.woff2',
  './fonts/f18853f63a870ebe.woff2',
  './js/learning/answer-policy.js',
  './css/app.css', './css/learn.css', './css/reference.css', './css/games.css', './css/views-a.css', './css/views-b.css', './css/views-c.css',
  './css/grammar-course.css', './css/adaptive.css', './css/course.css', './css/journey.css', './css/learnhub.css', './css/sentence-lab.css',
  './icons/icon.svg',
  './js/app.js', './js/components.js', './js/completion-menu.js', './js/conjugator.js', './js/data.js', './js/fx.js', './js/icons.js', './js/irregular.js', './js/source.js', './js/srs.js', './js/store.js', './js/sync.js', './js/ui.js',
  './js/views/addWord.js', './js/views/browse.js', './js/views/entry.js', './js/views/games.js', './js/views/grammar.js', './js/views/home.js', './js/views/homeLevels.js', './js/views/learn.js', './js/views/learnCards.js', './js/views/learnDash.js', './js/views/learnData.js', './js/views/learnSections.js', './js/views/learnVerb.js', './js/views/learnWord.js', './js/views/list.js', './js/views/lists.js', './js/views/play.js', './js/views/profile.js', './js/views/reference.js', './js/views/referenceEntry.js', './js/views/review.js', './js/views/scope.js', './js/views/search.js', './js/views/walkthrough.js', './js/views/words.js',
  './js/games/crossword.js', './js/games/engine.js', './js/games/flashcards.js', './js/games/hangman.js', './js/games/index.js', './js/games/matching.js', './js/games/questions.js', './js/games/sentence.js', './js/games/speed.js',
  './js/learning/model.js', './js/learning/curriculum.js', './js/learning/content.js', './js/learning/questions.js', './js/learning/diagnose.js', './js/learning/integration.js',
  './js/views/coursePlacement.js', './js/learning/course-v2-placement.js', './js/views/learnCourse.js', './js/learning/course-v2-engine.js', './js/learning/course-v2-state.js', './js/learning/course-v2-activities.js', './js/learning/course-v2-media.js', './js/learning/course-words.js',
  './js/learning/sentence-lab.js', './js/learning/sentence-lab-data.js', './js/learning/sentence-lab-activities.js', './js/views/labFrasi.js', './js/views/labFrasiLesson.js', './js/useful-words.js',
  './js/views/learnGrammar.js', './js/views/courseSession.js',
  './js/learning/grammar-lexicon.js','./js/learning/course-v2-glosses.js', './js/learning/grammar-state.js', './js/learning/grammar-course.js', './js/learning/grammar-journey.js',
  './js/views/course.js', './js/views/learnAdaptive.js', './js/views/learnJourney.js',
  './js/learning/journey.js', './js/learning/lesson-content.js', './js/learning/lesson-questions.js', './js/learning/word-questions.js', './js/learning/sentence-lookup.js', './js/learning/sentence-panel.js', './js/learning/lesson-activities.js', './js/learning/activity-panel.js', './js/learning/lesson-overview.js', './js/learning/progressive-content.js', './js/learning/legacy-progressive-content.js', './js/learning/verb-progressive-data.js', './js/learning/verb-lexicon-extra.js', './js/learning/verb-lexicon.js',
  './js/learning/assistant.js',
  './data/grammar-course/A1.json', './data/grammar-course/A2.json', './data/grammar-course/B1.json', './data/grammar-course/B2.json', './data/grammar-course/C1.json', './data/grammar-course/C2.json',
  './data/course-v2/Foundations.json', './data/course-v2/A1.json', './data/course-v2/A2.json', './data/course-v2/B1.json', './data/course-v2/B2.json', './data/course-v2/C1.json', './data/course-v2/C2.json', './data/course-v2/audio.json',
  './data/sentence-lab/presente.json', './data/sentence-lab/passato.json', './data/sentence-lab/futuro.json', './data/sentence-lab/strutture.json', './data/useful-words.json',
  './data/vocab.json', './data/verbs.json', './data/stats.json', './data/grammar.json',
  './data/course-index.json',
  './data/completion-index.json',
  './js/learning/course-vocabulary.js',
  './js/learning/home-learning.js',
  './js/learning/completion-state.js',  './css/conversations.css',
  './js/ai/audio-controller.js',
  './js/ai/grounding.js',
  './js/ai/index.js',
  './js/ai/packs.js',
  './js/ai/pcm-capture-worklet.js',
  './js/ai/pcm-capture.js',
  './js/ai/queue.js',
  './js/ai/sha256.js',
  './js/ai/source-index.js',
  './js/ai/tasks.js',
  './js/ai/teaching.js',
  './js/ai/temporary-audio.js',
  './js/ai/validation.js',
  './js/conversations/backup.js',
  './js/conversations/controller.js',
  './js/conversations/draft-recovery.js',
  './js/conversations/profile-backup.js',
  './js/conversations/runtime.js',
  './js/conversations/speech-session.js',
  './js/conversations/spoken-feedback.js',
  './js/conversations/storage.js',
  './js/conversations/summary.js',
  './js/learning/activity-viewport.js',
  './js/learning/case-coverage.js',
  './js/learning/collections.js',
  './js/learning/course-gloss-kind.js',
  './js/learning/daily-plan.js',
  './js/learning/journey-visit.js',
  './js/learning/migrate-profile.js',
  './js/learning/legacy-profile.js',
  './js/learning/objectives.js',
  './js/learning/plan-panel.js',
  './js/learning/review-session.js',
  './js/views/conversations.js',

];
// Generated by stamp-sw: exact response-body digests for atomic, reusable updates.
const ASSET_HASHES = {"./js/focus.js":"489c51209925583801c113b5e7c8e0be282964e50a222ffdb221cf833c97fe76","./js/learning/practice-authored-sources.js":"ed759c5eaf1024b38f668ddbe86f6a2091b210234f54a05d91f2028f4b11b9b5","./js/learning/journey-form.js":"1b37af6bfdc581cc8cdc304941aaf327ec16f9741a858701b7b3cdd8dc9a3a0c","./js/learning/verb-question-history.js":"ec34981f2ff34476ccf0ded0dcd3f10f1f965489c5192a128dc866c36bcd2343","./js/learning/verb-question-history-data.js":"3d2f81a5864c58463ec4ebacf9f590139f2e6a83e65b15028a98e9f6ca61d28f","./js/learning/journey-scene.js":"3776bd6cb8963515d52c4169933173cf5f56e996528e1995c5a28d0457630d29","./js/learning/practice-sources.js":"0252c9bf02d580fa94b8d9338a899c6e80f3cf536e38dbff6186cf98dc3164a2","./js/ai/practice-grounding.js":"62be9eb05f83662d92efd1f9f3ff2b1e3ba178b5dd630b9ce86d0e17dab74ec8","./js/ai/source-fingerprint.js":"a9f58b9f79601d34e4d65e1b93baab0b9b79ec9e8b650daf72207f28792ccb11","./js/learning/ai-assistance.js":"f5a718f3e2bf9e3c579b3d651f3adf48b5c8c4fdeab580da9ae3da251cdd43b9","./js/learning/ai-assistance-panel.js":"dcb73c44b03146b4c15ae4d9c91acd6fcc628c5312186541db432a7e202e9f7c","./js/learning/practice-help.js":"ae13b467d11bdd4c565938db59a76cc761f4f7b514d9b1537bea231f00a1fecc","./js/learning/conversation-continuation.js":"03d944e5719dacf45295f6010107ecbad71f9110f72df55a3ba2d57ef3e3fd4a","./js/learning/grammar-evidence.js":"b58192defee7bf29a95024e08d6e9358cd7e098bd050905a3c6ddcebf003c840","./js/conversations/study.js":"46e27e64e980e1c4be7d4368ced7e5bda553e37a5e6608d811df913b3cdbe9c9","./js/ai/language-policy.js":"690b2418e4fcbe272143fb29738f13b05f1e24c85477c2710311af47542f5681","./js/ai/language-scope.js":"0354a1c50c6748619d6a4cf46ccc6a84d76da911fbaec75e1d14604ba24563a1","./js/views/learningHistory.js":"075ca917fa493e3f78825389c4a8339e4f05af837c93a248cffc81c7a9178fba","./js/views/offlineAI.js":"1c9223d956401cf6600e4d9235aa49d8b97b82a7abaff735de2d73f934e6f829","./js/learning/course-sense-links.js":"9e67f74b64a19158588c86a8e9ae1316541923816714ed3db52e89e723f9ba6f","./index.html":"ec722b2c16268ec84091c020e65a5096625ca91bc439a3fa8ab10e449da63b41","./manifest.webmanifest":"00270d08c0c92de11aa6bfac95419b8fbb4599925858671f618ce051508e45b9","./css/fonts.css":"6f58afdcbf60d56f39e99e739577b41e81bc94712a3edce549ca3c9ca39d27c1","./fonts/066710ce7ed235a3.woff2":"066710ce7ed235a339d3d6cdcc8b55c0bea5632232662d83aacea25852108271","./fonts/0a557721b1f8b36d.woff2":"0a557721b1f8b36d3f3f84442689a71ca4a744300abcb46a1953f51bfc663b66","./fonts/23af38108404d4b0.woff2":"23af38108404d4b05ea87498afc5a104a3fe878b6339d162472e914a2c8bfa93","./fonts/2fb2e8cbfd52ae46.woff2":"2fb2e8cbfd52ae46179a8b6024eb162f1f9c6de3d22d6e3a30d8f395de7220be","./fonts/3911b66d9f2e005a.woff2":"3911b66d9f2e005a4b989223405d0e5032619c668597ba467cc76a23c8fffcfb","./fonts/4983926d3a16544e.woff2":"4983926d3a16544eedcd2233448bd8a43f711e7bf1fabaae8431e78e0b798635","./fonts/62213be8a78b42f1.woff2":"62213be8a78b42f1e29d1452d91e2f8b3e745572a9dd98d3941e39fa00b37d76","./fonts/6bbb044ab420e07e.woff2":"6bbb044ab420e07edb0a3042d2eb314b85e83a0182e945a15ab3b9092668dfd5","./fonts/7234ed860a9cc830.woff2":"7234ed860a9cc83045413c4faee63c960a8f2d1917adcf728119307d56e0d783","./fonts/83c005d49d8a6a50.woff2":"83c005d49d8a6a50474c73a5a36ac0468076e9c4a29da7bdb14995d80560a5be","./fonts/a2930b27d13a228b.woff2":"a2930b27d13a228bd9ab6a49269b5f800237892ad560cb9dd7fab01b1620f88e","./fonts/a30ddcd349703aff.woff2":"a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972","./fonts/c268b459a9329e59.woff2":"c268b459a9329e59fecf39a17618efd44c71735532048d60b12aab76a8c14914","./fonts/c89b9cc0bc6262bd.woff2":"c89b9cc0bc6262bd4f8d8494b6961601f3aefa829d08c2e3635f4d501d3a47c2","./fonts/db5ff4db83e58042.woff2":"db5ff4db83e580426280e9337a58dc57d3a83784a1b03ad80914651594441d52","./fonts/de37de877dc17e45.woff2":"de37de877dc17e4577341fa68bb5cb526b53d54cb29721e674208546a3c7849d","./fonts/e17cfd15fb96909d.woff2":"e17cfd15fb96909d64095015f958207063a0c07191da3512df7d560a781aebdf","./fonts/f18853f63a870ebe.woff2":"f18853f63a870ebef013e30e789d8d544f102e4acd94988e57c223d9c796ddf4","./js/learning/answer-policy.js":"95c71a07ebd0a6aa56b7ea2c4d6aae3595946ee7975e28c093910867504baa32","./css/app.css":"f7dfff2dd64f3055f5ca2524869cb986db994ab782a02f4fcd3b8b337e31510a","./css/learn.css":"14f1b82a1354ec0beb5e66e58f79cfab020c5094e3c4ce2e99be6a4a04fe664e","./css/reference.css":"395cbdcdc12cefdee37b72511b8063020cf2841685b64908db6dfa6ec94ddb32","./css/games.css":"d3891820db99eed0e92adc9aacf2655e8a15d76dbcd38801c0c1a7c140d5f95f","./css/views-a.css":"ee62c6cd40a4eeecd153346bf235c7d32e8a264bc6391dd54e2b662ca0c62bbb","./css/views-b.css":"197224c3c2e580a4eb79e43937c321aba8f613ad83f106f2775067831ff4335a","./css/views-c.css":"fe38c166ae34210bf91280ec3b16b7cd08a9417a5597fb4d7abe8b4cae59d18f","./css/grammar-course.css":"9322382c54ffcfb48e2202397e02f08fbc5f7c03fc7bb8777408a1b854b64e53","./css/adaptive.css":"a9d944dbd8f6d1ec3471813e31e0d87a3957ea950ea64209f7b74f190426a38b","./css/course.css":"ae2464a74ee37de7ce1b04406dd753abe1ccd9c81f8a62f64dfb428ecf9bd331","./css/journey.css":"562ce7bd9ec68a015c68fad1d65fce6e4752ff0ab9b4b0029863abafdfd0199d","./css/learnhub.css":"b4e1b634743950e1519570c49193944111f974128e3ea5c10712f15082f6db5e","./css/sentence-lab.css":"c3945b044f09b4e6cb60acec33b7ecdabb89d0aff8d1e15b516f91e5dcfc75e8","./icons/icon.svg":"6bb92f908edf098ca1cd1b4d091befa1ffa8e55c16530857e3b276b86c4863c1","./js/app.js":"45d2477aa4b4ac4f3d33b95e95daae3e59d493fffcee498f8638bc5fa6fd2f32","./js/components.js":"b513c14140c1fe8938ddca2cced30408ed569ceb80d0d50ccea1db7fb0a4a2ff","./js/completion-menu.js":"0884bff2fbc23abdcf6a5d5cea14091c9174b3d04ec2257bff4d7d7171affed1","./js/conjugator.js":"ab8fe9798aa76a9f5a865ae75e73bc5d3d88852000010565924155f3fe33d04d","./js/data.js":"3b7380b77d877b80cee80bda3577da6734d698a674e457e62761e0dbfa75c49f","./js/fx.js":"679f1b8c5eee38754b874556392f072ba6343177679279029ae7645c1c438040","./js/icons.js":"1b7b6ef93ff6736663d751f122168985ba2fd657057b2fb5fec08baf3f9326c6","./js/irregular.js":"c5746b42ce247796817953ec80022f0be61c7a005e32f520a3c8ce1faecff2e7","./js/source.js":"37aead3267bff595bf33e13707d53cbc64706b1e8cfc3f859d74a489709b8213","./js/srs.js":"088999d58a9b394856d80879f26f0f4200046cec6f56e9a60bc8938e785930c2","./js/store.js":"248ed51535049e4e484562ee89ac0ad0826c3989397b0563618b90ae48b81859","./js/sync.js":"2d417e7a49fad4ac5f1bc763ab0b2c0f1fe9c008fc6388439f253e0b70a43138","./js/ui.js":"a06a7fe3a1f0d3bcb3b0e4fddc1ae8a4553e38852c5b1d2713a9f1df37243df5","./js/views/addWord.js":"6ed6c57e33a01975567347f319cb16cc64bebaad3d96d97a776fdbcca9fb9e9e","./js/views/browse.js":"2fd7b582360b9ce44d87acac6080c9134b50b97b5a01d0e909e869eff148a981","./js/views/entry.js":"a14aaeb182563ce23a288f1556da16ef827cc5d5cd2a000ba2351c29b3029aa6","./js/views/games.js":"75f16be7bf82cf83547a67a140f9de7fddf7c31fad7458380d2034de13ceaa85","./js/views/grammar.js":"9c67078fb4de308c287ac99c22ca6c253cfc84c3688ad66a956e2b5d95283e5e","./js/views/home.js":"d5ca7e87f0c7d2a3ebf9aa890ef509029e7cec17d342e8ca064bc786e069f691","./js/views/homeLevels.js":"53aef8159d947c679694fffc8a286519e267d025890a3fa22020a68a2af00378","./js/views/learn.js":"4af9423038d2d0a78aec8adace7ee7696cf810212a1dc5be6484ad70f43a0d4b","./js/views/learnCards.js":"331ba75a76abed44a6f4aef1aa59a067e11aa54be7205af9dfc0e6337534aaca","./js/views/learnDash.js":"5a4d2edcd5cda9066061db16704fbdf78d4201261f936b566722afd80683a43b","./js/views/learnData.js":"1aa35f34adceea6c3f2d3e0783e2871e6299ee9c3daaf7045c8838ed2fecceac","./js/views/learnSections.js":"7ea6134c233ab874e59723a39efdef08b9279525ce4a6fe115de692127e966a9","./js/views/learnVerb.js":"f68ec2ab1225444e291c8868e36b1bc0672dbaff721c122c88cf584306a6b7a7","./js/views/learnWord.js":"e0ce88e7f7e32f6cf11af055f8579fca28d0f6127afae37888a84a0568215eea","./js/views/list.js":"767b690bba2fc775fa6dc0825b5e3904c5e189b2f1951c82694fb8dcdd1bec8f","./js/views/lists.js":"d4b02becff36e3da6c5ee8329505d1917ab1a8290bbda5e318778ce8c4b419c8","./js/views/play.js":"4556d1659273a95716ac2dafc60367a046f403aaf294de91f8182cd9cbc38ad4","./js/views/profile.js":"402d0049906b4cd4aa5319db518eb2ef701ecae00553a90a4c73cc8fc2485726","./js/views/reference.js":"c241ff1d3c98e7d37b5b04f7606cf4873e86dfef3a040fd5311ad10b5cacb928","./js/views/referenceEntry.js":"23ddf264cf58374c0692e662a151962737fcf06632f75ad2f66a77567842de8f","./js/views/review.js":"2d19c8bab301a4070fc9fd4403f6ef819bd5d97f8a226d252ae260518eea7fd0","./js/views/scope.js":"ee1f93385fab965fdd55e1a5a4fb9b69dc686e615634fb828ae77d02524b196b","./js/views/search.js":"9ed36543e25b092cc64dba041119bb12befc4f80d7a290488d0cc7c13c04c83b","./js/views/walkthrough.js":"d94c64d522277f06233a9b9b9ae4ead61ed8d289427e57f7706041da1fca653c","./js/views/words.js":"fd5d39c8a63aef45a32bc69365d94829326de375c49b1eb8ffd7032ab3d6039a","./js/games/crossword.js":"27e0a49c2a3d179c81f81fa7186011604d4a21021bcca7a95f41ae7e080d71a7","./js/games/engine.js":"442ae33b8277f28307585dabdaf3c93de03ae9b4a0ffd8efd490be0ea50ac504","./js/games/flashcards.js":"1eeb306968456503e93bf5b2dc5a7a4db2de2a4dc78db773813bc7eadb864a5c","./js/games/hangman.js":"666c4e889587faf1b9d06d959cc46c16721975173849de89076ee646d8d51fb5","./js/games/index.js":"2768a95809707ab218630375d514e786a8b8613314b0b5fefdd2d7da1b1a89ef","./js/games/matching.js":"a25900aa2d910e71668525a3b678ac15aa7de665a970961180a3675395797e63","./js/games/questions.js":"1942eeab4d3f2c26988a591cff63b91c18e2d9d93c10e41194414a0ad3563d31","./js/games/sentence.js":"47978b5db3263a9bec0fd2616aed4d243e90fae3a9169bca7c5bd1b8de490095","./js/games/speed.js":"69689e386886d4fa8a5f3b766e36c8d1b020ad1b732ae86089522044609330eb","./js/learning/model.js":"4ea53aa6804344a40006822c684dfffda8963f23d71aab2b73617973b496ccfd","./js/learning/curriculum.js":"07dcd23409bea31c9ba6148f221761b6ec5eba3dea1b9753c60eac22909705f3","./js/learning/content.js":"132fb6ed01f31f257d7bbfc43b9aa8b6bd69ac6c537777ea6f2299a7444c39b0","./js/learning/questions.js":"348df79abf03dd8a5e7e9c4d3681a2cd828d34baecbd1e8e61cc9bbeac1c4771","./js/learning/diagnose.js":"bd4a08a1eb0fae7897e801165502092a980c7c40cd680506d453e245c345ff4a","./js/learning/integration.js":"58540beba109d64faef6026a7c200d35b53e760d93738672fc4d91aa1d7ce9e4","./js/views/coursePlacement.js":"b4c7352a077d8803774b5a29ec619b72440fc7fb1005f070e7f66a9960b65a7e","./js/learning/course-v2-placement.js":"dfc4d191e07fe34fa1e08c604f961d3b7446e6fdb58d2b740cabd1c282f153cf","./js/views/learnCourse.js":"b3f73d0493f244bffe7cad46a814d51ac9c13462fd12f12e0ede82d7a1c27732","./js/learning/course-v2-engine.js":"1a1b5e905990213d304078018b8ef86db39d8b4bf0005d426ec48a3c88b8502f","./js/learning/course-v2-state.js":"7c2f489e23d6acb4f24a7be9e15fff33f0aaec0c24665b9a0baf10a6a4656252","./js/learning/course-v2-activities.js":"47cd9bb9b0ff032d53667a059e714c7155a284bc564d0bccb0619b0bae66f1c3","./js/learning/course-v2-media.js":"b9a3649f74fbe0d09a839640b4a895031b75389a0ee24ce2088e8158b4b41841","./js/learning/course-words.js":"7e585af8dae23f8a98db10c75e80217586a0a5478279c9caa33973821af9fd59","./js/learning/sentence-lab.js":"e5b33f96e68ded2b248fb8a6dd70701aaaa29ae951398e7f284265f8109922f7","./js/learning/sentence-lab-data.js":"f8580b9eae8196fd3c647a3fa923b775f73a0d4b893a0d0f25cb01bbe1af147b","./js/learning/sentence-lab-activities.js":"caaab7599d2d056b082d15de7e28f11d8399ff27ffce36019051d500b92167a8","./js/views/labFrasi.js":"74d529bcbf34f12fde5e71b0c90e67506b2d8f788cbcfddd3a920d8a2d48737e","./js/views/labFrasiLesson.js":"4729aa329e8bcd0a3e34dec12797fa17df0b5f78abc68173f691efffcee3b0bc","./js/useful-words.js":"ec43e6e0a48511276cfb607f2652ea90d56864832908741c24ff5790ec3d97b2","./js/views/learnGrammar.js":"d5f7c0defafecb90927e1bca8d46b17b3c5894eb8211cfb4b45168d295aa8bd4","./js/views/courseSession.js":"4a3e2696159a382fd236b8c761c45b43b332050dfcc6ee358368f74c0206a21f","./js/learning/grammar-lexicon.js":"6a173c57a8be5f421c98d4f23b46dc32a9c20813ad0ee8762974a0b91fe2d4f6","./js/learning/course-v2-glosses.js":"24914e7a037683f19ae2bee47dc1eb7a8bf28563d2425834bb0b209bf9de2557","./js/learning/grammar-state.js":"c90e8c8b26c99a026fe566363085554e1a80da32f013fa2008c7c7704cdfda3d","./js/learning/grammar-course.js":"378b2db00d392db3d662a9cfdb2f16a6160a6d27fba856a1e9415925b43a9432","./js/learning/grammar-journey.js":"37d9ec1701b0c746a42546941d72cb67371e6cb1ab3582e0f1800a00651a4e18","./js/views/course.js":"c86f5818389e36b45e27f5b3cfddaff10d3e97110ae2cdd29f0f303a05015d8a","./js/views/learnAdaptive.js":"52aca9dee7327c9cc31d253139e4db0b768908dab9708246415cc0b027ca7e32","./js/views/learnJourney.js":"a6f20734c1caf245a1f2c7ab758c69487117fdf49de806c2fb430ff6d315193d","./js/learning/journey.js":"b61e5c623b7c7d941e65d8ebffa5f0cc0eab3340609e98bfe03564358ea0d11e","./js/learning/lesson-content.js":"3932d27346dc0f785bf233a55f57f6b31f76a4da0619b985d9d828c33a0b76d8","./js/learning/lesson-questions.js":"276aac3aceec165cc64ded78fd04c30b25b035257f34dfb6b88226377bb9ae44","./js/learning/word-questions.js":"d0a8a1c50b13c8852d247ba50c173997494a9be0d243d77f05436769d531138c","./js/learning/sentence-lookup.js":"7c59a6533398a812fda2193f1c01363641aeef3e6e0e2d327ca7448481f5bfe0","./js/learning/sentence-panel.js":"b36b56603c422a386c12dee99371e997610ae8ca735e56a4113f77348c6fa172","./js/learning/lesson-activities.js":"0b0f728e0c36de2c47d364105cbcaea37d7e01f2b25dc3dfcd0853e22e9efc8b","./js/learning/activity-panel.js":"9dfd883f44a2b53f2dbf93500870be8e34f0d8b4a6439b67dde876450a0a2300","./js/learning/lesson-overview.js":"a3f59a41a771448f156a8002aa40a92db53386bfe662b5b94eb9a3355f6c3a99","./js/learning/progressive-content.js":"640b3ff8d3ec9dbe6d5aeaae7c7898a4ded8fa793ee4b88b14225c8fd773a7ef","./js/learning/legacy-progressive-content.js":"0a1030457c36e104e2a9152c95120e67243a9294f8f3b84ac47f39401aad1ef4","./js/learning/verb-progressive-data.js":"cd4be8a661e6cefb5ba5e435f46bfaf383832cf665437cfa2c5320743151d02b","./js/learning/verb-lexicon-extra.js":"1e6013e01f7b935515fea279ce6ad04f0efdcd27465cd7a41756ba24a9e39578","./js/learning/verb-lexicon.js":"264be25c9f63afb4720050b21d95f4d9d21225529632694c02c1bc95c2504fac","./js/learning/assistant.js":"a2758f02cf85f3ff80de2b0fab5a74c89727add6c4e78a8fef46a63e3f03ba69","./data/grammar-course/A1.json":"62601e0629f68a98e490ec77f440b1ac8a6140eae3c8263896f807f8d54fbbf3","./data/grammar-course/A2.json":"c4d4a3f7c807ce0bd01e742cee675d02f394836407006475b0e11100abba3202","./data/grammar-course/B1.json":"02f2f5a65b2e72b419f721ee4f953bb7c0ad07220286535ccc6b6b49b93d3aeb","./data/grammar-course/B2.json":"9b8df1c6731f9e7ca5f9d14287c7a29cd25b3c25c1a69a531cdc53ed1bc4c8d1","./data/grammar-course/C1.json":"b51d28eb19cfdfeb67fdb26cd0cab0f31a3d33c87c67c58e08df3ca2aa5d4a7a","./data/grammar-course/C2.json":"7d595c6d9a425bab5211c3c679d7513bd4fc8b4f2babbcbadc43a61ca93716a7","./data/course-v2/Foundations.json":"a3c43d8d031ca16424ac2147910920b6f597309a4301db4d9f99fdb724208ffb","./data/course-v2/A1.json":"3ea0e6a3816d052714409b7e480073e203f0c13b7d44942e2b244c2bbd894122","./data/course-v2/A2.json":"c9b39efa9b8c4bfc0a513ea9c7a8f13f6422f628e92d9a382cbcb598573fe93a","./data/course-v2/B1.json":"b8a356eb9567459d4fecfd686d912f8622d633855e4ae35849b1e4ed7e74e48e","./data/course-v2/B2.json":"c9a31582ef7b25504e1ad8e9fe67f47ba00adb985cacd4306db0ef0ed308e275","./data/course-v2/C1.json":"b7941d2f3a574b1a649cdc4c7425e6e3b60d18bbd00b065eaa8b16e5a481f292","./data/course-v2/C2.json":"6a578d31b00247b1e86e756e127ff513528ec5dcb6d2f044f275c36f0b79ccbd","./data/course-v2/audio.json":"65893ffee1578891d12be4cd822dbe6b239799b318554358b14eb4346991bbe3","./data/sentence-lab/presente.json":"8a8ca43e0e29baed9ae4b22500385ac2af53cd9a051636357dd2d1f3e101e86e","./data/sentence-lab/passato.json":"5bf05c2d5a8de89ca912bc96c72aa912f347cf0fdae3d960eb59360de2b9b40a","./data/sentence-lab/futuro.json":"358c508d101787671548e844da99ff1984a16325312a18a0d35e858b67f13bfa","./data/sentence-lab/strutture.json":"27403696c38d6a0cbac6c352c62b40d3faedd61ec86bea44711cd22879ad21aa","./data/useful-words.json":"0937ec7a324f4366110e24c39af0f20e0720c8910f2ccd090cfec827770c9545","./data/vocab.json":"07013e8c9968103b7fa23a129046ef837b037eeba5efa3cd63f9455cec39b3c8","./data/verbs.json":"ee0caba2450e75a9e0e6cdcce194c8a1fa1a9e8c32cecc489be5a7283d4e006e","./data/stats.json":"d502866bcc2464fce03512547e058dd346000c9f94bb7b4969347ebf90a03e64","./data/grammar.json":"b8b290d7847b08a9142875c95f1005c5af608a9117cc73d962fe017b7442f8b6","./data/course-index.json":"e91258c5631ed6e11c5a7f49c7e615d984eaf2e78da7e79378a83ab713a24ab8","./data/completion-index.json":"11424a84f9dbd3e2310083f57b486adb7f9c6031c193f27a4440cde5d1d9bf7f","./js/learning/course-vocabulary.js":"7d1413b932a218e0608c21df2a824c0c022985ddea82324a60ca51290c783baf","./js/learning/home-learning.js":"85cb1336588df232cf5a074667c174ca9f27649d6f8241fc51a3b76ec562bb47","./js/learning/completion-state.js":"a10412ec330c97bfc128c00ee024a75fe5337f14202160e08c0448755d7ea5d1","./css/conversations.css":"58c7150f2682d7b75d9c5a52b262cd63d741fc4668bc86f9c6f5def96256380c","./js/ai/audio-controller.js":"608604f0229787ce8cff4d63e6aa1227896961e38ce7143fde21604e81cc3850","./js/ai/grounding.js":"0cedd52bc096adcd5ff67c530dad655d3925e60a792a87f0318def5057b0db7a","./js/ai/index.js":"9f6bccb38711d18520c35d647945ac4397c0a13bcfcf5418da3496678c320e63","./js/ai/packs.js":"a0d641fc39dd2ec300355c6939d5a8ebeef9badb063d48adb2512bbdf3d984da","./js/ai/pcm-capture-worklet.js":"14826fce98c309ea40270fdba8448a66fb33c08fc7ee8d59714dd4d4ba847e8f","./js/ai/pcm-capture.js":"d49238f47c5ebfd7bc695275b4f3a1237600f937189811f62e376dc22f8d58a1","./js/ai/queue.js":"42b5eee7de41f2ec4dcf6c7922d7a349c1cbdf75c40bae28f7e516e06779c340","./js/ai/sha256.js":"8dfab2ce354282201cdbb99f8a66b9bd7e960ee35a42e87f535c940fa7effa34","./js/ai/source-index.js":"45f2bc23e8a1708dca68baf7fdfcbb124d5517612dcd2a756499ec9a365dc928","./js/ai/tasks.js":"5d85d9ac467c0838deb2ae9134407b45a3a4617a05830e79236e097385a10dbd","./js/ai/teaching.js":"4610cbae65b6489acb8491b706d3c8ee4f2930f5f2871c7417611481c4b06e37","./js/ai/temporary-audio.js":"808417af86cea2416fef1955bd4f6937c7771919da4d36e758ad474040082a12","./js/ai/validation.js":"33a9e0ade2a102364577438e28dac07006ec4e281bc4ff35dbf999623846e687","./js/conversations/backup.js":"f69e4b9e7be2898d86eddd6e2e3784c378fc350ff3142b9ce238646211f7ec8f","./js/conversations/controller.js":"f16d543c3836215d505d0a07a9b02d2d1b8b0df3c81016f289c03ae11495bd48","./js/conversations/draft-recovery.js":"6f05dbb7eb60402dcabf33fdafbcddced2da6b9d2d3a130a3db06b07aea0de58","./js/conversations/profile-backup.js":"7da13a6f5caac8168be025200130fdf07d23723e2eae442979055c70abb7b82e","./js/conversations/runtime.js":"3593d5fdb924d9cc6d95f385ab811dadeb83072468f60c3db86cda9ec0d560d0","./js/conversations/speech-session.js":"ffa005c1c2951d854d40dc55e5b48f858288310a1b5006c9018659117556de7f","./js/conversations/spoken-feedback.js":"8481e9bc32ff30eb5d2290f98d679240a14571ecb81cab805ea0a5e6e6bbdeaa","./js/conversations/storage.js":"10b5ab7f180951397d868c451568d6d2cfa4081495e73a98288d72a26e2f08e5","./js/conversations/summary.js":"332ad35c390d4959c8a39c8b914cc567a9418c18410dff45f2d9c2afa78bb6f5","./js/learning/activity-viewport.js":"3c97e97de8c3a66bf91565c52474de2189b2c8c2da898f8658ee95bcca04177b","./js/learning/case-coverage.js":"17a9ce6c5297a1c9a7c0e2438837845203130eb52c998bf4eae08fd41eb009a8","./js/learning/collections.js":"c79f6d3506c6403d5275ba250d74d1c9a93136a5ce1a6dca660ce5cb9e591330","./js/learning/course-gloss-kind.js":"cf38780f4bd66ef14a0e108c4ad168977367fa1dcdffc276c7ca2e31e9d70061","./js/learning/daily-plan.js":"9fb8d5d4fbfe981d9fc09215133616193e514cf9e2ce1baf55482ac29fa15f0b","./js/learning/journey-visit.js":"bf0dee80ce9972841fb7ff90235e84a58fcb2a5560f406c573a2a34d5cd0edcf","./js/learning/migrate-profile.js":"b2df4fb3e6a77b9ac42254bf9c8ad6f99ee160ce14f8c4cc00b356405bd13977","./js/learning/legacy-profile.js":"b6a0dada0691b7776fed313f1c6e6249e24639aaf9fe67679dd9f4c4eae6f125","./js/learning/objectives.js":"5336673522adf8b72a2e750a2104cadd0c146392dcba1651bb2cdf06051057a4","./js/learning/plan-panel.js":"64c842a3a8db3a55b84a3e56bcd5e238215251aec82da7a0d62e153a25535728","./js/learning/review-session.js":"95675532d778742b9e524c4d0d92013175fe7cfdfbcfb953c3a5d283b68d7361","./js/views/conversations.js":"80d6f51196136c1bc581abd94d86d250e8662b127909cf722b98c8b39bb08ca1"};
const assetURL=path=>new URL(path,self.location.href).href;
const hashesByURL=new Map(Object.entries(ASSET_HASHES).map(([path,hash])=>[assetURL(path),hash]));
hashesByURL.set(assetURL('./'),ASSET_HASHES['./index.html']);
const expectedHash=url=>hashesByURL.get(url);
async function verified(response,hash) {
  if(!response?.ok || !hash)return false;
  const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')===hash;
}
async function networkAsset(url,hash) {
  const response=await fetch(new Request(url,{cache:'no-cache'}));
  if(!await verified(response,hash))throw new Error('Incomplete or corrupt application asset: '+url);
  return response;
}
async function installShell() {
  const target=await caches.open(VERSION);
  const previous=await Promise.all((await caches.keys()).filter(k=>k.startsWith('parola-v')&&k!==VERSION).reverse().map(k=>caches.open(k)));
  const paths=[...new Set(SHELL)],stats={reused:0,fetched:0};
  try {
    // Bound parallelism on mobile; unchanged verified bytes need no network request.
    for(let offset=0;offset<paths.length;offset+=6)await Promise.all(paths.slice(offset,offset+6).map(async path=>{
      const url=assetURL(path),hash=ASSET_HASHES[path==='./'?'./index.html':path];
      let response;
      for(const source of [target,...previous]){
        const cached=await source.match(url);
        if(await verified(cached,hash)){response=cached;stats.reused++;break;}
      }
      if(!response){response=await networkAsset(url,hash);stats.fetched++;}
      await target.put(url,response);
    }));
    await target.put(assetURL('./__shell_integrity__'),new Response(JSON.stringify({version:VERSION,hashes:ASSET_HASHES,stats}),{headers:{'Content-Type':'application/json'}}));
    await self.skipWaiting();
  }catch(error){await caches.delete(VERSION);throw error;}
}
self.addEventListener('install',e=>e.waitUntil(installShell()));
// Pruning the audio cache runs after claim and outside waitUntil, so it never holds fetches behind activation.
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== AUDIO_CACHE && k !== FIT_CACHE && k !== ASSISTANT_RUNTIME_CACHE && !k.startsWith(ASSISTANT_CACHE_PREFIX) && !k.startsWith(AI_PACK_CACHE_PREFIX)).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(() => { pruneAudio(); })); });
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
// Fit scorer files, downloaded on demand by js/learning/fit-scorer.js into FIT_CACHE (never precached). The model and the
// runtime are immutable per cache version and come from that cache, from the network only when it does not have them.
// The worker script is app code: it is refreshed from the network (and the cached copy replaced) whenever the network
// answers and served from the cache only when it does not, so online an update never runs an old worker against new page code.
const FIT_PREFIXES=['./models/','./vendor/ort/','./js/workers/'].map(p=>new URL(p,self.location.href).href);
async function fitResponse(req) {
  const cache=await caches.open(FIT_CACHE);
  if(req.url.includes('/js/workers/')){
    try{const response=await fetch(req,{cache:'no-cache'});if(response.ok)await cache.put(req.url,response.clone());
      if(!response.ok&&req.url===new URL('./js/workers/fit-scorer.worker.js',self.registration.scope).href)return (await cache.match(req.url))||response;
      return response;}
    catch{return (await cache.match(req.url))||Response.error();}
  }
  return (await cache.match(req.url))||fetch(req);
}
// Optional runtime stays separate from the required application download.
const assistantRuntimeURLs=new Map(Object.entries(ASSISTANT_RUNTIME_FILES).map(([path,hash])=>[assetURL(path),hash]));
async function assistantRuntimeResponse(req) {
  const cache=await caches.open(ASSISTANT_RUNTIME_CACHE),hash=assistantRuntimeURLs.get(req.url),hit=await cache.match(req.url);
  if(await verified(hit,hash))return hit;
  const response=await networkAsset(req.url,hash);await cache.put(req.url,response.clone());return response;
}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||!req.url.startsWith(self.location.origin))return;
  if(req.url.includes('/audio/course-v2/')){e.respondWith(audioResponse(req));return;}
  if(assistantRuntimeURLs.has(req.url)){e.respondWith(assistantRuntimeResponse(req));return;}
  if(FIT_PREFIXES.some(p=>req.url.startsWith(p))){e.respondWith(fitResponse(req));return;}
  const url=new URL(req.url);url.search='';url.hash='';
  if(shellURLs.has(url.href)){
    e.respondWith(caches.open(VERSION).then(async cache=>{
      const hit=await cache.match(url.href);
      const hash=expectedHash(url.href);
      if(await verified(hit,hash))return hit;
      if(hit)await cache.delete(url.href);
      try{const response=await networkAsset(url.href,hash);await cache.put(url.href,response.clone());return response;}
      catch{return new Response('This installed file is unavailable. Reconnect and retry to repair it.',{status:503,headers:{'Content-Type':'text/plain'}});}
    }));
    return;
  }
  e.respondWith(fetch(req).catch(()=>caches.open(VERSION).then(cache=>req.mode==='navigate'?cache.match('./index.html'):Response.error())));
});
