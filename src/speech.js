// Read words aloud. Uses saved ElevenLabs audio when it's set up and ready,
// otherwise the browser's built-in voice (Web Speech API, works offline).
import { bestVoice, rankVoices } from './voices.js';
import { loadedClip, preload } from './aivoice.js';

const prefs = { voiceURI: null, rate: 0.85, aiVoiceId: null };
let voice = null;

export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refresh() {
  if (speechAvailable()) voice = bestVoice(speechSynthesis.getVoices(), prefs.voiceURI);
}

/** aiVoiceId: the ElevenLabs voice to use, or null for the built-in voice. */
export function setSpeechPrefs({ voiceURI = null, rate = 0.85, aiVoiceId = null } = {}) {
  Object.assign(prefs, { voiceURI, rate, aiVoiceId });
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

/** Get saved AI clips for these texts into memory ahead of time. */
export function preloadSpeech(texts) {
  return prefs.aiVoiceId ? preload(prefs.aiVoiceId, texts).catch(() => {}) : Promise.resolve();
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

/** Speak phrases in order, e.g. [word, sentence, word]. A new call cuts off the old one. */
export function say(...phrases) {
  return speak(phrases, true);
}

/** Same, but always with the built-in voice (for testing it). */
export function sayBuiltIn(...phrases) {
  return speak(phrases, false);
}

async function speak(phrases, allowAi) {
  const my = ++token;
  if (speechAvailable()) speechSynthesis.cancel();
  audio?.pause();
  for (const text of phrases.filter(Boolean)) {
    if (my !== token) return;
    const url = allowAi && audio && loadedClip(prefs.aiVoiceId, text);
    const played = url ? await playClip(url, my) : false;
    if (!played) await speakBuiltIn(text, my);
  }
}
