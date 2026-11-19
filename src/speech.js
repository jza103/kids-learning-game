// Read words aloud with the Web Speech API (works offline on iPad).
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US' && v.localService) ||
    voices.find((v) => v.lang && v.lang.startsWith('en')) ||
    null
  );
}

export function speechAvailable() {
  return 'speechSynthesis' in window;
}

if (speechAvailable()) {
  voice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => (voice = pickVoice()));
}

/** Speak a list of phrases in order, e.g. [word, sentence, word]. */
export function say(...phrases) {
  if (!speechAvailable()) return;
  speechSynthesis.cancel();
  for (const text of phrases.filter(Boolean)) {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }
}
