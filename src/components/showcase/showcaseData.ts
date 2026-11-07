// Real catalogue data the feature demos are built from: song titles, covers, bombshell
// variant art and a word-chain hop path pulled from public/data and public/word_chain.json.
// Nothing here is invented: every title, line and timestamp is from the shipped catalogue.

import type { Rarity } from '../../utils/rarity';

export interface DemoSong {
  day: number;
  title: string;
  cover: string;
}

const C = 'https://files.th3scr1b3.art/covers/';

export const SONGS: Record<number, DemoSong> = {
  1: { day: 1, title: "We're Going Crazy World", cover: `${C}january/01%20-%20Were%20Going%20Crazy%20World.jpg` },
  8: { day: 8, title: 'Poetry', cover: `${C}january/08%20-%20Poetry.jpg` },
  22: { day: 22, title: 'Tight Rope', cover: `${C}january/22%20-%20Tightrope+.jpg` },
  31: { day: 31, title: 'Scars In My Mind', cover: `${C}january/31%20-%20Scars%20in%20My%20Mind.jpg` },
  33: { day: 33, title: 'Better Version of Me', cover: `${C}february/02%20-%20Bettersion%20of%20Me.jpg` },
  55: { day: 55, title: 'Tried and True', cover: `${C}february/24%20-%20Tried%20N%20True.jpg` },
  85: { day: 85, title: 'Overdosed', cover: `${C}march/26%20-%20Odosed.jpg` },
  114: { day: 114, title: 'Rain', cover: `${C}april/24%20-%20rain_isitthathard_intro.jpg` },
  133: { day: 133, title: 'Softer Side', cover: `${C}may/13%20-%20softer_side_mas.jpg` },
  213: { day: 213, title: 'Trouble', cover: `${C}august/01%20-%20Trouble.jpg` },
  250: { day: 250, title: 'Sirens', cover: `${C}september/07%20-%20Sirens.jpg` },
  280: { day: 280, title: 'Fallin', cover: `${C}october/07%20-%20Fallin.jpg` },
  300: { day: 300, title: 'controlW', cover: `${C}october/27%20-%20controlW.jpg` },
  307: { day: 307, title: 'Hard to Ignore', cover: `${C}november/03%20-%20Hard%20to%20Ignore.jpg` },
  311: { day: 311, title: 'right where you left me', cover: `${C}november/07%20-%20right%20where%20you%20left%20me.jpg` },
};

/** Covers for the scrolling wall behind the landing hero. */
export const WALL_DAYS = [1, 8, 22, 31, 33, 55, 85, 114, 133, 213, 250, 280, 300, 307, 311];

/** The rhythm demo plays this chart (public/data/songs). */
export const DEMO_CHART_URL = '/data/songs/day-311.json';
export const DEMO_CHART_DAY = 311;

/** Bombshell variant art shipped locally (public/data/launch/bombshells). */
export const BOMBSHELL_ART = [
  '/data/launch/bombshells/day-033-01.jpg',
  '/data/launch/bombshells/day-001-01.jpg',
  '/data/launch/bombshells/day-164-01.jpg',
  '/data/launch/bombshells/day-085-01.jpg',
  '/data/launch/bombshells/day-213-01.jpg',
  '/data/launch/bombshells/day-114-01.jpg',
];

/** A real word-chain path: each hop follows a word the next song also sings. */
export const CHAIN_HOPS: Array<{ day: number; time: number; line: string; lit: string[]; hop?: string }> = [
  { day: 307, time: 17.8, line: 'Sittin and runnin everyday sometimes I do walk away', lit: ['everyday', 'sometimes', 'walk', 'away'], hop: 'sometimes' },
  { day: 8, time: 48.52, line: 'Of us getting together what we knew, yeah, sometimes the poetry rocks your mind right', lit: ['together', 'sometimes', 'rocks', 'mind', 'right'], hop: 'mind' },
  { day: 22, time: 90.68, line: 'Lighting your light in your mind', lit: ['Lighting', 'light', 'mind'] },
];

export const RARITY_STYLE: Record<Rarity, { label: string; color: string; glow: string }> = {
  common: { label: 'Common', color: '#8a8ea0', glow: 'rgba(138,142,160,0.35)' },
  uncommon: { label: 'Uncommon', color: '#4ade80', glow: 'rgba(74,222,128,0.45)' },
  rare: { label: 'Rare', color: '#3b82f6', glow: 'rgba(59,130,246,0.55)' },
  legendary: { label: 'Legendary', color: '#b44dff', glow: 'rgba(180,77,255,0.6)' },
  mythic: { label: 'Mythic', color: '#ffd700', glow: 'rgba(255,215,0,0.65)' },
};

/** Gameplay copy caps per rarity (project dossier, economy v2.1). */
export const RARITY_SUPPLY: Array<[Rarity, string]> = [
  ['common', '2,000'], ['uncommon', '500'], ['rare', '100'], ['legendary', '10'], ['mythic', '1'],
];
