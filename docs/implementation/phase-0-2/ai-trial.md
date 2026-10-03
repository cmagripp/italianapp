# Phase 1 disposable local AI and speech trial — 2026-10-03

The complete local pipeline is executable and has produced actual recognition, language-model replies and local speech in desktop Chrome. Four candidates were measured, including the existing 0.6B resource baseline and a 1.7B challenge. **No tested configuration is recommended as a production Italian tutor:** the small sample already contains severe false corrections, invented definitions and repetition. This is exploratory Phase 1 evidence, with an explicit unresolved mobile runtime decision. It does not implement Phases 4–5 conversation services.

## Tested environments and platform direction

- **Simulator configuration:** iPhone 16 Pro Max simulator, iOS 26.5 build 23F77, Xcode 26.6 build 17F113. Both Safari and a disposable native WKWebView exposed `navigator.gpu`, but returned **no adapter** from `requestAdapter()`. The WebLLM f16 loading gate therefore correctly prevents language-model loading. Safari exposed local Italian Alice; the WKWebView probe exposed no local Italian voice. Microphone API availability is recorded, rather than interpreted as a successful capture test. The reduced user-agent OS string is not the authoritative OS version.
- **Measured inference host:** MacBookPro18,4, Apple M1 Max, 32 GB RAM, headed Google Chrome 154.0.8037.95. Actual WebGPU adapter: Apple/Metal, shader-f16 available. No cross-origin isolation; ASR, VAD and Piper use one WASM thread. Model, ASR and bundled TTS workers remain loaded together during combined turns.

The simulator's null adapter is a simulator limitation. It supplies capability evidence and does not establish physical iPhone GPU, memory, microphone, thermal or latency behavior. The browser runtime remains a reproducible desktop test route; Phase 1 does not choose it for production mobile deployment. Phases 0–2 repairs can proceed with this recorded platform decision. Any later mobile runtime selection must use an environment that supplies a usable adapter, or measure another local runtime rather than infer suitability from these Mac timings. Apple documents installing and selecting actual simulator runtimes in [Xcode component guidance](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components).

Tracked probe evidence: [ai-trial-simulator.json](ai-trial-simulator.json). Rebuildable native harness: [simulator/run.sh](../../../dev/phase-1-ai-trial/simulator/run.sh).

## Configuration and actual written measurements

All candidates use their WebLLM 0.2.85 compatible MLC q4f16_1 export, context 1,024, reply cap 96 tokens, temperature 0.2, top-p 0.9 and seed 42. Eleven identical, isolated prompts span initial A1–C2 correction/valid-variant/meaning/number/register checks plus an injection case. Each comparison case uses empty history; ordinary manual/written/hands-free turns use the last six committed messages. This controls the comparison without claiming a full CEFR evaluation.

| Candidate | Model/export + model-library bytes | Written LLM p50 / p95 | Written structural failures | Cold offline generation |
| --- | ---: | ---: | ---: | --- |
| Qwen3 0.6B baseline | 357,050,150 | 398 / 1,283 ms | 0 / 11 | Passed |
| Gemma 3 1B IT | 607,652,373 | 404 / 2,579 ms | 0 / 11 | Passed |
| Qwen3.5 0.8B | 453,372,632 | 859 / 1,833 ms | 0 / 11 | Passed |
| Qwen3 1.7B challenge | 989,719,850 | 1,028 / 1,697 ms | 0 / 11 | Passed |

These LLM timings measure complete generated output in a warm worker. They exclude microphone capture, ASR, model installation and voice playback. The small p95 uses the nearest-rank statistic and is sensitive to a single long reply. “Structural” accepts bounded nonempty output without internal reasoning tokens; it does **not** establish correct Italian, brevity, preserved meaning or teaching quality.

The initial load timings are saved for each component in the raw evidence; for example the baseline took 2,266 ms for LLM, 1,014 ms for ASR and 1,389 ms for Piper session loading, sequentially. Each candidate then reopened with network disabled and fresh page/workers and generated a written reply. This is a desktop cache reopen; an installed PWA process termination was not tested.

Qwen models explicitly receive `enable_thinking:false`. WebLLM prepends an exact empty `<think>…</think>` header for that setting; the harness removes only the known empty header and preserves `rawReply`. Actual reasoning markers still fail structural validation. The initial Qwen3.5 attempt without this explicit option produced internal reasoning and was rejected; that failed run is retained in the diagnostic evidence. Gemma's trial reload sets `sliding_window_size:-1` alongside the bounded context because its packaged sliding-window setting conflicts with WebLLM's positive context setting. These are trial settings, not a production quality certification. The actual worker API is documented by [WebLLM](https://webllm.mlc.ai/docs/user/basic_usage.html).

Raw prompts, replies, token/latency details, failure diagnostics and environment metadata are retained in [ai-trial-desktop.json](ai-trial-desktop.json). The optional 2B stress candidate was pinned but not downloaded; a larger-model recommendation cannot be inferred. Total prepared artifacts for these four candidates and all copied speech/runtime variants were **2,812,159,005 bytes**. Shared speech/runtime artifacts were 404,364,000 bytes. These development sizes include redundant matched ORT variants and are not an optimized production pack budget. Browser caches add storage and can duplicate model bytes across runtime and trial caches.

## Teaching and learner-error preservation findings

These are direct observations from the raw sample, not independent educator ratings or an intrinsic ranking of model families. The tested prompt, conversion, quantization and bounded generation configuration may all affect results.

| Candidate | Reproducible serious example |
| --- | --- |
| Qwen3 0.6B | Asked for the person sharing an apartment, replied that the person is “tua moglie”; kept the erroneous “Se avrei…” construction; produced a repetitive market reformulation. |
| Gemma 3 1B | Called the apartment sharer “un'occupazione”; generated repeated code fences and irrelevant repeated text; answered the injection case in English. |
| Qwen3.5 0.8B | Defined the apartment sharer as “spettatrice” with an invented explanation; described both register expressions as infinitive verb forms; several replies repeat or lose the request's meaning. |
| Qwen3 1.7B | Changed valid “mi chiamo Carlo” to “mi chiami Carlo”; invented “cognitiva”/“vicina” for coinquilino; falsely marked the valid written date “il diciassette novembre” wrong. It correctly reformulated the controlled past-tense and conditional examples, but those successes do not cancel its severe failures. |

The short speech reference was deliberately ungrammatical: “Ieri io andare al mercato, ma non comprare niente.” macOS Alice generated the recording, so it is synthetic speech rather than a human learner sample. All four file-pipeline runs returned “e è rio andare al mercato, ma non comprare niente.” The accent-sensitive word error rate is **3 edits / 9 words = 33.3%**. Negation and erroneous infinitives survived; the opening phrase did not. This single result cannot estimate learner speech accuracy. Its ASR corruption also triggered misleading tutor corrections, making an editable transcript valuable in the manual mode.

The synthetic microphone path returned a different corrupted opening (“e a riondare…”). That result is retained alongside the raw recognized text and the manually edited input; the harness never silently normalizes recognition to the reference. Built-in browser `SpeechRecognition` is absent. The ASR uses the explicit Italian multilingual Whisper tiny q8 ONNX pipeline with local files only; [Transformers.js pipeline documentation](https://huggingface.co/docs/transformers.js/en/api/pipelines) describes the inference interface.

## Separate speech-mode measurements

The four file-pipeline runs exercised real Silero VAD, actual local ASR, each actual LLM and local Alice playback while Piper was also loaded. A file lacks a live endpoint clock, so `endToFirstAudioMs` is deliberately null. Its **processing-to-playback-start** was 2,261 ms (baseline), 3,937 ms (Gemma), 2,629 ms (Qwen3.5) and 4,157 ms (Qwen1.7). These numbers must not be called microphone endpoint latency.

The microphone runner used Chromium's synthetic capture device replaying the labelled Alice WAV through actual `getUserMedia`, MediaRecorder and MicVAD. It tested the Qwen1.7 combined configuration after the conversation-history safeguard was added. The manual draft remained unsent until Send; the runner edited it to the explicit reference and then sent once. The three hands-free turns used histories of 2, 4 and 6 committed messages. Capture pauses during recognition/reply/playback and resumes afterward. [MicVAD settings](https://docs.vad.ricky0123.com/user-guide/api/) document the underlying endpoint interface.

| Mode | Measured turns | ASR | LLM | Playback timing |
| --- | ---: | ---: | ---: | --- |
| Manual, edited before Send | 1 | 1,631 ms | 804 ms | Send → first playback event: 826 ms; endpoint latency is null because manual review time is unbounded. |
| Foreground hands-free, synthetic capture | 3 | 1,466–1,518 ms | p50 718 / p95 1,148 ms | Endpoint → first playback event p50 3,433 / p95 3,807 ms; Silero silence interval about 1,184–1,190 ms. |

Capture evidence and distinct source labels are saved in [ai-trial-capture.json](ai-trial-capture.json). The runner made requests only to its loopback trial origin. This is an actual browser capture/API/pipeline test with synthetic input. It is not live learner microphone accuracy, speaker echo handling, barge-in or physical phone performance.

## Offline voice and cancellation evidence

The separate speech/offline runner explicitly selects the bundled Italian Paola medium Piper voice, generates local WAV speech for a number/date/negation sentence, and performs three offline reopens with fresh workers and complete VAD→ASR→LLM→Piper turns. All three completed. The fixed sentence took 733–1,128 ms to synthesize and 875–1,135 ms to the first playback event. The runner records playback completion as well. No human listening result is claimed. Full results are saved in [ai-trial-speech-offline.json](ai-trial-speech-offline.json).

The harness blocks concurrent sends, rejects late recognition and generation results, and checks the cancellation epoch after Piper synthesis **before** creating or playing audio. Stop remains available while work is pending. The offline runner rejected a duplicate send and cancelled actual in-flight generation in 636 ms without committing a late assistant reply. Stop during actual Paola synthesis returned “Stale synthesis cancelled before playback” with **zero playback calls**. Pure safeguard tests also cover corrupt/blocked transcript storage, bounded committed history, accent-sensitive WER and local-only runtime flags.

## Reproduction, packaging and remaining evaluation

The trial runs on its own loopback origin and stores only its own transcript/cache keys. No production app imports it; loading the ordinary page never downloads weights. [Trial README](../../../dev/phase-1-ai-trial/README.md) provides provisioning, real browser runners, simulator setup and cleanup. `npm ci` and `prepare.mjs --models=baseline,gemma,qwen35,qwen17` rebuild the selected stack. `tools/test-ai-trial.mjs` passes; the browser measurements use real local inference.

Exact npm versions and integrity are locked; model exports and compiled MLC libraries use immutable revisions in [pins.json](../../../dev/phase-1-ai-trial/pins.json). [ai-trial-artifacts.json](ai-trial-artifacts.json) retains exact downloaded URLs, file SHA-256 values and sizes, with generated package assets attributed to the lockfile build. The preparer verifies upstream LFS hashes when supplied, and the independent trial cache install verifies each artifact's hash and size. The minified self-hostable WebLLM bundle has no retained legal-comment block; separate Apache, loglevel MIT, tslib ISC and TVM attribution files are retained under [vendor/webllm](../../../vendor/webllm/ATTRIBUTIONS.txt). No model weights or generated browser profiles are tracked.

Redistribution terms are recorded component by component in [LICENSES.md](../../../dev/phase-1-ai-trial/LICENSES.md). Qwen's original weights use Apache 2.0; Gemma uses its own [Gemma terms](https://ai.google.dev/gemma/terms). Whisper uses MIT; the Italian voice has its [voice card](https://huggingface.co/rhasspy/piper-voices/blob/main/it/it_IT/paola/medium/MODEL_CARD) and dataset attribution. The Piper wrapper's MIT license does not relicense the compiled eSpeak GPL stack. A production pack still requires the complete redistribution notice/source bundle; the trial does not label the combined stack as MIT.

Remaining production evaluations include a diverse human Italian learner-error corpus, independent teaching review, a usable mobile runtime, ASR tiny/base comparison, audible pronunciation checks, long-context/resume behavior, measured peak memory and 30–60-minute thermal/resource sessions. None is represented as completed. The runtime choice and model-quality gate remain explicit future work while correctness, persistence and accessibility repairs proceed in the authorized Phases 0–2.
