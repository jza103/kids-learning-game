// Friend Grove: the farm side game. Friends work on crews, crops grow from
// Sunshine (earned by learning, see sunshine.js), wild critters move in and
// make goodies, friends go on expeditions, and requests pay Grove Bells.
// Sunshine is poured in from the Sun Jar: crops, crafts and expeditions each
// fill up with it (faster with a good crew at the moment you pour), and
// critters and forage run on `farm.clock`, the total Sunshine poured so far.
// Nothing depends on logging in at set times.
// Pure functions: profile in, { profile, ... } out. The farm never pays coins,
// packs or friends; those only come from learning. Mastery feeds the farm
// (Wonder Seeds, Mystery Eggs), never the other way round.
import { ITEMS_BY_ID, themesOpen } from './content.js';
import { needsRefresh, MAX_BOX } from './srs.js';
import { trackedFacts } from './math.js';
import { friendInfo } from './friends.js';
import { dayKey } from './rng.js';
import {
  JOBS, farmTrait, BIOMES, BIOMES_BY_ID, CROPS, WONDER_CROPS, FORAGE, CRITTERS, CRITTERS_BY_ID, RECIPES,
  GOODS_BY_ID, DECOR_BY_ID, JOURNAL_PAGES, ELEMENT_IDS, JOB_IDS, ROUTES, ROUTES_BY_ID, EXPLORERS,
} from './farm-content.js';
import { mulberry32 } from './rng.js';

const MIN = 60e3;

// ---------- Tuning ----------
export const STATIONS = {
  fields: { id: 'fields', name: 'Fields', emoji: '🌱', job: 'grower' },
  pens: { id: 'pens', name: 'Pens', emoji: '🐾', job: 'tender' },
  forage: { id: 'forage', name: 'Forage', emoji: '🧺', job: 'gatherer' },
  workshop: { id: 'workshop', name: 'Workshop', emoji: '🔨', job: 'crafter' },
  build: { id: 'build', name: 'Build crew', emoji: '🪚', job: 'builder' },
};
export const STATION_IDS = Object.keys(STATIONS);
export const BASE_SLOTS = { fields: 2, pens: 1, forage: 1, workshop: 1, build: 1 };
export const MAX_SLOTS = 5; // per station, 25 in all
// Crew expansions: buy more spots in an area with Grove Bells, once the farm
// is big enough. EXPAND_COSTS[k] / EXPAND_LEVEL[k] are for the k-th expansion
// of that area (fields starts with 2 spots, the rest with 1; 5 at most).
export const EXPAND_COSTS = [50, 110, 190, 300];
export const EXPAND_LEVEL = [2, 3, 5, 8];
export const START_PLOTS = 4;
export const MAX_PLOTS = 12;
export const PLOT_COSTS = [40, 60, 90, 130, 180, 240, 310, 400]; // 5th..12th plot
export const START_PENS = 2;
export const MAX_PENS = CRITTERS.length;
export const penCost = (pens) => 50 + 40 * (pens - START_PENS);
export const START_BELLS = 20;
export const SPEED_PER_POWER = 0.15;
export const MAX_SPEED = 3;
// Sunshine: the Sun Jar (profile.sunJar) fills from learning; pouring it
// moves farm.clock forward by that much.
export const MORNING_RAIN = 8; // free Sunshine on the first farm visit each day
export const GOLDEN_EVERY = 10 * MIN; // Golden Season: 1 Sunshine per 10 minutes...
export const GOLDEN_MAX = 48; // ...up to this much per visit
export const GOODY_SUN = 4; // Sunshine per critter goody cycle
export const GOODY_MAX_CYCLES = 4; // goodies wait at most this many cycles
export const FORAGE_PER_POWER_SUN = 0.1; // finds per Sunshine per point of forage power
export const FORAGE_MAX_SUN = 40; // forage stops piling up after this much Sunshine
export const VISITOR_EVERY = 90 * MIN;
export const LIKES_NEEDED = 3; // favorite crops to befriend a wild critter (2 with a matching-element tender)
export const REQUEST_SLOTS = 3;
export const REQUEST_EVERY = 60 * MIN;
export const REQUEST_BONUS = 1.5; // requests pay this much more than selling
export const REQUESTER_BONUS = 0.25; // when the friend who asked is on a crew
export const BABY_CHANCE = 0.2;
export const BABY_PITY = 6; // collects before a baby is guaranteed
export const MAX_DISCOUNT = 0.3;
export const DISCOUNT_PER_POWER = 0.04;
export const FERTILIZER_SHARDS = 5;
export const GIFT_MAX = 5;
export const GIFT_THANKS = 10; // bells the receiver gets with a gift
// Farm level is paced by days, not hours: farm XP per day is capped.
export const FARM_XP_PER_DAY = 100;
export const XP_PER_LEVEL = 150;
export const FARM_XP = { harvest: 3, wonder: 10, goody: 1, craft: 5, befriend: 15, request: 10, perItem: 2, sun: 1 };

// ---------- State ----------
export function newFarm(now) {
  return {
    v: 3,
    started: now,
    clock: 0, // Sunshine poured in so far
    rainDay: null,
    goldenAt: now,
    bells: START_BELLS,
    xp: 0,
    xpDay: { day: null, got: 0 },
    plots: Array.from({ length: START_PLOTS }, () => null),
    pens: START_PENS,
    critters: {}, // critterId -> { at } (farm clock of last collect)
    visitor: null, // { id, baby? }
    visitorAt: now - VISITOR_EVERY, // first visitor right away
    forageClock: 0,
    forageCarry: 0,
    workshop: null, // { recipe, grown, need }
    crew: Object.fromEntries(STATION_IDS.map((s) => [s, []])),
    crewUp: Object.fromEntries(STATION_IDS.map((s) => [s, 0])), // expansions bought per area
    items: {},
    requests: Array.from({ length: REQUEST_SLOTS }, () => null),
    requestAt: Array.from({ length: REQUEST_SLOTS }, () => now),
    biomes: ['meadow'],
    decor: [],
    journal: { crops: [], critters: [], recipes: [], forage: [], explore: [] },
    stamps: [],
    perks: { day: null, used: {} },
    halfOff: false,
    claimed: { mastery: 0, eggs: 0 },
    wonderSeeds: 0,
    eggs: 0,
    babyPity: 0,
    inbox: [],
    gifts: { day: null, to: [] },
    expeditions: [], // { route, team, grown, need, met, size }
    routes: { day: null, list: [] }, // every open route, with today's needs
    souvenirs: [],
    stories: [],
    explorerPity: {},
    waiting: [], // explorer critters waiting for a pen
  };
}

/** Bring an older farm up to date. Mutates f. */
function upgrade(f, now) {
  if (f.v < 2) upgradeTo2(f, now);
  if (f.v < 3) upgradeTo3(f);
  return f;
}

// v3: crops, crafts and trips fill up ({ grown, need }) instead of ending at a
// clock time, crew spots come from expansions, and routes belong to lands.
function upgradeTo3(f) {
  const fill = (x) => {
    if (!x) return x;
    const need = Math.max(0, (x.ready ?? 0) - (x.start ?? 0));
    const { start, ready, ...rest } = x; // eslint-disable-line no-unused-vars
    return { ...rest, need, grown: Math.min(need, Math.max(0, f.clock - (start ?? 0))) };
  };
  f.plots = f.plots.map(fill);
  f.workshop = fill(f.workshop);
  const renamed = { cave: 'icecave', lagoon: 'bridge' };
  f.expeditions = (f.expeditions || []).map(fill).map((e) => ({ ...e, route: ROUTES_BY_ID[e.route] ? e.route : renamed[e.route] || 'hollow' }));
  // Keep every crew spot the old farm-level rule had given.
  const level = farmLevel(f);
  f.crewUp = Object.fromEntries(STATION_IDS.map((st) => {
    let n = 0;
    for (let l = 2; l <= level; l++) if (STATION_IDS[(l - 2) % STATION_IDS.length] === st) n++;
    return [st, Math.min(MAX_SLOTS - BASE_SLOTS[st], n)];
  }));
  f.routes = { day: null, list: [] };
  f.waiting = (f.waiting || []).filter((id) => CRITTERS_BY_ID[id]);
  delete f.mapPieces;
  f.v = 3;
}

function upgradeTo2(f, now) {
  f.v = 2;
  f.clock = 0;
  f.rainDay = null;
  f.goldenAt = now;
  // Anything growing is a free gift: ready now.
  f.plots = f.plots.map((pl) => (pl ? { crop: pl.crop, start: 0, ready: 0 } : null));
  for (const id of Object.keys(f.critters)) f.critters[id] = { at: 0 };
  f.forageClock = 0;
  delete f.forageAt;
  if (f.workshop) f.workshop = { recipe: f.workshop.recipe, start: 0, ready: 0 };
  Object.assign(f, { expeditions: [], routes: { day: null, list: [] }, souvenirs: [], stories: [], explorerPity: {}, waiting: [] }, { ...f, v: 2 });
  f.journal.explore = f.journal.explore || [];
}

export function farmOf(profile) {
  return profile.farm || newFarm(Date.now());
}
export const sunJar = (profile) => profile.sunJar || 0;

const withFarm = (profile, farm) => ({ ...profile, farm });
const clone = (f) => JSON.parse(JSON.stringify(f));

// ---------- Levels ----------
export function farmLevel(farm) {
  return 1 + Math.floor(farm.xp / XP_PER_LEVEL);
}
export function farmLevelProgress(farm) {
  return { level: farmLevel(farm), into: farm.xp % XP_PER_LEVEL, needed: XP_PER_LEVEL };
}
export function xpLeftToday(farm, now) {
  return farm.xpDay.day === dayKey(now) ? Math.max(0, FARM_XP_PER_DAY - farm.xpDay.got) : FARM_XP_PER_DAY;
}
/** Add farm XP (mutates the draft farm), respecting the daily cap. Returns XP added. */
function gainXp(f, amount, now, events) {
  const today = dayKey(now);
  if (f.xpDay.day !== today) f.xpDay = { day: today, got: 0 };
  const add = Math.min(amount, FARM_XP_PER_DAY - f.xpDay.got);
  if (add <= 0) return 0;
  const before = farmLevel(f);
  f.xp += add;
  f.xpDay.got += add;
  const after = farmLevel(f);
  if (after > before) events.push({ type: 'level', level: after });
  return add;
}

// ---------- Crews ----------
export function slotsFor(farm, station) {
  return Math.min(MAX_SLOTS, BASE_SLOTS[station] + (farm.crewUp?.[station] || 0));
}

/** The next expansion for an area: { cost, level, ok, reason } or null at the cap. */
export function nextExpansion(profile, station) {
  const f = farmOf(profile);
  const k = f.crewUp?.[station] || 0;
  if (BASE_SLOTS[station] + k >= MAX_SLOTS) return null;
  const cost = Math.round(EXPAND_COSTS[k] * (1 - buildDiscount(profile)));
  const level = EXPAND_LEVEL[k];
  const reason = farmLevel(f) < level ? 'level' : f.bells < cost ? 'bells' : null;
  return { cost, level, ok: !reason, reason };
}

/** Buy one more crew spot in an area. */
export function expandCrew(profile, station) {
  const x = nextExpansion(profile, station);
  if (!x) throw new Error('that area is as big as it gets');
  if (x.reason === 'level') throw new Error(`reach farm level ${x.level} first`);
  const f = clone(farmOf(profile));
  spendBells(f, x.cost);
  f.crewUp = { ...Object.fromEntries(STATION_IDS.map((s) => [s, 0])), ...f.crewUp };
  f.crewUp[station]++;
  return withFarm(profile, f);
}

export function stationOf(farm, friendId) {
  return STATION_IDS.find((s) => farm.crew[s].includes(friendId)) || null;
}

// ---------- Friend energy and know-how ----------
// Each friend has ⚡ energy and its own farm XP (know-how). Working uses energy
// as Sunshine is poured; resting friends get it back from the same Sunshine
// (and a bit every morning), so it follows learning, not the clock. A tired
// friend still works, just at half power and without learning anything, which
// nudges kids to swap crews around instead of leaving one crew in place.
export const ENERGY_MAX = 100;
export const ENERGY_USE = 1; // per Sunshine poured, for each friend on a crew
export const ENERGY_REST = 3; // per Sunshine poured, for each friend resting
export const MORNING_ENERGY = 30;
export const TIRED_POWER = 0.5;
export const TRIP_ENERGY = { short: 20, big: 40 };
export const RANKS = [
  { name: 'New Hand', emoji: '🌱', xp: 0 },
  { name: 'Helper', emoji: '🌿', xp: 30 },
  { name: 'Skilled', emoji: '🌳', xp: 90 },
  { name: 'Expert', emoji: '⭐', xp: 200 },
  { name: 'Master', emoji: '🌟', xp: 400 },
];
export const JOB_STAMP_SUN = 20; // Sunshine worked in an area to earn its stamp
export const newHand = () => ({ energy: ENERGY_MAX, xp: 0, jobs: {} });
export const handOf = (farm, id) => farm.hands?.[id] || newHand();
export function friendRank(farm, id) {
  const xp = handOf(farm, id).xp;
  let r = 0;
  while (r + 1 < RANKS.length && xp >= RANKS[r + 1].xp) r++;
  return r; // 0..4
}
export const jobStamps = (farm, id) => STATION_IDS.filter((st) => (handOf(farm, id).jobs[st] || 0) >= JOB_STAMP_SUN);
export const allRounder = (farm, id) => jobStamps(farm, id).length === STATION_IDS.length;
export const isTired = (farm, id) => handOf(farm, id).energy <= 0;
const editHand = (f, id) => {
  f.hands ||= {};
  return (f.hands[id] ||= newHand());
};
function rankUp(f, id, gain, events) {
  const before = friendRank(f, id);
  editHand(f, id).xp += gain;
  const after = friendRank(f, id);
  if (after > before) events.push({ type: 'rank', id, rank: after });
}

/**
 * How much one friend adds at a station: 2 if it's its job (1 if not), plus
 * its evolution bonus, +1 gold, +1 for ultra and legendary.
 */
export function workPower(profile, friendId, station) {
  const trait = farmTrait(friendId);
  const item = ITEMS_BY_ID[friendId];
  if (!trait || !item) return 0;
  const info = friendInfo(profile, friendId);
  const top = item.rarity === 'ultra' || item.rarity === 'legendary' ? 1 : 0;
  const f = farmOf(profile);
  const skill = Math.floor(friendRank(f, friendId) / 2) + (allRounder(f, friendId) ? 1 : 0);
  const power = (JOBS[trait.job].station === station ? 2 : 1) + info.stage.bonus + (info.gold ? 1 : 0) + top + skill;
  return isTired(f, friendId) ? power * TIRED_POWER : power;
}

export function stationPower(profile, station) {
  return farmOf(profile).crew[station].reduce((sum, id) => sum + workPower(profile, id, station), 0);
}
export function stationSpeed(profile, station) {
  return Math.min(MAX_SPEED, 1 + SPEED_PER_POWER * stationPower(profile, station));
}
export function crewElements(farm, station) {
  return new Set(farm.crew[station].map((id) => farmTrait(id)?.element).filter(Boolean));
}
export function buildDiscount(profile) {
  const d = Math.min(MAX_DISCOUNT, DISCOUNT_PER_POWER * stationPower(profile, 'build'));
  return farmOf(profile).halfOff ? Math.max(d, 0.5) : d;
}

/** Put a friend on a station's crew (moving it from any other crew). */
export function assignCrew(profile, friendId, station) {
  if (!profile.collection?.[friendId]) throw new Error('not your friend');
  if (!STATIONS[station]) throw new Error(`unknown station: ${station}`);
  const f = clone(farmOf(profile));
  if ((f.expeditions || []).some((e) => e.team.includes(friendId))) throw new Error('that friend is on an expedition');
  for (const s of STATION_IDS) f.crew[s] = f.crew[s].filter((id) => id !== friendId);
  if (f.crew[station].length >= slotsFor(f, station)) throw new Error('crew full');
  f.crew[station].push(friendId);
  return withFarm(profile, f);
}
export function removeCrew(profile, friendId) {
  const f = clone(farmOf(profile));
  for (const s of STATION_IDS) f.crew[s] = f.crew[s].filter((id) => id !== friendId);
  return withFarm(profile, f);
}

// ---------- Unlocked content ----------
export const biomeOpen = (farm, biome) => farm.biomes.includes(biome);
export const openCrops = (farm) => CROPS.filter((c) => biomeOpen(farm, c.biome));
export const openRecipes = (farm) => RECIPES.filter((r) => biomeOpen(farm, r.biome));
export const openForage = (farm) => FORAGE.filter((x) => biomeOpen(farm, x.biome));

function addItem(f, id, n = 1) {
  f.items[id] = (f.items[id] || 0) + n;
  const g = GOODS_BY_ID[id];
  const page = { wonder: 'crops', crop: 'crops', forage: 'forage', craft: 'recipes', treasure: 'explore' }[g.kind] || null;
  if (page) discover(f, page, id);
}
function takeItems(f, needs) {
  for (const [id, n] of Object.entries(needs)) if ((f.items[id] || 0) < n) throw new Error(`need ${n} ${id}`);
  for (const [id, n] of Object.entries(needs)) {
    f.items[id] -= n;
    if (!f.items[id]) delete f.items[id];
  }
}
function discover(f, page, id) {
  if (!f.journal[page]) f.journal[page] = [];
  if (!f.journal[page].includes(id)) f.journal[page].push(id);
}

// ---------- Fields ----------
export function plant(profile, plotIndex, cropId, now, rng = Math.random) {
  const f = clone(farmOf(profile));
  if (plotIndex < 0 || plotIndex >= f.plots.length) throw new Error('no such plot');
  if (f.plots[plotIndex]) throw new Error('plot in use');
  let c;
  if (cropId === 'wonder') {
    if (!(f.wonderSeeds > 0)) throw new Error('no wonder seeds');
    f.wonderSeeds--;
    const fresh = WONDER_CROPS.filter((w) => !f.journal.crops.includes(w.id));
    const pool = fresh.length ? fresh : WONDER_CROPS;
    c = pool[Math.floor(rng() * pool.length)];
  } else {
    c = CROPS.find((x) => x.id === cropId);
    if (!c || !biomeOpen(f, c.biome)) throw new Error('crop not open');
  }
  f.plots[plotIndex] = { crop: c.id, grown: 0, need: c.sun };
  return withFarm(profile, f);
}

/** Is this crop (or craft, or expedition) done? */
export const plotReady = (x) => Boolean(x && x.grown >= x.need - 1e-9);
/** Sunshine still needed to finish it at this speed. */
export const sunLeft = (x, speed = 1) => (x ? Math.max(0, Math.ceil((x.need - x.grown) / speed - 1e-9)) : 0);

/** Harvest every ready plot. Returns { profile, harvested: [{ id, n }], events }. */
export function harvestAll(profile, now) {
  const f = clone(farmOf(profile));
  const elements = crewElements(f, 'fields');
  const harvested = [];
  const events = [];
  f.plots = f.plots.map((plot) => {
    if (!plotReady(plot)) return plot;
    const g = GOODS_BY_ID[plot.crop];
    const n = g.kind === 'wonder' ? 1 : 2 + (elements.has(g.element) ? 1 : 0);
    addItem(f, g.id, n);
    harvested.push({ id: g.id, n });
    gainXp(f, g.kind === 'wonder' ? FARM_XP.wonder : FARM_XP.harvest, now, events);
    return null;
  });
  return { profile: withFarm(profile, f), harvested, events: [...events, ...stampEvents(f)] };
}

/** Spend shards to finish one growing crop now (the farm's use for shards). */
export function fertilize(profile, plotIndex, now) {
  const f = clone(farmOf(profile));
  const plot = f.plots[plotIndex];
  if (!plot || plotReady(plot)) throw new Error('nothing growing');
  if ((profile.shards || 0) < FERTILIZER_SHARDS) throw new Error('not enough shards');
  plot.grown = plot.need;
  return { ...withFarm(profile, f), shards: profile.shards - FERTILIZER_SHARDS };
}

// ---------- Pens and critters ----------
export const ownedCritters = (farm) => Object.keys(farm.critters);
export const penSpace = (farm) => farm.pens - ownedCritters(farm).length;

/** Goodies waiting from one critter (capped at GOODY_MAX_CYCLES cycles). */
export function goodyCycles(profile, critterId) {
  const f = farmOf(profile);
  const c = f.critters[critterId];
  if (!c) return 0;
  const cycle = GOODY_SUN / stationSpeed(profile, 'pens');
  return Math.min(GOODY_MAX_CYCLES, Math.floor((f.clock - c.at) / cycle + 1e-9));
}

/**
 * Collect goodies from every critter. A tender with the critter's element
 * doubles what it makes. Each collect may bring a baby critter (a mix of two
 * you have) as the next visitor.
 */
export function collectGoodies(profile, now, rng = Math.random) {
  const f = clone(farmOf(profile));
  const elements = crewElements(f, 'pens');
  const collected = {};
  const events = [];
  let any = false;
  for (const id of Object.keys(f.critters)) {
    const cycles = goodyCycles(profile, id);
    if (!cycles) continue;
    any = true;
    const critter = CRITTERS_BY_ID[id];
    const per = elements.has(critter.element) ? 2 : 1;
    for (const g of critter.makes) {
      addItem(f, g, cycles * per);
      collected[g] = (collected[g] || 0) + cycles * per;
      gainXp(f, FARM_XP.goody * cycles, now, events);
    }
    f.critters[id] = { at: f.clock };
  }
  if (any) {
    const baby = babyCandidates(f)[0];
    if (baby && !f.visitor) {
      f.babyPity++;
      if (f.babyPity >= BABY_PITY || rng() < BABY_CHANCE) {
        f.visitor = { id: baby.id, baby: true };
        f.babyPity = 0;
        events.push({ type: 'baby', id: baby.id });
      }
    }
  }
  return { profile: withFarm(profile, f), collected, events };
}

/** Babies whose parents both live in your pens and that you don't have yet. */
export function babyCandidates(farm) {
  return CRITTERS.filter((c) => c.kind === 'baby' && !farm.critters[c.id] && c.parents.every((p) => farm.critters[p]));
}

/** Crops needed to befriend the current visitor (0 for babies). */
export function befriendCost(farm) {
  const v = farm.visitor && CRITTERS_BY_ID[farm.visitor.id];
  if (!v || farm.visitor.baby) return 0;
  return crewElements(farm, 'pens').has(v.element) ? LIKES_NEEDED - 1 : LIKES_NEEDED;
}

export function befriend(profile, now) {
  const f = clone(farmOf(profile));
  if (!f.visitor) throw new Error('no visitor');
  if (penSpace(f) <= 0) throw new Error('no pen space');
  const v = CRITTERS_BY_ID[f.visitor.id];
  const cost = befriendCost(f);
  if (cost) takeItems(f, { [v.likes]: cost });
  f.critters[v.id] = { at: f.clock };
  discover(f, 'critters', v.id);
  f.visitor = null;
  f.visitorAt = now;
  const events = [{ type: 'befriend', id: v.id }];
  gainXp(f, FARM_XP.befriend, now, events);
  return { profile: withFarm(profile, f), events: [...events, ...stampEvents(f)] };
}

/** Wave goodbye to a visitor; another comes later. */
export function waveBye(profile, now) {
  const f = clone(farmOf(profile));
  f.visitor = null;
  f.visitorAt = now;
  return withFarm(profile, f);
}

function pickVisitor(f, rng) {
  const wilds = CRITTERS.filter((c) => c.kind === 'wild' && biomeOpen(f, c.biome) && !f.critters[c.id]);
  return wilds.length ? wilds[Math.floor(rng() * wilds.length)] : null;
}

/** Hatch a Mystery Egg into an egg critter (or Star Dust once all are hatched). */
export function hatchEgg(profile, now, rng = Math.random) {
  const f = clone(farmOf(profile));
  if (!(f.eggs > 0)) throw new Error('no eggs');
  const left = CRITTERS.filter((c) => c.kind === 'egg' && !f.critters[c.id]);
  const events = [];
  if (!left.length) {
    f.eggs--;
    addItem(f, 'stardust', 3);
    events.push({ type: 'stardust', n: 3 });
    return { profile: withFarm(profile, f), events };
  }
  if (penSpace(f) <= 0) throw new Error('no pen space');
  f.eggs--;
  const c = left[Math.floor(rng() * left.length)];
  f.critters[c.id] = { at: f.clock };
  discover(f, 'critters', c.id);
  events.push({ type: 'hatch', id: c.id });
  return { profile: withFarm(profile, f), events: [...events, ...stampEvents(f)] };
}

// ---------- Forage ----------
function forageTotal(profile) {
  const f = farmOf(profile);
  const sun = Math.min(FORAGE_MAX_SUN, Math.max(0, f.clock - f.forageClock));
  return f.forageCarry + sun * FORAGE_PER_POWER_SUN * stationPower(profile, 'forage');
}
/** Forage items found so far (whole items) since the last pick-up, capped. */
export function forageWaiting(profile) {
  return Math.floor(forageTotal(profile) + 1e-9);
}

function forageFinds(f, n, rng) {
  const pool = openForage(f);
  const elements = crewElements(f, 'forage');
  const weighted = pool.map((x) => [x, elements.has(x.element) ? 3 : 1]);
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  const out = {};
  for (let i = 0; i < n; i++) {
    let r = rng() * total;
    const hit = weighted.find(([, w]) => (r -= w) < 0) || weighted[weighted.length - 1];
    out[hit[0].id] = (out[hit[0].id] || 0) + 1;
  }
  return out;
}

export function collectForage(profile, now, rng = Math.random) {
  const f = clone(farmOf(profile));
  const total = forageTotal(profile);
  const n = Math.floor(total + 1e-9);
  f.forageCarry = Math.max(0, total - n);
  f.forageClock = f.clock;
  const found = forageFinds(f, n, rng);
  const events = [];
  for (const [id, k] of Object.entries(found)) addItem(f, id, k);
  if (n) gainXp(f, n, now, events);
  return { profile: withFarm(profile, f), found, events: [...events, ...stampEvents(f)] };
}

// ---------- Workshop ----------
export function startCraft(profile, recipeId, now) {
  const f = clone(farmOf(profile));
  if (f.workshop) throw new Error('workshop busy');
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r || !biomeOpen(f, r.biome)) throw new Error('recipe not open');
  takeItems(f, r.needs);
  f.workshop = { recipe: r.id, grown: 0, need: r.sun };
  return withFarm(profile, f);
}

export function canCraft(farm, recipe) {
  return Object.entries(recipe.needs).every(([id, n]) => (farm.items[id] || 0) >= n);
}

/** Bring a finished craft out of the workshop; with sellNow it's sold for Grove Bells right away. */
export function collectCraft(profile, now, { sellNow = false } = {}) {
  const f = clone(farmOf(profile));
  if (!f.workshop || !plotReady(f.workshop)) throw new Error('not ready');
  const id = f.workshop.recipe;
  addItem(f, id, 1);
  f.workshop = null;
  const events = [];
  gainXp(f, FARM_XP.craft, now, events);
  let bells = 0;
  if (sellNow) {
    takeItems(f, { [id]: 1 });
    bells = GOODS_BY_ID[id].value;
    f.bells += bells;
  }
  return { profile: withFarm(profile, f), id, bells, events: [...events, ...stampEvents(f)] };
}

/** Grove Bells a recipe earns over selling its materials as they are. */
export const craftProfit = (recipe) => recipe.value - Object.entries(recipe.needs).reduce((sum, [id, n]) => sum + GOODS_BY_ID[id].value * n, 0);

// ---------- Requests and selling ----------
function availableGoods(f) {
  const goods = [...openCrops(f), ...openForage(f)];
  for (const id of ownedCritters(f)) for (const g of CRITTERS_BY_ID[id].makes) goods.push(GOODS_BY_ID[g]);
  if (farmLevel(f) >= 2) goods.push(...openRecipes(f));
  return [...new Map(goods.map((g) => [g.id, g])).values()];
}

export function makeRequest(profile, rng = Math.random) {
  const f = farmOf(profile);
  const goods = availableGoods(f);
  const kinds = Math.min(goods.length, rng() < 0.4 ? 2 : 1);
  const wants = {};
  const pool = [...goods];
  for (let i = 0; i < kinds; i++) {
    const g = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const n = g.kind === 'craft' ? 1 : g.kind === 'crop' ? 2 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
    wants[g.id] = n;
  }
  const value = Object.entries(wants).reduce((s, [id, n]) => s + GOODS_BY_ID[id].value * n, 0);
  const friends = Object.keys(profile.collection || {}).filter((id) => ITEMS_BY_ID[id]);
  const from = friends.length ? friends[Math.floor(rng() * friends.length)] : null;
  return { from, wants, bells: Math.round(value * REQUEST_BONUS) + 5 };
}

export function requestPay(profile, req) {
  const f = farmOf(profile);
  const onCrew = req.from && stationOf(f, req.from);
  return Math.round(req.bells * (onCrew ? 1 + REQUESTER_BONUS : 1));
}

export function fillRequest(profile, slot, now) {
  const f = clone(farmOf(profile));
  const req = f.requests[slot];
  if (!req) throw new Error('no request');
  takeItems(f, req.wants);
  const bells = requestPay(profile, req);
  f.bells += bells;
  f.requests[slot] = null;
  f.requestAt[slot] = now + REQUEST_EVERY;
  const events = [];
  const count = Object.values(req.wants).reduce((s, n) => s + n, 0);
  gainXp(f, FARM_XP.request + FARM_XP.perItem * count, now, events);
  return { profile: withFarm(profile, f), bells, events };
}

export function skipRequest(profile, slot, now) {
  const f = clone(farmOf(profile));
  f.requests[slot] = null;
  f.requestAt[slot] = now + REQUEST_EVERY;
  return withFarm(profile, f);
}

export function sell(profile, itemId, n = 1) {
  const f = clone(farmOf(profile));
  takeItems(f, { [itemId]: n });
  const bells = GOODS_BY_ID[itemId].value * n;
  f.bells += bells;
  return { profile: withFarm(profile, f), bells };
}

// ---------- Building ----------
const price = (profile, base) => Math.round(base * (1 - buildDiscount(profile)));

export function plotCost(profile) {
  const n = farmOf(profile).plots.length;
  return n >= MAX_PLOTS ? null : price(profile, PLOT_COSTS[n - START_PLOTS]);
}
export function nextPenCost(profile) {
  const f = farmOf(profile);
  return f.pens >= MAX_PENS ? null : price(profile, penCost(f.pens));
}
export function biomeCost(profile, biomeId) {
  return price(profile, BIOMES_BY_ID[biomeId].cost);
}
export function decorCost(profile, decorId) {
  const d = DECOR_BY_ID[decorId];
  return d.bells ? price(profile, d.bells) : d.shards || 0;
}

function spendBells(f, cost) {
  if (f.bells < cost) throw new Error('not enough bells');
  f.bells -= cost;
  f.halfOff = false;
}

export function buyPlot(profile) {
  const cost = plotCost(profile);
  if (cost == null) throw new Error('all plots built');
  const f = clone(farmOf(profile));
  spendBells(f, cost);
  f.plots.push(null);
  return withFarm(profile, f);
}

export function buyPen(profile) {
  const cost = nextPenCost(profile);
  if (cost == null) throw new Error('all pens built');
  const f = clone(farmOf(profile));
  spendBells(f, cost);
  f.pens++;
  return withFarm(profile, f);
}

/** Why a biome can't open yet, or null if it can. */
export function biomeBlock(profile, biomeId) {
  const f = farmOf(profile);
  const b = BIOMES_BY_ID[biomeId];
  if (biomeOpen(f, biomeId)) return 'open';
  if (farmLevel(f) < b.level) return 'level';
  if (b.elements.length && !b.elements.some((e) => crewElements(f, 'build').has(e))) return 'element';
  if (f.bells < biomeCost(profile, biomeId)) return 'bells';
  return null;
}

export function openBiome(profile, biomeId, now) {
  const block = biomeBlock(profile, biomeId);
  if (block) throw new Error(`can't open: ${block}`);
  const f = clone(farmOf(profile));
  spendBells(f, biomeCost(profile, biomeId));
  f.biomes.push(biomeId);
  f.visitorAt = Math.min(f.visitorAt, now - VISITOR_EVERY); // a new critter shows up
  return withFarm(profile, f);
}

export function buyDecor(profile, decorId) {
  const d = DECOR_BY_ID[decorId];
  if (!d || d.stamp) throw new Error('not for sale');
  const f = clone(farmOf(profile));
  if (f.decor.includes(decorId)) throw new Error('already have it');
  if (d.shards) {
    if ((profile.shards || 0) < d.shards) throw new Error('not enough shards');
    f.decor.push(decorId);
    return { ...withFarm(profile, f), shards: profile.shards - d.shards };
  }
  spendBells(f, decorCost(profile, decorId));
  f.decor.push(decorId);
  return withFarm(profile, f);
}

// ---------- Journal ----------
export function journalProgress(farm, page) {
  const entries = JOURNAL_PAGES[page].entries;
  const found = entries.filter((e) => (farm.journal[page] || []).includes(e.id)).length;
  return { found, total: entries.length, complete: found === entries.length };
}
/** Award stamps (and their decorations) for newly finished pages. Mutates f. */
function stampEvents(f) {
  const events = [];
  for (const page of Object.keys(JOURNAL_PAGES)) {
    if (f.stamps.includes(page) || !journalProgress(f, page).complete) continue;
    f.stamps.push(page);
    const prize = Object.values(DECOR_BY_ID).find((d) => d.stamp === page);
    if (prize && !f.decor.includes(prize.id)) f.decor.push(prize.id);
    events.push({ type: 'stamp', page });
  }
  return events;
}

// ---------- Perks ----------
export function perkUsesLeft(profile, friendId, now) {
  const trait = farmTrait(friendId);
  if (!trait?.perk) return 0;
  const f = farmOf(profile);
  const info = friendInfo(profile, friendId);
  const max = trait.perkUses + (info.gold ? 1 : 0) + (info.stage.bonus >= 2 ? 1 : 0);
  const used = f.perks.day === dayKey(now) ? f.perks.used[friendId] || 0 : 0;
  return Math.max(0, max - used);
}

export function usePerk(profile, friendId, now, rng = Math.random) {
  const f0 = farmOf(profile);
  if (!stationOf(f0, friendId)) throw new Error('put this friend on a crew first');
  if (perkUsesLeft(profile, friendId, now) <= 0) throw new Error('used up today');
  const job = farmTrait(friendId).job;
  const f = clone(f0);
  const events = [];
  if (job === 'grower') {
    const i = f.plots.findIndex((p) => p && !plotReady(p));
    if (i < 0) throw new Error('nothing growing');
    f.plots[i].grown = f.plots[i].need;
  } else if (job === 'tender') {
    if (f.visitor) throw new Error('a critter is already visiting');
    const v = pickVisitor(f, rng);
    if (!v) throw new Error('no wild critters left to meet here');
    f.visitor = { id: v.id };
    events.push({ type: 'visitor', id: v.id });
  } else if (job === 'gatherer') {
    const found = forageFinds(f, 3, rng);
    for (const [id, k] of Object.entries(found)) addItem(f, id, k);
    events.push({ type: 'found', found });
  } else if (job === 'crafter') {
    if (!f.workshop || plotReady(f.workshop)) throw new Error('nothing in the workshop');
    f.workshop.grown = f.workshop.need;
  } else if (job === 'builder') {
    if (f.halfOff) throw new Error('your next build is already half price');
    f.halfOff = true;
  }
  const today = dayKey(now);
  if (f.perks.day !== today) f.perks = { day: today, used: {} };
  f.perks.used[friendId] = (f.perks.used[friendId] || 0) + 1;
  return { profile: withFarm(profile, f), events: [...events, ...stampEvents(f)] };
}

// ---------- Mastery treasures ----------
/** Everything mastered so far, across spelling, math and Word Match. */
export function masteryCount(profile) {
  const n = (srs) => Object.values(srs || {}).filter((i) => i?.masteredAt != null).length;
  return n(profile.srs) + n(profile.math?.srs) + n(profile.vocab?.srs);
}
/** Mystery Eggs earned: one per Legendary friend and one per finished theme. */
export function eggCount(profile) {
  const legends = Object.keys(profile.collection || {}).filter((id) => ITEMS_BY_ID[id]?.rarity === 'legendary').length;
  return legends + (profile.completedSets || []).length;
}

// ---------- Sunshine ----------
export const expeditionSpeed = (e) => 1 + NEED_SPEED * (e.met || 0);

/**
 * Pour Sunshine from the Sun Jar into the farm. Every crop, craft and
 * expedition in progress fills up at once, each at its crew's speed right now
 * (so a Grower added after planting still helps), and critters and forage move
 * along too. With no amount it pours just what's useful, so the rest stays in
 * the jar. Each Sunshine poured is also 1 farm XP: learning grows the farm.
 */
export function pourSun(profile, amount = null, now = Date.now()) {
  if (!sunJar(profile)) throw new Error('the Sun Jar is empty');
  const useful = sunUseful(profile);
  if (amount == null && !useful) throw new Error('plant something or send an expedition first, so the Sunshine has something to grow');
  const n = Math.min(sunJar(profile), Math.max(0, Math.ceil((amount ?? useful) - 1e-9)));
  if (!n) throw new Error('nothing to pour');
  const f = clone(farmOf(profile));
  const grow = (x, speed) => {
    if (x && !plotReady(x)) x.grown = Math.min(x.need, x.grown + n * speed);
  };
  const fields = stationSpeed(profile, 'fields');
  for (const pl of f.plots) grow(pl, fields);
  grow(f.workshop, stationSpeed(profile, 'workshop'));
  for (const e of f.expeditions) grow(e, expeditionSpeed(e));
  f.clock += n;
  const events = [];
  const onTrip = new Set(f.expeditions.flatMap((e) => e.team));
  for (const id of Object.keys(profile.collection || {})) {
    if (!ITEMS_BY_ID[id] || onTrip.has(id)) continue;
    const st = stationOf(f, id);
    const h = editHand(f, id);
    if (!st) {
      if (h.energy < ENERGY_MAX) h.energy = Math.min(ENERGY_MAX, h.energy + n * ENERGY_REST);
      continue;
    }
    const worked = Math.min(n, h.energy / ENERGY_USE);
    h.energy = Math.max(0, h.energy - n * ENERGY_USE);
    h.jobs[st] = (h.jobs[st] || 0) + n;
    if (worked > 0) rankUp(f, id, Math.round(worked), events);
  }
  gainXp(f, n * FARM_XP.sun, now, events);
  return { profile: { ...withFarm(profile, f), sunJar: sunJar(profile) - n }, poured: n, events };
}

/**
 * The most Sunshine that still does something right now: finishing what's
 * growing, filling critters' goodies and the forage basket. Pouring stops
 * there, so Sunshine is never wasted.
 */
export function sunUseful(profile) {
  const f = farmOf(profile);
  let need = sunToFinish(profile);
  const pens = stationSpeed(profile, 'pens');
  for (const c of Object.values(f.critters)) need = Math.max(need, (GOODY_SUN * GOODY_MAX_CYCLES) / pens - (f.clock - c.at));
  if (stationPower(profile, 'forage') > 0) need = Math.max(need, FORAGE_MAX_SUN - (f.clock - f.forageClock));
  return Math.max(0, Math.ceil(need - 1e-9));
}

/**
 * The least Sunshine that finishes something: the next crop, craft or
 * expedition. Returns { n, kind, id } or null when nothing is growing.
 */
export function sunToNext(profile) {
  const f = farmOf(profile);
  const fields = stationSpeed(profile, 'fields');
  const options = [
    ...f.plots.map((pl) => pl && { n: sunLeft(pl, fields), kind: 'crop', id: pl.crop }),
    f.workshop && { n: sunLeft(f.workshop, stationSpeed(profile, 'workshop')), kind: 'craft', id: f.workshop.recipe },
    ...f.expeditions.map((e) => ({ n: sunLeft(e, expeditionSpeed(e)), kind: 'trip', id: e.route })),
  ].filter((x) => x && x.n > 0);
  if (!options.length) return null;
  return options.reduce((a, b) => (b.n < a.n ? b : a));
}

/** Sunshine still needed before everything now growing is done (0 if nothing). */
export function sunToFinish(profile) {
  const f = farmOf(profile);
  const fields = stationSpeed(profile, 'fields');
  const left = [
    ...f.plots.map((p) => sunLeft(p, fields)),
    sunLeft(f.workshop, stationSpeed(profile, 'workshop')),
    ...f.expeditions.map((e) => sunLeft(e, expeditionSpeed(e))),
  ];
  return Math.max(0, ...left);
}

/**
 * Things to do before pouring so no Sunshine is wasted: empty plots, nobody
 * on the Fields crew, an idle workshop, a free expedition team. The kid can
 * still pour anyway.
 */
export function pourTips(profile) {
  const f = farmOf(profile);
  const tips = [];
  const empty = f.plots.filter((p) => !p).length;
  if (empty) tips.push({ id: 'plots', text: `${empty} empty plot${empty > 1 ? 's' : ''}: plant first so they grow too` });
  if (f.plots.some((p) => p && !plotReady(p)) && !f.crew.fields.length) tips.push({ id: 'growers', text: 'nobody on the Fields crew: crops grow faster with friends there' });
  if (!f.workshop && RECIPES.some((r) => biomeOpen(f, r.biome) && canCraft(f, r))) tips.push({ id: 'workshop', text: 'the workshop is free and you can make something' });
  const tired = STATION_IDS.flatMap((st) => f.crew[st]).filter((id) => isTired(f, id)).length;
  if (tired) tips.push({ id: 'tired', text: `${tired} friend${tired > 1 ? 's are' : ' is'} too tired to learn: swap in rested friends` });
  const openRoute = (f.routes?.list || []).some((r) => !r.done);
  if (f.expeditions.length < expeditionSlots(f) && openRoute && benchFriends(profile).length >= 3) tips.push({ id: 'trips', text: 'a team could go on an expedition' });
  return tips;
}

// ---------- Golden Season ----------
const doneItem = (i, now) => Boolean(i) && i.masteredAt != null && i.box >= MAX_BOX && !needsRefresh(i, now);

/**
 * True when there's nothing left to learn right now: every spelling word,
 * counted math fact and Word Match word is mastered and none needs a refresh.
 * Then the farm grows on its own (Jason: no gate for a kid who has mastered
 * everything).
 */
export function goldenSeason(profile, now) {
  const words = profile.words || [];
  if (!words.every((w) => doneItem(profile.srs?.[w.id], now))) return false;
  const msrs = profile.math?.srs || {};
  for (const op of ['mul', 'div']) if (!trackedFacts(op).every((f) => doneItem(msrs[f.id], now))) return false;
  const vocab = Object.values(profile.vocab?.srs || {});
  if (!vocab.length || !vocab.every((i) => doneItem(i, now))) return false;
  return true;
}

// ---------- Expeditions ----------
export const EXPEDITION_SUN = { short: 15, big: 40 };
export const TEAM_SIZE_FOR = { short: 3, big: 6 };
export const NEED_SPEED = 0.25; // each need met: +25% speed
export const EXPEDITION_SHARDS = { short: 3, big: 8 };
export const EXPEDITION_BELLS = { short: 15, big: 40 };
export const EXPLORER_CHANCE = 0.3;
export const EXPLORER_PITY = 3; // big trips on a route before its critter is guaranteed
export const FARM_XP_TRIP = { short: 8, big: 16 };

export function expeditionSlots(farm) {
  const level = farmLevel(farm);
  return level >= 10 ? 4 : level >= 5 ? 3 : 2;
}
/** Routes you can go on: every route in an open land. */
export const openRoutes = (farm) => ROUTES.filter((r) => biomeOpen(farm, r.land));

function seedFor(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Today's needs for one route: the same all day, different each day. */
export function routeNeeds(profile, routeId, day) {
  const r = ROUTES_BY_ID[routeId];
  const rng = mulberry32(seedFor(`${profile.id}|${day}|${routeId}`));
  const themes = themesOpen().map((t) => t.id);
  const kinds = ['element', 'job', 'theme'];
  const needs = [];
  for (let i = 0; i < (r.size === 'big' ? 3 : 2); i++) {
    const kind = kinds.splice(Math.floor(rng() * kinds.length), 1)[0];
    if (kind === 'element') needs.push({ kind, value: ELEMENT_IDS[Math.floor(rng() * ELEMENT_IDS.length)], n: r.size === 'big' ? 2 : 1 });
    else if (kind === 'job') needs.push({ kind, value: JOB_IDS[Math.floor(rng() * JOB_IDS.length)], n: 1 });
    else needs.push({ kind, value: themes[Math.floor(rng() * themes.length)], n: 2 });
  }
  return needs;
}

/** Make sure every open route is on today's list (new day: all fresh). Mutates f. */
function refreshRoutes(profile, f, day) {
  if (!f.routes || f.routes.day !== day) f.routes = { day, list: [] };
  for (const r of openRoutes(f)) {
    if (!f.routes.list.some((x) => x.route === r.id)) f.routes.list.push({ route: r.id, needs: routeNeeds(profile, r.id, day), done: false });
  }
}

/** Does a friend count toward a need? */
export function fitsNeed(id, need) {
  const t = farmTrait(id);
  const item = ITEMS_BY_ID[id];
  if (!t || !item) return false;
  if (need.kind === 'element') return t.element === need.value;
  if (need.kind === 'job') return t.job === need.value;
  return item.theme === need.value;
}
export function needsMet(team, needs) {
  return needs.filter((n) => team.filter((id) => fitsNeed(id, n)).length >= n.n).length;
}

/** Friends who are free for an expedition: owned, not on a crew, not already out. */
export function benchFriends(profile) {
  const f = farmOf(profile);
  const busy = new Set([...STATION_IDS.flatMap((s) => f.crew[s]), ...f.expeditions.flatMap((e) => e.team)]);
  return Object.keys(profile.collection || {}).filter((id) => ITEMS_BY_ID[id] && farmTrait(id) && !busy.has(id));
}

export function sendExpedition(profile, routeIndex, team, now) {
  const f = clone(farmOf(profile));
  const r = f.routes.list[routeIndex];
  if (!r || r.done) throw new Error('that route is done for today');
  const route = ROUTES_BY_ID[r.route];
  if (f.expeditions.length >= expeditionSlots(f)) throw new Error('all teams are out');
  const size = TEAM_SIZE_FOR[route.size];
  const unique = [...new Set(team)];
  if (unique.length !== size) throw new Error(`pick ${size} friends`);
  const free = new Set(benchFriends(profile));
  if (!unique.every((id) => free.has(id))) throw new Error('a friend is busy');
  const met = needsMet(unique, r.needs);
  for (const id of unique) {
    const h = editHand(f, id);
    h.energy = Math.max(0, h.energy - TRIP_ENERGY[route.size]);
  }
  f.expeditions.push({ route: route.id, team: unique, grown: 0, need: EXPEDITION_SUN[route.size], met, size: route.size });
  r.done = true;
  return withFarm(profile, f);
}

const STORY = {
  short: [
    '{a}, {b} and {c} followed a trail to {r} and came home giggling with {t}.',
    '{a} led the way to {r}, {b} kept everyone singing, and {c} spotted {t} first.',
    'At {r}, {a} tripped over a root, {b} caught them, and {c} found {t} right there.',
  ],
  big: [
    'It was a long trip to {r}! {a} read the map, {b} carried snacks, and the whole team of six found {t}.',
    '{a} and {b} built a raft, {c} steered all the way to {r}, and everyone came back with {t}.',
    'A storm rolled over {r}, but {a} found shelter, {b} told stories, and {c} discovered {t}.',
  ],
};

/** Where a friend is on the farm: a station id, 'trip', or null (resting). */
export function whereIs(farm, id) {
  if (farm.expeditions.some((e) => e.team.includes(id))) return 'trip';
  return stationOf(farm, id);
}

/** The explorer critter that lives on a route (big trips only). */
export const routeExplorer = (routeId) => EXPLORERS.find((c) => c.route === routeId) || null;

/** Bring a finished expedition home. Returns { profile, rewards, story, events }. */
export function collectExpedition(profile, index, now, rng = Math.random) {
  const f = clone(farmOf(profile));
  const e = f.expeditions[index];
  if (!e || !plotReady(e)) throw new Error('not back yet');
  const route = ROUTES_BY_ID[e.route];
  const treasure = route.treasure;
  const n = (e.size === 'big' ? 2 : 1) + e.met * (e.size === 'big' ? 2 : 1);
  addItem(f, treasure.id, n);
  discover(f, 'explore', treasure.id);
  const bells = EXPEDITION_BELLS[e.size];
  f.bells += bells;
  const events = [];
  if (!f.souvenirs.includes(route.souvenir.id)) {
    f.souvenirs.push(route.souvenir.id);
    discover(f, 'explore', route.souvenir.id);
    events.push({ type: 'souvenir', id: route.id });
  }
  const ex = routeExplorer(route.id);
  if (ex && !f.critters[ex.id] && !f.waiting.includes(ex.id)) {
    f.explorerPity[route.id] = (f.explorerPity[route.id] || 0) + 1;
    if (f.explorerPity[route.id] >= EXPLORER_PITY || rng() < EXPLORER_CHANCE) {
      f.waiting.push(ex.id);
      events.push({ type: 'explorer', id: ex.id });
    }
  }
  const names = e.team.map((id) => ITEMS_BY_ID[id].name);
  const lines = STORY[e.size];
  const story = lines[Math.floor(rng() * lines.length)]
    .replace('{a}', names[0]).replace('{b}', names[1]).replace('{c}', names[2]).replace('{r}', route.name)
    .replace('{t}', `${n} ${treasure.name}${n > 1 && !/[sy]$/.test(treasure.name) ? 's' : ''}`);
  f.stories = [{ route: route.id, text: story, team: e.team }, ...f.stories].slice(0, 20);
  f.expeditions.splice(index, 1);
  for (const id of e.team) rankUp(f, id, EXPEDITION_SUN[e.size], events);
  gainXp(f, FARM_XP_TRIP[e.size], now, events);
  const shards = EXPEDITION_SHARDS[e.size];
  const next = { ...withFarm(profile, f), shards: (profile.shards || 0) + shards };
  return { profile: next, rewards: { treasure: treasure.id, n, bells, shards }, story, events: [...events, ...stampEvents(f)] };
}

/** Move an explorer critter that was waiting for room into a pen. */
export function welcomeExplorer(profile, critterId) {
  const f = clone(farmOf(profile));
  if (!f.waiting.includes(critterId)) throw new Error('nobody waiting');
  if (penSpace(f) <= 0) throw new Error('no pen space');
  f.waiting = f.waiting.filter((id) => id !== critterId);
  f.critters[critterId] = { at: f.clock };
  discover(f, 'critters', critterId);
  return { profile: withFarm(profile, f), events: [{ type: 'befriend', id: critterId }, ...stampEvents(f)] };
}

// ---------- Visits: catch the farm up to now ----------
/**
 * Run when the farm opens (and on each farm action): claim treasures from
 * learning, bring a visitor, refill the request board, open gifts. Idempotent
 * for a given `now`.
 */
export function visitFarm(profile, now, rng = Math.random) {
  const f = upgrade(clone(profile.farm || newFarm(now)), now);
  const events = [];
  let jar = sunJar(profile);
  // Morning Rain: a little free Sunshine on the first visit each day.
  const today = dayKey(now);
  if (f.rainDay !== today) {
    f.rainDay = today;
    jar += MORNING_RAIN;
    for (const h of Object.values(f.hands || {})) h.energy = Math.min(ENERGY_MAX, h.energy + MORNING_ENERGY);
    events.push({ type: 'rain', n: MORNING_RAIN });
  }
  // Golden Season: nothing left to learn, so the farm grows on its own.
  if (goldenSeason(profile, now)) {
    const n = Math.min(GOLDEN_MAX, Math.floor(Math.max(0, now - (f.goldenAt ?? now)) / GOLDEN_EVERY));
    if (n) {
      jar += n;
      f.goldenAt = now;
      events.push({ type: 'golden', n });
    }
  } else {
    f.goldenAt = now;
  }
  refreshRoutes(profile, f, today);
  // Learning feeds the farm: one Wonder Seed per mastery, an egg per set.
  const mastered = masteryCount(profile);
  if (mastered > f.claimed.mastery) {
    events.push({ type: 'seeds', n: mastered - f.claimed.mastery });
    f.wonderSeeds += mastered - f.claimed.mastery;
    f.claimed.mastery = mastered;
  }
  const eggs = eggCount(profile);
  if (eggs > f.claimed.eggs) {
    events.push({ type: 'eggs', n: eggs - f.claimed.eggs });
    f.eggs += eggs - f.claimed.eggs;
    f.claimed.eggs = eggs;
  }
  // Friends that left the collection (shouldn't happen) leave crews too.
  for (const s of STATION_IDS) f.crew[s] = f.crew[s].filter((id) => profile.collection?.[id]);
  // A wild critter wanders in now and then.
  if (!f.visitor && now - f.visitorAt >= VISITOR_EVERY) {
    const v = pickVisitor(f, rng);
    if (v) {
      f.visitor = { id: v.id };
      events.push({ type: 'visitor', id: v.id });
    }
  }
  // Refill empty request slots.
  let next = withFarm(profile, f);
  for (let i = 0; i < REQUEST_SLOTS; i++) {
    if (!f.requests[i] && now >= f.requestAt[i]) f.requests[i] = makeRequest(next, rng);
  }
  // Gifts from siblings.
  for (const g of f.inbox) {
    addItem(f, g.item, g.n);
    f.bells += GIFT_THANKS;
    events.push({ type: 'gift', ...g });
  }
  f.inbox = [];
  next = { ...withFarm(profile, f), sunJar: jar };
  return { profile: next, events: [...events, ...stampEvents(f)] };
}

// ---------- Sibling gifts (same device) ----------
export function canGift(sender, receiverId, now) {
  const g = farmOf(sender).gifts;
  return !(g.day === dayKey(now) && g.to.includes(receiverId));
}

/** Send up to GIFT_MAX of one item to a sibling, once a day each. Returns both profiles. */
export function sendGift(sender, receiver, itemId, n, now) {
  if (sender.id === receiver.id) throw new Error('pick someone else');
  if (!canGift(sender, receiver.id, now)) throw new Error('already sent a gift today');
  const count = Math.max(1, Math.min(GIFT_MAX, n));
  const f = clone(farmOf(sender));
  takeItems(f, { [itemId]: count });
  const today = dayKey(now);
  if (f.gifts.day !== today) f.gifts = { day: today, to: [] };
  f.gifts.to.push(receiver.id);
  const r = clone(receiver.farm || newFarm(now));
  r.inbox.push({ from: sender.name, item: itemId, n: count });
  return { sender: withFarm(sender, f), receiver: withFarm(receiver, r) };
}

// ---------- Parent setting: farm after learning ----------
/** True if the kid answered something today (any game). */
export function learnedToday(profile, now) {
  const today = dayKey(now);
  if (profile.coinDay?.day === today) return true;
  return Object.values(profile.friends || {}).some((s) => s?.day === today);
}
export function farmLocked(profile, now) {
  return Boolean(profile.farmGate) && !learnedToday(profile, now);
}

export { BIOMES, CROPS, CRITTERS, RECIPES, FORAGE };
