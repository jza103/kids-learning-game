import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProfile, addWords, currentWords, entryWarnings, wordKey, parseWordList } from '../src/profile.js';
import { review } from '../src/srs.js';
import { TRICKY_SETS, setTricky, autoTricky, addTrickySet, readyForMore, trickyState, setsLeft, WEEK_MS, READY_STARS } from '../src/tricky.js';

const T0 = new Date(2026, 10, 20, 15).getTime();
const DAY = 24 * 3600e3;

test('tricky list: 10 words a set, no repeats, every sentence uses its word cleanly', () => {
  const seen = new Set();
  assert.ok(TRICKY_SETS.length >= 15);
  for (const set of TRICKY_SETS) {
    assert.equal(set.words.length, 10, set.name);
    assert.ok(set.name && set.tip);
    for (const [word, sentence] of set.words) {
      assert.ok(!seen.has(wordKey(word)), `repeat: ${word}`);
      seen.add(wordKey(word));
      assert.deepEqual(entryWarnings({ word, sentence }), [], `${word}: ${sentence}`);
    }
  }
});

test('turning the list on adds set 1 now, then one set a week', () => {
  let p = setTricky(newProfile('Sam', T0), true, T0);
  assert.equal(currentWords(p).length, 10);
  assert.equal(trickyState(p).next, 1);
  assert.equal(autoTricky(p, T0 + 6 * DAY), null, 'not a week yet');
  const r = autoTricky(p, T0 + WEEK_MS);
  assert.equal(r.set, TRICKY_SETS[1]);
  p = r.profile;
  assert.equal(p.words.length, 20);
  assert.deepEqual(currentWords(p).map((w) => w.word), TRICKY_SETS[1].words.map(([w]) => w));
  // Three weeks away still adds only one set.
  p = autoTricky(p, T0 + 5 * WEEK_MS).profile;
  assert.equal(p.words.length, 30);
  assert.equal(autoTricky(p, T0 + 5 * WEEK_MS + DAY), null);
  assert.equal(setsLeft(p), TRICKY_SETS.length - 3);
});

test('off means no weekly sets; back on picks up where it left off', () => {
  let p = setTricky(newProfile('Sam', T0), true, T0);
  p = setTricky(p, false, T0 + DAY);
  assert.equal(autoTricky(p, T0 + 3 * WEEK_MS), null);
  p = setTricky(p, true, T0 + 3 * WEEK_MS);
  assert.equal(p.words.length, 10, 'turning back on does not add right away');
  assert.equal(autoTricky(p, T0 + 3 * WEEK_MS).set, TRICKY_SETS[1]);
});

test('ready for more once every word this week has 3 stars', () => {
  let p = setTricky(newProfile('Sam', T0), true, T0);
  assert.equal(readyForMore(p), false);
  const srs = { ...p.srs };
  for (const w of currentWords(p)) {
    let item = srs[w.id];
    for (let i = 0; i < READY_STARS; i++) item = review(item, 'correct', T0 + i * DAY);
    srs[w.id] = item;
  }
  p = { ...p, srs };
  assert.equal(readyForMore(p), true);
  // The parent's own words this week take over, so no early set.
  const own = addWords(p, parseWordList('castle'), T0 + DAY).profile;
  assert.equal(readyForMore(own), false);
  p = addTrickySet(p, T0 + 2 * DAY).profile;
  assert.equal(readyForMore(p), false);
  assert.equal(trickyState(p).lastAt, T0 + 2 * DAY, 'the weekly clock restarts');
});

test('the list runs out cleanly', () => {
  let p = newProfile('Sam', T0);
  p = { ...p, tricky: { on: true, next: TRICKY_SETS.length, lastAt: T0, batch: null } };
  assert.equal(addTrickySet(p, T0), null);
  assert.equal(autoTricky(p, T0 + 9 * WEEK_MS), null);
});
