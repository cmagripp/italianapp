import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url)), port = Number(process.env.PAROLA_TRIAL_PORT || 8132);
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/measurements' && req.method === 'POST') {
      const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 4e6) throw Error('Report too large'); chunks.push(chunk); }
      const report = JSON.parse(Buffer.concat(chunks).toString()); await mkdir(path.join(root, 'measurements'), { recursive: true });
      await writeFile(path.join(root, 'measurements', `${Date.now()}.json`), JSON.stringify(report, null, 2)); res.writeHead(201); res.end('saved'); return;
    }
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const metadata = await stat(file); if (!metadata.isFile()) throw Error('Not a file');
    // Match the single-thread GitHub Pages baseline: deliberately no COOP/COEP shim.
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': metadata.size, 'Cache-Control': 'no-cache' }); createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end('Trial resource unavailable'); }
}).listen(port, '127.0.0.1', () => console.log(`Disposable AI trial: http://127.0.0.1:${port}`));
