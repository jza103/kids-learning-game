// Per-kid profile: their word list, spaced-repetition state, wallet,
// collection and cosmetics.
import { newItem, review } from './srs.js';
import { coinsForAnswer, newPackState } from './economy.js';
import { XP_PER, applyXpBoost } from './progress.js';

export function newProfile(name, now, id = `kid-${now.toString(36)}`) {
  return {
    id,
    name: name.trim() || 'Player',
    createdAt: now,
    words: [], // [{ id, word, sentence }]
    srs: {}, // id -> srs item; kept across weeks so returning words keep progress
    coins: 0,
    shards: 0,
    xp: 0,
    packs: newPackState(),
    collection: {}, // itemId -> count
    team: [],
    completedSets: [],
    look: { color: 'color-sky', hero: 'hero-cat', hat: null },
    stats: { answered: 0, correct: 0 },
  };
}

export function wordKey(word) {
  return normalize(word);
}

/** Lower-case, trim, straighten iPad "smart" quotes and collapse spaces. */
export function normalize(text) {
  return text
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function checkSpelling(input, word) {
  return normalize(input) === normalize(word);
}

/**
 * Parse a pasted word list. One word per line, optionally followed by an
 * example sentence after "|", e.g. "because | I stayed in because it rained."
 * A single comma-separated line also works.
 */
export function parseWordList(text) {
  let lines = text.split(/\r?\n/);
  if (lines.filter((l) => l.trim()).length === 1 && !text.includes('|') && text.includes(',')) {
    lines = text.split(',');
  }
  const seen = new Set();
  const out = [];
  for (const raw of lines) {
    const line = raw.replace(/^\s*(\d+[.)]|[-*•])\s+/, ''); // strip "1." or "-" list markers
    const [w, ...rest] = line.split('|');
    const word = (w || '').replace(/\s+/g, ' ').trim();
    if (!word) continue;
    const key = wordKey(word);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: key, word, sentence: rest.join('|').trim() });
  }
  return out;
}

/** Replace this week's list. Progress on words seen before is kept. */
export function setWords(profile, entries, now) {
  const srs = { ...profile.srs };
  for (const e of entries) if (!srs[e.id]) srs[e.id] = newItem(e.id, now);
  return { ...profile, words: entries, srs };
}

export function activeItems(profile) {
  return profile.words.map((w) => profile.srs[w.id]).filter(Boolean);
}

/**
 * Record one answer: updates the schedule, pays coins and XP.
 * result: 'correct' | 'assisted' | 'wrong'.
 */
export function recordAnswer(profile, wordId, result, now, powers = { xp: 0 }) {
  const before = profile.srs[wordId];
  if (!before) throw new Error(`unknown word: ${wordId}`);
  const coins = coinsForAnswer(before, result);
  const xp = applyXpBoost(XP_PER[result], powers);
  return {
    profile: {
      ...profile,
      srs: { ...profile.srs, [wordId]: review(before, result, now) },
      coins: profile.coins + coins,
      xp: profile.xp + xp,
      stats: {
        answered: profile.stats.answered + 1,
        correct: profile.stats.correct + (result === 'correct' ? 1 : 0),
      },
    },
    coins,
    xp,
  };
}
