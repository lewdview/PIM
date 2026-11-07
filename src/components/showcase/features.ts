import { lazy, type ComponentType } from 'react';
import type { SceneProps } from './sceneKit';

/** The feature tour: one live demo per system, in the order a new player meets them. */
export interface Feature {
  id: string;
  name: string;
  /** Short tag for tabs and the reel's chapter rail. */
  tab: string;
  accent: string;
  headline: string;
  body: string;
  points: string[];
  route: string;
  Scene: ComponentType<SceneProps>;
}

export const FEATURES: Feature[] = [
  {
    id: 'play',
    name: 'Rhythm',
    tab: 'PLAY',
    accent: '#FF1493',
    headline: 'Every song is a stage.',
    body: 'Three lanes: bass, mids and treble. Hit each note as it crosses the line. Miss one and that part of the song drops out until you hit the next.',
    points: ['Taps, holds and swipes', 'Fever at 20 combo', 'Surge at 40', 'Signal Lock at 60'],
    route: '/arcade',
    Scene: lazy(() => import('./scenes/RhythmScene')),
  },
  {
    id: 'daily',
    name: '365 days',
    tab: '365',
    accent: '#FFB800',
    headline: 'A new song every day.',
    body: 'One song a day, all year. Today’s card is free, and it unlocks today’s stage.',
    points: ['365 songs', 'Free daily card', 'Light and dark months'],
    route: '/daily',
    Scene: lazy(() => import('./scenes/DailyScene')),
  },
  {
    id: 'packs',
    name: 'Packs',
    tab: 'PACKS',
    accent: '#B44DFF',
    headline: 'Play well. Rip packs.',
    body: 'Better accuracy earns bigger packs. Every card is capped, from 2,000 copies of a Common down to one Mythic.',
    points: ['Five rarities', 'Hard supply caps', 'Pity after 25 dry pulls'],
    route: '/vault/reveal',
    Scene: lazy(() => import('./scenes/PackScene')),
  },
  {
    id: 'claw',
    name: 'Bonus claw',
    tab: 'CLAW',
    accent: '#FDE047',
    headline: 'Three drops for 99¢.',
    body: 'The bonus claw holds every pack in the vault. One pull gets three drops, and the pull is only spent on the third.',
    points: ['99¢ a pull', 'Every pack is in there', 'Odds published'],
    route: '/bonus-claw',
    Scene: lazy(() => import('./scenes/ClawScene')),
  },
  {
    id: 'forge',
    name: 'Fusion lab',
    tab: 'FORGE',
    accent: '#FF5500',
    headline: 'Three of a kind fuse up.',
    body: 'Combine three copies of the same card into one of the next rarity. Burn spares for V⚡ sparks, or spend 150 V⚡ to raise a card one tier.',
    points: ['3 → 1, one tier up', 'Burn for V⚡', 'Upgrade for 150 V⚡'],
    route: '/vault/forge',
    Scene: lazy(() => import('./scenes/ForgeScene')),
  },
  {
    id: 'bombshells',
    name: 'Bombshells',
    tab: 'BOMBSHELLS',
    accent: '#FF4FB0',
    headline: 'Every day has alternate covers.',
    body: 'Bombshells are variant cover art for each day’s song. Own one for every day of a month and claim a V⚡ reward.',
    points: ['Variant covers per day', 'Month Complete: 1,000 V⚡', 'Month Mastered: 2,500 V⚡'],
    route: '/bombshells',
    Scene: lazy(() => import('./scenes/BombshellScene')),
  },
  {
    id: 'chain',
    name: 'Word chain',
    tab: 'CHAIN',
    accent: '#00E5FF',
    headline: 'Follow a word to the next song.',
    body: 'Lit words in a lyric are sung in other songs too. Tap one and jump to that moment. Every hop adds a line to your own found poem.',
    points: ['Hop by shared lyrics', 'Plays from that line', 'Builds a found poem'],
    route: '/chain',
    Scene: lazy(() => import('./scenes/ChainScene')),
  },
  {
    id: 'status',
    name: 'First discoverer',
    tab: 'STATUS',
    accent: '#39FF14',
    headline: 'Get there first.',
    body: 'Platinum a song before anyone else and its 1-of-1 First Discoverer card is yours. Streaks, pulls and rare cards all raise your prestige rank.',
    points: ['Bronze to Platinum medals', '1-of-1 gold stamp', 'Global prestige board'],
    route: '/vault/leaderboard',
    Scene: lazy(() => import('./scenes/StatusScene')),
  },
];
