// Game content: collectible themes, monsters and cosmetic unlocks.
// Art is emoji so everything works offline with no image assets.

// Power kinds a collectible can give when it's on your team:
//  hint   - reveal the first letters of a word (per-round charges)
//  power  - extra damage on every correct answer
//  shield - a miss doesn't let the monster heal (per-round charges)
//  xp     - bonus player XP (percent)
//  buddy  - bonus friend XP for everyone on the team (percent, capped)
// Each game type decides what hint/power/shield mean in that game.
export const POWER_INFO = {
  hint: { label: 'Hint', describe: (n) => `${n} hint${n > 1 ? 's' : ''} per battle` },
  power: { label: 'Power', describe: (n) => `+${n} damage per hit` },
  shield: { label: 'Shield', describe: (n) => `blocks ${n} monster heal${n > 1 ? 's' : ''} per battle` },
  xp: { label: 'XP boost', describe: (n) => `+${n * 10}% XP for you` },
  buddy: { label: 'Friend boost', describe: (n) => `+${n * 10}% friend XP for the team` },
};

// 'ultra' only comes from Super Packs, which are earned by mastering words.
// 'legendary' only comes from finishing a set (see LEGENDS).
export const RARITIES = ['common', 'rare', 'epic', 'ultra', 'legendary'];
// Strength of a collectible's power by rarity.
export const RARITY_STRENGTH = { common: 1, rare: 2, epic: 3, ultra: 4, legendary: 5 };

// specialty: the game type ('spelling' | 'math' | 'vocab', see games.js) where
// this friend's power works. Friends can learn more game types; see friends.js.
const c = (id, name, emoji, rarity, power, specialty) => ({ id, name, emoji, rarity, power, specialty });

export const THEMES = [
  {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    reward: 'Ocean Explorer',
    items: [
      c('ocean-fish', 'Bubbles', '🐟', 'common', 'buddy', 'spelling'),
      c('ocean-crab', 'Pinchy', '🦀', 'common', 'shield', 'math'),
      c('ocean-puffer', 'Puff', '🐡', 'common', 'power', 'vocab'),
      c('ocean-shrimp', 'Wiggles', '🦐', 'common', 'hint', 'spelling'),
      c('ocean-turtle', 'Sir Slowpoke', '🐢', 'common', 'shield', 'vocab'),
      c('ocean-shell', 'Shelby', '🐚', 'common', 'xp', 'math'),
      c('ocean-octopus', 'Inky', '🐙', 'rare', 'hint', 'math'),
      c('ocean-dolphin', 'Dot', '🐬', 'rare', 'buddy', 'vocab'),
      c('ocean-shark', 'Finn', '🦈', 'rare', 'power', 'spelling'),
      c('ocean-whale', 'Grand Gulp', '🐳', 'epic', 'shield', 'spelling'),
      c('ocean-mermaid', 'Marina', '🧜', 'ultra', 'power', 'vocab'),
      c('ocean-kraken', 'Kraken Jr.', '🦑', 'ultra', 'hint', 'math'),
    ],
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    reward: 'Star Captain',
    items: [
      c('space-moon', 'Moony', '🌙', 'common', 'shield', 'spelling'),
      c('space-star', 'Twinkle', '⭐', 'common', 'xp', 'vocab'),
      c('space-comet', 'Zoom', '☄️', 'common', 'power', 'math'),
      c('space-satellite', 'Beep', '🛰️', 'common', 'hint', 'vocab'),
      c('space-planet', 'Ringo', '🪐', 'common', 'buddy', 'math'),
      c('space-rocket', 'Blastoff', '🚀', 'common', 'power', 'spelling'),
      c('space-alien', 'Zib', '👽', 'rare', 'hint', 'spelling'),
      c('space-ufo', 'Wobble', '🛸', 'rare', 'shield', 'vocab'),
      c('space-robot', 'Bolt', '🤖', 'rare', 'power', 'math'),
      c('space-sun', 'Big Sunny', '🌞', 'epic', 'xp', 'math'),
      c('space-galaxy', 'Nova', '🌌', 'ultra', 'shield', 'spelling'),
      c('space-wish', 'Wish', '🌠', 'ultra', 'power', 'vocab'),
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    reward: 'Forest Ranger',
    items: [
      c('forest-mushroom', 'Spotty', '🍄', 'common', 'shield', 'math'),
      c('forest-hedgehog', 'Prickles', '🦔', 'common', 'shield', 'spelling'),
      c('forest-snail', 'Zippy', '🐌', 'common', 'xp', 'spelling'),
      c('forest-squirrel', 'Nutso', '🐿️', 'common', 'hint', 'math'),
      c('forest-ladybug', 'Dotty', '🐞', 'common', 'power', 'vocab'),
      c('forest-frog', 'Hops', '🐸', 'common', 'buddy', 'vocab'),
      c('forest-owl', 'Professor Hoot', '🦉', 'rare', 'hint', 'vocab'),
      c('forest-fox', 'Rusty', '🦊', 'rare', 'power', 'math'),
      c('forest-deer', 'Antlers', '🦌', 'rare', 'xp', 'spelling'),
      c('forest-unicorn', 'Glimmer', '🦄', 'epic', 'hint', 'vocab'),
      c('forest-fairy', 'Pip', '🧚', 'ultra', 'buddy', 'spelling'),
      c('forest-dragon', 'Old Mossback', '🐉', 'ultra', 'power', 'math'),
    ],
  },
  {
    id: 'farm',
    name: 'Farm',
    emoji: '🚜',
    reward: 'Barnyard Boss',
    items: [
      c('farm-chicken', 'Clucky', '🐔', 'common', 'buddy', 'spelling'),
      c('farm-pig', 'Oinkers', '🐷', 'common', 'shield', 'math'),
      c('farm-cow', 'Moo-Moo', '🐮', 'common', 'power', 'vocab'),
      c('farm-sheep', 'Woolly', '🐑', 'common', 'hint', 'spelling'),
      c('farm-duck', 'Quackers', '🦆', 'common', 'xp', 'vocab'),
      c('farm-sunflower', 'Sunny', '🌻', 'common', 'hint', 'math'),
      c('farm-horse', 'Barnaby', '🐴', 'rare', 'power', 'spelling'),
      c('farm-turkey', 'Gobbles', '🦃', 'rare', 'shield', 'vocab'),
      c('farm-goat', 'Billy', '🐐', 'rare', 'xp', 'math'),
      c('farm-peacock', 'Fanfare', '🦚', 'epic', 'buddy', 'spelling'),
      c('farm-llama', 'Captain Llama', '🦙', 'ultra', 'hint', 'vocab'),
      c('farm-pumpkin', 'Jack', '🎃', 'ultra', 'power', 'math'),
    ],
  },
  {
    id: 'sweets',
    name: 'Sweets',
    emoji: '🍭',
    reward: 'Sugar Chef',
    items: [
      c('sweets-donut', 'Sprinkles', '🍩', 'common', 'shield', 'vocab'),
      c('sweets-cookie', 'Chip', '🍪', 'common', 'power', 'spelling'),
      c('sweets-candy', 'Gummy', '🍬', 'common', 'hint', 'math'),
      c('sweets-popcorn', 'Pop', '🍿', 'common', 'xp', 'spelling'),
      c('sweets-icecream', 'Swirl', '🍦', 'common', 'buddy', 'math'),
      c('sweets-cupcake', 'Frosty', '🧁', 'common', 'shield', 'vocab'),
      c('sweets-lollipop', 'Lolly', '🍭', 'rare', 'hint', 'vocab'),
      c('sweets-chocolate', 'Choco', '🍫', 'rare', 'power', 'math'),
      c('sweets-custard', 'Jiggles', '🍮', 'rare', 'shield', 'spelling'),
      c('sweets-cake', 'Lord Layercake', '🎂', 'epic', 'xp', 'math'),
      c('sweets-waffle', 'Waffle Wizard', '🧇', 'ultra', 'buddy', 'spelling'),
      c('sweets-melon', 'Melonzilla', '🍉', 'ultra', 'power', 'vocab'),
    ],
  },
];


// Monthly themes: one new 12-friend theme around the start of each month
// through June, so there's always a new set to start. `from` is the local
// date it appears (packs, collection, Super Packs).
const SPEC_ROT = [
  ['spelling', 'math', 'vocab'],
  ['math', 'vocab', 'spelling'],
  ['vocab', 'spelling', 'math'],
];
const SPEC_PATTERN = [0, 1, 2, 0, 2, 1, 0, 2, 1, 0, 2, 1]; // 4 per game type
const POWER_PATTERN = ['buddy', 'shield', 'power', 'hint', 'xp', 'hint', 'power', 'shield', 'xp', 'buddy', 'hint', 'power'];
const TIERS = ['common', 'common', 'common', 'common', 'common', 'common', 'rare', 'rare', 'rare', 'epic', 'ultra', 'ultra'];
function monthly(n, id, name, emoji, reward, from, list) {
  return {
    id, name, emoji, reward, from,
    items: list.map(([key, fname, femoji], i) =>
      c(`${id}-${key}`, fname, femoji, TIERS[i], POWER_PATTERN[i < 6 ? (i + n) % 6 : i], SPEC_ROT[n % 3][SPEC_PATTERN[i]]),
    ),
  };
}

THEMES.push(
  monthly(0, 'winter', 'Winter', '⛄', 'Snow Champion', '2026-12-01', [
    ['penguin', 'Waddles', '🐧'], ['snowman', 'Mr. Carrot', '☃️'], ['mitten', 'Mitts', '🧤'], ['cocoa', 'Cocoa', '☕'],
    ['scarf', 'Scarfy', '🧣'], ['sled', 'Slider', '🛷'], ['polarbear', 'Polar Pete', '🐻‍❄️'], ['skate', 'Glide', '⛸️'],
    ['seal', 'Blubber', '🦭'], ['snowflake', 'Crystal', '❄️'], ['tree', 'Evergreen', '🎄'], ['blizzard', 'Blizzard', '🌨️'],
  ]),
  monthly(1, 'dinos', 'Dinos', '🦕', 'Fossil Finder', '2027-01-04', [
    ['egg', 'Eggbert', '🥚'], ['bone', 'Bones', '🦴'], ['rock', 'Rocky', '🪨'], ['fern', 'Fernie', '🌿'],
    ['lizard', 'Lizzy', '🦎'], ['paw', 'Stomp', '🐾'], ['volcano', 'Rumble', '🌋'], ['dodo', 'Doodle', '🦤'],
    ['feather', 'Plume', '🪶'], ['longneck', 'Longneck', '🦕'], ['rex', 'Rexy', '🦖'], ['mammoth', 'Tusk', '🦣'],
  ]),
  monthly(2, 'hearts', 'Hearts', '💖', 'Friendship Star', '2027-02-01', [
    ['letter', 'Letty', '💌'], ['teddy', 'Teddy', '🧸'], ['rose', 'Rosie', '🌹'], ['balloon', 'Floaty', '🎈'],
    ['bow', 'Bowie', '🎀'], ['bouquet', 'Posy', '💐'], ['flamingo', 'Flora', '🦩'], ['dove', 'Coo', '🕊️'],
    ['swan', 'Grace', '🦢'], ['gift', 'Ribbons', '💝'], ['rainbow', 'Rainbow', '🌈'], ['cupid', 'Cupid Jr.', '💘'],
  ]),
  monthly(3, 'garden', 'Garden', '🌷', 'Master Gardener', '2027-03-01', [
    ['tulip', 'Tully', '🌷'], ['bee', 'Buzz', '🐝'], ['caterpillar', 'Inchy', '🐛'], ['daisy', 'Daisy', '🌼'],
    ['worm', 'Squirm', '🪱'], ['sprout', 'Sprout', '🌱'], ['butterfly', 'Flutter', '🦋'], ['rabbit', 'Hopper', '🐇'],
    ['strawberry', 'Berry', '🍓'], ['blossom', 'Blossom', '🌸'], ['hibiscus', 'Queen Bloom', '🌺'], ['plant', 'Old Leafy', '🪴'],
  ]),
  monthly(4, 'jungle', 'Jungle', '🌴', 'Jungle Guide', '2027-04-05', [
    ['monkey', 'Cheeky', '🐒'], ['snake', 'Slinky', '🐍'], ['banana', 'Nana', '🍌'], ['sloth', 'Snooze', '🦥'],
    ['palm', 'Palmer', '🌴'], ['croc', 'Snappy', '🐊'], ['parrot', 'Polly', '🦜'], ['zebra', 'Stripes', '🦓'],
    ['giraffe', 'Tallulah', '🦒'], ['elephant', 'Trunks', '🐘'], ['tiger', 'Raja', '🐅'], ['orangutan', 'Professor Mango', '🦧'],
  ]),
  monthly(5, 'beach', 'Beach', '🏖️', 'Beach Boss', '2027-05-03', [
    ['coconut', 'Coco', '🥥'], ['kite', 'Flyer', '🪁'], ['shades', 'Shades', '🕶️'], ['umbrella', 'Shady', '⛱️'],
    ['ball', 'Spike', '🏐'], ['pineapple', 'Pina', '🍍'], ['lobster', 'Clawdia', '🦞'], ['fish', 'Coral', '🐠'],
    ['boat', 'Skipper', '⛵'], ['island', 'Isla', '🏝️'], ['bigwhale', 'Big Blue', '🐋'], ['sunset', 'Dusk', '🌅'],
  ]),
  monthly(6, 'magic', 'Magic', '🏰', 'Grand Wizard', '2027-06-01', [
    ['candle', 'Wick', '🕯️'], ['key', 'Keymaster', '🗝️'], ['scroll', 'Scrolly', '📜'], ['potion', 'Fizz', '🧪'],
    ['bubbles', 'Bubbly', '🫧'], ['sparkles', 'Glitter', '✨'], ['wand', 'Sparkle', '🪄'], ['mirror', 'Mira', '🪞'],
    ['castle', 'Sir Turret', '🏰'], ['orb', 'Oracle', '🔮'], ['star', 'Starla', '🌟'], ['dizzy', 'Dizzy', '💫'],
  ]),
);

const localDay = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Themes that have appeared by `now` (older themes have no `from`). */
export function themesOpen(now = Date.now()) {
  const today = localDay(now);
  return THEMES.filter((t) => !t.from || t.from <= today);
}
/** The next theme still to come, or null. */
export function nextTheme(now = Date.now()) {
  const today = localDay(now);
  return THEMES.filter((t) => t.from && t.from > today).sort((a, b) => (a.from < b.from ? -1 : 1))[0] || null;
}

// Gold versions: a Super Pack can turn a rare, epic or ultra you own gold
// (+1 power). They never come from coins or shards.
export const GOLD_RARITIES = ['rare', 'epic', 'ultra'];
export const GOLD_BONUS = 1;

// Legendary friends (top tier): only for finishing a set, never from packs.
//  spelling: every LEGEND_RULES.weekStars Week Stars (a whole week's list mastered)
//  math: one Table Titan per table 3-12 (every × and ÷ fact of that table mastered)
//  vocab: every LEGEND_RULES.vocabWords mastered Word Match words
export const LEGEND_RULES = { weekStars: 4, vocabWords: 25, minWeekWords: 5 };
const L = (id, name, emoji, power, track, extra = {}) => ({ id: `legend-${id}`, name, emoji, rarity: 'legendary', power, specialty: track, track, ...extra });
const TITANS = [
  [3, 'Tri-Horn', '🦏', 'power'], [4, 'Moon Howl', '🐺', 'shield'], [5, 'High Five', '🖐️', 'hint'], [6, 'Dicey', '🎲', 'xp'],
  [7, 'Lucky Seven', '🐆', 'buddy'], [8, 'Eight Ball', '🎱', 'power'], [9, 'Nine Lives', '🐈‍⬛', 'shield'], [10, 'Perfect Ten', '🔟', 'hint'],
  [11, 'Zap', '⚡', 'xp'], [12, 'Clockwork', '🕛', 'power'],
];
export const LEGENDS = [
  ...TITANS.map(([t, name, emoji, power]) => L(`titan-${t}`, name, emoji, power, 'math', { table: t })),
  ...[
    ['storybook', 'Storybook', '📖', 'hint'], ['pencil', 'Pencil Knight', '✏️', 'power'], ['crayon', 'Crayonia', '🖍️', 'buddy'],
    ['alpha', 'Alpha', '🔤', 'shield'], ['scribe', 'Scribe', '📝', 'xp'], ['cap', 'Professor Cap', '🎓', 'hint'],
    ['pen', 'Penny Pen', '🖊️', 'power'], ['stacks', 'Stacks', '📚', 'shield'], ['abc', 'Big ABC', '🔠', 'buddy'],
    ['chatter', 'Chatter', '💬', 'xp'], ['wordmap', 'Wordmap', '🗺️', 'hint'], ['quill', 'Quill', '✒️', 'power'],
  ].map(([id, name, emoji, power], i) => L(`spell-${id}`, name, emoji, power, 'spelling', { order: i })),
  ...[
    ['brain', 'Big Brain', '🧠', 'xp'], ['clue', 'Detective Clue', '🔍', 'hint'], ['idea', 'Bright Idea', '💡', 'power'],
    ['speaker', 'Speaker', '🗣️', 'buddy'], ['mic', 'Mic Drop', '🎤', 'shield'], ['globe', 'Globetrotter', '🌍', 'xp'],
    ['compass', 'Compass', '🧭', 'hint'], ['telescope', 'Stargazer', '🔭', 'power'], ['drama', 'Drama', '🎭', 'buddy'],
    ['signal', 'Signal', '📡', 'shield'], ['gene', 'Gene', '🧬', 'xp'], ['news', 'Newsy', '📰', 'hint'],
  ].map(([id, name, emoji, power], i) => L(`vocab-${id}`, name, emoji, power, 'vocab', { order: i })),
];

export const ALL_ITEMS = THEMES.flatMap((t) => t.items.map((i) => ({ ...i, theme: t.id })));
export const LEGEND_ITEMS = LEGENDS.map((i) => ({ ...i, theme: 'legend' }));
export const ITEMS_BY_ID = Object.fromEntries([...ALL_ITEMS, ...LEGEND_ITEMS].map((i) => [i.id, i]));

export const MONSTERS = [
  { name: 'Grumble Blob', emoji: '🟢', hp: 4 },
  { name: 'Sneezy Ghost', emoji: '👻', hp: 5 },
  { name: 'Glitch', emoji: '👾', hp: 5 },
  { name: 'Mumbles', emoji: '🧟', hp: 6 },
  { name: 'Spell Goblin', emoji: '👺', hp: 6 },
  { name: 'Typo Dragon', emoji: '🐲', hp: 7 },
];

// Cosmetic unlocks by level. Purely visual.
export const COSMETICS = [
  { id: 'color-sky', kind: 'color', label: 'Sky', value: '#4f8cff', level: 1 },
  { id: 'color-grass', kind: 'color', label: 'Grass', value: '#2fa86b', level: 1 },
  { id: 'hero-cat', kind: 'hero', label: 'Cat', value: '🐱', level: 1 },
  { id: 'hero-dog', kind: 'hero', label: 'Dog', value: '🐶', level: 1 },
  { id: 'color-sunset', kind: 'color', label: 'Sunset', value: '#ff7a45', level: 2 },
  { id: 'hero-panda', kind: 'hero', label: 'Panda', value: '🐼', level: 2 },
  { id: 'color-grape', kind: 'color', label: 'Grape', value: '#8b5cf6', level: 3 },
  { id: 'hero-tiger', kind: 'hero', label: 'Tiger', value: '🐯', level: 3 },
  { id: 'hat-cap', kind: 'hat', label: 'Cap', value: '🧢', level: 4 },
  { id: 'color-bubblegum', kind: 'color', label: 'Bubblegum', value: '#ec4899', level: 5 },
  { id: 'hero-lion', kind: 'hero', label: 'Lion', value: '🦁', level: 5 },
  { id: 'hat-crown', kind: 'hat', label: 'Crown', value: '👑', level: 6 },
  { id: 'hero-dino', kind: 'hero', label: 'Dino', value: '🦖', level: 7 },
  { id: 'hat-wizard', kind: 'hat', label: 'Wizard hat', value: '🎩', level: 8 },
  { id: 'color-midnight', kind: 'color', label: 'Midnight', value: '#1e3a8a', level: 10 },
  { id: 'hero-dragon', kind: 'hero', label: 'Dragon', value: '🐉', level: 12 },
];
