import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coinsForAnswer, BOX_COINS, COMEBACK_BONUS, PACK_COST, DAILY_PACK_CAP, RARE_PITY, EPIC_PITY,
  SHARDS_FOR_DUPLICATE, CRAFT_COST, ODDS, canOpenPack, openPack, rollRarity, craft, packsLeftToday,
  pityStatus, themeProgress,
} from '../src/economy.js';
import { THEMES } from '../src/content.js';
import { newItem, review } from '../src/srs.js';
import { mulberry32 } from '../src/rng.js';
import { newProfile, parseWordList, addWords, recordAnswer, checkSpelling, activeItems } from '../src/profile.js';
const setWords = (p, entries, now) => addWords(p, entries, now).profile;
import { claimSetRewards, teamPowers, levelForXp, xpForLevel, XP_PER } from '../src/progress.js';
import { newBattle, applyAnswer, hintText } from '../src/battle.js';

const T0 = new Date(2026, 10, 19, 15).getTime();
const DAY = 24 * 3600e3;
const rich = (p, coins = 100000) => ({ ...p, coins });

test('mastered words pay less than shaky ones; wrong pays nothing', () => {
  const fresh = newItem('w', T0);
  const mastered = { ...fresh, box: 5, seen: 9 };
  assert.equal(coinsForAnswer(fresh, 'correct'), BOX_COINS[0]);
  assert.equal(coinsForAnswer(mastered, 'correct'), BOX_COINS[5]);
  assert.ok(BOX_COINS[0] > BOX_COINS[5]);
  for (let i = 1; i < BOX_COINS.length; i++) assert.ok(BOX_COINS[i] <= BOX_COINS[i - 1]);
  assert.equal(coinsForAnswer(fresh, 'wrong'), 0);
});

test('getting a previously missed word right pays a comeback bonus', () => {
  const missed = review(newItem('w', T0), 'wrong', T0);
  assert.equal(coinsForAnswer(missed, 'correct'), BOX_COINS[0] + COMEBACK_BONUS);
});

test('hinted answers pay half', () => {
  const item = newItem('w', T0);
  assert.equal(coinsForAnswer(item, 'assisted'), Math.floor(BOX_COINS[0] / 2));
});

test('grinding a mastered word earns far less than practicing a missed one', () => {
  let p = setWords(newProfile('A', T0), parseWordList('easy\nhard'), T0);
  p.srs.easy = { ...p.srs.easy, box: 5, seen: 10 };
  p.srs.hard = review(p.srs.hard, 'wrong', T0);
  const easy = recordAnswer(p, 'easy', 'correct', T0).coins;
  const hard = recordAnswer(p, 'hard', 'correct', T0).coins;
  assert.ok(hard >= easy * 5, `${hard} vs ${easy}`);
});

test('recordAnswer updates schedule, coins, XP and stats together', () => {
  let p = setWords(newProfile('A', T0), parseWordList('because | I stayed in because it rained.'), T0);
  const r = recordAnswer(p, 'because', 'correct', T0);
  assert.equal(r.profile.srs.because.box, 1);
  assert.equal(r.profile.coins, BOX_COINS[0]);
  assert.equal(r.profile.xp, XP_PER.correct);
  assert.deepEqual(r.profile.stats, { answered: 1, correct: 1 });
  assert.equal(p.coins, 0, 'input profile untouched');
});

test('odds add up to 1', () => {
  assert.ok(Math.abs(Object.values(ODDS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('packs cost coins and are capped per day, resetting the next day', () => {
  let p = rich(newProfile('A', T0), PACK_COST * (DAILY_PACK_CAP + 2));
  const rng = mulberry32(7);
  for (let i = 0; i < DAILY_PACK_CAP; i++) p = openPack(p, 'ocean', T0, rng).profile;
  assert.equal(p.coins, PACK_COST * 2);
  assert.equal(packsLeftToday(p, T0), 0);
  assert.deepEqual(canOpenPack(p, T0), { ok: false, reason: 'cap' });
  assert.throws(() => openPack(p, 'ocean', T0, rng));
  assert.equal(packsLeftToday(p, T0 + DAY), DAILY_PACK_CAP);
  p = openPack(p, 'ocean', T0 + DAY, rng).profile;
  assert.equal(p.packs.openedToday, 1);
});

test('cannot open a pack without enough coins', () => {
  const p = rich(newProfile('A', T0), PACK_COST - 1);
  assert.deepEqual(canOpenPack(p, T0), { ok: false, reason: 'coins' });
});

test('pity: a rare-or-better is guaranteed every RARE_PITY packs, even with worst luck', () => {
  const alwaysCommon = () => 0; // weightedPick with 0 → first entry (common)
  let packs = { sinceRare: 0, sinceEpic: 0 };
  const seq = [];
  for (let i = 0; i < RARE_PITY * 3; i++) {
    const r = rollRarity(packs, alwaysCommon);
    seq.push(r);
    packs = { sinceRare: r === 'common' ? packs.sinceRare + 1 : 0, sinceEpic: r === 'epic' ? 0 : packs.sinceEpic + 1 };
  }
  for (let i = 0; i < seq.length; i += RARE_PITY) {
    assert.ok(seq.slice(i, i + RARE_PITY).some((r) => r !== 'common'), seq.join(','));
  }
});

test('pity: an epic is guaranteed within EPIC_PITY packs', () => {
  let p = rich(newProfile('A', T0));
  const neverEpic = mulberry32(3);
  let sawEpic = false;
  for (let d = 0; d < EPIC_PITY && !sawEpic; d++) {
    // one pack per day so the daily cap doesn't get in the way
    const { profile, result } = openPack(p, 'space', T0 + d * DAY, () => Math.min(0.999, neverEpic() * 0.9));
    p = profile;
    sawEpic = result.rarity === 'epic';
  }
  assert.ok(sawEpic);
  assert.equal(pityStatus(p.packs).epicIn, EPIC_PITY);
});

test('rarity distribution roughly matches the shown odds (pity aside)', () => {
  const rng = mulberry32(99);
  const counts = { common: 0, rare: 0, epic: 0 };
  const n = 20000;
  for (let i = 0; i < n; i++) counts[rollRarity({ sinceRare: 0, sinceEpic: 0 }, rng)]++;
  for (const r of Object.keys(ODDS)) assert.ok(Math.abs(counts[r] / n - ODDS[r]) < 0.02, `${r} ${counts[r] / n}`);
});

test('packs give missing collectibles first; duplicates turn into shards', () => {
  const theme = THEMES[0];
  const commons = theme.items.filter((i) => i.rarity === 'common');
  let p = rich(newProfile('A', T0));
  const rng = () => 0; // always common, always first in pool
  let day = 0;
  // Only commons until pity kicks in; count the commons we get.
  const got = new Set();
  while (got.size < commons.length) {
    const { profile, result } = openPack(p, theme.id, T0 + day++ * DAY, rng);
    p = profile;
    if (result.rarity === 'common') {
      assert.equal(result.duplicate, false, 'no duplicates while commons are missing');
      got.add(result.item.id);
    }
  }
  // All commons owned now; next common is a duplicate worth shards.
  p = { ...p, packs: { ...p.packs, sinceRare: 0 } };
  const shardsBefore = p.shards;
  const { profile, result } = openPack(p, theme.id, T0 + day * DAY, rng);
  assert.equal(result.rarity, 'common');
  assert.equal(result.duplicate, true);
  assert.equal(profile.shards, shardsBefore + SHARDS_FOR_DUPLICATE.common);
  assert.equal(profile.collection[result.item.id], 2);
});

test('shards craft a chosen missing collectible', () => {
  const epic = THEMES[1].items.find((i) => i.rarity === 'epic');
  let p = { ...newProfile('A', T0), shards: CRAFT_COST.epic - 1 };
  assert.throws(() => craft(p, epic.id), /not enough shards/);
  p = { ...p, shards: CRAFT_COST.epic };
  p = craft(p, epic.id);
  assert.equal(p.shards, 0);
  assert.equal(p.collection[epic.id], 1);
  assert.throws(() => craft({ ...p, shards: 999 }, epic.id), /already owned/);
});

test('completing a theme is possible and pays set XP exactly once', () => {
  const theme = THEMES[2];
  let p = newProfile('A', T0);
  p.collection = Object.fromEntries(theme.items.map((i) => [i.id, 1]));
  assert.ok(themeProgress(theme, p.collection).complete);
  const first = claimSetRewards(p);
  assert.equal(first.newly.length, 1);
  assert.equal(first.profile.xp, XP_PER.setComplete);
  const second = claimSetRewards(first.profile);
  assert.equal(second.newly.length, 0);
  assert.equal(second.profile.xp, XP_PER.setComplete);
});

test('team powers add up by rarity; only the first three count', () => {
  const [ocean] = THEMES;
  const octopus = ocean.items.find((i) => i.id === 'ocean-octopus'); // rare hint
  const shrimp = ocean.items.find((i) => i.id === 'ocean-shrimp'); // common hint
  const whale = ocean.items.find((i) => i.id === 'ocean-whale'); // epic shield
  const puff = ocean.items.find((i) => i.id === 'ocean-puffer');
  const powers = teamPowers([octopus.id, shrimp.id, whale.id, puff.id]);
  assert.deepEqual(powers, { hint: 3, power: 0, shield: 3, xp: 0 });
});

test('levels follow the XP curve', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(xpForLevel(2) - 1), 1);
  assert.equal(levelForXp(xpForLevel(2)), 2);
  assert.equal(levelForXp(xpForLevel(5)), 5);
});

test('battle: hits, combos, shields and monster swap', () => {
  const powers = { hint: 0, power: 0, shield: 1, xp: 0 };
  let b = newBattle(powers);
  const hp = b.hp;
  b = applyAnswer(b, 'correct', powers).battle;
  assert.equal(b.hp, hp - 1);
  let r = applyAnswer(b, 'wrong', powers);
  assert.equal(r.events[0].type, 'shielded');
  assert.equal(r.battle.hp, hp - 1);
  r = applyAnswer(r.battle, 'wrong', powers);
  assert.equal(r.events[0].type, 'healed');
  b = r.battle;
  let defeated = 0;
  for (let i = 0; i < 10; i++) {
    r = applyAnswer(b, 'correct', powers);
    b = r.battle;
    if (r.events.some((e) => e.type === 'defeated')) defeated++;
  }
  assert.ok(defeated >= 1);
  assert.equal(b.defeated, defeated);
});

test('spelling check forgives case, spaces and iPad smart quotes', () => {
  assert.ok(checkSpelling('  Don’t ', "don't"));
  assert.ok(checkSpelling('ICE  cream', 'ice cream'));
  assert.ok(!checkSpelling('becuase', 'because'));
});

test('word list parsing: sentences, numbering, commas, duplicates', () => {
  assert.deepEqual(parseWordList('1. because | I stayed in because it rained.\n2) friend\n\n- Friend\nice-cream'), [
    { id: 'because', word: 'because', sentence: 'I stayed in because it rained.' },
    { id: 'friend', word: 'friend', sentence: '' },
    { id: 'ice-cream', word: 'ice-cream', sentence: '' },
  ]);
  assert.deepEqual(parseWordList('cat, dog ,bird').map((w) => w.word), ['cat', 'dog', 'bird']);
});


test('hint shows the first letters only', () => {
  assert.equal(hintText('because'), 'b e c _ _ _ _');
  assert.equal(hintText("don't", 1), "d _ _ ' _");
});
