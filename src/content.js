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
export const RARITIES = ['common', 'rare', 'epic', 'ultra'];
// Strength of a collectible's power by rarity.
export const RARITY_STRENGTH = { common: 1, rare: 2, epic: 3, ultra: 4 };

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
];

export const ALL_ITEMS = THEMES.flatMap((t) => t.items.map((i) => ({ ...i, theme: t.id })));
export const ITEMS_BY_ID = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));

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
