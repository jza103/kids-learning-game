import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProfile, parseWordList, addWords, currentWords, activeItems, recordAnswer, pickPracticeWord, migrateProfile, removeWord, entryWarnings, cleanEntries, MAX_REVIEW_PER_ROUND } from '../src/profile.js';
import { review, MAX_BOX, masteryRating, INTERVALS } from '../src/srs.js';
import { rewardMastery, openSuperPack, craft, MASTERY_COINS, SUPER_PACK_EVERY, SUPER_PACK_SHARDS, openPack, PACK_COST } from '../src/economy.js';
import { THEMES, ALL_ITEMS } from '../src/content.js';
import { XP_PER } from '../src/progress.js';
import { mulberry32 } from '../src/rng.js';
import { scoreVoice, bestVoice, rankVoices } from '../src/voices.js';

const T0 = new Date(2026, 10, 19, 15).getTime();
const DAY = 24 * 3600e3;
const WEEK = 7 * DAY;

function masterWord(p, id, start) {
  let now = start;
  let last;
  for (let i = 0; i < MAX_BOX; i++) {
    last = recordAnswer(p, id, 'correct', now);
    p = last.profile;
    now = p.srs[id].dueAt;
  }
  return { profile: p, last, now };
}

test('the word bank grows week to week; returning words keep their mastery', () => {
  let p = addWords(newProfile('A', T0), parseWordList('cat\ndog'), T0).profile;
  p = recordAnswer(p, 'cat', 'correct', T0).profile;
  const r = addWords(p, parseWordList('fish\ncat | The cat sat.'), T0 + WEEK);
  p = r.profile;
  assert.equal(r.added, 1);
  assert.equal(r.returning, 1);
  assert.deepEqual(p.words.map((w) => w.id), ['cat', 'dog', 'fish']);
  assert.deepEqual(currentWords(p).map((w) => w.id).sort(), ['cat', 'fish']);
  assert.equal(p.srs.cat.box, 1, 'mastery kept');
  assert.equal(p.words.find((w) => w.id === 'cat').sentence, 'The cat sat.');
  assert.equal(activeItems(p).length, 3);
  p = removeWord(p, 'dog');
  assert.deepEqual(p.words.map((w) => w.id), ['cat', 'fish']);
});

test('deleting a word erases its stars, so adding it again starts fresh', () => {
  let p = addWords(newProfile('A', T0), parseWordList('becuase\ncat'), T0).profile;
  p = masterWord(p, 'becuase', T0).profile;
  p = { ...p, coins: 99 };
  assert.equal(p.masteredWords, 1);
  p = removeWord(p, 'becuase');
  assert.equal(p.srs.becuase, undefined);
  assert.equal(p.masteredWords, 0);
  assert.equal(p.coins, 99, 'earned coins stay');
  p = addWords(p, parseWordList('becuase'), T0 + WEEK).profile;
  assert.equal(p.srs.becuase.box, 0);
});

test('word entry tips catch sentences that will read badly', () => {
  assert.deepEqual(entryWarnings({ word: 'because', sentence: 'I stayed inside because it rained.' }), []);
  assert.deepEqual(entryWarnings({ word: 'because', sentence: 'Because it rained, I stayed in.' }), []);
  assert.deepEqual(entryWarnings({ word: 'because', sentence: '' }), []);
  assert.match(entryWarnings({ word: 'because', sentence: 'Because. I stayed inside because it rained. Because.' }).join(), /before and after/);
  assert.match(entryWarnings({ word: 'because', sentence: 'I stayed inside because it rained. because' }).join(), /before and after/);
  assert.match(entryWarnings({ word: 'friend', sentence: 'My friends live next door.' }).join(), /exactly/);
  assert.match(entryWarnings({ word: "don't", sentence: 'I don’t know.' }).join() || 'ok', /ok/);
  assert.match(entryWarnings({ word: 'fr1end', sentence: '' }).join(), /numbers/);
  assert.match(entryWarnings({ word: 'my friend lives next door', sentence: '' }).join(), /\|/);
});

test('mastery rating follows the box', () => {
  let p = addWords(newProfile('A', T0), parseWordList('cat'), T0).profile;
  assert.deepEqual(masteryRating(p.srs.cat, T0), { stars: 0, label: 'New', refresh: false });
  p = recordAnswer(p, 'cat', 'correct', T0).profile;
  assert.deepEqual(masteryRating(p.srs.cat, T0), { stars: 1, label: 'Learning', refresh: false });
  const m = masterWord(p, 'cat', p.srs.cat.dueAt);
  p = m.profile;
  assert.equal(masteryRating(p.srs.cat, m.now - 1).label, 'Mastered');
  assert.deepEqual(masteryRating(p.srs.cat, m.now), { stars: MAX_BOX - 1, label: 'Needs a refresh', refresh: true });
});

test('mastering a word pays coins, XP and Super Pack progress exactly once', () => {
  let p = addWords(newProfile('A', T0), parseWordList('cat'), T0).profile;
  const { profile, last, now } = masterWord(p, 'cat', T0);
  assert.equal(last.mastered, true);
  assert.equal(profile.masteredWords, 1);
  assert.equal(profile.superProgress, 1);
  assert.ok(last.xp >= XP_PER.mastered);
  // Slip and re-master: no second reward.
  p = recordAnswer(profile, 'cat', 'wrong', now).profile;
  const again = masterWord(p, 'cat', now + INTERVALS[0]);
  assert.equal(again.profile.masteredWords, 1);
  assert.equal(again.last.mastered, false);
});

test('every SUPER_PACK_EVERY mastered words earns a Super Pack', () => {
  let p = newProfile('A', T0);
  for (let i = 0; i < SUPER_PACK_EVERY * 2 + 1; i++) p = rewardMastery(p);
  assert.equal(p.superPacks, 2);
  assert.equal(p.superProgress, 1);
  assert.equal(p.coins, MASTERY_COINS * (SUPER_PACK_EVERY * 2 + 1));
});

test('a Super Pack always gives an ultra until they are all owned, then shards', () => {
  const ultras = ALL_ITEMS.filter((i) => i.rarity === 'ultra');
  let p = { ...newProfile('A', T0), superPacks: ultras.length + 1 };
  const rng = mulberry32(5);
  const got = new Set();
  for (let i = 0; i < ultras.length; i++) {
    const { profile, result } = openSuperPack(p, 'ocean', rng);
    p = profile;
    assert.equal(result.item.rarity, 'ultra');
    assert.ok(!got.has(result.item.id), 'no duplicate ultras');
    got.add(result.item.id);
  }
  // The theme's own ultras come first.
  const oceanUltras = THEMES[0].items.filter((i) => i.rarity === 'ultra').map((i) => i.id);
  assert.ok(oceanUltras.every((id) => [...got].slice(0, oceanUltras.length).includes(id)));
  // Next: a missing ocean friend (not ultra).
  const { profile, result } = openSuperPack(p, 'ocean', rng);
  assert.equal(result.item.theme ?? 'ocean', 'ocean');
  assert.notEqual(result.item.rarity, 'ultra');
  assert.equal(profile.superPacks, 0);
  assert.throws(() => openSuperPack(profile, 'ocean', rng), /no super packs/);
});

test('a Super Pack gives shards once the whole collection is done', () => {
  const all = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, 1]));
  const p = { ...newProfile('A', T0), superPacks: 1, collection: all };
  const { profile, result } = openSuperPack(p, 'space', () => 0);
  assert.equal(result.item, null);
  assert.equal(profile.shards, SUPER_PACK_SHARDS);
});

test('ultras never come from normal packs and cannot be crafted', () => {
  let p = { ...newProfile('A', T0), coins: PACK_COST * 400, shards: 99999 };
  const rng = mulberry32(11);
  for (let d = 0; d < 300; d++) {
    const { profile, result } = openPack(p, 'forest', T0 + d * DAY, rng);
    p = profile;
    assert.notEqual(result.rarity, 'ultra');
  }
  const ultra = ALL_ITEMS.find((i) => i.rarity === 'ultra');
  assert.throws(() => craft(p, ultra.id), /super packs/);
});

test("practice picks mostly this week's words, with a few due older words", () => {
  let p = addWords(newProfile('A', T0), parseWordList('old1\nold2\nold3\nold4'), T0).profile;
  for (const id of ['old1', 'old2', 'old3', 'old4']) p = recordAnswer(p, id, 'correct', T0).profile;
  p = addWords(p, parseWordList('n1\nn2\nn3\nn4\nn5\nn6\nn7\nn8\nn9\nn10'), T0 + WEEK).profile;
  const now = T0 + WEEK + 1000; // old words are due again by now
  const rng = mulberry32(3);
  let reviewCount = 0;
  let rounds = 200;
  for (let r = 0; r < rounds; r++) {
    let used = 0;
    for (let i = 0; i < 10; i++) {
      const pick = pickPracticeWord(p, now, rng, [], used);
      if (pick.review) used++;
    }
    assert.ok(used <= MAX_REVIEW_PER_ROUND);
    reviewCount += used;
  }
  const perRound = reviewCount / rounds;
  assert.ok(perRound > 0.5 && perRound < 3.5, `review words per round: ${perRound}`);
});

test('older words that are not due are left alone', () => {
  let p = addWords(newProfile('A', T0), parseWordList('old'), T0).profile;
  p = recordAnswer(p, 'old', 'correct', T0).profile;
  p = { ...p, srs: { ...p.srs, old: { ...p.srs.old, dueAt: T0 + 30 * DAY } } };
  p = addWords(p, parseWordList('new'), T0 + DAY).profile;
  const rng = mulberry32(9);
  for (let i = 0; i < 100; i++) assert.equal(pickPracticeWord(p, T0 + DAY, rng).item.id, 'new');
});

test('profiles saved before the word bank are migrated', () => {
  const old = { ...newProfile('A', T0), words: [{ id: 'cat', word: 'cat', sentence: '' }] };
  delete old.currentBatch;
  delete old.superPacks;
  const p = migrateProfile(old);
  assert.equal(p.superPacks, 0);
  assert.deepEqual(currentWords(p).map((w) => w.id), ['cat']);
});

test('voice ranking prefers Premium/Enhanced voices and skips novelty ones', () => {
  const v = (name, voiceURI, lang = 'en-US') => ({ name, voiceURI, lang });
  const voices = [
    v('Samantha', 'com.apple.voice.compact.en-US.Samantha'),
    v('Zarvox', 'com.apple.speech.synthesis.voice.Zarvox'),
    v('Ava', 'com.apple.voice.premium.en-US.Ava'),
    v('Evan', 'com.apple.voice.enhanced.en-US.Evan'),
    v('Thomas', 'com.apple.voice.compact.fr-FR.Thomas', 'fr-FR'),
  ];
  assert.equal(bestVoice(voices).name, 'Ava');
  assert.deepEqual(rankVoices(voices).map((x) => x.name), ['Ava', 'Evan', 'Samantha', 'Zarvox']);
  assert.ok(scoreVoice(voices[1]) < 0);
  assert.equal(bestVoice(voices, voices[0].voiceURI).name, 'Samantha', 'a grown-up choice wins');
  assert.equal(bestVoice(voices, 'gone').name, 'Ava', 'falls back if the chosen voice is gone');
});

test('entries from the word form are tidied, blanks and repeats dropped', () => {
  const out = cleanEntries([
    { word: ' because ', sentence: ' I stayed   in. ' },
    { word: '', sentence: 'orphan sentence' },
    { word: 'Because', sentence: '' },
    { word: 'friend' },
  ]);
  assert.deepEqual(out, [
    { id: 'because', word: 'because', sentence: 'I stayed in.' },
    { id: 'friend', word: 'friend', sentence: '' },
  ]);
  assert.deepEqual(parseWordList('because | I stayed in.\nfriend'), out);
});
