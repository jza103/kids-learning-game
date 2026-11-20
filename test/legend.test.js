import { test } from 'node:test';
import assert from 'node:assert/strict';

// Answers a day apart: from 2 stars up a word earns one star a day.
const DAY_STEP = 24 * 3600e3;
import { newProfile, addWords, parseWordList, recordAnswer } from '../src/profile.js';
import { recordFact } from '../src/math.js';
import { recordMatch, vocabOf } from '../src/vocab.js';
import { LEGENDS, LEGEND_RULES } from '../src/content.js';
import { titanFactIds, legendProgress, claimLegends } from '../src/legend.js';
import { MAX_BOX } from '../src/srs.js';

const T0 = new Date(2026, 10, 19, 15).getTime();
const WEEK = 7 * 24 * 3600e3;

test('mastering every × and ÷ fact of a table (3-12) earns its Table Titan, once', () => {
  let p = newProfile('A', T0);
  const ids = titanFactIds(7);
  assert.equal(ids.length, 20);
  let got = [];
  let now = T0;
  for (const id of ids) {
    for (let k = 0; k < MAX_BOX; k++) {
      const r = recordFact(p, id, 'correct', { mode: 'speed', now: (now += DAY_STEP) });
      p = r.profile;
      got = got.concat(r.legends);
    }
  }
  assert.deepEqual(got.map((l) => l.id), ['legend-titan-7']);
  assert.equal(p.collection['legend-titan-7'], 1);
  assert.deepEqual(p.legendsNew, ['legend-titan-7']);
  assert.equal(claimLegends(p).newly.length, 0, 'not given twice');
  assert.equal(legendProgress(p).tables.find((t) => t.table === 7).mastered, 20);
});

test('a fully mastered week list earns a Week Star; every 4 Week Stars earn a spelling Legendary', () => {
  let p = newProfile('A', T0);
  let now = T0;
  let stars = 0;
  const legends = [];
  for (let week = 0; week < LEGEND_RULES.weekStars; week++) {
    now = T0 + week * WEEK;
    const words = Array.from({ length: LEGEND_RULES.minWeekWords }, (_, i) => `w${week}x${i}`);
    p = addWords(p, parseWordList(words.join('\n')), now).profile;
    for (const id of words) {
      for (let k = 0; k < MAX_BOX; k++) {
        const r = recordAnswer(p, id, 'correct', (now += DAY_STEP));
        p = r.profile;
        if (r.weekStar) stars++;
        legends.push(...r.legends);
      }
    }
  }
  assert.equal(stars, LEGEND_RULES.weekStars);
  assert.equal(p.weekStars.length, LEGEND_RULES.weekStars);
  assert.deepEqual(legends.map((l) => l.id), [LEGENDS.find((l) => l.track === 'spelling').id]);
});

test('finishing last week\'s list after a new list arrives still earns its Week Star', () => {
  let p = newProfile('A', T0);
  let now = T0;
  const old = ['ant', 'bee', 'cow', 'dog', 'eel'];
  p = addWords(p, parseWordList(old.join('\n')), now).profile;
  for (const id of old.slice(0, 4)) for (let k = 0; k < MAX_BOX; k++) p = recordAnswer(p, id, 'correct', (now += DAY_STEP)).profile;
  now = T0 + WEEK;
  p = addWords(p, parseWordList('fox\ngnu\nhen\nibis\njay'), now).profile;
  assert.equal((p.weekStars || []).length, 0);
  let star = false;
  for (let k = 0; k < MAX_BOX; k++) {
    const r = recordAnswer(p, 'eel', 'correct', (now += DAY_STEP));
    p = r.profile;
    star ||= r.weekStar;
  }
  assert.ok(star);
  assert.deepEqual(p.weekStars, [T0]);
});

test('a short list (fewer than the minimum words) earns no Week Star', () => {
  let p = addWords(newProfile('A', T0), parseWordList('cat\ndog'), T0).profile;
  let now = T0;
  for (const id of ['cat', 'dog']) for (let k = 0; k < MAX_BOX; k++) p = recordAnswer(p, id, 'correct', (now += DAY_STEP)).profile;
  assert.equal((p.weekStars || []).length, 0);
});

test('every 25 mastered Word Match words earn a vocab Legendary', () => {
  let p = newProfile('A', T0);
  const ids = vocabOf(p).words.map((w) => w.id).slice(0, LEGEND_RULES.vocabWords);
  let now = T0;
  const legends = [];
  for (const id of ids) {
    for (let k = 0; k < MAX_BOX; k++) {
      const r = recordMatch(p, id, 'correct', (now += DAY_STEP));
      p = r.profile;
      legends.push(...r.legends);
    }
  }
  assert.deepEqual(legends.map((l) => l.id), [LEGENDS.find((l) => l.track === 'vocab').id]);
});
