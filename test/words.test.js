import { test } from 'node:test';
import assert from 'node:assert/strict';

// Answers a day apart: from 2 stars up a word earns one star a day.
const DAY_STEP = 24 * 3600e3;
import { newProfile, parseWordList, addWords, currentWords, activeItems, recordAnswer, pickPracticeWord, migrateProfile, removeWord, entryWarnings, cleanEntries, MAX_REVIEW_PER_ROUND } from '../src/profile.js';
import { review, MAX_BOX, masteryRating, INTERVALS } from '../src/srs.js';
import { rewardMastery, openSuperPack, craft, MASTERY_COINS, SUPER_PACK_EVERY, SUPER_PACK_SHARDS, openPack, PACK_COST } from '../src/economy.js';
import { THEMES, ALL_ITEMS, themesOpen, nextTheme, GOLD_RARITIES, GOLD_BONUS } from '../src/content.js';
import { friendInfo } from '../src/friends.js';
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

test('Super Packs: the theme\'s ultras, then gold versions there, then other ultras, then gold anywhere, then friends', () => {
  const open = themesOpen(T0);
  const openUltras = open.flatMap((t) => t.items).filter((i) => i.rarity === 'ultra');
  assert.equal(openUltras.length, 10, 'only themes open on T0 count');
  let p = { ...newProfile('A', T0), superPacks: 100 };
  const rng = mulberry32(5);
  const take = () => {
    const r = openSuperPack(p, 'ocean', rng, T0);
    p = r.profile;
    return r.result;
  };
  const oceanUltras = THEMES[0].items.filter((i) => i.rarity === 'ultra').map((i) => i.id);
  const first = [take(), take()];
  assert.deepEqual(first.map((r) => r.item.id).sort(), [...oceanUltras].sort());
  const golds = [take(), take()];
  assert.ok(golds.every((r) => r.gold && oceanUltras.includes(r.item.id)), 'then the ocean ultras turn gold');
  const others = Array.from({ length: 8 }, take);
  assert.ok(others.every((r) => !r.gold && r.item.rarity === 'ultra' && r.item.theme !== 'ocean'));
  const moreGold = Array.from({ length: 8 }, take);
  assert.ok(moreGold.every((r) => r.gold && r.item.rarity === 'ultra'));
  const friend = take();
  assert.equal(friend.item.theme, 'ocean');
  assert.notEqual(friend.item.rarity, 'ultra');
  assert.ok(!friend.gold);
  assert.ok(openUltras.every((i) => p.gold[i.id] && p.collection[i.id]));
});

test('gold versions add power; a Super Pack gives shards once everything is owned and gold', () => {
  const open = themesOpen(T0).flatMap((t) => t.items);
  const all = Object.fromEntries(open.map((i) => [i.id, 1]));
  const gold = Object.fromEntries(open.filter((i) => GOLD_RARITIES.includes(i.rarity)).map((i) => [i.id, true]));
  const p = { ...newProfile('A', T0), superPacks: 1, collection: all, gold };
  const { profile, result } = openSuperPack(p, 'space', () => 0, T0);
  assert.equal(result.item, null);
  assert.equal(profile.shards, SUPER_PACK_SHARDS);
  const ultra = open.find((i) => i.rarity === 'ultra');
  assert.equal(friendInfo(p, ultra.id).strength, friendInfo({ ...p, gold: {} }, ultra.id).strength + GOLD_BONUS);
});

test('future themes stay hidden until their month', () => {
  const winter = THEMES.find((t) => t.id === 'winter');
  assert.ok(!themesOpen(T0).includes(winter));
  assert.ok(themesOpen(new Date(2026, 11, 1, 8).getTime()).includes(winter));
  assert.equal(nextTheme(T0).id, 'winter');
  const p = { ...newProfile('A', T0), coins: 1000 };
  assert.throws(() => openPack(p, 'winter', T0), /not yet open/);
  assert.throws(() => openSuperPack({ ...p, superPacks: 1 }, 'winter', Math.random, T0), /not yet open/);
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

test('a mastered word that is deleted and added again does not pay its mastery twice', () => {
  const T = Date.UTC(2026, 10, 20, 15);
  let p = addWords(newProfile('A', T), parseWordList('cat'), T).profile;
  let now = T;
  const master = () => {
    let paid = 0;
    for (let k = 0; k < MAX_BOX; k++) {
      const r = recordAnswer(p, 'cat', 'correct', (now += DAY_STEP));
      p = r.profile;
      if (r.mastered) paid++;
    }
    return paid;
  };
  assert.equal(master(), 1);
  p = addWords(removeWord(p, 'cat'), parseWordList('cat'), now).profile;
  assert.equal(master(), 0);
  assert.equal(p.masteredWords, 0, 'the count drops with the delete and is not paid back');
});
