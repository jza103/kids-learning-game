import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_ITEMS, THEMES, LEGEND_ITEMS } from '../src/content.js';
import { ROUTES_BY_ID, farmTrait, JOB_IDS, ELEMENT_IDS, CROPS, CRITTERS_BY_ID, GOODS_BY_ID, JOURNAL_PAGES, DECOR } from '../src/farm-content.js';
import {
  visitFarm, assignCrew, removeCrew, slotsFor, workPower, stationSpeed, plant, harvestAll, collectGoodies, befriend, befriendCost,
  collectForage, forageWaiting, startCraft, collectCraft, fillRequest, sell, buyPlot, buyPen, plotCost, openBiome, biomeBlock,
  buyDecor, usePerk, perkUsesLeft, hatchEgg, fertilize, sendGift, canGift, farmLocked, farmLevel, xpLeftToday,
  FARM_XP_PER_DAY, XP_PER_LEVEL, FORAGE_MAX_SUN, GOODY_MAX_CYCLES, FERTILIZER_SHARDS, BABY_PITY, START_BELLS, newFarm, journalProgress,
  pourSun, goldenSeason, MORNING_RAIN, GOLDEN_MAX, sendExpedition, collectExpedition, benchFriends, needsMet, expeditionSlots, welcomeExplorer,
  EXPEDITION_SUN, EXPEDITION_SHARDS,
} from '../src/farm.js';
import { newProfile } from '../src/profile.js';
import { mulberry32 } from '../src/rng.js';

const T0 = new Date(2026, 10, 20, 9).getTime();
const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const first5 = THEMES.slice(0, 5).flatMap((t) => t.items);
const findFriend = (pred) => [...ALL_ITEMS, ...LEGEND_ITEMS].find((i) => pred(farmTrait(i.id), i)).id;
function kid(friends = [], extra = {}) {
  return { ...newProfile('Kid', T0), collection: Object.fromEntries(friends.map((id) => [id, 1])), ...extra };
}
const open = (p, now = T0, seed = 1) => ({ ...visitFarm(p, now, mulberry32(seed)).profile, sunJar: 0 });
/** Pour n Sunshine into the farm. */
const shine = (p, n) => pourSun({ ...p, sunJar: n }, n).profile;

test('every friend has a farm trait, and the first 60 cover every job and element', () => {
  for (const i of [...ALL_ITEMS, ...LEGEND_ITEMS]) assert.ok(farmTrait(i.id), i.id);
  for (const j of JOB_IDS) assert.ok(first5.filter((i) => farmTrait(i.id).job === j).length >= 8, j);
  for (const e of ELEMENT_IDS) assert.ok(first5.filter((i) => farmTrait(i.id).element === e).length >= 4, e);
  for (const t of THEMES) assert.equal(new Set(t.items.map((i) => farmTrait(i.id).job)).size, JOB_IDS.length, t.id);
});

test('commons have no perk; rare and up have one', () => {
  for (const i of ALL_ITEMS) assert.equal(Boolean(farmTrait(i.id).perk), i.rarity !== 'common', i.id);
});

test('content references are all valid', () => {
  for (const c of Object.values(CRITTERS_BY_ID)) {
    for (const g of c.makes) assert.ok(GOODS_BY_ID[g], `${c.id} makes ${g}`);
    if (c.likes) assert.ok(GOODS_BY_ID[c.likes], c.id);
    assert.ok(c.element, c.id);
  }
  for (const r of JOURNAL_PAGES.recipes.entries) for (const id of Object.keys(r.needs)) assert.ok(GOODS_BY_ID[id], `${r.id} needs ${id}`);
  for (const d of DECOR) assert.ok(d.bells || d.shards || d.stamp, d.id);
});

test('a new farm brings a visitor and fills the request board', () => {
  const p = open(kid(['ocean-fish']));
  assert.ok(p.farm.visitor);
  assert.equal(p.farm.requests.filter(Boolean).length, 3);
  assert.equal(p.farm.bells, START_BELLS);
});

test('crews: job match counts double and slots grow with farm level', () => {
  const grower = first5.find((i) => i.rarity === 'common' && farmTrait(i.id).job === 'grower').id;
  const other = first5.find((i) => i.rarity === 'common' && farmTrait(i.id).job === 'crafter').id;
  let p = open(kid([grower, other]));
  assert.equal(workPower(p, grower, 'fields'), 2);
  assert.equal(workPower(p, other, 'fields'), 1);
  p = assignCrew(p, grower, 'fields');
  p = assignCrew(p, other, 'fields');
  assert.ok(Math.abs(stationSpeed(p, 'fields') - 1.45) < 1e-9);
  // Moving a friend takes it off its old crew.
  p = assignCrew(p, other, 'workshop');
  assert.deepEqual(p.farm.crew.fields, [grower]);
  assert.throws(() => assignCrew(p, 'ocean-whale', 'pens'), /not your friend/);
  // Station slots: 6 to start, 25 at most.
  const total = (f) => ['fields', 'pens', 'forage', 'workshop', 'build'].reduce((s, st) => s + slotsFor(f, st), 0);
  assert.equal(total(p.farm), 6);
  assert.equal(total({ ...p.farm, xp: XP_PER_LEVEL * 40 }), 25);
  p = removeCrew(p, other);
  assert.deepEqual(p.farm.crew.workshop, []);
});

test('crops grow from Sunshine, not time; a matching element grower adds one to the harvest', () => {
  const carrotFriend = first5.find((i) => farmTrait(i.id).job === 'grower' && farmTrait(i.id).element === 'earth').id;
  let p = open(kid([carrotFriend]));
  p = plant(p, 0, 'carrot', T0);
  assert.equal(harvestAll(p, T0 + 30 * DAY).harvested.length, 0, 'time alone grows nothing');
  p = shine(p, 2);
  assert.equal(harvestAll(p, T0).harvested.length, 0);
  p = shine(p, 1);
  let r = harvestAll(p, T0);
  assert.deepEqual(r.harvested, [{ id: 'carrot', n: 2 }]);
  p = assignCrew(p, carrotFriend, 'fields');
  p = plant(p, 1, 'carrot', T0);
  p = shine(p, 3);
  r = harvestAll(p, T0);
  assert.deepEqual(r.harvested, [{ id: 'carrot', n: 3 }, { id: 'carrot', n: 3 }]);
  assert.throws(() => plant(p, 2, 'lettuce', T0), /not open/);
});

test('wonder seeds come from mastery, once each, and grow wonder crops', () => {
  const srs = { a: { masteredAt: T0 }, b: { masteredAt: null } };
  let p = kid([], { srs, math: { srs: { x: { masteredAt: T0 } } } });
  let r = visitFarm(p, T0, mulberry32(1));
  assert.equal(r.profile.farm.wonderSeeds, 2);
  r = visitFarm(r.profile, T0 + 1, mulberry32(1));
  assert.equal(r.profile.farm.wonderSeeds, 2, 'not paid twice');
  p = plant(r.profile, 0, 'wonder', T0);
  assert.equal(p.farm.wonderSeeds, 1);
  const h = harvestAll(shine(p, 8), T0);
  assert.equal(GOODS_BY_ID[h.harvested[0].id].kind, 'wonder');
});

test('the farm never touches coins, packs or the collection', () => {
  const p0 = kid(['ocean-fish'], { coins: 123, shards: 0 });
  let p = open(p0);
  p = plant(p, 0, 'carrot', T0);
  p = harvestAll(shine(p, 3), T0).profile;
  p = sell(p, 'carrot', 2).profile;
  assert.equal(p.coins, 123);
  assert.deepEqual(p.collection, p0.collection);
  assert.deepEqual(p.packs, p0.packs);
});

test('befriending a visitor costs its favorite crop, less with a matching tender', () => {
  let p = open(kid([]));
  const v = CRITTERS_BY_ID[p.farm.visitor.id];
  assert.equal(befriendCost(p.farm), 3);
  assert.throws(() => befriend(p, T0), /need 3/);
  p = { ...p, farm: { ...p.farm, items: { [v.likes]: 3 } } };
  p = befriend(p, T0).profile;
  assert.ok(p.farm.critters[v.id]);
  assert.equal(p.farm.items[v.likes], undefined);
  assert.ok(p.farm.journal.critters.includes(v.id));
  const tender = first5.find((i) => farmTrait(i.id).job === 'tender' && farmTrait(i.id).element === 'earth').id;
  let q = open(kid([tender]));
  q = { ...assignCrew(q, tender, 'pens') };
  q.farm = { ...q.farm, visitor: { id: 'fluffle' } };
  assert.equal(befriendCost(q.farm), 2);
});

test('critters make goodies, capped while away; babies are guaranteed by the pity count', () => {
  let p = open(kid([]));
  p.farm = { ...p.farm, visitor: null, critters: { fluffle: { at: 0 }, buzzby: { at: 0 } } };
  p = shine(p, 100);
  let r = collectGoodies(p, T0, () => 0.99);
  assert.equal(r.collected.wool, GOODY_MAX_CYCLES);
  assert.equal(r.collected.honey, GOODY_MAX_CYCLES);
  p = r.profile;
  const now = T0;
  for (let i = 2; i < BABY_PITY; i++) {
    p = collectGoodies(shine(p, 4), now, () => 0.99).profile;
    assert.equal(p.farm.visitor, null);
  }
  r = collectGoodies(shine(p, 4), now, () => 0.99);
  assert.deepEqual(r.profile.farm.visitor, { id: 'bumblefluff', baby: true });
  assert.equal(befriendCost(r.profile.farm), 0);
  p = buyPen({ ...r.profile, farm: { ...r.profile.farm, bells: 1000 } });
  p = befriend(p, now).profile;
  assert.deepEqual(CRITTERS_BY_ID.bumblefluff.makes, ['wool', 'honey']);
  assert.ok(p.farm.critters.bumblefluff);
});

test('forage needs a crew and stops piling up', () => {
  const g = first5.find((i) => i.rarity === 'common' && farmTrait(i.id).job === 'gatherer').id;
  let p = open(kid([g]));
  assert.equal(forageWaiting(shine(p, 20)), 0);
  p = assignCrew(p, g, 'forage');
  assert.equal(forageWaiting(shine(p, 20)), 4);
  assert.equal(forageWaiting(shine(p, 500)), FORAGE_MAX_SUN * 0.1 * 2);
  const r = collectForage(shine(p, 15), T0, mulberry32(3));
  assert.equal(Object.values(r.found).reduce((a, b) => a + b, 0), 3);
  assert.ok(Math.abs(r.profile.farm.forageCarry) < 1e-9);
});

test('workshop crafts take items and time', () => {
  let p = open(kid([]));
  p.farm = { ...p.farm, items: { corn: 2, honey: 1 } };
  p = startCraft(p, 'bread', T0);
  assert.deepEqual(p.farm.items, {});
  assert.throws(() => collectCraft(shine(p, 4), T0), /not ready/);
  const r = collectCraft(shine(p, 5), T0);
  assert.equal(r.profile.farm.items.bread, 1);
});

test('requests pay bells (more when the friend who asked is on a crew)', () => {
  let p = open(kid(['ocean-fish']));
  p.farm = { ...p.farm, items: { carrot: 3 }, requests: [{ from: 'ocean-fish', wants: { carrot: 3 }, bells: 20 }, null, null] };
  let r = fillRequest(p, 0, T0);
  assert.equal(r.bells, 20);
  assert.equal(r.profile.farm.requests[0], null);
  p = assignCrew(p, 'ocean-fish', 'fields');
  r = fillRequest(p, 0, T0);
  assert.equal(r.bells, 25);
  // A new request shows up an hour later.
  assert.equal(visitFarm(r.profile, T0 + 30 * MIN, mulberry32(2)).profile.farm.requests[0], null);
  assert.ok(visitFarm(r.profile, T0 + HOUR, mulberry32(2)).profile.farm.requests[0]);
});

test('farm XP is capped per day, so levels take days', () => {
  let p = open(kid([]));
  p.farm = { ...p.farm, items: { carrot: 500 } };
  for (let i = 0; i < 100; i++) {
    p.farm.requests[0] = { from: null, wants: { carrot: 1 }, bells: 1 };
    p = fillRequest(p, 0, T0).profile;
  }
  assert.equal(p.farm.xp, FARM_XP_PER_DAY);
  assert.equal(xpLeftToday(p.farm, T0), 0);
  assert.equal(xpLeftToday(p.farm, T0 + DAY), FARM_XP_PER_DAY);
  assert.equal(farmLevel(p.farm), 1);
});

test('building: plots and pens cost bells; biomes need a level, an element on the build crew and bells', () => {
  let p = open(kid([]));
  p.farm = { ...p.farm, bells: 1000 };
  const cost = plotCost(p);
  p = buyPlot(p);
  assert.equal(p.farm.plots.length, 5);
  assert.equal(p.farm.bells, 1000 - cost);
  assert.equal(biomeBlock(p, 'frost'), 'level');
  p.farm = { ...p.farm, xp: XP_PER_LEVEL * 2 };
  assert.equal(biomeBlock(p, 'frost'), 'element');
  const frosty = findFriend((t) => t.element === 'frost' && t.job === 'builder');
  p = { ...p, collection: { [frosty]: 1 } };
  p = assignCrew(p, frosty, 'build');
  assert.equal(biomeBlock(p, 'frost'), null);
  p = openBiome(p, 'frost', T0);
  assert.ok(p.farm.biomes.includes('frost'));
  assert.ok(p.farm.bells < 1000 - cost - 100, 'bells spent (with builder discount)');
});

test('shards buy crystal decor and fertilizer, never friends', () => {
  let p = open(kid([], { shards: 40 }));
  p = buyDecor(p, 'crystal-lamp');
  assert.equal(p.shards, 15);
  assert.ok(p.farm.decor.includes('crystal-lamp'));
  assert.throws(() => buyDecor(p, 'crystal-tree'), /shards/);
  p = plant(p, 0, 'strawberry', T0);
  p = fertilize(p, 0, T0);
  assert.equal(p.shards, 15 - FERTILIZER_SHARDS);
  assert.equal(harvestAll(p, T0).harvested.length, 1);
});

test('perks: once a day per rare friend, only while on a crew', () => {
  const rareGrower = findFriend((t, i) => t.job === 'grower' && i.rarity === 'rare');
  let p = open(kid([rareGrower]));
  p = plant(p, 0, 'strawberry', T0);
  assert.throws(() => usePerk(p, rareGrower, T0), /crew/);
  p = assignCrew(p, rareGrower, 'fields');
  assert.equal(perkUsesLeft(p, rareGrower, T0), 1);
  p = usePerk(p, rareGrower, T0).profile;
  assert.equal(harvestAll(p, T0).harvested.length, 1);
  assert.equal(perkUsesLeft(p, rareGrower, T0), 0);
  assert.equal(perkUsesLeft(p, rareGrower, T0 + DAY), 1);
});

test('eggs: one per Legendary and finished theme, hatching egg critters', () => {
  let p = open(kid(['legend-titan-3'], { completedSets: ['ocean'] }));
  assert.equal(p.farm.eggs, 2);
  p = hatchEgg(p, T0, () => 0).profile;
  assert.equal(p.farm.eggs, 1);
  assert.equal(CRITTERS_BY_ID[Object.keys(p.farm.critters)[0]].kind, 'egg');
});

test('the journal stamps a finished page and gives its decoration', () => {
  let p = open(kid([]));
  const forage = JOURNAL_PAGES.forage.entries.map((x) => x.id);
  p.farm = { ...p.farm, journal: { ...p.farm.journal, forage: forage.slice(1) }, crew: { ...p.farm.crew } };
  p.farm.items = {};
  // Gatherer perk path is random; add the last one by selling-safe path: collect with a forced find.
  const g = findFriend((t, i) => t.job === 'gatherer' && i.rarity === 'rare');
  p = { ...p, collection: { [g]: 1 } };
  p = assignCrew(p, g, 'forage');
  p.farm.biomes = ['meadow', 'frost', 'tide', 'caves', 'cloud'];
  const r = usePerk(p, g, T0, () => 0); // always the first forage item
  assert.ok(r.events.some((e) => e.type === 'stamp' && e.page === 'forage'));
  assert.ok(r.profile.farm.decor.includes('stamp-forage'));
  assert.ok(journalProgress(r.profile.farm, 'forage').complete);
});

test('sibling gifts: once a day per sibling, opened on the next visit', () => {
  let a = open(kid([]));
  a.farm = { ...a.farm, items: { carrot: 10 } };
  let b = { ...kid([]), id: 'kid-b', name: 'Sib' };
  const r = sendGift(a, b, 'carrot', 9, T0);
  assert.equal(r.sender.farm.items.carrot, 5);
  assert.equal(canGift(r.sender, 'kid-b', T0), false);
  assert.equal(canGift(r.sender, 'kid-b', T0 + DAY), true);
  const v = visitFarm(r.receiver, T0, mulberry32(1));
  assert.equal(v.profile.farm.items.carrot, 5);
  assert.ok(v.events.some((e) => e.type === 'gift'));
  assert.equal(v.profile.farm.inbox.length, 0);
});

test('parent gate: off by default; when on, the farm opens after any answer today', () => {
  const p = kid([]);
  assert.equal(farmLocked(p, T0), false);
  const gated = { ...p, farmGate: true };
  assert.equal(farmLocked(gated, T0), true);
  assert.equal(farmLocked({ ...gated, coinDay: { day: new Date(T0).toLocaleDateString('sv'), earned: 5 } }, T0), false);
});

test('newFarm is plain JSON', () => {
  const f = newFarm(T0);
  assert.deepEqual(JSON.parse(JSON.stringify(f)), f);
  assert.ok(CROPS.length >= 10);
});

test('Morning Rain once a day; the Sun Jar pours into the farm clock', () => {
  let r = visitFarm(kid([]), T0, mulberry32(1));
  assert.equal(r.profile.sunJar, MORNING_RAIN);
  r = visitFarm(r.profile, T0 + HOUR, mulberry32(1));
  assert.equal(r.profile.sunJar, MORNING_RAIN, 'not twice in a day');
  r = visitFarm(r.profile, T0 + DAY, mulberry32(1));
  assert.equal(r.profile.sunJar, MORNING_RAIN * 2);
  assert.throws(() => pourSun(r.profile), /plant something/);
  let p = plant(r.profile, 0, 'carrot', T0);
  p = pourSun(p).profile;
  assert.equal(p.sunJar, MORNING_RAIN * 2 - 3, 'only what the carrot needs');
  assert.equal(p.farm.clock, 3);
  p = pourSun(p, 100).profile;
  assert.equal(p.sunJar, 0);
  assert.throws(() => pourSun(p), /empty/);
});

test('learning answers fill the Sun Jar (and refreshes pay shards)', async () => {
  const { recordAnswer, addWords } = await import('../src/profile.js');
  let p = addWords(newProfile('Kid', T0), [{ id: 'cat', word: 'cat', sentence: '' }], T0).profile;
  p = recordAnswer(p, 'cat', 'wrong', T0).profile;
  assert.equal(p.sunJar || 0, 0);
  p = recordAnswer(p, 'cat', 'correct', T0 + MIN).profile;
  assert.equal(p.sunJar, 2, 'getting a missed word right pays double');
  const before = p.shards;
  p = { ...p, srs: { ...p.srs, cat: { ...p.srs.cat, box: 5, masteredAt: T0, dueAt: T0 } } };
  const r = recordAnswer(p, 'cat', 'correct', T0 + DAY);
  assert.equal(r.shards, 2);
  assert.equal(r.profile.shards, before + 2);
});

test('Golden Season: only when everything is mastered; then the farm grows on its own', async () => {
  const { trackedFacts } = await import('../src/math.js');
  const done = { box: 5, masteredAt: T0, dueAt: T0 + 30 * DAY };
  const msrs = Object.fromEntries([...trackedFacts('mul'), ...trackedFacts('div')].map((f) => [f.id, done]));
  const p = { ...kid([]), words: [{ id: 'cat' }], srs: { cat: done }, math: { srs: msrs }, vocab: { srs: { a: done } } };
  assert.equal(goldenSeason(p, T0), true);
  assert.equal(goldenSeason({ ...p, vocab: { srs: { a: done, b: { box: 2, masteredAt: null, dueAt: T0 } } } }, T0), false);
  assert.equal(goldenSeason(p, T0 + 31 * DAY), false, 'a refresh is due');
  assert.equal(goldenSeason(kid([]), T0), false);
  let r = visitFarm(p, T0, mulberry32(1));
  r = visitFarm({ ...r.profile, sunJar: 0 }, T0 + 2 * DAY, mulberry32(1));
  assert.equal(r.profile.sunJar, MORNING_RAIN + GOLDEN_MAX);
});

test('expeditions: bench friends only, needs speed them up, rewards include shards and a story', () => {
  const ids = first5.slice(0, 12).map((i) => i.id);
  let p = open(kid(ids));
  p = assignCrew(p, ids[0], 'fields');
  assert.equal(benchFriends(p).includes(ids[0]), false);
  assert.equal(p.farm.routes.list.length, 3);
  const shortIdx = p.farm.routes.list.findIndex((r) => ROUTES_BY_ID[r.route].size === 'short');
  assert.ok(shortIdx >= 0);
  const team = benchFriends(p).slice(0, 3);
  assert.throws(() => sendExpedition(p, shortIdx, team.slice(0, 2), T0), /pick 3/);
  p = sendExpedition(p, shortIdx, team, T0);
  assert.throws(() => sendExpedition(p, shortIdx, benchFriends(p).slice(0, 3), T0), /done for today/);
  assert.throws(() => assignCrew(p, team[0], 'pens'), /expedition/);
  assert.equal(benchFriends(p).some((id) => team.includes(id)), false);
  assert.throws(() => collectExpedition(p, 0, T0), /not back/);
  const shards = p.shards;
  p = shine(p, 15);
  const r = collectExpedition(p, 0, T0, () => 0);
  assert.equal(r.profile.shards, shards + EXPEDITION_SHARDS.short);
  assert.equal(r.profile.farm.mapPieces, 1);
  assert.ok(r.story.includes(first5.find((x) => x.id === team[0]).name));
  assert.equal(r.profile.farm.expeditions.length, 0);
  assert.equal(expeditionSlots(r.profile.farm), 2);
});

test('needs: elements, jobs and themes count', () => {
  const ocean = THEMES[0].items.map((i) => i.id);
  assert.equal(needsMet(ocean.slice(0, 2), [{ kind: 'theme', value: 'ocean', n: 2 }]), 1);
  assert.equal(needsMet(ocean.slice(0, 1), [{ kind: 'theme', value: 'ocean', n: 2 }]), 0);
});

test('big expeditions find their region critter by the pity count', () => {
  const ids = first5.slice(0, 20).map((i) => i.id);
  let p = open(kid(ids));
  for (let k = 0; k < 3; k++) {
    p.farm = { ...p.farm, routes: { day: p.farm.routes.day, list: [{ route: 'oldoak', needs: [], done: false }] } };
    p = sendExpedition(p, 0, benchFriends(p).slice(0, 6), T0);
    p = shine(p, 40);
    const r = collectExpedition(p, 0, T0, () => 0.99);
    p = r.profile;
  }
  assert.deepEqual(p.farm.waiting, ['mossling']);
  p = buyPen({ ...p, farm: { ...p.farm, bells: 1000 } });
  p.farm.critters = {};
  p = welcomeExplorer(p, 'mossling').profile;
  assert.ok(p.farm.critters.mossling);
});

test('an old clock-time farm upgrades without losing anything', () => {
  const old = { ...newFarm(T0), v: 1, plots: [{ crop: 'corn', plantedAt: T0, readyAt: T0 + HOUR }, null, null, null], critters: { fluffle: { lastAt: T0 } }, forageAt: T0, workshop: { recipe: 'bread', readyAt: T0 + HOUR } };
  delete old.expeditions;
  delete old.clock;
  const p = visitFarm({ ...kid([]), farm: old }, T0, mulberry32(1)).profile;
  assert.equal(p.farm.v, 2);
  assert.equal(harvestAll(p, T0).harvested.length, 1);
  assert.ok(Array.isArray(p.farm.expeditions));
  assert.equal(p.farm.workshop.ready, 0);
});

test('Wishing Well: a missing friend with the chosen trait, never ultra; coins use a daily pack', async () => {
  const { makeWish, canWish, wishCoinCost, WISH_SHARDS, DAILY_PACK_CAP } = await import('../src/economy.js');
  const attr = { kind: 'element', value: 'frost' };
  let p = kid([], { coins: 1000, shards: 0 });
  const cost = wishCoinCost(p, T0);
  let r = makeWish(p, attr, 'coins', T0, () => 0);
  assert.equal(farmTrait(r.result.item.id).element, 'frost');
  assert.ok(['common', 'rare', 'epic'].includes(r.result.item.rarity));
  assert.equal(r.profile.coins, 1000 - cost);
  assert.equal(r.profile.packs.openedToday, 1);
  assert.equal(canWish(r.profile, attr, 'shards', T0, 'rare').reason, 'shards');
  p = { ...r.profile, shards: WISH_SHARDS.rare };
  r = makeWish(p, { kind: 'job', value: 'builder' }, 'shards', T0, () => 0, 'rare');
  assert.equal(r.result.item.rarity, 'rare');
  assert.equal(farmTrait(r.result.item.id).job, 'builder');
  assert.equal(r.profile.shards, 0);
  // Daily cap applies to coin wishes.
  const capped = { ...p, packs: { ...p.packs, day: new Date(T0).toLocaleDateString('sv'), openedToday: DAILY_PACK_CAP } };
  assert.equal(canWish(capped, attr, 'coins', T0).reason, 'cap');
  // Owning every common/rare/epic with the trait: nothing to wish for.
  const all = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, 1]));
  assert.equal(canWish({ ...p, collection: all }, attr, 'coins', T0).reason, 'none');
});
