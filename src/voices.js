// Choosing the most natural-sounding installed voice. Pure functions so they
// can be tested without a browser.

// Novelty voices that ship with Apple devices; never pick these by default.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|princess|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
// Good-sounding English voices on Apple devices and desktop browsers.
const KNOWN_GOOD = /\b(ava|zoe|samantha|allison|evan|nathan|joelle|noelle|susan|tom|karen|daniel|serena|moira|google us english|microsoft (aria|jenny|guy)|natural)\b/i;

export function isEnglish(v) {
  return /^en([-_]|$)/i.test(v.lang || '');
}

/** Higher is better. Premium > Enhanced > Siri/neural > plain; compact last. */
export function scoreVoice(v) {
  const id = `${v.name || ''} ${v.voiceURI || ''}`;
  let score = 0;
  if (/^en[-_]US$/i.test(v.lang || '')) score += 3;
  else if (isEnglish(v)) score += 1;
  if (/premium/i.test(id)) score += 30;
  else if (/enhanced/i.test(id)) score += 20;
  else if (/siri|neural|natural/i.test(id)) score += 15;
  if (/compact/i.test(id)) score -= 5;
  if (KNOWN_GOOD.test(v.name || '')) score += 4;
  if (/google/i.test(id)) score += 8; // Chrome's network voices are decent
  if (NOVELTY.test(v.name || '')) score -= 50;
  return score;
}

export function rankVoices(voices) {
  return voices.filter(isEnglish).sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name));
}

/** The chosen voice if it's still installed, otherwise the best English one. */
export function bestVoice(voices, preferredURI = null) {
  if (preferredURI) {
    const chosen = voices.find((v) => v.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  return rankVoices(voices)[0] || null;
}

/** A short quality tag shown next to a voice in the picker. */
export function voiceQuality(v) {
  const id = `${v.name || ''} ${v.voiceURI || ''}`;
  if (/premium/i.test(id)) return 'Premium';
  if (/enhanced/i.test(id)) return 'Enhanced';
  if (/compact/i.test(id)) return 'Basic';
  return '';
}
