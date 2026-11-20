// Friend Grove content: farm traits for every friend, biomes, crops,
// critters, forage, recipes and decorations. Emoji art, like the rest.
import { THEMES, LEGENDS, ITEMS_BY_ID } from './content.js';

// ---------- Farm traits ----------
// Every friend has a farm job (where it works best) and an element (which
// crops, critters and biomes it's good with). Rare and better friends also get
// a once-a-day perk that comes from their job.
export const JOBS = {
  grower: { id: 'grower', name: 'Grower', emoji: '🌱', station: 'fields' },
  tender: { id: 'tender', name: 'Tender', emoji: '🐾', station: 'pens' },
  gatherer: { id: 'gatherer', name: 'Gatherer', emoji: '🧺', station: 'forage' },
  crafter: { id: 'crafter', name: 'Crafter', emoji: '🔨', station: 'workshop' },
  builder: { id: 'builder', name: 'Builder', emoji: '🪚', station: 'build' },
};
export const JOB_IDS = Object.keys(JOBS);

export const ELEMENTS = {
  sun: { id: 'sun', name: 'Sun', emoji: '☀️' },
  water: { id: 'water', name: 'Water', emoji: '💧' },
  earth: { id: 'earth', name: 'Earth', emoji: '🪨' },
  frost: { id: 'frost', name: 'Frost', emoji: '❄️' },
  glow: { id: 'glow', name: 'Glow', emoji: '✨' },
  wind: { id: 'wind', name: 'Wind', emoji: '🍃' },
};
export const ELEMENT_IDS = Object.keys(ELEMENTS);

// Each job's perk (rare and better friends, while on a crew).
export const PERKS = {
  grower: { name: 'Sunburst', emoji: '🌞', describe: 'finishes growing one crop right now' },
  tender: { name: 'Critter Call', emoji: '📣', describe: 'calls a wild critter to visit right now' },
  gatherer: { name: 'Treasure Hunt', emoji: '🗺️', describe: 'finds 3 forage items right now' },
  crafter: { name: 'Quick Hands', emoji: '⚡', describe: 'finishes the workshop job right now' },
  builder: { name: 'Barn Raising', emoji: '🏗️', describe: 'makes your next build half price' },
};

// Each theme leans toward one element; a third of its friends share it.
const THEME_ELEMENT = {
  ocean: 'water', space: 'glow', forest: 'earth', farm: 'sun', sweets: 'wind', winter: 'frost', dinos: 'earth',
  hearts: 'wind', garden: 'sun', jungle: 'water', beach: 'sun', magic: 'glow',
};

const TRAITS = {};
THEMES.forEach((t, ti) => {
  const home = THEME_ELEMENT[t.id] || ELEMENT_IDS[ti % ELEMENT_IDS.length];
  t.items.forEach((item, i) => {
    TRAITS[item.id] = {
      job: JOB_IDS[(i + ti) % JOB_IDS.length],
      element: i % 3 === 0 ? home : ELEMENT_IDS[(i * 5 + ti * 2) % ELEMENT_IDS.length],
    };
  });
});
LEGENDS.forEach((l, i) => {
  TRAITS[l.id] = { job: JOB_IDS[i % JOB_IDS.length], element: ELEMENT_IDS[(i * 7 + 1) % ELEMENT_IDS.length] };
});

const PERK_USES = { common: 0, rare: 1, epic: 1, ultra: 2, legendary: 2 };

/** A friend's farm trait: { job, element, perk|null, perkUses }. */
export function farmTrait(id) {
  const t = TRAITS[id];
  const item = ITEMS_BY_ID[id];
  if (!t || !item) return null;
  const uses = PERK_USES[item.rarity] || 0;
  return { ...t, perk: uses ? PERKS[t.job] : null, perkUses: uses };
}

// ---------- Biomes ----------
// from: the day a land arrives (with that month's friend theme), so the Grove
// grows over the school year however fast a kid plays (Jason, 2026-11-20).
// level: farm level needed. cost: Grove Bells. elements: a friend of one of
// these elements must be on the build crew to open it.
export const BIOMES = [
  { id: 'meadow', name: 'Sunny Meadow', emoji: '🌼', level: 1, cost: 0, elements: [] },
  { id: 'frost', name: 'Frost Ridge', emoji: '🏔️', level: 3, cost: 120, elements: ['frost', 'wind'], from: '2027-01-04' },
  { id: 'tide', name: 'Tide Pools', emoji: '🌊', level: 6, cost: 300, elements: ['water', 'sun'], from: '2027-03-01' },
  { id: 'caves', name: 'Glow Caves', emoji: '🕯️', level: 10, cost: 600, elements: ['glow', 'earth'], from: '2027-04-05' },
  { id: 'cloud', name: 'Cloud Garden', emoji: '☁️', level: 15, cost: 1000, elements: ['wind', 'sun'], from: '2027-05-03' },
];
export const BIOMES_BY_ID = Object.fromEntries(BIOMES.map((b) => [b.id, b]));

// ---------- Things you can have (crops, goodies, forage, crafts) ----------
// value: Grove Bells when sold. sun: Sunshine it takes to grow or craft.
const crop = (id, name, emoji, element, biome, sun, value) => ({ id, name, emoji, kind: 'crop', element, biome, sun, value });
export const CROPS = [
  crop('carrot', 'Carrot', '🥕', 'earth', 'meadow', 3, 4),
  crop('corn', 'Corn', '🌽', 'sun', 'meadow', 6, 8),
  crop('strawberry', 'Strawberry', '🍓', 'water', 'meadow', 10, 14),
  crop('lettuce', 'Ice Lettuce', '🥬', 'frost', 'frost', 5, 8),
  crop('blueberry', 'Snowberry', '🫐', 'wind', 'frost', 14, 18),
  crop('grapes', 'Sea Grapes', '🍇', 'water', 'tide', 6, 11),
  crop('rice', 'Tide Rice', '🌾', 'water', 'tide', 10, 15),
  crop('coconut', 'Coconut', '🥥', 'sun', 'tide', 20, 26),
  crop('mushroom', 'Glowshroom', '🍄', 'glow', 'caves', 5, 10),
  crop('pepper', 'Moon Pepper', '🌶️', 'glow', 'caves', 9, 17),
  crop('melon', 'Star Melon', '🍈', 'earth', 'caves', 16, 28),
  crop('puffcorn', 'Puffcorn', '🍿', 'wind', 'cloud', 7, 14),
  crop('peach', 'Sky Peach', '🍑', 'wind', 'cloud', 13, 24),
  crop('bloom', 'Rainbow Bloom', '🌸', 'sun', 'cloud', 24, 40),
];

// Wonder crops only grow from Wonder Seeds, which come from mastering.
export const WONDER_SUN = 8;
const wonder = (id, name, emoji, value) => ({ id, name, emoji, kind: 'wonder', sun: WONDER_SUN, value });
export const WONDER_CROPS = [
  wonder('w-pumpkin', 'Golden Pumpkin', '🎃', 50),
  wonder('w-apple', 'Ruby Apple', '🍎', 50),
  wonder('w-pear', 'Moon Pear', '🍐', 50),
  wonder('w-lemon', 'Sun Lemon', '🍋', 50),
  wonder('w-mango', 'Dream Mango', '🥭', 50),
  wonder('w-cherry', 'Twin Cherries', '🍒', 50),
];

const forage = (id, name, emoji, element, biome, value) => ({ id, name, emoji, kind: 'forage', element, biome, value });
export const FORAGE = [
  forage('acorn', 'Acorn', '🌰', 'earth', 'meadow', 5),
  forage('daisy', 'Wildflower', '🌼', 'sun', 'meadow', 5),
  forage('crystal', 'Snow Crystal', '💠', 'frost', 'frost', 9),
  forage('shell', 'Seashell', '🐚', 'water', 'tide', 10),
  forage('glowstone', 'Glow Stone', '🔮', 'glow', 'caves', 14),
  forage('cloudpuff', 'Cloud Puff', '🌫️', 'wind', 'cloud', 16),
];

// Critters: wild visitors you befriend with their favorite crop. They live in
// pens and make goodies over time.
const goody = (id, name, emoji, value) => ({ id, name, emoji, kind: 'goody', value });
export const GOODIES = [
  goody('wool', 'Wool', '🧶', 8),
  goody('honey', 'Honey', '🍯', 10),
  goody('icicle', 'Icicle', '🧊', 12),
  goody('cheese', 'Cheese', '🧀', 14),
  goody('feather', 'Feather', '🪶', 14),
  goody('pearl', 'Bubble Pearl', '🫧', 18),
  goody('dust', 'Glow Dust', '✨', 20),
  goody('goo', 'Glow Goo', '💚', 20),
  goody('silk', 'Dream Silk', '🧵', 24),
  goody('note', 'Song Note', '🎵', 24),
  goody('stardust', 'Star Dust', '🌟', 45),
];


// kind: 'wild' (visits, befriend with `likes`), 'baby' (a mix of two critters
// in your pens), 'egg' (hatches from a Mystery Egg, earned by mastering sets).
const wild = (id, name, emoji, element, biome, likes, makes) => ({ id, name, emoji, element, biome, likes, makes: [makes], kind: 'wild' });
export const CRITTERS = [
  wild('fluffle', 'Fluffle', '🐑', 'earth', 'meadow', 'carrot', 'wool'),
  wild('buzzby', 'Buzzby', '🐝', 'sun', 'meadow', 'corn', 'honey'),
  wild('flurry', 'Flurry', '🦊', 'frost', 'frost', 'lettuce', 'icicle'),
  wild('bleats', 'Bleats', '🐐', 'wind', 'frost', 'blueberry', 'cheese'),
  wild('puddles', 'Puddles', '🦆', 'water', 'tide', 'rice', 'feather'),
  wild('snapper', 'Snapper', '🦞', 'water', 'tide', 'grapes', 'pearl'),
  wild('glimmer', 'Glimmer', '🦇', 'glow', 'caves', 'pepper', 'dust'),
  wild('nibbles', 'Nibbles', '🐌', 'earth', 'caves', 'mushroom', 'goo'),
  wild('flutter', 'Flutter', '🦋', 'wind', 'cloud', 'peach', 'silk'),
  wild('tweet', 'Tweet', '🐦', 'sun', 'cloud', 'puffcorn', 'note'),
];
const baby = (id, name, emoji, parents) => ({ id, name, emoji, parents, kind: 'baby' });
const BABIES = [
  baby('bumblefluff', 'Bumblefluff', '🐻', ['fluffle', 'buzzby']),
  baby('snowfleece', 'Snowfleece', '🐏', ['fluffle', 'flurry']),
  baby('quackhorn', 'Quackhorn', '🦌', ['bleats', 'puddles']),
  baby('glowgator', 'Glowgator', '🐊', ['snapper', 'glimmer']),
  baby('skipper', 'Skipper', '🦗', ['nibbles', 'flutter']),
  baby('moonwing', 'Moonwing', '🦉', ['glimmer', 'tweet']),
];
const egg = (id, name, emoji, element) => ({ id, name, emoji, element, makes: ['stardust'], kind: 'egg' });
const EGGS = [
  egg('starbun', 'Starbun', '🐇', 'glow'),
  egg('embercheep', 'Embercheep', '🐥', 'sun'),
  egg('puffwhale', 'Puffwhale', '🐋', 'water'),
  egg('jewelbug', 'Jewelbug', '🐞', 'earth'),
];
// Explorer critters (one per land) are defined with the routes below.
CRITTERS.push(...BABIES, ...EGGS);
export const CRITTERS_BY_ID = Object.fromEntries(CRITTERS.map((c) => [c.id, c]));
// Babies make both parents' goodies, and take the first parent's element and biome.
for (const b of BABIES) {
  const [a, z] = b.parents.map((id) => CRITTERS_BY_ID[id]);
  b.makes = [a.makes[0], z.makes[0]];
  b.element = a.element;
  b.biome = z.biome;
}

const craft = (id, name, emoji, biome, needs, sun, value) => ({ id, name, emoji, kind: 'craft', biome, needs, sun, value });
export const RECIPES = [
  craft('bread', 'Honey Bread', '🍞', 'meadow', { corn: 2, honey: 1 }, 5, 40),
  craft('basket', 'Picnic Basket', '🧺', 'meadow', { carrot: 2, strawberry: 1, acorn: 2 }, 7, 60),
  craft('sweater', 'Cozy Sweater', '🧥', 'meadow', { wool: 3, daisy: 1 }, 8, 55),
  craft('slushie', 'Berry Slush', '🍧', 'frost', { blueberry: 2, icicle: 1 }, 6, 70),
  craft('fondue', 'Cheese Fondue', '🫕', 'frost', { cheese: 2, lettuce: 2 }, 8, 75),
  craft('riceball', 'Rice Ball', '🍙', 'tide', { rice: 2, grapes: 1 }, 5, 55),
  craft('chime', 'Shell Chime', '🎐', 'tide', { shell: 3, feather: 1 }, 8, 85),
  craft('lantern', 'Glow Lantern', '🏮', 'caves', { glowstone: 2, dust: 1 }, 8, 95),
  craft('stew', 'Mushroom Stew', '🍲', 'caves', { mushroom: 3, pepper: 1, goo: 1 }, 7, 100),
  craft('kite', 'Sky Kite', '🪁', 'cloud', { silk: 2, cloudpuff: 2 }, 12, 125),
  craft('pie', 'Peach Pie', '🥧', 'cloud', { peach: 2, puffcorn: 2, honey: 1 }, 9, 120),
  craft('musicbox', 'Music Box', '🎶', 'cloud', { note: 2, pearl: 1, coconut: 1 }, 12, 140),
];

export const GOODS = [...CROPS, ...WONDER_CROPS, ...FORAGE, ...GOODIES, ...RECIPES]; // + expedition treasures, below
export const GOODS_BY_ID = Object.fromEntries(GOODS.map((g) => [g.id, g]));

// ---------- Decorations ----------
// price in Grove Bells, or shards (crystal decor: the place shards go now).
// stamp: free once that Journal page is complete.
export const DECOR = [
  { id: 'fence', name: 'Picket Fence', emoji: '🪵', bells: 25 },
  { id: 'scarecrow', name: 'Scarecrow', emoji: '🧑‍🌾', bells: 40 },
  { id: 'mailbox', name: 'Mailbox', emoji: '📫', bells: 50 },
  { id: 'bench', name: 'Park Bench', emoji: '🪑', bells: 60 },
  { id: 'well', name: 'Wishing Well', emoji: '⛲', bells: 90 },
  { id: 'tent', name: 'Camp Tent', emoji: '⛺', bells: 120 },
  { id: 'windmill', name: 'Windmill', emoji: '🌬️', bells: 160 },
  { id: 'barn', name: 'Big Red Barn', emoji: '🏚️', bells: 220 },
  { id: 'carousel', name: 'Carousel', emoji: '🎠', bells: 300 },
  { id: 'ferris', name: 'Ferris Wheel', emoji: '🎡', bells: 450 },
  { id: 'castle', name: 'Sand Castle', emoji: '🏰', bells: 600 },
  { id: 'crystal-lamp', name: 'Crystal Lamp', emoji: '💡', shards: 25 },
  { id: 'crystal-tree', name: 'Crystal Tree', emoji: '🎄', shards: 60 },
  { id: 'crystal-arch', name: 'Geode Arch', emoji: '🌈', shards: 120 },
  { id: 'crystal-statue', name: 'Diamond Statue', emoji: '💎', shards: 250 },
  { id: 'stamp-crops', name: 'Prize Pumpkin Trophy', emoji: '🏆', stamp: 'crops' },
  { id: 'stamp-critters', name: 'Critter Totem', emoji: '🗿', stamp: 'critters' },
  { id: 'stamp-recipes', name: 'Chef Statue', emoji: '👩‍🍳', stamp: 'recipes' },
  { id: 'stamp-forage', name: 'Explorer Flag', emoji: '🚩', stamp: 'forage' },
  { id: 'stamp-explore', name: 'Globe Statue', emoji: '🌐', stamp: 'explore' },
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));

// Journal pages (a stamp each when complete).
export const JOURNAL_PAGES = {
  crops: { name: 'Crops', emoji: '🌽', entries: [...CROPS, ...WONDER_CROPS] },
  critters: { name: 'Critters', emoji: '🐾', entries: CRITTERS },
  recipes: { name: 'Recipes', emoji: '🍲', entries: RECIPES },
  forage: { name: 'Forage', emoji: '🧺', entries: FORAGE },
  explore: { name: 'Expeditions', emoji: '🗺️', entries: [] }, // filled below: treasures and souvenirs
};

// ---------- Expeditions ----------
// Every land (biome) has its own 3 routes: two short trips (3 friends) and a
// big trip (6 friends). Each route has its own treasure and souvenir, and each
// land's big trip is the only place to find that land's explorer critter, so
// collecting everything takes opening every land and running every route.
const route = (id, name, emoji, land, size, [tid, tname, temoji, tvalue], [sname, semoji]) => ({
  id, name, emoji, land, size,
  treasure: { id: tid, name: tname, emoji: temoji, kind: 'treasure', land, route: id, value: tvalue },
  souvenir: { id: `souv-${id}`, name: sname, emoji: semoji },
});
export const ROUTES = [
  route('hollow', 'Mushroom Hollow', '🍄', 'meadow', 'short', ['clover', 'Four-Leaf Clover', '🍀', 18], ['Spotted Cap', '🧢']),
  route('creek', 'Babbling Creek', '🏞️', 'meadow', 'short', ['pebble', 'Wishing Pebble', '🪨', 18], ['Toy Boat', '⛵']),
  route('oldoak', 'The Old Oak', '🌳', 'meadow', 'big', ['goldacorn', 'Golden Acorn', '🌰', 30], ['Owl Feather', '🪶']),
  route('pass', 'Windy Pass', '🌬️', 'frost', 'short', ['frostbloom', 'Frost Flower', '💮', 22], ['Snow Globe', '🔮']),
  route('icecave', 'Ice Cave', '🧊', 'frost', 'short', ['bluegem', 'Ice Gem', '💎', 24], ['Ice Skate', '⛸️']),
  route('summit', 'Thunder Summit', '🏔️', 'frost', 'big', ['storm', 'Storm Crystal', '⚡', 34], ['Summit Flag', '🚩']),
  route('tidepath', 'Tide Path', '🦀', 'tide', 'short', ['coral', 'Rainbow Coral', '🪸', 24], ['Message Bottle', '🍾']),
  route('lighthouse', 'Lighthouse Point', '🗼', 'tide', 'short', ['seaglass', 'Sea Glass', '🫙', 24], ['Tiny Lantern', '🏮']),
  route('wreck', 'Sunken Ship', '🚢', 'tide', 'big', ['doubloon', 'Pirate Coin', '🪙', 38], ['Ship Wheel', '☸️']),
  route('tunnel', 'Echo Tunnel', '🦇', 'caves', 'short', ['amber', 'Amber Drop', '🟠', 28], ['Echo Shell', '🐚']),
  route('pool', 'Crystal Pool', '💧', 'caves', 'short', ['moonstone', 'Moonstone', '🌙', 28], ['Glow Worm Jar', '🪲']),
  route('mine', 'Deep Mine', '⛏️', 'caves', 'big', ['geode', 'Giant Geode', '🔷', 42], ['Miner Lamp', '🔦']),
  route('bridge', 'Rainbow Bridge', '🌈', 'cloud', 'short', ['prism', 'Prism Drop', '🔆', 32], ['Kite String', '🪁']),
  route('meteor', 'Meteor Field', '☄️', 'cloud', 'short', ['fallenstar', 'Fallen Star', '🌠', 34], ['Space Rock', '🌑']),
  route('observatory', 'Star Observatory', '🔭', 'cloud', 'big', ['comet', 'Comet Tail', '💫', 48], ['Star Map', '🗺️']),
];
export const ROUTES_BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
export const TREASURES = ROUTES.map((r) => r.treasure);
export const SOUVENIRS = ROUTES.map((r) => r.souvenir);
GOODS.push(...TREASURES);
for (const t of TREASURES) GOODS_BY_ID[t.id] = t;
// One explorer critter per land, only from that land's big trip.
const explorer = (id, name, emoji, element, route) => ({ id, name, emoji, element, route, land: ROUTES_BY_ID[route].land, makes: [ROUTES_BY_ID[route].treasure.id], kind: 'explorer' });
export const EXPLORERS = [
  explorer('mossling', 'Mossling', '🦥', 'earth', 'oldoak'),
  explorer('boltbird', 'Bolt Bird', '🦅', 'wind', 'summit'),
  explorer('reefpup', 'Reef Pup', '🦭', 'water', 'wreck'),
  explorer('gemmole', 'Gem Mole', '🦔', 'glow', 'mine'),
  explorer('starfox', 'Comet Kit', '🐈', 'glow', 'observatory'),
];
CRITTERS.push(...EXPLORERS);
for (const c of EXPLORERS) CRITTERS_BY_ID[c.id] = c;
JOURNAL_PAGES.explore.entries = [...TREASURES, ...SOUVENIRS];
