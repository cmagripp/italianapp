import { readFile, stat, statfs } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

const pins = JSON.parse(await readFile(new URL('./native-pins.json', import.meta.url)));
const root = new URL('../assets/native-llama/', import.meta.url);
const assets = [
  ['models/' + pins.model.file, pins.model.bytes, pins.model.sha256],
  ['runtime/macos-arm64.tar.gz', pins.runtime.macosArchiveBytes, pins.runtime.macosArchiveSHA256],
  ['runtime/xcframework.zip', pins.runtime.xcframeworkArchiveBytes, pins.runtime.xcframeworkArchiveSHA256],
  ['runtime/source.tar.gz', null, pins.runtime.sourceArchiveSHA256],
];
const storage = await statfs(root);
const freeGiB = Number(storage.bavail) * Number(storage.bsize) / 2 ** 30;
if (freeGiB < pins.trial.minimumFreeGiB) throw new Error('The owned trial disk floor is unavailable.');
for (const [path, expectedBytes, expectedHash] of assets) {
  const url = new URL(path, root), metadata = await stat(url), hash = createHash('sha256');
  for await (const chunk of createReadStream(url)) hash.update(chunk);
  const actualHash = hash.digest('hex');
  if ((expectedBytes !== null && metadata.size !== expectedBytes) || actualHash !== expectedHash) {
    throw new Error(`Pinned native artifact mismatch: ${path}`);
  }
  console.log(JSON.stringify({ path, bytes: metadata.size, sha256: actualHash, verified: true }));
}
console.log(JSON.stringify({ freeGiB, diskFloorGiB: pins.trial.minimumFreeGiB, downloadedBytes: 0 }));
