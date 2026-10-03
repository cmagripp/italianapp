import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
await build({ entryPoints: [path.join(root, 'hash-entry.mjs')], bundle: true, format: 'esm', platform: 'browser', outfile: path.join(root, '../../js/ai/sha256.js'), minify: true, legalComments: 'inline',
  banner: { js: '// Generated from @noble/hashes2.0.1; rebuild with dev/phase-1-ai-trial/build-hash.mjs. See sha256-LICENSE.txt.' } });
await copyFile(path.join(root, 'node_modules/@noble/hashes/LICENSE'), path.join(root, '../../js/ai/sha256-LICENSE.txt'));
