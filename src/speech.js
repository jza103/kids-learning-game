// Read words aloud with the Web Speech API (works offline on iPad).
// The voice is whichever installed voice sounds best, unless a grown-up picks one.
import { bestVoice, rankVoices } from './voices.js';

const prefs = { voiceURI: null, rate: 0.85 };
let voice = null;

export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function refresh() {
  if (speechAvailable()) voice = bestVoice(speechSynthesis.getVoices(), prefs.voiceURI);
}

export function setSpeechPrefs({ voiceURI = null, rate = 0.85 } = {}) {
  prefs.voiceURI = voiceURI;
  prefs.rate = rate;
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

/** Speak a list of phrases in order, e.g. [word, sentence, word]. */
export function say(...phrases) {
  if (!speechAvailable()) return;
  if (!voice) refresh();
  speechSynthesis.cancel();
  for (const text of phrases.filter(Boolean)) {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = prefs.rate;
    speechSynthesis.speak(u);
  }
}
