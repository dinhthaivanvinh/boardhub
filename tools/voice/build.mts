/**
 * Makes the pre-recorded lesson voice: one mp3 per sentence the lessons say, named by `voiceKey(sentence)`, plus
 * `index.json` listing the files that exist. Run by hand, see README.md.
 *
 *   pnpm --filter @bg/server exec tsx ../../tools/voice/build.mts [--force]
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mp3Encoder } from '@breezystack/lamejs';
import { speechEntries } from '../../packages/games/chess/src/learn/speech-texts';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, 'package.json'));
const sherpa = require('sherpa-onnx-node');

const MODEL_DIR = process.env.VOICE_MODEL_DIR ?? join(here, 'model', 'vits-piper-vi_VN-vais1000-medium');
const OUT_DIR = join(here, '..', '..', 'apps', 'web', 'public', 'audio', 'vi');
const FORCE = process.argv.includes('--force');
/** A little slower than the voice's natural speed: the listeners are five years old. */
const SPEED = 0.9;
const KBPS = 48;

const tts = new sherpa.OfflineTts({
  model: {
    vits: {
      model: join(MODEL_DIR, 'vi_VN-vais1000-medium.onnx'),
      tokens: join(MODEL_DIR, 'tokens.txt'),
      dataDir: join(MODEL_DIR, 'espeak-ng-data'),
    },
    debug: false,
    numThreads: 2,
    provider: 'cpu',
  },
  maxNumSentences: 1,
});

/** Float samples (-1..1) to a mono mp3, with the peak brought to 90% so every file is about as loud. */
function toMp3(samples: Float32Array, sampleRate: number): Buffer {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0 ? 0.9 / peak : 1;
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++)
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i]! * gain * 32767)));
  const encoder = new Mp3Encoder(1, sampleRate, KBPS);
  const parts: Buffer[] = [];
  for (let i = 0; i < pcm.length; i += 1152)
    parts.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(i, i + 1152))));
  parts.push(Buffer.from(encoder.flush()));
  return Buffer.concat(parts.filter((p) => p.length > 0));
}

mkdirSync(OUT_DIR, { recursive: true });
const entries = speechEntries('vi');
const wanted = new Set(entries.map((e) => `${e.key}.mp3`));

let made = 0;
let kept = 0;
let bytes = 0;
for (const [i, entry] of entries.entries()) {
  const file = join(OUT_DIR, `${entry.key}.mp3`);
  if (!FORCE && existsSync(file)) {
    kept++;
    continue;
  }
  const audio = tts.generate({ text: entry.spoken, sid: 0, speed: SPEED });
  if (audio.samples.length === 0) throw new Error(`no audio for: ${entry.spoken}`);
  const mp3 = toMp3(audio.samples, audio.sampleRate);
  writeFileSync(file, mp3);
  bytes += mp3.length;
  made++;
  if (made % 25 === 0) console.log(`${i + 1}/${entries.length}`);
}

// Files of sentences that no lesson says any more are removed.
for (const name of readdirSync(OUT_DIR)) {
  if (name.endsWith('.mp3') && !wanted.has(name)) rmSync(join(OUT_DIR, name));
}

writeFileSync(
  join(OUT_DIR, 'index.json'),
  JSON.stringify(
    {
      version: 1,
      lang: 'vi',
      voice: 'vi_VN-vais1000-medium (Piper)',
      credit:
        'VAIS-1000 Vietnamese speech synthesis corpus, CC BY 4.0, https://ieee-dataport.org/documents/vais-1000-vietnamese-speech-synthesis-corpus',
      files: entries.map((e) => e.key).sort(),
    },
    null,
    1,
  ) + '\n',
);
console.log(
  `made ${made}, kept ${kept}, ${(bytes / 1024).toFixed(0)} KB new, ${entries.length} sentences in total`,
);
