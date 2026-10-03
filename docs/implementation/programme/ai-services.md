# AI service integration contract

The new `js/ai/` modules are reusable foundations. They have no model import, automatic download, cloud call, microphone permission prompt, storage migration or scripted conversation on import. Actual Italian generation remains unavailable until a candidate, local runtime, verified language policy and applicable device gates pass. The trial explicitly bypasses language validation for evaluation; normal `createAIService()` defaults to fail closed.

## Written requests

Conversation setup fields `learnerName`, `topic`, `register` and `addresseeId` are bounded strings passed as data. `participants[].active:false` makes that participant ineligible; an explicit addressee must be active and is the only permitted responder. For the first generated partner turn use `opening:true, text:''` with setup and no learner message. Opening suppresses history, sends `learnerMessage:null` and forbids correction proposals. Ordinary empty learner text remains invalid. No opening greeting is scripted by the service.

```js
const service = createAIService({
  runtime, grounding, isCurrent,
  languagePolicy: { version: 'reviewed-policy-revision', async validate(text, context) { /* verified checks */ } },
  // requireLanguageValidation defaults true; do not disable in released UI.
});
const response = await service.request({
  task: 'conversation', text: committedLearnerText, level: 'A2',
  sourceRevision: learnerRevision, scope: conversationId,
  participants: [{ id: 'giulia', name: 'Giulia', role: 'agreed partner facts' }],
  history: committedTurns, agreement: 'neutral', recognitionUncertain: false,
  allowedSenseIds: [], requestedIds: [], protectedNames: [],
}, { scope: conversationId, signal, priority: 0 });
```

The host saves the learner turn durably before requesting a partner, commits only an accepted response for the same revision, and catches validation/runtime failures into a retryable state. `isCurrent(request)` must compare the durable learner/source revision, not a mutable text reference. Request snapshots exclude drafts from context. Latest input is bounded to 4,000 characters; the total prompt defaults to 10,000 characters and at most ten committed history messages. These are character bounds: a production runtime still needs tokenizer-based input/output budgeting and controlled summary rollover. Trial actual token counts are preserved in the evaluation report.

The runtime contract is `generate({messages,responseFormat,signal,...}) -> string | {text,provenance}`, optional `cancel()` and `dispose()`. One generator runs at a time with stable priority/FIFO ordering. Cancelling an active request rejects its consumer immediately, tells the adapter to cancel, and rejects late replies. The next request waits for the old engine promise to settle, so an adapter must reliably settle or terminate its worker after cancellation; a permanently hung adapter cannot simply be overlapped. `cancelScope(id)` removes only that conversation's pending work. A source edit or conversation delete must cancel that scope.

Accepted results contain `message:{participantId,text}`, verified `corrections`, deterministic `vocabulary` source matches, deterministic `teaching` cards and `provenance`. Vocabulary uses sense IDs and exact finalized text spans, never model-generated IDs. Cards copy supplied sense definitions/forms/examples or accepted correction rule explanations/sources; free prose is not converted into dictionary or grammar authority. Corrections contain exact original/replacement/ruleId, the verified reference explanation and source; any generated old-format reason is retained only under provenance. They never award mastery or rewrite the learner's original transcript. A missing correction source, unresolved rule verifier, changed protected negation/quantity/name or uncertain-ASR correction is rejected. Protected fragment checks cover numerals, common unambiguous written numbers, specified names and negation; a full semantic preservation policy is still required.

`languagePolicy.validate(text,{request,grounding})` must return `{ok:true}` or `{ok:false,reasons:[...]}`. The service does not ship a pretend comprehensive CEFR/semantic validator: the current probe records `languageRangeVerified:false`. Structural validation alone allowed real false teaching, including a negation reversal, so release must leave the gate closed until this policy is independently verified. Optional `repairAttempts:1` permits only one bounded simpler retry; rejected raw replies/reasons remain in provenance and persistent failure exposes all attempts. Default is zero retries.

Grounding is supplied through `createGrounding({version,senses,rules})`. Records must be explicitly reviewed (`verified:true`), carry a level and matching keywords/requested IDs, and stay within the cumulative level ceiling or an explicit sense exception. A correction rule has an independently implemented `confirmCorrection(proposal,request)`; retrieval alone grants no correction authority. Production sense IDs should come from the authoritative dictionary adapter, including child-sense IDs, rather than this trial's local probe IDs. Broader verified inflection, construction, ambiguity and circumlocution coverage remains required.

## Pack installation

`createPackManager({origin,allowedOrigins,...})` accepts only application-controlled manifests. Configure pinned trusted HTTPS weight-host origins, such as the exact chosen model host, plus the app origin. Executable JS/MJS/WASM must be same-origin runtime assets; model output cannot choose fetch URLs. Manifest revision and asset URL revisions/hashes must be immutable, and every shard includes exact SHA-256, byte length and kind. Current shards are limited to 512 MiB each.

`install(manifest,{signal,onProgress,probe})` streams and hashes each download into staged CacheStorage, resumes only verified completed shards, checks available storage, and activates one durable pointer after all assets and any requested runtime probe succeed. A failed or cancelled replacement keeps the previous active pack. `active(id,{verify:true})` catches eviction/corruption; `remove(id)` removes only owned AI caches and leaves all learner records alone. Web Locks serialize tabs when supported; fallback locking is per manager instance and does not yet guarantee cross-tab serialization on platforms without Web Locks.

An optional real runtime probe receives `{pack,signal,response(pinnedUrl)}` and must return the same model revision/runtime version and `written:true` after actual inference. Without it installation reports assets verified, written generation false. Even a matching probe cannot claim Italian teaching quality or physical phone readiness. Speech readiness remains separate. The retained actual-Chrome cache test used synthetic files and a synthetic probe; connecting a production runtime to these verified cached assets remains unimplemented. Third-party weights avoid requiring multi-GB files on GitHub Pages; self-host the small pinned executable shell and retain the model/runtime notices in the pack. There is no selected production manifest yet.

## Manual and controlled hands-free audio

`createAudioController` takes injected capture/recognizer/player adapters plus `onSend`, `onDraft` and `onState`. It is a controller, not an installed recognizer. Manual `start('manual')` then `stopRecording()` creates an editable unsent draft with original recognized text retained. `edit(text)` saves the edit through the host; `sendDraft()` commits once through host `onSend`. Raw audio remains transient unless the host explicitly saves `retainedAudio()`.

Hands-free mode is controlled alternation: stop capture before recognition, generate after a committed learner turn, await complete playback and then resume. Uncertain recognition pauses into editable review, and lifecycle `pause()` cancels late work without automatically restarting microphone capture on return. Permission, recognition, model and playback failures release capture and expose a recoverable error. Adapters and host sends must honor AbortSignal and durable source revisions. Speaker interruption and real microphone/speaker echo cancellation are not implemented or claimed.

## Verification and limits

Twenty-eight meaningful service tests cover queue ordering/cancellation, stale revision snapshots, unsupported/unsourced correction rejection, protected meaning, deterministic teaching/source links, prompt bounds/draft exclusion, streaming SHA-256, pack corruption/resume/replacement/origin restrictions and distinct readiness, manual edits/send, alternating hands-free/uncertainty/lifecycle handling and recoverable failures. The original phase1 trial tests still pass. The earlier physical-Mac native probe compiled but its system model was unavailable because Apple Intelligence was disabled. Subsequent isolated simulator and native-GGUF evidence is preserved in [ai-native-qwen-decision.md](ai-native-qwen-decision.md); no production provider is enabled.

Actual model quality, synthetic ASR results, offline probe scope and remaining release gates are in [ai-evaluation.md](ai-evaluation.md). Tests establish these foundations' behavior. They do not establish a production teacher, physical iPhone runtime, human learner ASR, audible voice quality, complete review corpus or thirty-to-sixty-minute speech endurance.
