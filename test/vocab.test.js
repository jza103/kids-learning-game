import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProfile } from '../src/profile.js';
import { MAX_BOX } from '../src/srs.js';
import { BOX_COINS, MASTERY_COINS, SUPER_PACK_EVERY } from '../src/economy.js';
import { mulberry32 } from '../src/rng.js';
import { STARTER_VOCAB } from '../src/vocab-words.js';
import {
  vocabOf, vocabItems, addVocabWord, removeVocabWord, restoreStarterWords, pickBoard, recordMatch, coinsForMatch,
  vocabEntryWarnings, vocabKey, BOARD_SIZE, MAX_NEW_PER_ROUND,
} from '../src/vocab.js';

const T0 = new Date(2026, 10, 20, 15).getTime();

test('starter words: unique, short meanings that never contain the word', () => {
  assert.ok(STARTER_VOCAB.length >= 40);
  assert.equal(new Set(STARTER_VOCAB.map((e) => vocabKey(e.word))).size, STARTER_VOCAB.length);
  assert.equal(new Set(STARTER_VOCAB.map((e) => e.definition)).size, STARTER_VOCAB.length);
  for (const e of STARTER_VOCAB) assert.deepEqual(vocabEntryWarnings(e), [], e.word);
});

test('a new profile starts with the starter words, all new', () => {
  const p = newProfile('A', T0);
  assert.equal(vocabItems(p).length, STARTER_VOCAB.length);
  assert.ok(vocabItems(p).every((i) => i.seen === 0));
  assert.equal(p.vocab, undefined, 'nothing is saved until the kid plays or a grown-up edits');
});

test('adding words: new ones join, existing ones get a new meaning and keep stars', () => {
  let p = newProfile('A', T0);
  p = recordMatch(p, 'brave', 'correct', T0).profile;
  let r = addVocabWord(p, { word: ' Brave ', definition: 'ready to face danger' }, T0 + 1);
  assert.equal(r.updated, true);
  assert.equal(vocabOf(r.profile).srs.brave.box, 1);
  assert.equal(vocabOf(r.profile).words.find((w) => w.id === 'brave').definition, 'ready to face danger');
  r = addVocabWord(r.profile, { word: 'gravity', definition: 'the pull that makes things fall down' }, T0 + 2);
  assert.equal(r.added, true);
  assert.equal(vocabItems(r.profile).length, STARTER_VOCAB.length + 1);
  assert.throws(() => addVocabWord(p, { word: 'x', definition: '  ' }, T0));
});

test('removing and restoring starter words', () => {
  let p = removeVocabWord(newProfile('A', T0), 'brave');
  assert.ok(!vocabOf(p).words.some((w) => w.id === 'brave'));
  assert.equal(vocabOf(p).srs.brave, undefined);
  const r = restoreStarterWords(p, T0);
  assert.equal(r.restored, 1);
  assert.equal(restoreStarterWords(r.profile, T0).restored, 0);
});

test('tips catch a meaning that gives the word away', () => {
  assert.equal(vocabEntryWarnings({ word: 'happy', definition: 'feeling happy' }).length, 1);
  assert.equal(vocabEntryWarnings({ word: 'happy', definition: 'feeling glad' }).length, 0);
  assert.equal(vocabEntryWarnings({ word: 'happy', definition: '' }).length, 1);
});

test('boards: distinct words, a decoy meaning, and new words come in a few at a time', () => {
  const rng = mulberry32(3);
  let p = newProfile('A', T0);
  let newLeft = MAX_NEW_PER_ROUND;
  let recent = [];
  const introduced = new Set();
  for (let board = 0; board < 3; board++) {
    const { words, decoy } = pickBoard(p, T0, rng, { recent, newLeft });
    assert.equal(words.length, BOARD_SIZE);
    assert.equal(new Set(words.map((w) => w.id)).size, BOARD_SIZE);
    assert.ok(decoy && !words.some((w) => w.id === decoy.id));
    const fresh = words.filter((w) => vocabOf(p).srs[w.id].seen === 0);
    newLeft -= fresh.length;
    fresh.forEach((w) => introduced.add(w.id));
    for (const w of words) p = recordMatch(p, w.id, 'correct', T0).profile;
    recent = words.map((w) => w.id);
  }
  assert.equal(introduced.size, MAX_NEW_PER_ROUND);
  // First new words follow the starter list order (easier first).
  assert.ok(introduced.has(vocabKey(STARTER_VOCAB[0].word)));
});

test('a tiny list still makes a board', () => {
  let p = newProfile('A', T0);
  for (const w of vocabOf(p).words.slice(2)) p = removeVocabWord(p, w.id);
  const { words, decoy } = pickBoard(p, T0, mulberry32(1));
  assert.equal(words.length, 2);
  assert.equal(decoy, null);
});

test('coins: only for correct matches, scaled below spelling, shaky words pay more', () => {
  const p = newProfile('A', T0);
  const item = vocabOf(p).srs.brave;
  assert.equal(coinsForMatch(item, 'wrong'), 0);
  assert.ok(coinsForMatch(item, 'correct') < BOX_COINS[0]);
  assert.ok(coinsForMatch({ ...item, box: 5 }, 'correct') >= 1);
  assert.ok(coinsForMatch(item, 'correct') > coinsForMatch({ ...item, box: 4 }, 'correct'));
  const wrong = recordMatch(p, 'brave', 'wrong', T0);
  assert.equal(wrong.coins, 0);
  assert.equal(vocabOf(wrong.profile).srs.brave.misses, 1);
  assert.equal(wrong.profile.vocabStats.answered, 1);
});

test('mastering vocabulary words pays the mastery reward and counts toward Super Packs', () => {
  let p = newProfile('A', T0);
  const ids = vocabOf(p).words.slice(0, SUPER_PACK_EVERY).map((w) => w.id);
  for (const id of ids) {
    let now = T0;
    for (let i = 0; i < MAX_BOX; i++) {
      const before = p.coins;
      const r = recordMatch(p, id, 'correct', now);
      p = r.profile;
      if (i === MAX_BOX - 1) {
        assert.equal(r.mastered, true);
        assert.equal(p.coins - before, r.coins + MASTERY_COINS);
      }
      now = vocabOf(p).srs[id].dueAt;
    }
  }
  assert.equal(p.superPacks, 1);
  assert.equal(p.masteredWords, SUPER_PACK_EVERY);
  // Spelling words are untouched.
  assert.deepEqual(p.srs, {});
});
