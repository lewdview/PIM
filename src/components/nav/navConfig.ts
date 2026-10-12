// ════════════════════════════════════════════════════════════════════════════════
// navConfig.ts — One source of truth for the app shell's destinations.
// The top bar menus, the phone dock sheets and super search all read from here, so a
// new page only needs adding once.
// ════════════════════════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react';
import {
  Gamepad2, Play, Compass, CalendarDays, Trophy, GraduationCap,
  Home, Layers, Package, Gem, Bomb, BookOpen, Flame, Sparkles, Image,
  BarChart3, ShoppingBag, Gift,
  User, SlidersHorizontal, Monitor, Bell, LifeBuoy, FileText, PenTool,
} from 'lucide-react';

export type NavSectionId = 'play' | 'collect' | 'compete' | 'you';

/** Non-route actions the shell knows how to run. */
export type NavAction = 'options' | 'guide' | 'notifications' | 'hdr';

export interface NavItem {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  to?: string;
  action?: NavAction;
  /** Extra words super search matches on. */
  keywords?: string[];
  devOnly?: boolean;
}

export interface NavSection {
  id: NavSectionId;
  label: string;
  accent: string;
  /** Darker shade used for the 3D button lip. */
  accentDeep: string;
  icon: LucideIcon;
  /** Where tapping the section itself goes. */
  home: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'play',
    label: 'Play',
    accent: '#FF1E8C',
    accentDeep: '#A3005A',
    icon: Gamepad2,
    home: '/arcade',
    items: [
      { id: 'arcade', label: 'Arcade', to: '/arcade', icon: Gamepad2, desc: 'Quick-play the 3-lane rhythm engine', keywords: ['play', 'game', 'rhythm', 'engine', 'quick', 'pim'] },
      { id: 'daily', label: "Today's drop", to: '/daily', icon: Play, desc: "Play today's song before it rotates", keywords: ['daily', 'drop', 'today', 'stage'] },
      { id: 'campaign', label: 'Campaign', to: '/campaign', icon: Compass, desc: 'Monthly chapters across the 365 roadmap', keywords: ['story', 'chapters', 'roadmap', 'progress'] },
      { id: 'timeline', label: '365 timeline', to: '/365', icon: CalendarDays, desc: 'Every daily release, day by day', keywords: ['archive', 'calendar', 'timeline', 'days'] },
      { id: 'awards', label: 'Award play', to: '/songs', icon: Trophy, desc: 'Curated songs and score tiers', keywords: ['awards', 'curated', 'select', 'songs'] },
      { id: 'academy', label: 'Flight academy', to: '/tutorial', icon: GraduationCap, desc: 'Learn taps, holds and swipes', keywords: ['tutorial', 'learn', 'training', 'controls', 'mechanics'] },
    ],
  },
  {
    id: 'collect',
    label: 'Collect',
    accent: '#FF5500',
    accentDeep: '#9E2C00',
    icon: Layers,
    home: '/vault',
    items: [
      { id: 'vault', label: 'Vault HQ', to: '/vault', icon: Home, desc: "Claim today's card and see vault stats", keywords: ['home', 'daily', 'card', 'claim', 'dashboard'] },
      { id: 'collection', label: 'Collection', to: '/vault/collection', icon: Layers, desc: 'Your cards, foils and proofs', keywords: ['binder', 'inventory', 'cards', 'proofs'] },
      { id: 'reveal', label: 'Open packs', to: '/vault/reveal', icon: Package, desc: 'Rip earned booster packs', keywords: ['reveal', 'unbox', 'rip', 'pack', 'foil'] },
      { id: 'finds', label: 'Vault finds', to: '/vault/finds', icon: Gem, desc: 'Hidden finds, odds and the pull simulator', keywords: ['odds', 'simulator', 'finds', 'pulls'] },
      { id: 'bombshells', label: 'Bombshells', to: '/bombshells', icon: Bomb, desc: 'Variant covers and month rewards', keywords: ['variants', 'covers', 'month'] },
      { id: 'codex', label: 'Card codex', to: '/vault/codex', icon: BookOpen, desc: 'Full catalog and set completion', keywords: ['registry', 'catalog', 'set', 'tracker'] },
      { id: 'forge', label: 'Fusion lab', to: '/vault/forge', icon: Flame, desc: 'Fuse duplicates into higher rarities', keywords: ['forge', 'fusion', 'upgrade', 'burn', 'catalyst'] },
      { id: 'next-vault', label: 'Claw machine', to: '/next-vault', icon: Sparkles, desc: 'Robotic claw pack dispenser and token machines', keywords: ['claw', 'gacha', 'machine', 'nextgen'] },
      { id: 'hero', label: 'Hero exhibit', to: '/hero', icon: Image, desc: "Museum showcase of today's masterpiece", keywords: ['museum', 'showcase', 'exhibit', 'art'] },
    ],
  },
  {
    id: 'compete',
    label: 'Compete',
    accent: '#FFB800',
    accentDeep: '#A87600',
    icon: BarChart3,
    home: '/vault/leaderboard',
    items: [
      { id: 'leaderboard', label: 'Leaderboard', to: '/vault/leaderboard', icon: BarChart3, desc: 'Global accuracy and prestige ranks', keywords: ['rank', 'scores', 'top', 'high score', 'prestige'] },
      { id: 'shop', label: 'Shop', to: '/vault/earn', icon: ShoppingBag, desc: 'Token bundles, power-ups and cosmetics', keywords: ['earn', 'tokens', 'buy', 'store', 'bundles', 'market'] },
      { id: 'rewards', label: 'Daily rewards', to: '/vault/claim', icon: Gift, desc: 'Streak crates and token bonuses', keywords: ['claim', 'streak', 'redeem', 'crate', 'free'] },
    ],
  },
  {
    id: 'you',
    label: 'You',
    accent: '#00E5FF',
    accentDeep: '#007C8C',
    icon: User,
    home: '/profile',
    items: [
      { id: 'profile', label: 'Profile', to: '/profile', icon: User, desc: 'Identity, wallet and achievements', keywords: ['identity', 'wallet', 'avatar', 'th3scr1b3', 'account'] },
      { id: 'options', label: 'Audio & calibration', action: 'options', icon: SlidersHorizontal, desc: 'Latency offset, volume, lanes and skins', keywords: ['settings', 'options', 'latency', 'audio', 'offset', 'volume', 'keys'] },
      { id: 'hdr', label: '4K HDR display', action: 'hdr', icon: Monitor, desc: 'Turn the high dynamic range shaders on or off', keywords: ['4k', 'hdr', 'graphics', 'display', 'shaders'] },
      { id: 'notifications', label: 'Transmissions', action: 'notifications', icon: Bell, desc: 'Broadcasts and system alerts', keywords: ['notifications', 'alerts', 'news', 'inbox'] },
      { id: 'guide', label: 'Field guide', action: 'guide', icon: LifeBuoy, desc: 'Instruction booklet and mechanics', keywords: ['manual', 'help', 'how to'] },
      { id: 'legal', label: 'Terms & privacy', to: '/vault/legal', icon: FileText, desc: 'Terms, licenses and privacy policy', keywords: ['legal', 'terms', 'privacy', 'policy', 'license'] },
      { id: 'editor', label: 'Beatmap editor', to: '/admin/editor', icon: PenTool, desc: 'Custom note chart editor', devOnly: true },
      { id: 'card-designs', label: 'Card designs', to: '/admin/card-designs', icon: Image, desc: 'Foil design showcase', devOnly: true },
      { id: 'pitch-deck', label: 'Pitch deck', to: '/pitch-deck', icon: FileText, desc: 'Executive deck', devOnly: true },
    ],
  },
];

export const isDevMode = (): boolean => {
  try {
    return import.meta.env.DEV || localStorage.getItem('th3vault_dev_mode') === 'true';
  } catch {
    return import.meta.env.DEV;
  }
};

export const visibleItems = (items: NavItem[]) => {
  const dev = isDevMode();
  return items.filter((i) => !i.devOnly || dev);
};

/** Which section owns the current URL, for the active tab highlight. */
export function sectionForPath(path: string): NavSectionId | null {
  const starts = (prefixes: string[]) =>
    prefixes.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '-'));
  if (starts(['/vault/leaderboard', '/leaderboard', '/vault/earn', '/earn', '/shop', '/store', '/vault/claim', '/claim'])) return 'compete';
  if (starts(['/profile', '/user', '/hub', '/options', '/vault/legal', '/legal', '/admin', '/pitch-deck'])) return 'you';
  if (starts(['/arcade', '/pim', '/play', '/campaign', '/chapter', '/songs', '/song', '/listen', '/tutorial', '/365', '/day', '/daily', '/drop', '/today', '/results'])) return 'play';
  if (starts(['/vault', '/collection', '/reveal', '/vaultfinds', '/bombshells', '/forge', '/codex', '/next-vault', '/hero'])) return 'collect';
  return null;
}

/** The player's hub: today's song, claim, streak and recent songs. */
export const HOME_PATH = '/home';

/** Fired by anything that wants the shell to open the field guide. */
export const OPEN_GUIDE_EVENT = 'pim:open-guide';
