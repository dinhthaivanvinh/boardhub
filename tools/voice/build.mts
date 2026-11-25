/**
 * Makes the pre-recorded lesson voice: one mp3 per sentence the lessons say, named by `voiceKey(sentence)`, plus
 * `index.json` listing the files that exist. Run by hand, see README.md.
 *
 *   pnpm --filter @bg/server exec tsx ../../tools/voice/build.mts [--force]
 *
 * The voice is the Microsoft Edge neural voice (the one of Edge's "Read aloud"), fetched online one sentence at a
 * time. Environment: VOICE_NAME (default vi-VN-HoaiMyNeural), VOICE_RATE (default -25%).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { speechEntries } from '../../packages/games/chess/src/learn/speech-texts';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, 'package.json'));
const { EdgeTTS } = require('node-edge-tts') as {
  EdgeTTS: new (o: Record<string, unknown>) => { ttsPromise(text: string, file: string): Promise<void> };
};

const OUT_DIR = join(here, '..', '..', 'apps', 'web', 'public', 'audio', 'vi-edge');
const FORCE = process.argv.includes('--force');
const VOICE = process.env.VOICE_NAME ?? 'vi-VN-HoaiMyNeural';
/** Slower than the voice's natural speed: the listeners are five years old. */
const RATE = process.env.VOICE_RATE ?? '-25%';

const tts = new EdgeTTS({
  voice: VOICE,
  lang: 'vi-VN',
  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  rate: RATE,
  timeout: 30_000,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Asks again a few times: the online service now and then drops a request. */
async function speak(text: string, file: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await tts.ttsPromise(text, file);
      if (statSync(file).size > 1000) return;
      throw new Error('empty audio');
    } catch (err) {
      if (attempt >= 8) throw new Error(`no audio for: ${text}`, { cause: err });
      await sleep(5000 * attempt);
    }
  }
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
  await speak(entry.spoken, file);
  await sleep(700); // the service answers 429 to a fast client
  bytes += statSync(file).size;
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
      version: 2,
      lang: 'vi',
      voice: `${VOICE} (Microsoft Edge neural voice), rate ${RATE}`,
      files: entries.map((e) => e.key).sort(),
    },
    null,
    1,
  ) + '\n',
);
console.log(
  `made ${made}, kept ${kept}, ${(bytes / 1024).toFixed(0)} KB new, ${entries.length} sentences in total`,
);
