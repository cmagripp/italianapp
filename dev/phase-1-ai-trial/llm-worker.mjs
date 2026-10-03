import { CreateMLCEngine } from '@mlc-ai/web-llm';
import { SETTINGS, messagesFor, validateReply } from './core.mjs';
let engine, generation = 0, currentModelId;
self.onmessage = async ({ data }) => {
  const { id, op, payload } = data;
  try {
    if (op === 'cancel') { generation++; engine?.interruptGenerate(); self.postMessage({ id, result: true }); return; }
    if (op === 'unload') { generation++; await engine?.unload(); engine = null; self.postMessage({ id, result: true }); return; }
    if (op === 'load') {
      await engine?.unload(); const started = performance.now();
      const model = { ...payload.model, model: new URL(payload.model.model, self.location.href).href, model_lib: new URL(payload.model.model_lib, self.location.href).href };
      engine = await CreateMLCEngine(model.model_id, { appConfig: { model_list: [model], useIndexedDBCache: false }, logLevel: 'ERROR',
        initProgressCallback: p => self.postMessage({ progress: p }) }, { context_window_size: payload.context || SETTINGS.context_window_size, sliding_window_size: -1, enable_thinking: false });
      currentModelId = model.model_id;
      self.postMessage({ id, result: { loadMs: performance.now() - started } }); return;
    }
    if (!engine) throw Error('Load an explicitly provisioned model first.');
    const token = ++generation, started = performance.now(); let firstTokenMs = null, text = '', usage;
    const stream = await engine.chat.completions.create({ messages: messagesFor(payload.text, payload.level, payload.history),
      max_tokens: SETTINGS.max_tokens, temperature: SETTINGS.temperature, top_p: SETTINGS.top_p, seed: SETTINGS.seed,
      ...(/^Qwen3(?:[-.])/.test(currentModelId) ? { extra_body: { enable_thinking: false } } : {}),
      stream: true, stream_options: { include_usage: true } });
    for await (const chunk of stream) { if (token !== generation) throw Error('Cancelled'); const next = chunk.choices[0]?.delta.content || ''; if (next && firstTokenMs === null) firstTokenMs = performance.now() - started; text += next; usage ||= chunk.usage; }
    // WebLLM 0.2.85 includes its injected empty Qwen3 thinking header in the output.
    // Remove only that exact empty header; reject any actual/internal reasoning.
    const rawReply = text; text = text.replace(/^<think>\s*<\/think>\s*/, '');
    const validation = validateReply(text);
    self.postMessage({ id, result: { reply: validation.text, rawReply, validation, llmMs: performance.now() - started, firstTokenMs, usage } });
  } catch (error) { self.postMessage({ id, error: String(error?.message || error) }); }
};
