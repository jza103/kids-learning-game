// Optional natural voice from ElevenLabs. Each word and sentence is generated
// once, saved on this device (Cache Storage) and played from there, so
// practice still works offline. Only the words and sentences are sent to
// ElevenLabs; the API key stays on this device and is left out of backups.

export const AUDIO_CACHE = 'spelling-audio';
export const MODEL_ID = 'eleven_multilingual_v2';
const API = 'https://api.elevenlabs.io/v1';
// 64 kbps is plenty for a voice and keeps shared list files small.
export const OUTPUT_FORMAT = 'mp3_44100_64';
const KEY_STORE = 'klg-elevenlabs-key';

// ---------- pure helpers (tested) ----------
export function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

// How clips are made. A word said on its own sounds odd to the AI voice, so
// each request carries spelling-test context (previous_text), the word and its
// sentence are one clip so the word sounds the same every time, and the voice
// is tuned to be steady and a little slow. Bump CLIP_STYLE when this changes
// so old clips are made again.
export const CLIP_STYLE = 2;
export const WORD_CONTEXT = 'Spelling test. Listen carefully. The next word is:';
export const SENTENCE_CONTEXT = 'Spelling test. I will say the word, use it in a sentence, then say the word again.';
export const PAUSE = '<break time="0.8s" />';
export const VOICE_SETTINGS = { stability: 0.8, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.9 };

/** The word as it should be read: no trailing punctuation the parent typed. */
function cleanWord(word) {
  return normalizeText(word).replace(/[.!?,;:]+$/, '');
}

/** End a sentence with punctuation so the voice finishes it naturally. */
function cleanSentence(sentence) {
  const s = normalizeText(sentence);
  return s && !/[.!?]["')\]]?$/.test(s) ? `${s}.` : s;
}

/** The clip for a word on its own. */
export function wordClip(word) {
  const w = cleanWord(word);
  return { id: `v${CLIP_STYLE}/word/${w}`, text: `${w}.`, previous: WORD_CONTEXT };
}

/** One clip for "word. sentence. word.", spoken in a single breath of context. */
export function sentenceClip(word, sentence) {
  const w = cleanWord(word);
  const s = cleanSentence(sentence);
  return { id: `v${CLIP_STYLE}/sentence/${w}/${s}`, text: `${w}. ${PAUSE} ${s} ${PAUSE} ${w}.`, previous: SENTENCE_CONTEXT };
}

// Word Match clips: the word then its meaning in one clip, and the meaning on
// its own (for reading out the meanings on a board).
export const MEANING_CONTEXT = 'Vocabulary practice. I will say the word, then what it means.';
export const DEFINITION_CONTEXT = 'Vocabulary practice. This is what a word means:';

export function meaningClip(word, definition) {
  const w = cleanWord(word);
  const d = cleanSentence(definition);
  return { id: `v${CLIP_STYLE}/meaning/${w}/${d}`, text: `${w}. ${PAUSE} ${d}`, previous: MEANING_CONTEXT };
}

export function definitionClip(definition) {
  const d = cleanSentence(definition);
  return { id: `v${CLIP_STYLE}/definition/${d}`, text: d, previous: DEFINITION_CONTEXT };
}

/** The clips a Word Match word needs: the word, word + meaning, and the meaning alone. */
export function clipsForVocab(w) {
  if (!cleanWord(w.word)) return [];
  const out = [wordClip(w.word)];
  if (normalizeText(w.definition)) out.push(meaningClip(w.word, w.definition), definitionClip(w.definition));
  return out;
}

/** Every clip a word list needs (spelling and Word Match), without repeats. */
export function clipsForList(list) {
  const out = new Map();
  for (const w of list.spelling || []) for (const c of clipsForWord(w)) out.set(c.id, c);
  for (const w of list.vocab || []) for (const c of clipsForVocab(w)) out.set(c.id, c);
  return [...out.values()];
}

/** Cache key for a clip. Not a real URL; it only names the stored audio. */
export function clipUrl(voiceId, clipId) {
  return `https://audio.local/${encodeURIComponent(voiceId)}/${encodeURIComponent(clipId)}`;
}

/** The clips a word needs: the word, plus word-sentence-word if it has a sentence. */
export function clipsForWord(w) {
  const out = [];
  if (cleanWord(w.word)) out.push(wordClip(w.word));
  if (cleanWord(w.word) && normalizeText(w.sentence)) out.push(sentenceClip(w.word, w.sentence));
  return out;
}

/** Every clip these profiles need, without repeats. */
export function clipSpecs(profiles) {
  const out = new Map();
  for (const p of profiles) for (const w of p.words || []) for (const c of clipsForWord(w)) out.set(c.id, c);
  return [...out.values()];
}

/** ElevenLabs characters these clips use (the pause tags are left out). */
export function charCount(specs) {
  return specs.reduce((n, c) => n + c.text.split(PAUSE).join('').length, 0);
}

// ElevenLabs' standard voices, used when the key isn't allowed to list voices
// (a key with only Text to Speech access can still use these).
export const DEFAULT_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', accent: 'american', description: 'soft, warm' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'american', description: 'calm' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', accent: 'american', description: 'friendly' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', accent: 'british', description: 'warm' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', accent: 'british', description: 'clear' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', accent: 'american', description: 'deep' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', accent: 'british', description: 'warm' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', accent: 'british', description: 'authoritative' },
];

/** True when the error is about the key's permissions rather than the key itself. */
export function isPermissionError(status, detail = '') {
  return status === 403 || /permission/i.test(detail);
}

/** Turn an API error into a sentence a parent can act on, keeping ElevenLabs' own reason. */
export function explainError(status, detail = '') {
  const why = detail ? ` (ElevenLabs said: ${detail})` : '';
  if (isPermissionError(status, detail)) return `The key is missing a permission it needs${why}. Edit the key on elevenlabs.io and turn on Text to Speech.`;
  if (status === 401) return `ElevenLabs rejected the API key${why}. Check that the whole key was copied.`;
  if (status === 402 || /quota|credits/i.test(detail)) return `This month's free ElevenLabs characters are used up${why}. Words without audio will use the built-in voice.`;
  if (status === 429) return 'ElevenLabs is busy. Try again in a minute.';
  if (status === 0) return "Couldn't reach ElevenLabs. Check the internet connection.";
  if (status === 404) return `ElevenLabs couldn't find that voice${why}. Pick another voice.`;
  return `ElevenLabs error ${status}${why}`;
}

// ---------- key ----------
export function getKey() {
  try {
    return localStorage.getItem(KEY_STORE) || '';
  } catch {
    return '';
  }
}

export function setKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORE, key.trim());
    else localStorage.removeItem(KEY_STORE);
  } catch {}
}

// ---------- API ----------
async function api(path, key, init = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers: { 'xi-api-key': key, ...(init.headers || {}) } });
  } catch {
    throw Object.assign(new Error(explainError(0)), { status: 0 });
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      const d = body?.detail;
      detail = typeof d === 'string' ? d : [d?.status, d?.message].filter(Boolean).join(': ');
    } catch {}
    throw Object.assign(new Error(explainError(res.status, detail)), { status: res.status, detail });
  }
  return res;
}

/**
 * Voices available to this key, premade ones first. If the key may not list
 * voices (Text-to-Speech-only keys), returns the standard voices with limited: true.
 */
export async function listVoicesOrDefaults(key) {
  try {
    return { voices: await listVoices(key), limited: false };
  } catch (err) {
    if (err.status === 401 || err.status === 403) return { voices: DEFAULT_VOICES, limited: true, reason: err.detail || '' };
    throw err;
  }
}

export async function listVoices(key) {
  const res = await api('/voices', key);
  const { voices = [] } = await res.json();
  return voices
    .map((v) => ({ id: v.voice_id, name: v.name, category: v.category, accent: v.labels?.accent || '', description: v.labels?.description || v.labels?.descriptive || '' }))
    .sort((a, b) => (b.category === 'premade') - (a.category === 'premade') || a.name.localeCompare(b.name));
}

/** The request body for a clip (exported for tests). */
export function clipRequest(spec) {
  return { text: spec.text, model_id: MODEL_ID, previous_text: spec.previous, voice_settings: VOICE_SETTINGS };
}

/** spec: a clip from wordClip/sentenceClip, or plain text. */
export async function generateClip(key, voiceId, spec) {
  const clip = typeof spec === 'string' ? { text: normalizeText(spec) } : spec;
  const res = await api(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(clipRequest(clip)),
  });
  return res.blob();
}

// ---------- saved clips ----------
const objectUrls = new Map();

async function audioCache() {
  return caches.open(AUDIO_CACHE);
}

export async function hasClip(voiceId, spec) {
  if (typeof caches === 'undefined') return false;
  return Boolean(await (await audioCache()).match(clipUrl(voiceId, spec.id)));
}

/** Save a clip (e.g. one that came in a word list file). */
export async function putClip(voiceId, clipId, blob) {
  if (typeof caches === 'undefined') return;
  await (await audioCache()).put(clipUrl(voiceId, clipId), new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
}

/** A saved clip's audio, or null. */
export async function getClip(voiceId, clipId) {
  if (typeof caches === 'undefined') return null;
  const res = await (await audioCache()).match(clipUrl(voiceId, clipId));
  return res ? res.blob() : null;
}

/** Count how many of these clips are already saved for this voice. */
export async function countReady(voiceId, specs) {
  let n = 0;
  for (const c of specs) if (await hasClip(voiceId, c)) n++;
  return n;
}

/**
 * Generate and save any clips that don't exist yet. Stops at the first key or
 * quota problem. onProgress(done, total) after each clip.
 */
export async function prepareClips(key, voiceId, specs, onProgress = () => {}) {
  const cache = await audioCache();
  const missing = [];
  for (const c of specs) if (!(await cache.match(clipUrl(voiceId, c.id)))) missing.push(c);
  let made = 0;
  for (const c of missing) {
    try {
      const blob = await generateClip(key, voiceId, c);
      await cache.put(clipUrl(voiceId, c.id), new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
      made++;
      onProgress(made, missing.length);
    } catch (err) {
      return { made, missing: missing.length, error: err.message };
    }
  }
  return { made, missing: missing.length, error: null };
}

/** Load saved clips into memory so they can play instantly (keeps iPad happy). */
export async function preload(voiceId, specs) {
  if (typeof caches === 'undefined' || !voiceId) return;
  const cache = await audioCache();
  for (const c of specs) {
    const k = clipUrl(voiceId, c.id);
    if (objectUrls.has(k)) continue;
    const res = await cache.match(k);
    if (res) objectUrls.set(k, URL.createObjectURL(await res.blob()));
  }
}

/** A ready-to-play URL for a clip that has been preloaded, or null. */
export function loadedClip(voiceId, spec) {
  return voiceId && spec ? objectUrls.get(clipUrl(voiceId, spec.id)) || null : null;
}

/** Which saved clip URLs are no longer needed (deleted words, old clip styles). */
export function staleClipUrls(savedUrls, specs) {
  const keep = new Set(specs.map((c) => encodeURIComponent(c.id)));
  return savedUrls.filter((u) => !keep.has(u.split('/').pop()));
}

/** Delete saved audio that no word needs any more, for every voice. */
export async function pruneClips(specs) {
  if (typeof caches === 'undefined') return 0;
  const cache = await audioCache();
  const stale = staleClipUrls((await cache.keys()).map((r) => r.url), specs);
  for (const u of stale) {
    await cache.delete(u);
    const obj = objectUrls.get(u);
    if (obj) URL.revokeObjectURL(obj);
    objectUrls.delete(u);
  }
  return stale.length;
}

export async function clearClips() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls.clear();
  if (typeof caches !== 'undefined') await caches.delete(AUDIO_CACHE);
}
