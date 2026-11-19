// Game content: collectible themes, monsters and cosmetic unlocks.
// Art is emoji so everything works offline with no image assets.

// Power kinds a collectible can give when it's on your team:
//  hint   - reveal the first letters of a word (per-round charges)
//  power  - extra damage on every correct answer
//  shield - a miss doesn't let the monster heal (per-round charges)
//  xp     - bonus XP (percent)
export const POWER_INFO = {
  hint: { label: 'Hint', describe: (n) => `${n} hint${n > 1 ? 's' : ''} per battle` },
  power: { label: 'Power', describe: (n) => `+${n} damage per hit` },
  shield: { label: 'Shield', describe: (n) => `blocks ${n} monster heal${n > 1 ? 's' : ''} per battle` },
  xp: { label: 'XP boost', describe: (n) => `+${n * 10}% XP` },
};

export const RARITIES = ['common', 'rare', 'epic'];
// Strength of a collectible's power by rarity.
export const RARITY_STRENGTH = { common: 1, rare: 2, epic: 3 };

const c = (id, name, emoji, rarity, power) => ({ id, name, emoji, rarity, power });

export const THEMES = [
  {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    reward: 'Ocean Explorer',
    items: [
      c('ocean-fish', 'Bubbles', '🐟', 'common', 'xp'),
      c('ocean-crab', 'Pinchy', '🦀', 'common', 'shield'),
      c('ocean-puffer', 'Puff', '🐡', 'common', 'power'),
      c('ocean-shrimp', 'Wiggles', '🦐', 'common', 'hint'),
      c('ocean-turtle', 'Sir Slowpoke', '🐢', 'common', 'shield'),
      c('ocean-shell', 'Shelby', '🐚', 'common', 'xp'),
      c('ocean-octopus', 'Inky', '🐙', 'rare', 'hint'),
      c('ocean-dolphin', 'Dot', '🐬', 'rare', 'xp'),
      c('ocean-shark', 'Finn', '🦈', 'rare', 'power'),
      c('ocean-whale', 'Grand Gulp', '🐳', 'epic', 'shield'),
    ],
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    reward: 'Star Captain',
    items: [
      c('space-moon', 'Moony', '🌙', 'common', 'shield'),
      c('space-star', 'Twinkle', '⭐', 'common', 'xp'),
      c('space-comet', 'Zoom', '☄️', 'common', 'power'),
      c('space-satellite', 'Beep', '🛰️', 'common', 'hint'),
      c('space-planet', 'Ringo', '🪐', 'common', 'xp'),
      c('space-rocket', 'Blastoff', '🚀', 'common', 'power'),
      c('space-alien', 'Zib', '👽', 'rare', 'hint'),
      c('space-ufo', 'Wobble', '🛸', 'rare', 'shield'),
      c('space-robot', 'Bolt', '🤖', 'rare', 'power'),
      c('space-sun', 'Big Sunny', '🌞', 'epic', 'xp'),
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    reward: 'Forest Ranger',
    items: [
      c('forest-mushroom', 'Spotty', '🍄', 'common', 'shield'),
      c('forest-hedgehog', 'Prickles', '🦔', 'common', 'shield'),
      c('forest-snail', 'Zippy', '🐌', 'common', 'xp'),
      c('forest-squirrel', 'Nutso', '🐿️', 'common', 'hint'),
      c('forest-ladybug', 'Dotty', '🐞', 'common', 'power'),
      c('forest-frog', 'Hops', '🐸', 'common', 'power'),
      c('forest-owl', 'Professor Hoot', '🦉', 'rare', 'hint'),
      c('forest-fox', 'Rusty', '🦊', 'rare', 'power'),
      c('forest-deer', 'Antlers', '🦌', 'rare', 'xp'),
      c('forest-unicorn', 'Glimmer', '🦄', 'epic', 'hint'),
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
