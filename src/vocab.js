// Word Match: a vocabulary game where kids match words to their meanings by
// tapping (no typing). Each kid has their own vocabulary list, kept apart from
// spelling words, with the same 0-5 star spaced-repetition mastery. All
// functions are pure: they take a profile and return a new one.
import { newItem, review, pickNext } from './srs.js';
import { coinsForAnswer, earnCoins, rewardMastery } from './economy.js';
import { XP_PER, applyXpBoost } from './progress.js';
import { normalize } from './profile.js';
import { STARTER_VOCAB } from './vocab-words.js';

export const BOARD_SIZE = 4; // word/meaning pairs per board
export const BOARDS_PER_ROUND = 3;
export const MAX_NEW_PER_ROUND = 6; // new words are introduced a few at a time
export const MIN_WORDS = 2;
// Recognizing a meaning is quicker than spelling a word, so a match pays a bit
// less than a spelled word (same "shaky words pay more" table, scaled).
export const VOCAB_COIN_SCALE = 0.7;
export const MAX_WORD_LENGTH = 40;
export const MAX_DEFINITION_LENGTH = 120;

export const vocabKey = (word) => normalize(word);

function seededVocab(now) {
  const words = STARTER_VOCAB.map((e, i) => ({ id: vocabKey(e.word), word: e.word, definition: e.definition, addedAt: now, order: i, starter: true }));
  return { words, srs: Object.fromEntries(words.map((w) => [w.id, newItem(w.id, now)])) };
}

/** A kid's vocabulary. Profiles that never played start with the starter words. */
export function vocabOf(profile) {
  return profile.vocab || seededVocab(profile.createdAt || 0);
}

export function vocabItems(profile) {
  const v = vocabOf(profile);
  return v.words.map((w) => v.srs[w.id]).filter(Boolean);
}

/** Tips shown while a grown-up types a word and its meaning. */
export function vocabEntryWarnings({ word, definition }) {
  const out = [];
  const w = normalize(word || '');
  const d = normalize(definition || '');
  if (!w) return out;
  if (/[0-9]/.test(w)) out.push('The word has numbers in it. Check the spelling.');
  if (!d) out.push('Add a meaning so there is something to match.');
  else if (new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(d))
    out.push('The meaning uses the word itself, which gives the answer away.');
  if (d.length > MAX_DEFINITION_LENGTH) out.push('Shorter meanings are easier to read on a phone.');
  return out;
}

/**
 * Add a word, or update the meaning of one already in the list (its stars are
 * kept). Returns { profile, added, updated }.
 */
export function addVocabWord(profile, { word, definition }, now) {
  const cleanWord = String(word || '').replace(/\s+/g, ' ').trim().slice(0, MAX_WORD_LENGTH);
  const cleanDef = String(definition || '').replace(/\s+/g, ' ').trim().slice(0, MAX_DEFINITION_LENGTH);
  if (!cleanWord || !cleanDef) throw new Error('A word and its meaning are both needed.');
  const v = vocabOf(profile);
  const id = vocabKey(cleanWord);
  const existing = v.words.find((w) => w.id === id);
  const words = existing
    ? v.words.map((w) => (w.id === id ? { ...w, word: cleanWord, definition: cleanDef } : w))
    : [...v.words, { id, word: cleanWord, definition: cleanDef, addedAt: now, order: -now }];
  const srs = v.srs[id] ? v.srs : { ...v.srs, [id]: newItem(id, now) };
  return { profile: { ...profile, vocab: { ...v, words, srs } }, added: !existing, updated: Boolean(existing) };
}

/** Delete a word and its stars. Coins and friends already earned stay. */
export function removeVocabWord(profile, id) {
  const v = vocabOf(profile);
  const srs = { ...v.srs };
  delete srs[id];
  return { ...profile, vocab: { ...v, words: v.words.filter((w) => w.id !== id), srs } };
}

/** Put back any starter words that were deleted. */
export function restoreStarterWords(profile, now) {
  const v = vocabOf(profile);
  const have = new Set(v.words.map((w) => w.id));
  const back = seededVocab(now).words.filter((w) => !have.has(w.id));
  const srs = { ...v.srs };
  for (const w of back) srs[w.id] = newItem(w.id, now);
  return { profile: { ...profile, vocab: { ...v, words: [...v.words, ...back], srs } }, restored: back.length };
}

/**
 * Pick the words for one board. Known words are chosen by the scheduler
 * (shaky and due words more often); new words come in starter-list order, at
 * most `newLeft` of them. Words from the last board are avoided if possible.
 * Returns { words, decoy } where decoy is an extra meaning to choose from.
 */
export function pickBoard(profile, now, rng = Math.random, { size = BOARD_SIZE, recent = [], newLeft = MAX_NEW_PER_ROUND } = {}) {
  const v = vocabOf(profile);
  const byId = Object.fromEntries(v.words.map((w) => [w.id, w]));
  const items = vocabItems(profile);
  const fresh = items
    .filter((i) => i.seen === 0)
    .sort((a, b) => (byId[a.id].order ?? 0) - (byId[b.id].order ?? 0));
  const known = items.filter((i) => i.seen > 0);
  const chosen = [];
  const take = (id) => chosen.push(id);
  const avail = (list) => list.filter((i) => !chosen.includes(i.id));
  const target = Math.min(size, items.length);
  // Roughly half new, half review, while new words remain.
  let newSlots = Math.min(newLeft, fresh.length, known.length >= target ? Math.ceil(target / 2) : target);
  for (const i of fresh.slice(0, newSlots)) take(i.id);
  while (chosen.length < target) {
    let pool = avail(known).filter((i) => !recent.includes(i.id));
    if (!pool.length) pool = avail(known);
    if (!pool.length) {
      // Not enough known words: use more new ones, even past the round's limit.
      const more = avail(fresh);
      if (!more.length) break;
      take(more[0].id);
      continue;
    }
    take(pickNext(pool, now, rng).id);
  }
  const others = v.words.filter((w) => !chosen.includes(w.id));
  const decoy = others.length ? others[Math.floor(rng() * others.length)] : null;
  return { words: chosen.map((id) => byId[id]), decoy };
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function coinsForMatch(itemBefore, result) {
  const coins = coinsForAnswer(itemBefore, result);
  return coins ? Math.max(1, Math.round(coins * VOCAB_COIN_SCALE)) : 0;
}

/**
 * Record the first try at matching a word: updates its stars, pays coins and
 * XP. Mastering a word counts toward Super Packs just like spelling.
 * result: 'correct' | 'assisted' | 'wrong'.
 */
export function recordMatch(profile, id, result, now, powers = { xp: 0 }) {
  const v = vocabOf(profile);
  const before = v.srs[id];
  if (!before) throw new Error(`unknown vocabulary word: ${id}`);
  const paid = earnCoins(profile, coinsForMatch(before, result), now);
  const coins = paid.coins;
  const after = review(before, result, now);
  const mastered = before.masteredAt == null && after.masteredAt != null;
  const xp = applyXpBoost(XP_PER[result] + (mastered ? XP_PER.mastered : 0), powers);
  const stats = profile.vocabStats || { answered: 0, correct: 0 };
  let next = {
    ...paid.profile,
    vocab: { ...v, srs: { ...v.srs, [id]: after } },
    xp: profile.xp + xp,
    vocabStats: { answered: stats.answered + 1, correct: stats.correct + (result === 'correct' ? 1 : 0) },
  };
  if (mastered) next = rewardMastery(next);
  return { profile: next, coins, xp, mastered };
}
