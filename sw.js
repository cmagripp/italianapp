// Service worker: offline cache for the app shell (HTML, CSS, every JS module), the dictionary data and the course packs.
// VERSION is stamped, never bumped by hand: `node tools/stamp-sw.mjs` rewrites it as '<prefix>-<hash>', where the hash
// covers every SHELL file and this worker's own code, so the same content always gives the same VERSION and any change
// to a precached file or to this file gives a new one (old caches are dropped on activate). Run it after any change to
// the shell, the data or this file; tools/check-shell.mjs fails while the stamp is stale, and the deploy job stamps
// before publishing. Edit the readable prefix by hand only to label a release.
const VERSION = 'parola-v15-a9cf12a5a28d';
// Downloaded lesson audio: kept across updates. Must equal AUDIO_CACHE in js/learning/course-v2-media.js (check-shell checks).
const AUDIO_CACHE = 'parola-course-audio-v2';
// Downloaded fit scorer (sentence workshop layer 2: the model, the ONNX runtime and its worker, js/learning/fit-scorer.js):
// kept across updates too. Must equal FIT_CACHE in js/learning/fit-scorer.js and js/workers/fit-scorer.worker.js (check-shell checks).
const FIT_CACHE = 'parola-fit-scorer-v1';
// The experimental assistant (sentence workshop layer 3, js/learning/assistant.js, docs/ASSISTANT-EXPERIMENT.md): WebLLM
// keeps its downloaded weights, model library and config in Cache API caches named 'webllm/model', 'webllm/wasm' and
// 'webllm/config' on this origin. They are kept across updates too (check-shell checks); the files themselves are
// cross-origin, so the fetch handler below never sees them.
const ASSISTANT_CACHE_PREFIX = 'webllm/';
const ASSISTANT_RUNTIME_CACHE = 'parola-assistant-runtime-v1';
const ASSISTANT_RUNTIME_FILES = {"./vendor/webllm/webllm-0.2.85.7e7917ff4d322fe7.mjs":"7e7917ff4d322fe727bcdb11325690e59051d68f0d364b071eba5e76c275df99"};
const SHELL = [
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
  './js/learning/sentence-lab.js', './js/learning/sentence-lab-data.js', './js/learning/sentence-lab-activities.js', './js/views/labFrasi.js', './js/views/labFrasiLesson.js', './js/learning/fit-scorer.js', './js/useful-words.js',
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
  './js/learning/completion-state.js',
];
// Generated by stamp-sw: exact response-body digests for atomic, reusable updates.
const ASSET_HASHES = {"./index.html":"40390052fe759d0eedbcbdff38ed909704b6d6d144c95a93ed51c22b95244e3e","./manifest.webmanifest":"00270d08c0c92de11aa6bfac95419b8fbb4599925858671f618ce051508e45b9","./css/fonts.css":"6f58afdcbf60d56f39e99e739577b41e81bc94712a3edce549ca3c9ca39d27c1","./fonts/066710ce7ed235a3.woff2":"066710ce7ed235a339d3d6cdcc8b55c0bea5632232662d83aacea25852108271","./fonts/0a557721b1f8b36d.woff2":"0a557721b1f8b36d3f3f84442689a71ca4a744300abcb46a1953f51bfc663b66","./fonts/23af38108404d4b0.woff2":"23af38108404d4b05ea87498afc5a104a3fe878b6339d162472e914a2c8bfa93","./fonts/2fb2e8cbfd52ae46.woff2":"2fb2e8cbfd52ae46179a8b6024eb162f1f9c6de3d22d6e3a30d8f395de7220be","./fonts/3911b66d9f2e005a.woff2":"3911b66d9f2e005a4b989223405d0e5032619c668597ba467cc76a23c8fffcfb","./fonts/4983926d3a16544e.woff2":"4983926d3a16544eedcd2233448bd8a43f711e7bf1fabaae8431e78e0b798635","./fonts/62213be8a78b42f1.woff2":"62213be8a78b42f1e29d1452d91e2f8b3e745572a9dd98d3941e39fa00b37d76","./fonts/6bbb044ab420e07e.woff2":"6bbb044ab420e07edb0a3042d2eb314b85e83a0182e945a15ab3b9092668dfd5","./fonts/7234ed860a9cc830.woff2":"7234ed860a9cc83045413c4faee63c960a8f2d1917adcf728119307d56e0d783","./fonts/83c005d49d8a6a50.woff2":"83c005d49d8a6a50474c73a5a36ac0468076e9c4a29da7bdb14995d80560a5be","./fonts/a2930b27d13a228b.woff2":"a2930b27d13a228bd9ab6a49269b5f800237892ad560cb9dd7fab01b1620f88e","./fonts/a30ddcd349703aff.woff2":"a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972","./fonts/c268b459a9329e59.woff2":"c268b459a9329e59fecf39a17618efd44c71735532048d60b12aab76a8c14914","./fonts/c89b9cc0bc6262bd.woff2":"c89b9cc0bc6262bd4f8d8494b6961601f3aefa829d08c2e3635f4d501d3a47c2","./fonts/db5ff4db83e58042.woff2":"db5ff4db83e580426280e9337a58dc57d3a83784a1b03ad80914651594441d52","./fonts/de37de877dc17e45.woff2":"de37de877dc17e4577341fa68bb5cb526b53d54cb29721e674208546a3c7849d","./fonts/e17cfd15fb96909d.woff2":"e17cfd15fb96909d64095015f958207063a0c07191da3512df7d560a781aebdf","./fonts/f18853f63a870ebe.woff2":"f18853f63a870ebef013e30e789d8d544f102e4acd94988e57c223d9c796ddf4","./js/learning/answer-policy.js":"95c71a07ebd0a6aa56b7ea2c4d6aae3595946ee7975e28c093910867504baa32","./css/app.css":"f7dfff2dd64f3055f5ca2524869cb986db994ab782a02f4fcd3b8b337e31510a","./css/learn.css":"14f1b82a1354ec0beb5e66e58f79cfab020c5094e3c4ce2e99be6a4a04fe664e","./css/reference.css":"67df008b08d4b8ad0d59a585ef8772b1d5fd41bff9de61778bd93dda0f07e89e","./css/games.css":"d3891820db99eed0e92adc9aacf2655e8a15d76dbcd38801c0c1a7c140d5f95f","./css/views-a.css":"b22c48b659f53255256431ebfbad55ff46d3b1ace51cbad5ffa567ddce4dd62f","./css/views-b.css":"197224c3c2e580a4eb79e43937c321aba8f613ad83f106f2775067831ff4335a","./css/views-c.css":"efc0643e7381676d7238d1f05caf6b6cd637145d46f9c6bf7ad667235e5e8de8","./css/grammar-course.css":"073f4e846789ae01d37a8c3f9d99d7725efd176d765c16414252bd65a3919fbf","./css/adaptive.css":"a9d944dbd8f6d1ec3471813e31e0d87a3957ea950ea64209f7b74f190426a38b","./css/course.css":"ae2464a74ee37de7ce1b04406dd753abe1ccd9c81f8a62f64dfb428ecf9bd331","./css/journey.css":"b53062834909e36751b87f01c1d4dd8b1389196d323c42ddf1f0b7029040ddee","./css/learnhub.css":"b4e1b634743950e1519570c49193944111f974128e3ea5c10712f15082f6db5e","./css/sentence-lab.css":"9feb00e79563716e770866699f132fd304720898802a2bec34f5eb31ac3ab031","./icons/icon.svg":"6bb92f908edf098ca1cd1b4d091befa1ffa8e55c16530857e3b276b86c4863c1","./js/app.js":"025f8eee2bedd75c73a91ce9452cbf641fc098a4d16de623f5c228b79378677a","./js/components.js":"b513c14140c1fe8938ddca2cced30408ed569ceb80d0d50ccea1db7fb0a4a2ff","./js/completion-menu.js":"0884bff2fbc23abdcf6a5d5cea14091c9174b3d04ec2257bff4d7d7171affed1","./js/conjugator.js":"a0a85b0727b7143a68aa26865ce34332d67c9616241af6aab0204aaf7f9a653e","./js/data.js":"a75e05616e33664b7c3088e363a6e332a1e5e35444da112f9486e002ea811b4e","./js/fx.js":"f1aaab291ae5f1af1832cc5e0b7f4b4f1e7cf577ac7f0942e2a4efca35217fea","./js/icons.js":"bffe41465e43083b9247968af0d8d0196982ccf5eaec841572029051f2034003","./js/irregular.js":"c5746b42ce247796817953ec80022f0be61c7a005e32f520a3c8ce1faecff2e7","./js/source.js":"37aead3267bff595bf33e13707d53cbc64706b1e8cfc3f859d74a489709b8213","./js/srs.js":"088999d58a9b394856d80879f26f0f4200046cec6f56e9a60bc8938e785930c2","./js/store.js":"ba40a9df7195865d6df649dbf3d5dde868ecbd4e7f01207854a6413afceca9a5","./js/sync.js":"2d417e7a49fad4ac5f1bc763ab0b2c0f1fe9c008fc6388439f253e0b70a43138","./js/ui.js":"976d5c864269ce07a0196ef7a052da279aafb6aba8b1c8e114bd6a85b19960e6","./js/views/addWord.js":"6ed6c57e33a01975567347f319cb16cc64bebaad3d96d97a776fdbcca9fb9e9e","./js/views/browse.js":"2fd7b582360b9ce44d87acac6080c9134b50b97b5a01d0e909e869eff148a981","./js/views/entry.js":"2e9fdf12dae6126f1de14fb4223b6a59f69723c2595ac02ecb121faf76654f82","./js/views/games.js":"378375b691a3fc0c5b3f13d63d231858337076211e2e2894e56a57b611fb595c","./js/views/grammar.js":"9c67078fb4de308c287ac99c22ca6c253cfc84c3688ad66a956e2b5d95283e5e","./js/views/home.js":"a0ed054a69ad0b62253071c9170d20a07b3e223fe770900fe374f4c73b531ddc","./js/views/homeLevels.js":"53aef8159d947c679694fffc8a286519e267d025890a3fa22020a68a2af00378","./js/views/learn.js":"e75b8e5095faaa04ff5544c694df69a236560a74cd55c593db32c21f830aff2e","./js/views/learnCards.js":"331ba75a76abed44a6f4aef1aa59a067e11aa54be7205af9dfc0e6337534aaca","./js/views/learnDash.js":"d66d43e0fb6380238d0a9fc39568d41cc8619504d58b755c5173791a20a7bf8a","./js/views/learnData.js":"d2a1458c6034a08874495b6d63aa4e7808ed1a2b999db5989fa39c627ef613d0","./js/views/learnSections.js":"7ea6134c233ab874e59723a39efdef08b9279525ce4a6fe115de692127e966a9","./js/views/learnVerb.js":"f68ec2ab1225444e291c8868e36b1bc0672dbaff721c122c88cf584306a6b7a7","./js/views/learnWord.js":"e0ce88e7f7e32f6cf11af055f8579fca28d0f6127afae37888a84a0568215eea","./js/views/list.js":"767b690bba2fc775fa6dc0825b5e3904c5e189b2f1951c82694fb8dcdd1bec8f","./js/views/lists.js":"d4b02becff36e3da6c5ee8329505d1917ab1a8290bbda5e318778ce8c4b419c8","./js/views/play.js":"5c1728f992e2f86ab5943b0c16fa4cbfbe2cafc858c6e577c899530f0d8cf291","./js/views/profile.js":"c681fe63db7b9dbbf3748dcc5a3abbfbbaaea1740f5701ccaa5e7423ded592b0","./js/views/reference.js":"c241ff1d3c98e7d37b5b04f7606cf4873e86dfef3a040fd5311ad10b5cacb928","./js/views/referenceEntry.js":"5c7cc4411b3def3a84ed309bcc917cd08850f6e67ab448533b77d09a8df0620c","./js/views/review.js":"3e878f7dc2190922f241a159d117f8eda10da1490f767d98989c05dbc1588f01","./js/views/scope.js":"ee1f93385fab965fdd55e1a5a4fb9b69dc686e615634fb828ae77d02524b196b","./js/views/search.js":"9ed36543e25b092cc64dba041119bb12befc4f80d7a290488d0cc7c13c04c83b","./js/views/walkthrough.js":"d94c64d522277f06233a9b9b9ae4ead61ed8d289427e57f7706041da1fca653c","./js/views/words.js":"fd5d39c8a63aef45a32bc69365d94829326de375c49b1eb8ffd7032ab3d6039a","./js/games/crossword.js":"d320d29cfa0bc01727bf5ed36a7ba4201ce31af6bb0ef84de9cdde46e5cf1af5","./js/games/engine.js":"d6c4ae84dcca9a7d3ca28f94ee26733e985b0aa19b87a6adcd6f6d157a5ae3b9","./js/games/flashcards.js":"ab886a36434e76e13793a2757d0eb26e6848cf2e34d717af8f3b9ffe2ebc6cba","./js/games/hangman.js":"18d986ba33c41380cf54b15e39f7a49f0c17cfe8b8f866312d10de8dee43b067","./js/games/index.js":"2636dd372746bd053e8ef99b26d76e9bb3a0ea8f5e577af8459f6618b30e79a2","./js/games/matching.js":"0f4dc5dd234456fe7d4208f485d0f6ea1f558766ab84eb6134ab704df17137cc","./js/games/questions.js":"1942eeab4d3f2c26988a591cff63b91c18e2d9d93c10e41194414a0ad3563d31","./js/games/sentence.js":"e161a7f806c0fcabb1c7f658d1a7ae195bae12c0864d8f5b8bd06b0e8b71e18b","./js/games/speed.js":"b4e7b396a60e9f8471a5330df0c05369ef274b1d2e4c747e8586dac55332e835","./js/learning/model.js":"cfb0fdbfef2d0824167ed6d02c66576a9ed62e42977bf5ac4d4e91b94db9920d","./js/learning/curriculum.js":"07dcd23409bea31c9ba6148f221761b6ec5eba3dea1b9753c60eac22909705f3","./js/learning/content.js":"132fb6ed01f31f257d7bbfc43b9aa8b6bd69ac6c537777ea6f2299a7444c39b0","./js/learning/questions.js":"348df79abf03dd8a5e7e9c4d3681a2cd828d34baecbd1e8e61cc9bbeac1c4771","./js/learning/diagnose.js":"bd4a08a1eb0fae7897e801165502092a980c7c40cd680506d453e245c345ff4a","./js/learning/integration.js":"266244dcd852c7f13821681099362f4c55cd8991442b4314c2a2e3caebede7de","./js/views/coursePlacement.js":"a72af9c9dff6f233ee55201ebd9f0803d61f448152a9c4385cd8d962ed5d6f3a","./js/learning/course-v2-placement.js":"dfc4d191e07fe34fa1e08c604f961d3b7446e6fdb58d2b740cabd1c282f153cf","./js/views/learnCourse.js":"50e9871a9e6f1c7f1415c8811bb65fbe39e6c059bd51abff0275e25e486a123a","./js/learning/course-v2-engine.js":"1a1b5e905990213d304078018b8ef86db39d8b4bf0005d426ec48a3c88b8502f","./js/learning/course-v2-state.js":"7f26284af530c0be43cbf0009a2b10f361566d8a54f36d1d979b78ccc108b7fe","./js/learning/course-v2-activities.js":"47cd9bb9b0ff032d53667a059e714c7155a284bc564d0bccb0619b0bae66f1c3","./js/learning/course-v2-media.js":"b9a3649f74fbe0d09a839640b4a895031b75389a0ee24ce2088e8158b4b41841","./js/learning/course-words.js":"3494a5134001b24afa61ff14fbb8e29b94e06db805e0d7745024df79fd37aba7","./js/learning/sentence-lab.js":"6f8c7d78ed07c7d4c5d3c48ee10ba6978a35c8eed7e0ada233f7188a2b890080","./js/learning/sentence-lab-data.js":"f8580b9eae8196fd3c647a3fa923b775f73a0d4b893a0d0f25cb01bbe1af147b","./js/learning/sentence-lab-activities.js":"caaab7599d2d056b082d15de7e28f11d8399ff27ffce36019051d500b92167a8","./js/views/labFrasi.js":"46e609b2b4325c0d9be71ec35a56b87762978ae0e01902f313f7ef5c02569d26","./js/views/labFrasiLesson.js":"413d1dabca617c23290c15cc7a945b6c01a1eca39c471a18fcdf5a500412d002","./js/learning/fit-scorer.js":"d76e2584eb05ed1ca95516d9a3a68c20ba4e9789cd7b34847c5254068333b4cf","./js/useful-words.js":"ec43e6e0a48511276cfb607f2652ea90d56864832908741c24ff5790ec3d97b2","./js/views/learnGrammar.js":"0a43830e50c50c0f29e7b75e563bb947bccd269efd0bdebb2a29390039366f75","./js/views/courseSession.js":"1b7ff60b773db767792a3c69e927f66360ef17881e8388e1ce4ce00460e921c5","./js/learning/grammar-lexicon.js":"6a173c57a8be5f421c98d4f23b46dc32a9c20813ad0ee8762974a0b91fe2d4f6","./js/learning/course-v2-glosses.js":"24914e7a037683f19ae2bee47dc1eb7a8bf28563d2425834bb0b209bf9de2557","./js/learning/grammar-state.js":"8a34d45790d0f1ce5e8adc2a7de4bf5f7a6a6382b27572b8787a3c74f647ca2d","./js/learning/grammar-course.js":"de2e09c90074b61f4fb973e302b7e407329e6a43583018a9c8737c62b27a0938","./js/learning/grammar-journey.js":"37d9ec1701b0c746a42546941d72cb67371e6cb1ab3582e0f1800a00651a4e18","./js/views/course.js":"2add487061c065feb04eefdd0e90127a10665b956a3cad661f09a7117e270b9e","./js/views/learnAdaptive.js":"82e30cd75bdd1601de975d21849ac0df4e110d6f3b82ace07cc7b76c6b77c3ef","./js/views/learnJourney.js":"da30c38baa969cbc718ca8864bb5e94baf2e4070be3e3d51b1d1b101f2896b03","./js/learning/journey.js":"ec6da113cdfdadd267cf34a472db31d28d9c523c57a1219ca2fc238dc45d19ae","./js/learning/lesson-content.js":"323936d2fbed185d2bade84fa28c03f9a4d743dfe97a28af2af4299306acd546","./js/learning/lesson-questions.js":"77f5705e3b2b2779aaba2b38c8878411a9d3889679db485d5774f33a1842dccd","./js/learning/word-questions.js":"f24ced1662f945b84cbf6f7ef6560c5908afe523534347a38dd888f6465dad43","./js/learning/sentence-lookup.js":"53b6fa7e2598819fae105fb814fd2b02c7ea10b50ede13fcd4afe26d36e01342","./js/learning/sentence-panel.js":"0c5bfb26a2d43f1e59d2a65e73ae7b3116f9e06341fceb46ddb0b721c52572aa","./js/learning/lesson-activities.js":"0b0f728e0c36de2c47d364105cbcaea37d7e01f2b25dc3dfcd0853e22e9efc8b","./js/learning/activity-panel.js":"9dfd883f44a2b53f2dbf93500870be8e34f0d8b4a6439b67dde876450a0a2300","./js/learning/lesson-overview.js":"a3f59a41a771448f156a8002aa40a92db53386bfe662b5b94eb9a3355f6c3a99","./js/learning/progressive-content.js":"379dd7457e2b52453beecf6112ab10a35579ba6b48921c331ac278b39a254492","./js/learning/legacy-progressive-content.js":"0a1030457c36e104e2a9152c95120e67243a9294f8f3b84ac47f39401aad1ef4","./js/learning/verb-progressive-data.js":"bef1b991505fa5ba5f2b0c09e4d6682c9bc1d74ee22092d1d2a57cd702fa5fc7","./js/learning/verb-lexicon-extra.js":"1e6013e01f7b935515fea279ce6ad04f0efdcd27465cd7a41756ba24a9e39578","./js/learning/verb-lexicon.js":"264be25c9f63afb4720050b21d95f4d9d21225529632694c02c1bc95c2504fac","./js/learning/assistant.js":"a2758f02cf85f3ff80de2b0fab5a74c89727add6c4e78a8fef46a63e3f03ba69","./data/grammar-course/A1.json":"62601e0629f68a98e490ec77f440b1ac8a6140eae3c8263896f807f8d54fbbf3","./data/grammar-course/A2.json":"c4d4a3f7c807ce0bd01e742cee675d02f394836407006475b0e11100abba3202","./data/grammar-course/B1.json":"02f2f5a65b2e72b419f721ee4f953bb7c0ad07220286535ccc6b6b49b93d3aeb","./data/grammar-course/B2.json":"9b8df1c6731f9e7ca5f9d14287c7a29cd25b3c25c1a69a531cdc53ed1bc4c8d1","./data/grammar-course/C1.json":"b51d28eb19cfdfeb67fdb26cd0cab0f31a3d33c87c67c58e08df3ca2aa5d4a7a","./data/grammar-course/C2.json":"7d595c6d9a425bab5211c3c679d7513bd4fc8b4f2babbcbadc43a61ca93716a7","./data/course-v2/Foundations.json":"f918e5ea2e9399a2f3b75dcf3aec484c445871fb1d1afbb59890c3ed2aaec6c6","./data/course-v2/A1.json":"4da57e20c1fb6534fdf819a594c5add64182515a4dbf702a766c8a7fb79a144b","./data/course-v2/A2.json":"9dee2f01b65c329fc4ea90e0c33120b05f4d09a6c612a15745f5d6e3f98b257b","./data/course-v2/B1.json":"d8a0cfcb130f707ddf847796f54d2c52009312bb7af49d65f9634943cd098c9a","./data/course-v2/B2.json":"032bde3fd38bdc99a726e4bb0ab332752359b55f149e0fc4165b7c9c0a0b73b5","./data/course-v2/C1.json":"e2373d18a9b29a15fcd70aa1835aec06e95af82c5e42c9aa80149e6226800cfc","./data/course-v2/C2.json":"9e2de915186e6644a4ab79cec01e5ff81062409c663f9b774cd62421c36a5dfe","./data/course-v2/audio.json":"9333e0a452d46721bd098cb24716d1929344fc7a5e2871a914a6f1418cdc6372","./data/sentence-lab/presente.json":"2001c4edc65faab7acf1958f414ea045a8d7eee641e57395920a5447b6cb345b","./data/sentence-lab/passato.json":"5bf05c2d5a8de89ca912bc96c72aa912f347cf0fdae3d960eb59360de2b9b40a","./data/sentence-lab/futuro.json":"358c508d101787671548e844da99ff1984a16325312a18a0d35e858b67f13bfa","./data/sentence-lab/strutture.json":"27403696c38d6a0cbac6c352c62b40d3faedd61ec86bea44711cd22879ad21aa","./data/useful-words.json":"0937ec7a324f4366110e24c39af0f20e0720c8910f2ccd090cfec827770c9545","./data/vocab.json":"a561444160645af8eaf6beff381cf484b4deb94469794464566daa3f10fc3d25","./data/verbs.json":"c43e5f023fcb689d49a893321325b9a793aa2039678da4b3b4d351cc58ab0d71","./data/stats.json":"b1533f1bcdea4843e5829483112be1ab2b243852fa3228aa3bff11803d9249be","./data/grammar.json":"b8b290d7847b08a9142875c95f1005c5af608a9117cc73d962fe017b7442f8b6","./data/course-index.json":"c2c2d9125eb279684e88634b75674b5aae087e43092d4a61b97cabe11d765e4f","./data/completion-index.json":"05756fae9d796afc01d140e4814c21bef7855ab6592cb583fc199efe15668d93","./js/learning/course-vocabulary.js":"7d1413b932a218e0608c21df2a824c0c022985ddea82324a60ca51290c783baf","./js/learning/home-learning.js":"85cb1336588df232cf5a074667c174ca9f27649d6f8241fc51a3b76ec562bb47","./js/learning/completion-state.js":"a10412ec330c97bfc128c00ee024a75fe5337f14202160e08c0448755d7ea5d1"};
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
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== AUDIO_CACHE && k !== FIT_CACHE && k !== ASSISTANT_RUNTIME_CACHE && !k.startsWith(ASSISTANT_CACHE_PREFIX)).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(() => { pruneAudio(); })); });
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
    try{const response=await fetch(req,{cache:'no-cache'});if(response.ok)await cache.put(req.url,response.clone());return response;}
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
