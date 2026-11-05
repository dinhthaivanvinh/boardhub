// The avatar catalog. Ids are stored in user data: never rename or reorder existing ids, only append
// (docs/office/05-avatar-system.md §3).

export const SPECIES = [
  'cat',
  'dog',
  'fox',
  'panda',
  'rabbit',
  'bear',
  'penguin',
  'frog',
  'owl',
  'tiger',
] as const;
export const PATTERNS = ['plain', 'stripes', 'spots', 'patch'] as const;
export const EYES = ['round', 'happy', 'sleepy', 'wink', 'star', 'surprised'] as const;
export const MOUTHS = ['smile', 'grin', 'tongue', 'o', 'cat'] as const;
export const ACCESSORIES = [
  'none',
  'cap',
  'beanie',
  'crown',
  'glasses',
  'sunglasses',
  'bow',
  'scarf',
  'headphones',
  'flower',
] as const;

export type Species = (typeof SPECIES)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Eyes = (typeof EYES)[number];
export type Mouth = (typeof MOUTHS)[number];
export type Accessory = (typeof ACCESSORIES)[number];

/** 24 colours: natural fur (8), pastel (8), bright (8). Every colour in an avatar comes from here. */
export const PALETTE = [
  // natural
  '#f59e0b',
  '#b45309',
  '#78350f',
  '#fef3c7',
  '#f8fafc',
  '#d1d5db',
  '#6b7280',
  '#27272a',
  // pastel
  '#fbcfe8',
  '#c7d2fe',
  '#bae6fd',
  '#bbf7d0',
  '#fde68a',
  '#fed7aa',
  '#e9d5ff',
  '#99f6e4',
  // bright
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const;
export type PaletteColor = (typeof PALETTE)[number];

/** The species' own look: used for new avatars and "random" (most of the time). */
export const NATURAL: Record<Species, { body: PaletteColor; accent: PaletteColor; pattern: Pattern }> = {
  cat: { body: '#f59e0b', accent: '#fef3c7', pattern: 'stripes' },
  dog: { body: '#b45309', accent: '#fef3c7', pattern: 'plain' },
  fox: { body: '#f97316', accent: '#f8fafc', pattern: 'plain' },
  panda: { body: '#f8fafc', accent: '#27272a', pattern: 'plain' },
  rabbit: { body: '#f8fafc', accent: '#fbcfe8', pattern: 'plain' },
  bear: { body: '#78350f', accent: '#fde68a', pattern: 'plain' },
  penguin: { body: '#27272a', accent: '#f8fafc', pattern: 'plain' },
  frog: { body: '#22c55e', accent: '#fde68a', pattern: 'spots' },
  owl: { body: '#b45309', accent: '#fef3c7', pattern: 'plain' },
  tiger: { body: '#f97316', accent: '#f8fafc', pattern: 'stripes' },
};

/** Body/accent pairs that look good together, for the "fun" half of random avatars. */
export const FUN_PAIRS: readonly [PaletteColor, PaletteColor][] = [
  ['#fbcfe8', '#f8fafc'],
  ['#c7d2fe', '#f8fafc'],
  ['#bae6fd', '#f8fafc'],
  ['#bbf7d0', '#fef3c7'],
  ['#fde68a', '#fed7aa'],
  ['#e9d5ff', '#fbcfe8'],
  ['#99f6e4', '#f8fafc'],
  ['#3b82f6', '#bae6fd'],
  ['#8b5cf6', '#e9d5ff'],
  ['#ec4899', '#fbcfe8'],
  ['#06b6d4', '#99f6e4'],
  ['#6b7280', '#d1d5db'],
];

/** Backgrounds that keep any fur readable. */
export const BACKGROUNDS: readonly PaletteColor[] = [
  '#bae6fd',
  '#bbf7d0',
  '#fde68a',
  '#fbcfe8',
  '#c7d2fe',
  '#fed7aa',
  '#e9d5ff',
  '#99f6e4',
  '#3b82f6',
  '#8b5cf6',
  '#22c55e',
  '#27272a',
];
