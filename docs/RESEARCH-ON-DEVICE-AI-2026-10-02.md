# Research note: an offline AI model inside the Parola web app (2 October 2026)

Question: can the installed web app (static files, GitHub Pages, iPhone Home Screen, fully offline) ship a small language model, downloaded on demand and run on the device, to judge whether a free-entry word fits a sentence blank, pick a reactive reply in a scripted dialogue, and explain a grammar slip? The assessment and the design it leads to are in `PLAN-SENTENCE-WORKSHOP-2026-10-02.md` §8. This note keeps the facts and sources.

## Platform

- WebGPU on by default since Safari 26.0 (15 Sep 2025) on iOS, iPadOS, macOS, visionOS; every iOS browser uses WebKit so all get it. `shader-f16` supported on all Apple devices; Apple advises f16 storage on iOS to avoid termination under memory pressure. No `subgroups`. Buffer limits on iPhones vary: `maxBufferSize` 256 MB on all, 1 GB on about 82 percent; storage binding 256 MB on 74 percent. WebLLM falls back to 256 MB buffers. [webkit.org/blog/17333, WWDC25 session 236, web3dsurvey.com limits pages]
- Memory: a page is reloaded silently ("using significant memory") at roughly 3 GB on an iPhone 15 Pro and 1.5 GB on an iPhone 12 Pro, varying with uptime; a JS-heap test on iOS 26.2 crashed an iPhone SE 3 near 100 MB; a May 2026 paper quotes under 500 MB per tab. Treat 1 to 1.5 GB total as the realistic ceiling on an 8 GB phone; nothing is thrown, so it cannot be caught. [github.com/Nehanth/pooled/issues/207, lapcatsoftware.com 2026/1/7, arxiv 2605.20706]
- Safari 27.0 (17 Sep 2026): Wasm JSPI; WebGPU gains only `clip_distances`. Safari 26.2: resizable Wasm memory. Wasm SIMD since 16.4; threads need cross-origin isolation headers, which GitHub Pages cannot set (the `coi-serviceworker` workaround exists). Memory64 not shipped. WebGPU bugs: multi-command-buffer hang on iOS 26 (Apr 2026, open), a 26.4 rendering regression fixed May 2026. [webkit.org/blog/18325, 17640; bugs.webkit.org 311598, 315186]
- Background: a Home Screen web app gets about 5 s of JS after backgrounding, then is frozen; no background inference.
- Storage: since iOS 17 an origin gets up to 60 percent of the disk, Home Screen apps the same quota, LRU eviction skips persistent origins; the old 50 MB Cache API cap is gone. Home Screen apps are exempt from the seven-day purge. No quota failures found for 0.5 to 1 GB caches; failures reported are memory, not storage. [webkit.org/blog/14403, 10218; developer.apple.com/forums/thread/710157]

## Runtimes

- WebLLM 0.2.85 (Sep 2026): WebGPU only, 163 prebuilt models, OPFS caching. Weights at 4-bit: Qwen3 0.6B 336 MB, Qwen3 1.7B about 850 MB, Qwen2.5 0.5B 279 MB, SmolLM2 360M 376 MB, Llama 3.2 1B about 880 MB VRAM. The config's VRAM figures (Qwen3 0.6B: 1.4 GB at a 4k window) are dominated by KV cache and logits; a batch-1 build roughly halves them. On iOS 26 a 135M model works, a 3B one kills the tab. [github.com/mlc-ai/web-llm releases, issues 753 and 498; huggingface.co/mlc-ai]
- Transformers.js 4.x: WebGPU rewritten in C++ (Feb 2026); Safari WebGPU only enabled by PR 1700, shipped in 4.3.0 on 16 Sep 2026; open iOS memory issues remain. ONNX q4f16 sizes: Qwen3 0.6B 570 MB, gemma-3 1B 763 MB, LFM2 350M 255 MB. [huggingface.co/blog/transformersjs-v4, transformers.js issues 1604, 1242, 973]
- wllama 3.6: needs Wasm Memory64, which Safari lacks, so Safari uses a degraded compat build; Safari 26.x returned no tokens in one report. An iPhone 16 Pro on iOS 26.7 (30 Sep 2026) loaded Gemma 270M and Qwen3 0.6B in every backend and the tab died at first inference each time. [github.com/ngxson/wllama issues 210, 203; github.com/Taleef7/JobTrail/issues/110]
- No Apple on-device model API for the web; WebKit opposed Chrome's Prompt API; WebNN is a W3C draft not in Safari.

## Models and Italian

- Qwen3 0.6B: 119 languages; its report's Italian rows score the 0.6B at roughly a third of the 1.7B. Qwen3.5 0.8B (Mar 2026): 201 languages, untested on phones. Gemma 3 270M: mostly embeddings, "not designed for conversational use". Gemma 3 1B: 760 to 806 MB. SmolLM2: English only. SmolLM3 3B and Phi-4-mini: too large. LFM2 350M to 1.2B: fast and small but Italian is not an official language. Llama 3.2 1B: Italian supported, about 800 MB.
- No Italian leaderboard covers models under 3B.
- Grammatical acceptability: ItaCoLA (2021) fine-tuned Italian BERT reaches MCC 0.60 in domain, 0.20 out of domain; a public checkpoint reports accuracy 0.87 / MCC 0.43. MELA (ACL 2024) on Italian: fine-tuned XLM-R 53.5, GPT-4o 53.0, small open generative models 5 to 24. BERTino (Italian DistilBERT, 66M parameters, MIT) is about 70 MB at int8. Pseudo-log-likelihood scoring needs no labelled data. [arxiv 2109.12053, 2311.09033, 2303.18121; huggingface.co/indigo-ai/BERTino, gsarti/itacola]

## Field speed and heat

- No measured iPhone 16 Pro Safari tokens-per-second figure exists. iPhone 17 Pro Max in the LlamaWeb paper: 4 to 17 tokens per second decode on the smallest models. Native on-device (not web) Llama 3.2 3B on an iPhone 16 Pro dropped from 37.6 to 22.6 tokens per second within minutes and twenty inferences cost about 10 percent battery. [arxiv 2605.20706, buildmvpfast.com May 2026]

## Caveats

GitHub's API and npm's registry were unreachable through the session proxy; library release dates come from release pages and a 20 September 2026 article. The Qwen3 Italian averages were extracted from the HTML paper and should be checked against the PDF before being quoted.
