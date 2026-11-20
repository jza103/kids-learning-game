import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_LISTS } from '../src/word-lists-builtin.js';
import { parseListText, saveLists, makeListFile, deleteList, allLists, usesWord, csvRow } from '../src/wordlists.js';
import { entryWarnings } from '../src/profile.js';
import { vocabEntryWarnings } from '../src/vocab.js';
import { clipsForList, clipsForVocab, meaningClip } from '../src/aivoice.js';

test('built-in lists: 3 weeks for each of grades 3 to 6', () => {
  for (const g of [3, 4, 5, 6]) assert.deepEqual(BUILTIN_LISTS.filter((l) => l.grade === g).map((l) => l.week), [1, 2, 3]);
  const ids = BUILTIN_LISTS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('built-in spelling sentences use the word; meanings never do', () => {
  for (const l of BUILTIN_LISTS) {
    assert.ok(l.spelling.length >= 10 && l.vocab.length >= 6, l.id);
    for (const e of l.spelling) assert.deepEqual(entryWarnings(e), [], `${l.id} ${e.word}`);
    for (const e of l.vocab) assert.deepEqual(vocabEntryWarnings(e), [], `${l.id} ${e.word}`);
  }
});

test('no word repeats within a grade', () => {
  for (const g of [3, 4, 5, 6]) {
    const words = BUILTIN_LISTS.filter((l) => l.grade === g).flatMap((l) => [...l.spelling, ...l.vocab].map((e) => e.word));
    assert.equal(new Set(words).size, words.length, `grade ${g}`);
  }
});

test('plain lines with week headings and dashes', () => {
  const r = parseListText('Week 1\n1. because\n2) friend\n\nWeek 2\nhappy - The dog is happy.\nbrave: not afraid');
  assert.deepEqual(r.lists.map((l) => l.name), ['Week 1', 'Week 2']);
  assert.deepEqual(r.lists[0].spelling.map((e) => e.word), ['because', 'friend']);
  assert.equal(r.lists[1].spelling[0].sentence, 'The dog is happy.');
  assert.deepEqual(r.lists[1].vocab, [{ word: 'brave', definition: 'not afraid' }]);
});

test('a teacher list with a title, a sentence on its own line and a vocabulary section', () => {
  const r = parseListText('3rd Grade Spelling - Unit 2 Lesson 3\n1. jump\n2. jumped\nThe frog jumped into the pond.\n\nVocabulary:\nhabitat - the home of an animal', { name: 'Ms. Lee' });
  assert.equal(r.lists.length, 1);
  assert.equal(r.lists[0].grade, 3);
  assert.equal(r.lists[0].spelling[1].sentence, 'The frog jumped into the pond.');
  assert.deepEqual(r.lists[0].vocab.map((v) => v.word), ['habitat']);
});

test('CSV with a header, quotes and a week column', () => {
  const r = parseListText('Word,Sentence,Definition,Week\ncat,"The cat sat, then slept.",,1\nbrave,,not afraid,2', { name: 'Class' });
  assert.deepEqual(r.lists.map((l) => l.name), ['Class · Week 1', 'Class · Week 2']);
  assert.equal(r.lists[0].spelling[0].sentence, 'The cat sat, then slept.');
  assert.equal(r.lists[1].vocab[0].definition, 'not afraid');
  assert.deepEqual(csvRow('a,"b ""c"", d",e'), ['a', 'b "c", d', 'e']);
});

test('one comma line, TSV, and the forced kinds', () => {
  assert.deepEqual(parseListText('cat, hat, bat').lists[0].spelling.map((e) => e.word), ['cat', 'hat', 'bat']);
  assert.equal(parseListText('cat\tThe cat sat.').lists[0].spelling[0].sentence, 'The cat sat.');
  assert.equal(parseListText('brave - not afraid', { kind: 'spelling' }).lists[0].spelling[0].sentence, 'not afraid');
  const v = parseListText('jump - The frog will jump.', { kind: 'vocab' });
  assert.equal(v.lists[0].vocab[0].definition, 'The frog will jump.');
  assert.ok(usesWord('He jumped high', 'jump'));
  assert.ok(!usesWord('not afraid', 'brave'));
});

test('JSON in several shapes', () => {
  assert.deepEqual(parseListText('["cat","dog"]').lists[0].spelling.map((e) => e.word), ['cat', 'dog']);
  const r = parseListText(JSON.stringify({ name: 'X', spelling: [{ word: 'cat', sentence: 'A cat.' }], vocabulary: [{ term: 'brave', meaning: 'not afraid' }] }));
  assert.equal(r.lists[0].name, 'X');
  assert.equal(r.lists[0].vocab[0].definition, 'not afraid');
  assert.equal(parseListText('{"brave": "not afraid"}').lists[0].vocab[0].word, 'brave');
});

test('a list file round trip keeps lists and audio; same name replaces', () => {
  const mine = { name: 'Ms. Lee week 4', spelling: [{ word: 'cat', sentence: 'The cat sat.' }], vocab: [] };
  const file = makeListFile([BUILTIN_LISTS[0], mine], { voiceId: 'v1', voiceName: 'Sarah', clips: { a: 'AAAA' } });
  const back = parseListText(JSON.stringify(file));
  assert.ok(back.ourFile);
  assert.equal(back.lists[0].builtIn, true);
  assert.equal(back.audio.clips.a, 'AAAA');
  let data = { profiles: {} };
  let r = saveLists(data, back.lists, 1);
  assert.equal(r.added, 1); // the built-in one is already in the app
  r = saveLists(r.data, [{ ...mine, spelling: [{ word: 'dog' }] }], 2);
  assert.equal(r.replaced, 1);
  data = r.data;
  const own = allLists(data).filter((l) => !l.builtIn);
  assert.deepEqual(own.map((l) => l.spelling[0].word), ['dog']);
  assert.equal(allLists(deleteList(data, own[0].id)).filter((l) => !l.builtIn).length, 0);
});

test('Word Match clips: word, word + meaning, meaning alone', () => {
  const c = clipsForVocab({ word: 'brave', definition: 'not afraid' });
  assert.equal(c.length, 3);
  assert.match(meaningClip('brave', 'not afraid').text, /^brave\. .* not afraid\.$/);
  assert.equal(clipsForList(BUILTIN_LISTS[0]).length, 12 * 2 + 8 * 3);
});
