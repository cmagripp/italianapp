# Disposable offline Italian pipeline trial

Phase 1 only. This directory is served on its own origin, has its own transcript/cache keys, and is not imported by the application. It exercises actual model inference; no scripted tutor reply or cloud recognition is supplied. See `docs/implementation/phase-0-2/ai-trial.md` for measured results and the outstanding platform decision.

## Run locally

```sh
cd dev/phase-1-ai-trial
npm ci
node prepare.mjs --models=baseline,gemma,qwen35
node server.mjs
```

Open <http://127.0.0.1:8132/>. Choose a candidate, explicitly install its pack, and load the pipeline. Provisioning reads immutable revisions from `pins.json`, streams downloads to partial files, verifies available upstream SHA-256 hashes, and emits `assets/manifest.json` with exact SHA-256 and byte counts for every artifact. Browser installation independently hashes each artifact before cache activation. A corrupt file fails installation. Only the selected language model is cached by an installation; ASR, VAD and the Italian voice are shared.

Weights, generated runtime bundles, browser profiles, simulator builds and measurement files are ignored. Downloaded artifacts remain local and are not committed to the small website. Preparation requires roughly 1.8 GB for the three primary models and speech runtimes; browser caches add space. `--models=baseline,gemma,qwen35,qwen17` adds the pinned 1.7B challenge. The 2B stress candidate is available only by explicit `qwen2` selection. `npm ci` installs pinned dependencies; it does not download model weights.

Written turns run free generation in a WebGPU worker. Manual mode uses actual `getUserMedia`/MediaRecorder, Stop produces an editable unsent Italian transcript, and Send commits once. Foreground hands-free uses Silero V5 and a 1.2-second silence interval, pauses capture for inference/playback, and resumes listening after playback. This controlled alternating trial does not implement speaker interruption. Raw microphone PCM and unsaved recordings are transient. Visibility loss, Stop and worker release cancel the active loop. Italian recognition is multilingual Whisper tiny q8 on one WASM thread; built-in `SpeechRecognition` is never used.

Ordinary turns include the last six committed messages; the eleven comparison cases explicitly run with an empty history. The harness rejects a concurrent send and checks the cancellation epoch after recognition, generation and voice synthesis before committing or starting playback. A blocked or corrupt trial transcript store does not prevent capability probing; its error is displayed and included in exports.

Local Italian system voices must report `localService=true`. When none is exposed, the selected Paola Piper ONNX voice uses an Italian eSpeak phonemizer and plays a generated local WAV. Playback start/end events are measured; audible correctness still needs human listening. No inference contacts a model host after explicit provisioning. Server-side TTS and cloud replies are absent.

## Repeatable measurements

With the server running, point `PAROLA_TRIAL_PLAYWRIGHT` at an installed Playwright `index.mjs`, or use the development dependency installed at `/tmp/parola-grammar-tools/node_modules/playwright/index.mjs`:

```sh
node make-fixture.mjs
node prepare.mjs --models=baseline,gemma,qwen35,qwen17
PAROLA_TRIAL_FIXTURE=/assets/fixtures/learner-error.wav node benchmark.mjs
node microphone-benchmark.mjs
node speech-offline-benchmark.mjs
node ../../tools/test-ai-trial.mjs
```

The optional fixture generator requires macOS `say` with Alice and `afconvert`. It reads the deliberately incorrect sentence “Ieri io andare al mercato, ma non comprare niente.” This is synthetic speech, never a claim of human learner recognition quality. The microphone benchmark passes that WAV through Chromium's simulated capture device, labels every row accordingly, and tests Record/Stop/editable draft/Send plus three successive hands-free turns. It uses real recognition, model generation and local speech playback. It is not an iPhone microphone/acoustic test.

The browser benchmark clears only the disposable origin's earlier development caches, then runs the same eleven initial smoke cases per model with a 1,024-token context and 96-token reply cap. JSON includes raw generated output, structural validation, prompt/response timing, ASR, VAD and local synthesis. It reloads the page with network disabled and creates fresh inference workers. These desktop cache reopens are distinct from installed-PWA process termination or phone performance. Use Export for manual/device sessions. Neither eleven smoke cases nor structural validation establishes CEFR teaching quality.

The speech/offline runner explicitly selects Paola, verifies three offline reopens with fresh workers and actual bundled synthesis, and exercises duplicate-send rejection plus generation/synthesis cancellation. Run the browser scripts sequentially because they share one persistent profile. Voice timing uses browser playback events; a human must still check intelligibility, pronunciation and audible output.

## iPhone 16 Pro Max simulator

Tested configuration: iPhone 16 Pro Max simulator, iOS 26.5 build 23F77, Xcode 26.6. `simulator/run.sh` builds a disposable WKWebView app and records the actual environment to its Documents/probe.json. It requires the server on 8132. To check Safari separately:

```sh
xcrun simctl openurl 80FC8AD8-F787-4C66-AC1B-462ABD6E2AEA 'http://127.0.0.1:8132/?probe=iPhone16ProMax-simulator-Safari-iOS26.5'
```

The probe records `navigator.gpu`, the actual adapter, f16, local voices, storage and capture capability. An exposed `navigator.gpu` with a null adapter fails the language-model gate. Do not treat browser viewport emulation or the simulator's Mac GPU/resources as phone measurements.

## Recovery and cleanup

Release models before switching candidates. Keep exported text reports independently of model packs. Deleting `assets/` removes only trial artifacts; rerun preparation to repair them. Remove the `parola-phase1-disposable-trial-v1` cache and `parola.phase1.trial.v1` storage key on origin 8132 to clear the trial; never clear the production app's origin. The local server binds only to loopback. No production profile is read or migrated.
