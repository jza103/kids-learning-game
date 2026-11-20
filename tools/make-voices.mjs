#!/usr/bin/env node
// Make the ElevenLabs voice audio for word lists once, on a computer, and save
// a word list file with the audio inside. Load that file on each iPad under
// Grown-ups → Word lists → Choose a file; no key is needed there.
//
//   ELEVENLABS_API_KEY=... node tools/make-voices.mjs                 # all built-in lists
//   ELEVENLABS_API_KEY=... node tools/make-voices.mjs --grade 3       # just 3rd grade
//   ELEVENLABS_API_KEY=... node tools/make-voices.mjs --in teacher.txt --name "Ms. Lee week 4"
//   node tools/make-voices.mjs --dry                                   # count characters only
//
// Options: --voice <ElevenLabs voice id> (default Sarah), --voice-name <label>,
// --kind auto|spelling|vocab (for --in), --out <file>. Requires Node 18+.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { BUILTIN_LISTS } from '../src/word-lists-builtin.js';
import { parseListText, makeListFile } from '../src/wordlists.js';
import { clipsForList, generateClip, charCount, DEFAULT_VOICES } from '../src/aivoice.js';

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const voiceId = opt('voice', DEFAULT_VOICES[0].id);
const voiceName = opt('voice-name', DEFAULT_VOICES.find((v) => v.id === voiceId)?.name || 'AI voice');
let lists;
if (opt('in')) {
  const file = opt('in');
  const parsed = parseListText(readFileSync(file, 'utf8'), { kind: opt('kind', 'auto'), name: opt('name', basename(file).replace(/\.[^.]+$/, '')) });
  lists = parsed.lists;
  if (parsed.skipped.length) console.warn(`Skipped: ${parsed.skipped.join(' · ')}`);
} else {
  const grade = opt('grade');
  lists = BUILTIN_LISTS.filter((l) => !grade || String(l.grade) === grade);
}
if (!lists.length) {
  console.error('No words found.');
  process.exit(1);
}

const specs = [...new Map(lists.flatMap(clipsForList).map((c) => [c.id, c])).values()];
console.log(`${lists.length} lists, ${specs.length} clips, about ${charCount(specs).toLocaleString()} ElevenLabs characters, voice ${voiceName}.`);
if (flag('dry')) process.exit(0);

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('Set ELEVENLABS_API_KEY first (elevenlabs.io → API keys, with Text to Speech turned on).');
  process.exit(1);
}

const out = opt('out', `word-lists${opt('grade') ? `-grade-${opt('grade')}` : ''}${opt('in') ? `-${basename(opt('in')).replace(/\.[^.]+$/, '')}` : ''}-with-voices.json`);
// Pick up where an earlier run stopped (same voice).
const clips = {};
if (existsSync(out)) {
  try {
    const old = JSON.parse(readFileSync(out, 'utf8')).audio;
    if (old?.voiceId === voiceId) Object.assign(clips, old.clips);
  } catch {}
}
let n = 0;
for (const c of specs) {
  if (clips[c.id]) {
    n++;
    continue;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const blob = await generateClip(key, voiceId, c);
      clips[c.id] = Buffer.from(await blob.arrayBuffer()).toString('base64');
      break;
    } catch (err) {
      if (err.status === 429 && attempt < 5) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      console.error(`\nStopped at clip ${n + 1}: ${err.message}`);
      if (n) writeFileSync(out, JSON.stringify(makeListFile(lists, { voiceId, voiceName, clips })));
      if (n) console.error(`Saved the ${n} clips made so far in ${out}. Run again later to finish.`);
      process.exit(1);
    }
  }
  n++;
  process.stdout.write(`\r${n} of ${specs.length}`);
}
writeFileSync(out, JSON.stringify(makeListFile(lists, { voiceId, voiceName, clips })));
console.log(`\nSaved ${out}. On each iPad: Grown-ups → Word lists → Choose a file.`);
