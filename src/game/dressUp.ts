/**
 * dressUp.ts — Daily Waifu Dress-Up data, target looks and scoring.
 *
 * Every day of the 365 already has an outfit material, a colour palette and an
 * art category in utils/artTypes.ts (the same data the dev "365 Art Types &
 * Outfit Matrix" shows). This module turns that into a dress-up brief: the
 * player wears garments in the day's material, coloured from the day's palette,
 * in the day's scene, plus one seeded "signature piece".
 */

import { getArtTypeForDay, OUTFIT_STYLES, type OutfitStyle, type ArtTypeData } from '../utils/artTypes';

export type GarmentSlot = 'top' | 'bottom' | 'legwear' | 'shoes';
export type Slot = GarmentSlot | 'hair' | 'accessory';

export interface WardrobeItem {
  id: string;
  label: string;
}

export const WARDROBE: Record<Slot, WardrobeItem[]> = {
  hair: [
    { id: 'twintails', label: 'Twin Tails' },
    { id: 'long', label: 'Long & Straight' },
    { id: 'bob', label: 'Bob Cut' },
    { id: 'ponytail', label: 'High Ponytail' },
    { id: 'buns', label: 'Space Buns' },
  ],
  top: [
    { id: 'none', label: 'Bodysuit Only' },
    { id: 'crop', label: 'Crop Top' },
    { id: 'bikini', label: 'Bikini Top' },
    { id: 'corset', label: 'Corset' },
    { id: 'sailor', label: 'Sailor Halter' },
    { id: 'kimono', label: 'Kimono Wrap' },
    { id: 'jacket', label: 'Cropped Jacket' },
  ],
  bottom: [
    { id: 'none', label: 'Bodysuit Only' },
    { id: 'pleated', label: 'Pleated Skirt' },
    { id: 'shorts', label: 'Booty Shorts' },
    { id: 'mini', label: 'Pencil Mini' },
    { id: 'gown', label: 'Floor Gown' },
    { id: 'pants', label: 'Flare Pants' },
  ],
  legwear: [
    { id: 'none', label: 'Bare' },
    { id: 'thighhighs', label: 'Thigh-Highs' },
    { id: 'stockings', label: 'Sheer Stockings' },
    { id: 'fishnet', label: 'Fishnets' },
    { id: 'warmers', label: 'Leg Warmers' },
  ],
  shoes: [
    { id: 'none', label: 'Barefoot' },
    { id: 'platforms', label: 'Platform Heels' },
    { id: 'boots', label: 'Combat Boots' },
    { id: 'sneakers', label: 'Sneakers' },
    { id: 'maryjanes', label: 'Mary Janes' },
  ],
  accessory: [
    { id: 'none', label: 'None' },
    { id: 'choker', label: 'Choker' },
    { id: 'catears', label: 'Cat Ears' },
    { id: 'halo', label: 'Halo' },
    { id: 'visor', label: 'Cyber Visor' },
    { id: 'headphones', label: 'Headphones' },
  ],
};

export const GARMENT_SLOTS: GarmentSlot[] = ['top', 'bottom', 'legwear', 'shoes'];
export const ALL_SLOTS: Slot[] = ['hair', 'top', 'bottom', 'legwear', 'shoes', 'accessory'];

export const MATERIAL_KEYS = Object.keys(OUTFIT_STYLES) as OutfitStyle[];

export const HAIR_COLORS = [
  '#1a1a2e', '#f5e6c8', '#ff7eb6', '#7dd3fc', '#c084fc', '#ef4444', '#f8fafc', '#fbbf24', '#34d399', '#6b4226',
];

/** Scenes map 1:1 onto the ten art categories in artTypes.ts. */
export const SCENES: { category: string; label: string; colors: [string, string, string] }[] = [
  { category: 'Cyberpunk & Sci-Fi', label: 'Neon City', colors: ['#05050b', '#1e0b3a', '#00f0ff'] },
  { category: 'Dark Fantasy & Gothic', label: 'Gothic Cathedral', colors: ['#0b0208', '#2a0a1e', '#b91c1c'] },
  { category: 'Neon Retro & Synthwave', label: 'Synthwave Grid', colors: ['#12002a', '#ff007f', '#ffd700'] },
  { category: 'High-Fashion & Vogue', label: 'Runway Studio', colors: ['#111111', '#2d2d2d', '#f8fafc'] },
  { category: 'Impressionist & Fine Art', label: 'Painted Garden', colors: ['#1d3557', '#457b9d', '#f4a261'] },
  { category: 'Anime & Celestial', label: 'Starry Sky', colors: ['#0a0a2a', '#312e81', '#fde68a'] },
  { category: 'Minimalist & Surrealism', label: 'Dream Void', colors: ['#e5e7eb', '#cbd5e1', '#0f172a'] },
  { category: 'Streetwear & Graffiti', label: 'Graffiti Alley', colors: ['#1c1917', '#44403c', '#39ff14'] },
  { category: 'Organic & Nature Noir', label: 'Midnight Forest', colors: ['#020f04', '#064e3b', '#6ee7b7'] },
  { category: 'Industrial & Mechanical', label: 'Steel Foundry', colors: ['#0c0a09', '#3f3f46', '#ff5500'] },
];

export interface GarmentChoice {
  item: string;
  material: OutfitStyle;
  color: string;
}

export interface Outfit {
  hair: { item: string; color: string };
  top: GarmentChoice;
  bottom: GarmentChoice;
  legwear: GarmentChoice;
  shoes: GarmentChoice;
  accessory: { item: string };
  scene: string; // art category
}

export interface DayBrief {
  day: number;
  art: ArtTypeData;
  material: OutfitStyle;
  palette: [string, string, string];
  swatches: string[];
  scene: string;
  signature: { slot: GarmentSlot; item: WardrobeItem };
  target: Outfit;
}

// Small deterministic PRNG so every day always produces the same brief.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

const DISTRACTOR_COLORS = [
  '#00f0ff', '#7000ff', '#39ff14', '#ff007f', '#9d00ff', '#ffd700', '#ff5500', '#ffb8e0', '#c084fc',
  '#a7f3d0', '#ef4444', '#e2e8f0', '#3b82f6', '#94a3b8', '#10b981', '#ff7700', '#ff00b7', '#f8fafc',
  '#475569', '#8b5cf6', '#14b8a6', '#f472b6', '#fb923c', '#f43f5e', '#111827',
];

export function getDayBrief(day: number): DayBrief {
  const art = getArtTypeForDay(day);
  const rand = mulberry32(day * 9973 + 17);
  const palette: [string, string, string] = [art.colorCombo.primary, art.colorCombo.secondary, art.colorCombo.accent];
  const lowerPalette = palette.map((c) => c.toLowerCase());

  // 9 swatches: the day's three palette colours mixed into six distractors.
  const distractors = DISTRACTOR_COLORS.filter((c) => !lowerPalette.includes(c.toLowerCase()));
  const chosen: string[] = [];
  while (chosen.length < 6) {
    const c = pick(rand, distractors);
    if (!chosen.includes(c)) chosen.push(c);
  }
  const swatches = [...palette, ...chosen].sort(() => rand() - 0.5);

  const signatureSlot = pick(rand, GARMENT_SLOTS);
  const wearable = (slot: GarmentSlot) => WARDROBE[slot].filter((i) => i.id !== 'none');
  const signatureItem = pick(rand, wearable(signatureSlot));

  const itemFor = (slot: GarmentSlot) => (slot === signatureSlot ? signatureItem.id : pick(rand, wearable(slot)).id);
  const target: Outfit = {
    hair: { item: pick(rand, WARDROBE.hair).id, color: pick(rand, HAIR_COLORS) },
    top: { item: itemFor('top'), material: art.outfitStyle, color: palette[0] },
    bottom: { item: itemFor('bottom'), material: art.outfitStyle, color: palette[1] },
    legwear: { item: itemFor('legwear'), material: art.outfitStyle, color: palette[2] },
    shoes: { item: itemFor('shoes'), material: art.outfitStyle, color: palette[0] },
    accessory: { item: pick(rand, WARDROBE.accessory.filter((i) => i.id !== 'none')).id },
    scene: art.artCategory,
  };
  // The gown already covers the legs, so keep the reveal readable.
  if (target.bottom.item === 'gown' && signatureSlot !== 'legwear') target.legwear.item = 'none';

  return {
    day,
    art,
    material: art.outfitStyle,
    palette,
    swatches,
    scene: art.artCategory,
    signature: { slot: signatureSlot, item: signatureItem },
    target,
  };
}

export function defaultOutfit(): Outfit {
  return {
    hair: { item: 'twintails', color: HAIR_COLORS[2] },
    top: { item: 'none', material: 'knit', color: '#f8fafc' },
    bottom: { item: 'none', material: 'knit', color: '#f8fafc' },
    legwear: { item: 'none', material: 'knit', color: '#f8fafc' },
    shoes: { item: 'none', material: 'knit', color: '#f8fafc' },
    accessory: { item: 'none' },
    scene: SCENES[6].category,
  };
}

export interface ScoreBreakdown {
  material: number; // /40
  palette: number; // /30
  scene: number; // /15
  signature: number; // /15
  total: number; // /100
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  notes: string[];
}

/**
 * Scoring: 40 material + 30 palette over the garments worn, 15 for the scene,
 * 15 for wearing the signature piece. A top and a bottom must be worn to score.
 */
export function scoreOutfit(outfit: Outfit, brief: DayBrief): ScoreBreakdown {
  const notes: string[] = [];
  const worn = GARMENT_SLOTS.filter((s) => outfit[s].item !== 'none');
  const dressed = outfit.top.item !== 'none' && outfit.bottom.item !== 'none';
  const materialLabel = OUTFIT_STYLES[brief.material].label;

  let material = 0;
  let palette = 0;
  if (!dressed) {
    notes.push('Put on a top and a bottom to start scoring.');
  } else {
    const matHits = worn.filter((s) => outfit[s].material === brief.material).length;
    const lowerPalette = brief.palette.map((c) => c.toLowerCase());
    const colHits = worn.filter((s) => lowerPalette.includes(outfit[s].color.toLowerCase())).length;
    material = Math.round((40 * matHits) / worn.length);
    palette = Math.round((30 * colHits) / worn.length);
    if (matHits < worn.length) notes.push(`${worn.length - matHits} piece(s) aren't ${materialLabel}.`);
    if (colHits < worn.length) notes.push(`${worn.length - colHits} piece(s) are off-palette.`);
  }

  const scene = outfit.scene === brief.scene ? 15 : 0;
  if (!scene) notes.push('The backdrop doesn\'t match today\'s scene.');

  const sig = outfit[brief.signature.slot].item === brief.signature.item.id ? 15 : 0;
  if (!sig) notes.push(`Missing the signature piece: ${brief.signature.item.label}.`);

  const total = material + palette + scene + sig;
  const grade = total >= 95 ? 'S' : total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D';
  return { material, palette, scene, signature: sig, total, grade, notes };
}
