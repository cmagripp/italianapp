import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/fixtures');
await mkdir(folder, { recursive: true });
const reference = 'Ieri io andare al mercato, ma non comprare niente.';
for (const [command, args] of [['say', ['-v', 'Alice', '-o', path.join(folder, 'learner-error.aiff'), reference]], ['afconvert', ['-f', 'WAVE', '-d', 'LEI16', path.join(folder, 'learner-error.aiff'), path.join(folder, 'learner-error.wav')]]]) {
  const result = spawnSync(command, args); if (result.status !== 0) throw Error(`macOS fixture tool ${command} failed: ${result.stderr}`);
}
const wav = await readFile(path.join(folder, 'learner-error.wav')); let dataAt, byteRate;
for (let offset = 12; offset + 8 < wav.length;) { const kind = wav.toString('ascii', offset, offset + 4), size = wav.readUInt32LE(offset + 4); if (kind === 'fmt ') byteRate = wav.readUInt32LE(offset + 16); if (kind === 'data') dataAt = offset; offset += 8 + size + size % 2; }
if (!dataAt || !byteRate) throw Error('Unexpected fixture WAV layout');
const silence = Buffer.alloc(byteRate * 2), padded = Buffer.concat([wav, silence]); padded.writeUInt32LE(padded.length - 8, 4); padded.writeUInt32LE(wav.readUInt32LE(dataAt + 4) + silence.length, dataAt + 4);
await writeFile(path.join(folder, 'learner-error-padded.wav'), padded);
await writeFile(path.join(folder, 'provenance.json'), JSON.stringify({ reference, source: 'synthetic macOS Alice local voice', humanLearnerRecording: false, additionalSilenceSeconds: 2 }, null, 2));
console.log('Synthetic Italian regression fixture prepared. It cannot establish human learner recognition quality.');
