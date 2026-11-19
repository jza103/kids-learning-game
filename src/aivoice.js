// Optional natural voice from ElevenLabs. Each word and sentence is generated
// once, saved on this device (Cache Storage) and played from there, so
// practice still works offline. Only the words and sentences are sent to
// ElevenLabs; the API key stays on this device and is left out of backups.

export const AUDIO_CACHE = 'spelling-audio';
export const MODEL_ID = 'eleven_multilingual_v2';
const API = 'https://api.elevenlabs.io/v1';
const KEY_STORE = 'klg-elevenlabs-key';

// ---------- pure helpers (tested) ----------
export function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/** Cache key for a clip. Not a real URL; it only names the stored audio. */
export function clipUrl(voiceId, text) {
  return `https://audio.local/${encodeURIComponent(voiceId)}/${encodeURIComponent(normalizeText(text))}`;
}

/** Every word and example sentence in these profiles, without repeats. */
export function clipTexts(profiles) {
  const out = new Set();
  for (const p of profiles) {
    for (const w of p.words || []) {
      if (normalizeText(w.word)) out.add(normalizeText(w.word));
      if (normalizeText(w.sentence)) out.add(normalizeText(w.sentence));
    }
  }
  return [...out];
}

export function charCount(texts) {
  return texts.reduce((n, t) => n + t.length, 0);
}

/** Turn an API error into a sentence a parent can act on. */
export function explainError(status, detail = '') {
  if (status === 401) return 'ElevenLabs rejected the API key. Check that it was copied correctly and has Text to Speech access.';
  if (status === 402 || /quota|credits|limit/i.test(detail)) return "This month's free ElevenLabs characters are used up. Words without audio will use the built-in voice.";
  if (status === 429) return 'ElevenLabs is busy. Try again in a minute.';
  if (status === 0) return "Couldn't reach ElevenLabs. Check the internet connection.";
  return `ElevenLabs error ${status}${detail ? `: ${detail}` : ''}`;
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
      detail = body?.detail?.message || body?.detail?.status || (typeof body?.detail === 'string' ? body.detail : '');
    } catch {}
    throw Object.assign(new Error(explainError(res.status, detail)), { status: res.status });
  }
  return res;
}

/** Voices available to this key, premade ones first. */
export async function listVoices(key) {
  const res = await api('/voices', key);
  const { voices = [] } = await res.json();
  return voices
    .map((v) => ({ id: v.voice_id, name: v.name, category: v.category, accent: v.labels?.accent || '', description: v.labels?.description || v.labels?.descriptive || '' }))
    .sort((a, b) => (b.category === 'premade') - (a.category === 'premade') || a.name.localeCompare(b.name));
}

export async function generateClip(key, voiceId, text) {
  const res = await api(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: normalizeText(text), model_id: MODEL_ID, voice_settings: { stability: 0.6, similarity_boost: 0.75 } }),
  });
  return res.blob();
}

// ---------- saved clips ----------
const objectUrls = new Map();

async function audioCache() {
  return caches.open(AUDIO_CACHE);
}

export async function hasClip(voiceId, text) {
  if (typeof caches === 'undefined') return false;
  return Boolean(await (await audioCache()).match(clipUrl(voiceId, text)));
}

/** Count how many of these texts already have audio for this voice. */
export async function countReady(voiceId, texts) {
  let n = 0;
  for (const t of texts) if (await hasClip(voiceId, t)) n++;
  return n;
}

/**
 * Generate and save audio for any texts that don't have it yet. Stops at the
 * first key or quota problem. onProgress(done, total) after each clip.
 */
export async function prepareClips(key, voiceId, texts, onProgress = () => {}) {
  const cache = await audioCache();
  const missing = [];
  for (const t of texts) if (!(await cache.match(clipUrl(voiceId, t)))) missing.push(t);
  let made = 0;
  for (const t of missing) {
    try {
      const blob = await generateClip(key, voiceId, t);
      await cache.put(clipUrl(voiceId, t), new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
      made++;
      onProgress(made, missing.length);
    } catch (err) {
      return { made, missing: missing.length, error: err.message };
    }
  }
  return { made, missing: missing.length, error: null };
}

/** Load saved clips into memory so they can play instantly (keeps iPad happy). */
export async function preload(voiceId, texts) {
  if (typeof caches === 'undefined' || !voiceId) return;
  const cache = await audioCache();
  for (const t of texts) {
    const k = clipUrl(voiceId, t);
    if (objectUrls.has(k)) continue;
    const res = await cache.match(k);
    if (res) objectUrls.set(k, URL.createObjectURL(await res.blob()));
  }
}

/** A ready-to-play URL for a clip that has been preloaded, or null. */
export function loadedClip(voiceId, text) {
  return voiceId ? objectUrls.get(clipUrl(voiceId, text)) || null : null;
}

export async function clearClips() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls.clear();
  if (typeof caches !== 'undefined') await caches.delete(AUDIO_CACHE);
}
