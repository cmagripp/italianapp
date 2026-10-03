/** Serial local inference: aborts reject immediately, but the next task waits for
 * the runtime to settle so two generators never share one model concurrently. */
export function abortError(message = 'AI request cancelled') {
  return new DOMException(message, 'AbortError');
}

export class RequestQueue {
  #pending = []; #active = null; #sequence = 0; #disposed = false;
  constructor({ onCancel = () => {} } = {}) { this.onCancel = onCancel; }
  get state() { return { active: !!this.#active, pending: this.#pending.length, disposed: this.#disposed }; }
  enqueue(run, { signal, priority = 0, scope = 'default' } = {}) {
    if (this.#disposed || signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const item = { run, resolve, reject, priority, scope, sequence: ++this.#sequence, controller: new AbortController(), settled: false };
      item.abort = () => {
        if (item.settled) return;
        item.controller.abort(); item.settled = true; reject(abortError());
        this.#pending = this.#pending.filter(candidate => candidate !== item);
        if (this.#active === item) { try { Promise.resolve(this.onCancel()).catch(() => {}); } catch {} }
        item.cleanup();
      };
      item.cleanup = () => signal?.removeEventListener('abort', item.abort);
      signal?.addEventListener('abort', item.abort, { once: true });
      this.#pending.push(item);
      this.#pending.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
      this.#drain();
    });
  }
  cancelScope(scope) { for (const item of [...this.#pending, this.#active].filter(Boolean)) if (item.scope === scope) item.abort(); }
  dispose() { this.#disposed = true; for (const item of [...this.#pending, this.#active].filter(Boolean)) item.abort(); }
  async #drain() {
    if (this.#active || this.#disposed) return;
    const item = this.#pending.shift(); if (!item) return;
    this.#active = item;
    try {
      const result = await item.run(item.controller.signal);
      if (!item.settled) { item.settled = true; item.resolve(result); }
    } catch (error) { if (!item.settled) { item.settled = true; item.reject(error); } }
    finally { item.cleanup(); this.#active = null; this.#drain(); }
  }
}
