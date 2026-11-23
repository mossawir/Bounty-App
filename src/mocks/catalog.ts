import type { Category, Product } from '@/types/domain';

/** Deterministic PRNG so every reload (and every teammate) sees the same catalogue. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYBOARD_FAMILIES = [
  'Clackwell',
  'Thockworks',
  'Gasket',
  'Nyx',
  'Halo',
  'Tactile',
  'Linear',
  'Alice',
  'Split',
  'Quiet Key',
  'Brass Plate',
  'Foam Stack',
  'Southpaw',
  'Numpad Nine',
  'Buckling',
  'Kailh Corner',
  'Topre Tent',
  'Lubed & Loaded',
  'Silent Spring',
  'Copper Leaf',
];
const KEYBOARD_SIZES = ['60%', '65%', '75%', 'TKL', '1800', 'Ergo'];
const KEYBOARD_SPECS = [
  'Hot-swap',
  'Aluminium',
  'Walnut',
  'PBT',
  'Low-profile',
  'RGB',
  'Gasket-mount',
  'Split-space',
];
const EDITIONS = ['', ' Pro', ' Lite', ' Max', ' II'];

const DUCK_FAMILIES = [
  'Debug Duck',
  'Rubber Duck',
  'Sentry Duck',
  'Caffeine Duck',
  'Merge Duck',
  'Stack Duck',
  'Lint Duck',
  'Null Duck',
  'Triage Duck',
  'Standup Duck',
  'Deploy Duck',
  'Rollback Duck',
];
const DUCK_VARIANTS = [
  'Classic',
  'Glow in the Dark',
  'Squeaky',
  'Night Shift',
  'Refactor',
  'On Call',
  'Jumbo',
  'Pocket',
];
const DUCK_SIZES = ['', ' · mini', ' · jumbo', ' · glow'];

const COFFEE_FAMILIES = [
  'Byte Roast',
  'Nightshade Espresso',
  'Merge Conflict Blend',
  'Kernel Panic Dark',
  'Uptime Decaf',
  'Cold Brew Build',
  'Sprint Blend',
  'Hotfix House',
  'Standup Sunrise',
  'Deep Work Dark',
];
const COFFEE_FORMATS = ['Whole bean 250g', 'Ground 250g', 'Whole bean 1kg', 'Capsules x10'];
const COFFEE_NOTES = [
  'cocoa + cherry',
  'toffee + orange',
  'black tea + plum',
  'hazelnut + smoke',
  'citrus + honey',
];

const STICKER_FAMILIES = [
  'Syntax Error',
  'Rubber Duck Squad',
  'Tabs vs Spaces',
  'Null Pointer',
  'It Works On My Machine',
  'Stack Trace',
  'Semver Sunset',
  '404 Motivation',
  'Merge Conflict',
  'Ship It',
  'Linter Approved',
  'Binary Sunset',
];
const STICKER_FORMATS = ['Sticker sheet', 'Die-cut pack', 'Laptop decal set', 'Holo pack'];
const STICKER_FINISHES = [' · matte', ' · glossy', ' · holographic', ''];

const PRICE_RANGE: Record<Category, [number, number]> = {
  keyboards: [4900, 24900],
  ducks: [599, 1899],
  coffee: [1299, 4599],
  stickers: [349, 1199],
};

const CATEGORY_WEIGHTS: Array<[Category, number]> = [
  ['keyboards', 0.24],
  ['ducks', 0.28],
  ['coffee', 0.24],
  ['stickers', 0.24],
];

function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.floor(random() * items.length);
  return items[index] ?? items[0]!;
}

function toCents(value: number): number {
  return Math.max(99, Math.round(value / 100) * 100 - 1);
}

function categoryAt(fraction: number): Category {
  let cursor = 0;
  for (const [category, weight] of CATEGORY_WEIGHTS) {
    cursor += weight;
    if (fraction < cursor) return category;
  }
  return 'stickers';
}

/** 5,000 products, generated once. 1250-ish per category, ~18% out of stock. */
export function createCatalog(size = 5000): Product[] {
  const random = mulberry32(0x5eed);
  const products: Product[] = [];

  for (let index = 0; index < size; index += 1) {
    const category = categoryAt(random());
    const [min, max] = PRICE_RANGE[category];
    const rawPrice = min + random() * (max - min);
    const stock = random() < 0.18 ? 0 : Math.floor(1 + random() * 48);
    const rating = Math.round((3.2 + random() * 1.8) * 10) / 10;

    let name: string;
    switch (category) {
      case 'keyboards':
        name = `${pick(KEYBOARD_FAMILIES, random)} ${pick(KEYBOARD_SIZES, random)} ${pick(
          KEYBOARD_SPECS,
          random,
        )}${pick(EDITIONS, random)}`;
        break;
      case 'ducks':
        name = `${pick(DUCK_FAMILIES, random)} · ${pick(DUCK_VARIANTS, random)}${pick(
          DUCK_SIZES,
          random,
        )}`;
        break;
      case 'coffee':
        name = `${pick(COFFEE_FAMILIES, random)} — ${pick(COFFEE_FORMATS, random)} (${pick(
          COFFEE_NOTES,
          random,
        )})`;
        break;
      case 'stickers':
        name = `${pick(STICKER_FAMILIES, random)} ${pick(STICKER_FORMATS, random)}${pick(
          STICKER_FINISHES,
          random,
        )}`;
        break;
    }

    products.push({
      id: `p-${String(index + 1).padStart(4, '0')}`,
      name,
      price: toCents(rawPrice),
      category,
      stock,
      rating,
      imageUrl: `/img/${category}-${Math.floor(random() * 3) + 1}.svg`,
    });
  }

  return products;
}
