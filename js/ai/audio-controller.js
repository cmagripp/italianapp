import { abortError } from './queue.js';

/** Foreground alternating speech controller. Actual capture/recognition/local
 * playback adapters are injected; spoken barge-in is not advertised. The host
 * persists transcripts through onDraft/onSend, never this controller. */
export function createAudioController({ capture, recognizer, player, onSend, onDraft = () => {}, onState = () => {} } = {}) {
  if (!capture?.start || !capture?.stop || !recognizer?.transcribe || !player?.speak || typeof onSend !== 'function') throw new TypeError('Local speech adapters are required');
  let state = 'idle', mode = 'manual', epoch = 0, controller = null, temporaryAudio = null, draft = null, active = false;
  const notify = next => { state = next; onState({ state, mode, hasTemporaryAudio: !!temporaryAudio, draft: draft ? { ...draft } : null }); };
  const check = token => { if (token !== epoch || controller?.signal.aborted) throw abortError('Stale speech result'); };
  const stopAdapters = async () => { await Promise.allSettled([Promise.resolve().then(() => capture.stop()), Promise.resolve().then(() => player.stop?.())]); };
  async function listen(token) {
    check(token); notify('listening');
    await capture.start({ mode, signal: controller.signal,
      onUtterance: audio => { if (active && mode === 'handsfree' && state === 'listening' && token === epoch) processAudio(audio, token).catch(error => { if (error.name !== 'AbortError') { active = false; notify('error'); } }); },
      onError: () => { if (token === epoch) { active = false; pause('error'); } },
    });
    check(token);
  }
  async function processAudio(audio, token) {
    check(token); notify('transcribing'); await capture.stop(); check(token);
    temporaryAudio = audio;
    let result;
    try { result = await recognizer.transcribe(audio, { signal: controller.signal }); check(token); }
    catch (error) { if (error.name !== 'AbortError') { active = false; temporaryAudio = null; notify('error'); } throw error; }
    const text = typeof result.recognizedText === 'string' ? result.recognizedText.trim() : '';
    if (!text) { temporaryAudio = null; if (active && mode === 'handsfree') await listen(token); else notify('review'); return; }
    draft = { recognizedText: text, text, edited: false, recognitionUncertain: result.uncertain === true, source: mode === 'manual' ? 'manual-speech' : 'handsfree-speech' };
    await onDraft({ ...draft }); check(token);
    if (mode === 'manual' || draft.recognitionUncertain) { notify('review'); return; }
    await sendDraft(token);
  }
  async function sendDraft(token = epoch) {
    check(token); if (!draft?.text?.trim()) throw new TypeError('No transcript to send');
    if (['thinking', 'speaking'].includes(state)) throw new Error('A speech turn is already pending');
    const sent = { ...draft }; notify('thinking');
    let response;
    try { response = await onSend(sent, { signal: controller.signal }); check(token); }
    catch (error) { if (error.name !== 'AbortError') { active = false; notify('error'); } throw error; }
    // Host onSend owns durable learner/assistant commit ordering. A transcript
    // edit must be confirmed before calling this method, not silently normalized.
    draft = null; temporaryAudio = null; notify('speaking');
    const text = response?.message?.text || response?.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error('No validated reply to speak');
    try { check(token); await player.speak(text, { signal: controller.signal }); check(token); }
    catch (error) { if (error.name !== 'AbortError') { active = false; notify('error'); } throw error; }
    if (active && mode === 'handsfree') await listen(token); else notify('idle');
    return response;
  }
  async function pause(reason = 'paused') {
    epoch++; active = false; controller?.abort(); await stopAdapters(); temporaryAudio = null; notify(reason);
  }
  return {
    get snapshot() { return { state, mode, active, draft: draft ? { ...draft } : null }; },
    async start(nextMode = 'manual') {
      if (!['manual', 'handsfree'].includes(nextMode)) throw new TypeError('Unknown speech mode');
      await pause(); mode = nextMode; active = true; controller = new AbortController(); const token = epoch;
      try {
        if (mode === 'manual') { notify('recording'); await capture.start({ mode, signal: controller.signal }); check(token); }
        else await listen(token);
      } catch (error) { if (error.name !== 'AbortError') await pause('error'); throw error; }
    },
    async stopRecording() {
      if (mode !== 'manual' || state !== 'recording') throw new Error('Manual recording is not active');
      const token = epoch; notify('finishing'); const audio = await capture.finish(); check(token); active = false; await processAudio(audio, token);
      return draft ? { ...draft } : null;
    },
    async edit(text) {
      if (state !== 'review' || !draft || typeof text !== 'string') throw new Error('Transcript is not editable');
      draft = { ...draft, text, edited: text !== draft.recognizedText, recognitionUncertain: false }; await onDraft({ ...draft }); notify('review');
    },
    sendDraft,
    pause,
    async cancelDraft() { await pause(); draft = null; await onDraft(null); notify('idle'); },
    // Visibility loss, profile changes and OS audio interruptions call lifecycle.
    // Returning foreground requires a new explicit start action.
    lifecycle() { return pause(); },
    retainedAudio() { return temporaryAudio; }, // host saves only on an explicit learner action
    async dispose() { await pause(); draft = null; notify('disposed'); },
  };
}
