// Read words aloud. Uses saved ElevenLabs audio when it's set up and ready,
// otherwise the browser's built-in voice (Web Speech API, works offline).
import { bestVoice, rankVoices } from './voices.js';
import { loadedClip, preload, wordClip, sentenceClip, meaningClip, definitionClip } from './aivoice.js';

const prefs = { voiceURI: null, rate: 0.85, aiVoiceIds: [] };
let voice = null;

export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refresh() {
  if (speechAvailable()) voice = bestVoice(speechSynthesis.getVoices(), prefs.voiceURI);
}

/**
 * aiVoiceId: the ElevenLabs voice to use, or null for the built-in voice.
 * listVoiceIds: voices whose audio came in word list files; used for any clip
 * the main voice doesn't have, even on a device with no ElevenLabs key.
 */
export function setSpeechPrefs({ voiceURI = null, rate = 0.85, aiVoiceId = null, listVoiceIds = [] } = {}) {
  const aiVoiceIds = [...new Set([aiVoiceId, ...listVoiceIds].filter(Boolean))];
  Object.assign(prefs, { voiceURI, rate, aiVoiceIds });
  refresh();
}

/** English voices, best first. */
export function englishVoices() {
  return speechAvailable() ? rankVoices(speechSynthesis.getVoices()) : [];
}

export function currentVoice() {
  return voice;
}

const listeners = [];
export function onVoicesChanged(fn) {
  listeners.push(fn);
}

if (speechAvailable()) {
  refresh();
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    refresh();
    listeners.forEach((fn) => fn());
  });
}

// One audio element, reused, so iPad lets it play after the first tap.
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let unlocked = false;

/** Call from a tap handler before the first AI clip plays. */
export function unlockAudio() {
  if (!audio || unlocked) return;
  unlocked = true;
  audio.src = SILENCE;
  audio.play().catch(() => (unlocked = false));
}

/** Get saved AI clips into memory ahead of time. */
export function preloadSpeech(specs) {
  return Promise.all(prefs.aiVoiceIds.map((v) => preload(v, specs).catch(() => {})));
}

let token = 0;

function speakBuiltIn(text, my) {
  return new Promise((resolve) => {
    if (!speechAvailable() || my !== token) return resolve();
    if (!voice) refresh();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = prefs.rate;
    const done = () => resolve();
    u.onend = done;
    u.onerror = done;
    setTimeout(done, 1500 + text.length * 150); // iOS sometimes never fires onend
    speechSynthesis.speak(u);
  });
}

function playClip(url, my) {
  return new Promise((resolve) => {
    if (my !== token) return resolve(true);
    const done = () => {
      audio.onended = audio.onerror = null;
      resolve(true);
    };
    audio.onended = done;
    audio.onerror = () => resolve(false);
    audio.src = url;
    audio.play().catch(() => resolve(false));
  });
}

/** Say a spelling word. */
export function sayWord(word) {
  return speak([{ clip: wordClip(word), phrases: [word] }], true);
}

/** Say the word, use it in its sentence, then say the word again. */
export function saySentence(word, sentence) {
  return speak([{ clip: sentenceClip(word, sentence), phrases: [word, sentence, word] }], true);
}

/** Say a Word Match word and what it means. */
export function sayMeaning(word, definition) {
  return speak([{ clip: meaningClip(word, definition), phrases: [word, definition] }], true);
}

/** Read out meanings one after another. */
export function sayDefinitions(definitions) {
  return speak(definitions.map((d) => ({ clip: definitionClip(d), phrases: [d] })), true);
}

/** Always the built-in voice (for testing it). */
export function sayBuiltIn(...phrases) {
  return speak([{ clip: null, phrases }], false);
}

async function speak(parts, allowAi) {
  const my = ++token;
  if (speechAvailable()) speechSynthesis.cancel();
  audio?.pause();
  for (const { clip, phrases } of parts) {
    if (my !== token) return;
    const url = allowAi && audio && prefs.aiVoiceIds.map((v) => loadedClip(v, clip)).find(Boolean);
    if (url && (await playClip(url, my))) continue;
    for (const text of phrases.filter(Boolean)) {
      if (my !== token) return;
      await speakBuiltIn(text, my);
    }
  }
}
