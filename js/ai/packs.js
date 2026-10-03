import { abortError } from './queue.js';
import { createSHA256 } from './sha256.js';

const SHA = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{40,64}$/;
const PREFIX = 'parola-ai-pack-v1:';
function checkAbort(signal) { if (signal?.aborted) throw abortError('Pack installation cancelled'); }

export function validatePackManifest(manifest, origin, allowedOrigins = [origin]) {
  if (!manifest || manifest.schema !== 1 || !/^[a-z0-9-]{1,60}$/.test(manifest.id) || !REVISION.test(manifest.revision) ||
      typeof manifest.runtime?.name !== 'string' || typeof manifest.runtime?.version !== 'string' ||
      !Array.isArray(manifest.notices) || !manifest.notices.length || manifest.notices.some(n => typeof n !== 'string' || !n.trim()) ||
      !Array.isArray(manifest.assets) || !manifest.assets.length) throw new TypeError('Invalid pinned pack manifest');
  const urls = new Set();
  for (const asset of manifest.assets) {
    const url = new URL(asset.url, origin);
    if (!allowedOrigins.includes(url.origin) || (asset.kind === 'runtime' && url.origin !== origin) || url.username || url.password || url.hash || !(url.pathname.includes(asset.revision || manifest.revision) || url.pathname.includes(asset.sha256)) ||
        !['weights', 'tokenizer', 'runtime', 'recognition', 'voice', 'vad', 'notice'].includes(asset.kind) || ((/\.(?:m?js|wasm)$/i.test(url.pathname)) && asset.kind !== 'runtime') || !SHA.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 512 * 1024 * 1024 || urls.has(url.href)) {
      throw new TypeError('Invalid local pack asset');
    }
    urls.add(url.href);
  }
  return { ...structuredClone(manifest), assets: manifest.assets.map(a => ({ ...a, url: new URL(a.url, origin).href })), bytes: manifest.assets.reduce((total, a) => total + a.bytes, 0) };
}

/** Assets are verified before a single durable pointer activates a revision.
 * A failed replacement leaves the previous pack active. Interrupted installs
 * keep verified shards for a later resume; learner records are never touched. */
export function createPackManager({ cacheStorage = globalThis.caches, fetchImpl = globalThis.fetch, hashFactory = createSHA256,
  origin = globalThis.location?.origin, allowedOrigins = [origin], storageEstimate = () => globalThis.navigator?.storage?.estimate?.(), locks = globalThis.navigator?.locks } = {}) {
  if (!cacheStorage || typeof hashFactory !== 'function' || !origin || typeof fetchImpl !== 'function' || !allowedOrigins.every(value => { const url = new URL(value); return url.origin === value && (url.protocol === 'https:' || value === origin); })) throw new TypeError('Verified offline pack storage is unavailable');
  const stateCache = `${PREFIX}state`;
  const stateURL = id => new URL(`/__parola_ai_pack_state__/${id}`, origin).href;
  const packName = pack => `${PREFIX}${pack.id}:${pack.revision}`;
  const localBusy = new Set();
  const validAsset = async (response, asset) => {
    if (!response) return false;
    const hash = hashFactory(), reader = response.body.getReader(); let bytes = 0;
    try {
      while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > asset.bytes) { await reader.cancel(); return false; } hash.update(next.value); }
      return bytes === asset.bytes && hash.hex() === asset.sha256;
    } finally { reader.releaseLock(); }
  };
  async function exclusive(id, work) {
    if (locks) return locks.request(`${PREFIX}${id}`, work);
    if (localBusy.has(id)) throw new Error('Pack operation already in progress');
    localBusy.add(id); try { return await work(); } finally { localBusy.delete(id); }
  }
  async function active(id, { verify = false } = {}) {
    const response = await (await cacheStorage.open(stateCache)).match(stateURL(id));
    if (!response) return null;
    const pack = validatePackManifest(await response.json(), origin, allowedOrigins);
    if (!(await cacheStorage.keys()).includes(packName(pack))) throw new Error('Active pack is missing; repair required');
    if (verify) {
      const cache = await cacheStorage.open(packName(pack));
      for (const asset of pack.assets) if (!await validAsset(await cache.match(asset.url), asset)) throw new Error('Active pack is damaged; repair required');
    }
    return pack;
  }
  return {
    active,
    install(input, { signal, onProgress = () => {}, probe } = {}) {
      const pack = validatePackManifest(input, origin, allowedOrigins);
      return exclusive(pack.id, async () => {
        checkAbort(signal);
        const priorResponse = await (await cacheStorage.open(stateCache)).match(stateURL(pack.id));
        if (priorResponse) {
          const prior = validatePackManifest(await priorResponse.json(), origin, allowedOrigins);
          if (prior.revision === pack.revision && JSON.stringify({ assets: prior.assets, runtime: prior.runtime }) !== JSON.stringify({ assets: pack.assets, runtime: pack.runtime })) throw new Error('An installed immutable revision cannot change its assets');
        }
        const cache = await cacheStorage.open(packName(pack)); let completedBytes = 0, transferredBytes = 0;
        const missing = [];
        for (const asset of pack.assets) {
          checkAbort(signal);
          if (await validAsset(await cache.match(asset.url), asset)) completedBytes += asset.bytes;
          else { await cache.delete(asset.url); missing.push(asset); }
        }
        const estimate = await storageEstimate();
        if (Number.isFinite(estimate?.quota) && Number.isFinite(estimate?.usage) && estimate.quota - estimate.usage < (pack.bytes - completedBytes) * 1.1) throw new Error('Insufficient storage for a verified pack');
        const progress = phase => onProgress({ phase, totalBytes: pack.bytes, verifiedBytes: completedBytes, transferredBytes });
        progress('downloading');
        for (const asset of missing) {
          checkAbort(signal);
          const response = await fetchImpl(asset.url, { signal, cache: 'no-store', credentials: new URL(asset.url).origin === origin ? 'same-origin' : 'omit', redirect: 'follow' });
          if (!response.ok || response.type === 'opaque' || (response.url && !allowedOrigins.includes(new URL(response.url).origin))) throw new Error('Allowlisted pack download failed');
          if (!response.body) throw new Error('Pack download has no streaming body');
          const hash = hashFactory(); let size = 0;
          const verifiedStream = response.body.pipeThrough(new TransformStream({
            transform(chunk, output) {
              checkAbort(signal); size += chunk.byteLength; transferredBytes += chunk.byteLength;
              if (size > asset.bytes) throw new Error('Pack asset exceeds pinned size');
              hash.update(chunk); progress('downloading'); output.enqueue(chunk);
            },
            flush() {
              checkAbort(signal); progress('verifying');
              if (size !== asset.bytes || hash.hex() !== asset.sha256) throw new Error('Pack integrity verification failed');
            },
          }));
          try { await cache.put(asset.url, new Response(verifiedStream, { headers: { 'Content-Type': asset.contentType || 'application/octet-stream', 'Content-Length': String(asset.bytes) } })); }
          catch (error) { await cache.delete(asset.url); throw error; }
          completedBytes += asset.bytes; progress('verified');
        }
        checkAbort(signal);
        let runtimeProbe = null;
        if (probe) {
          progress('probing');
          runtimeProbe = await probe({ pack, signal, response: async url => {
            const absolute = new URL(url, origin).href;
            if (!pack.assets.some(asset => asset.url === absolute)) throw new Error('Probe requested an unpinned asset');
            return cache.match(absolute);
          } });
          checkAbort(signal);
          if (!runtimeProbe || runtimeProbe.written !== true || runtimeProbe.modelRevision !== pack.revision || runtimeProbe.runtimeVersion !== pack.runtime.version) throw new Error('Local runtime compatibility probe failed');
        }
        const installed = { ...pack, readiness: { assetsVerified: true, writtenGeneration: runtimeProbe?.written === true, speechPipeline: runtimeProbe?.speech === true,
          italianTeachingQuality: false, physicalPhone: false }, runtimeProbe };
        // No active pointer is changed until every asset has passed verification.
        await (await cacheStorage.open(stateCache)).put(stateURL(pack.id), new Response(JSON.stringify(installed), { headers: { 'Content-Type': 'application/json' } }));
        progress(runtimeProbe ? 'ready' : 'assets-installed'); return installed;
      });
    },
    async response(id, url) {
      const pack = await active(id); if (!pack) return null;
      const absolute = new URL(url, origin).href;
      const asset = pack.assets.find(a => a.url === absolute); if (!asset) return null;
      const cache = await cacheStorage.open(packName(pack));
      if (!await validAsset(await cache.match(absolute), asset)) throw new Error('Pack integrity failed; repair required');
      // A new cache response avoids an unread tee branch buffering the whole
      // asset while its sibling is hashed.
      return cache.match(absolute);
    },
    remove(id) {
      return exclusive(id, async () => {
        await (await cacheStorage.open(stateCache)).delete(stateURL(id));
        for (const name of await cacheStorage.keys()) if (name.startsWith(`${PREFIX}${id}:`)) await cacheStorage.delete(name);
      });
    },
  };
}
