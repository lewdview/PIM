// ════════════════════════════════════════════════════════════════════════════════
// CommandPaletteModal.tsx — TH3SCR1B3 Global Command Matrix & Quick Jump HUD
// Day-locked search: strictly releases ≤ currentDay unless unlocked via Prophecy Card
// ════════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Gamepad2, Home, Flame, Zap, Shield, Sparkles,
  Music, BookOpen, Layers, Trophy, Settings, FileText, Bell,
  ChevronRight, History, X, Monitor, User,
  CornerDownLeft, Compass, Lock, Unlock, Radio
} from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useDisplayMode } from '../store/useDisplayMode';
import { getCurrentDay, formatDate, getMonthFromDay } from '../utils/dayCalc';
import staticSongCatalog from '../data/song_catalog.json';
import { haptics } from '../utils/haptics';

export interface CommandItem {
  id: string;
  category: 'modes' | 'vault' | 'tracks' | 'system';
  title: string;
  subtitle: string;
  icon: any;
  to?: string;
  action?: () => void;
  badge?: string;
  badgeColor?: string;
  accent?: string;
  day?: number;
  isProphecy?: boolean;
  keywords?: string[];
}

const RECENT_SEARCHES_KEY = 'th3scr1b3_recent_searches_v1';

export default function CommandPaletteModal() {
  const isOpen = useVaultStore((s) => s.commandPaletteOpen);
  const setOpen = useVaultStore((s) => s.setCommandPaletteOpen);
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);
  const collection = useVaultStore((s) => s.collection);
  const claimedRewards = useVaultStore((s) => s.claimedRewards);
  const { toggle: toggle4K } = useDisplayMode();
  const { setShowAuthModal } = useAuthStore();
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'modes' | 'vault' | 'tracks' | 'system'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    if (!term.trim()) return;
    try {
      const updated = [term.trim(), ...recentSearches.filter(s => s.toLowerCase() !== term.trim().toLowerCase())].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }, [recentSearches]);

  // Global hotkeys to open/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K or "/" when not typing in another input
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(!useVaultStore.getState().commandPaletteOpen);
        return;
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === 'Escape' && useVaultStore.getState().commandPaletteOpen) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build the complete Command Index with strict Day-locking & Prophecy Card support
  const commandIndex: CommandItem[] = useMemo(() => {
    const currentDay = getCurrentDay();

    // Determine days unlocked via prophecy cards or owned cards
    const prophecyDays = new Set<number>();
    collection.forEach((owned) => {
      if (owned.card?.day) {
        prophecyDays.add(owned.card.day);
      }
    });

    // Check claimedRewards or localStorage reward tiers for prophecy cards
    Object.entries(claimedRewards).forEach(([songId, tierList]) => {
      if (Array.isArray(tierList) && tierList.includes('prophecy')) {
        const match = songId.match(/(\d+)/);
        if (match) prophecyDays.add(parseInt(match[1], 10));
      }
    });

    const items: CommandItem[] = [
      // ── Core Modes ──
      {
        id: 'mode-arcade',
        category: 'modes',
        title: 'PIM Arcade Engine',
        subtitle: 'Quick-play 3-lane rhythm arcade & stage selector',
        icon: Gamepad2,
        to: '/arcade',
        badge: 'QUICK PLAY',
        badgeColor: '#FF1493',
        accent: '#FF1493',
        keywords: ['play', 'game', 'rhythm', 'engine', 'arcade', 'music'],
      },
      {
        id: 'mode-campaign',
        category: 'modes',
        title: 'PIM Story Campaign',
        subtitle: 'Monthly chapters & 365-day narrative roadmap',
        icon: Compass,
        to: '/campaign',
        badge: '365 ROADMAP',
        badgeColor: '#FF1493',
        accent: '#FF1493',
        keywords: ['campaign', 'story', 'chapters', 'roadmap', 'progress'],
      },
      {
        id: 'mode-songs',
        category: 'modes',
        title: 'PIM Award Play',
        subtitle: 'Curated song catalog & tier rankings',
        icon: Trophy,
        to: '/songs',
        badge: 'AWARDS',
        badgeColor: '#FF1493',
        accent: '#FF1493',
        keywords: ['songs', 'award', 'curated', 'select', 'leaderboard'],
      },
      {
        id: 'mode-tutorial',
        category: 'modes',
        title: 'PIM Flight Academy',
        subtitle: 'Master the 3-lane DSP controls, holds & swipes',
        icon: Radio,
        to: '/tutorial',
        badge: 'GUIDE',
        badgeColor: '#00E5FF',
        accent: '#00E5FF',
        keywords: ['tutorial', 'training', 'learn', 'controls', 'mechanics'],
      },

      // ── Vault & Economy Chambers ──
      {
        id: 'vault-home',
        category: 'vault',
        title: 'Vault Dashboard HQ',
        subtitle: 'Daily card release, claims & vault telemetry',
        icon: Home,
        to: '/vault',
        badge: 'DAILY DROP',
        badgeColor: '#FF5500',
        accent: '#FF5500',
        keywords: ['vault', 'home', 'daily', 'card', 'claim'],
      },
      {
        id: 'vault-next',
        category: 'vault',
        title: 'Next-Gen Vault Console',
        subtitle: 'Robotic claw pack dispenser & token machines',
        icon: Sparkles,
        to: '/next-vault',
        badge: 'INTERACTIVE',
        badgeColor: '#FF5500',
        accent: '#FF5500',
        keywords: ['claw', 'gacha', 'machine', 'nextgen', 'packs'],
      },
      {
        id: 'vault-hero',
        category: 'vault',
        title: 'Hero Exhibit & Museum',
        subtitle: 'Museum-grade showcase of the daily masterpiece',
        icon: Sparkles,
        to: '/hero',
        badge: 'EXHIBIT',
        badgeColor: '#FF5500',
        accent: '#FF5500',
        keywords: ['hero', 'museum', 'showcase', 'exhibit', 'art'],
      },
      {
        id: 'vault-collection',
        category: 'vault',
        title: 'Card Collection Binder',
        subtitle: 'Your TH3SCR1B3 cards, holographic variants & proofs',
        icon: Layers,
        to: '/vault/collection',
        badge: 'INVENTORY',
        badgeColor: '#FF5500',
        accent: '#FF5500',
        keywords: ['collection', 'cards', 'inventory', 'binder', 'proofs'],
      },
      {
        id: 'vault-reveal',
        category: 'vault',
        title: 'Pack Reveal Chamber',
        subtitle: 'Unseal earned booster packs & discover rare foils',
        icon: Sparkles,
        to: '/vault/reveal',
        badge: 'UNBOXING',
        badgeColor: '#FF5500',
        accent: '#FF5500',
        keywords: ['reveal', 'pack', 'unboxing', 'rip', 'foil'],
      },
      {
        id: 'vault-codex',
        category: 'vault',
        title: 'Codex & Card Catalog',
        subtitle: 'Universal registry & full set completion tracker',
        icon: BookOpen,
        to: '/vault/codex',
        badge: 'REGISTRY',
        badgeColor: '#FF5500',
        accent: '#FF5500',
        keywords: ['codex', 'catalog', 'set', 'tracker', 'database'],
      },
      {
        id: 'vault-forge',
        category: 'vault',
        title: 'Fusion Chamber Lab',
        subtitle: 'Synthesize & upgrade duplicate cards into mythics',
        icon: Flame,
        to: '/vault/forge',
        badge: 'FUSION BOOST',
        badgeColor: '#39FF14',
        accent: '#39FF14',
        keywords: ['forge', 'fusion', 'upgrade', 'burn', 'catalyst'],
      },
      {
        id: 'vault-leaderboard',
        category: 'vault',
        title: 'Global TH3SCR1B3 Leaderboard',
        subtitle: 'Real-time accuracy & prestige rankings on Base',
        icon: Trophy,
        to: '/vault/leaderboard',
        badge: 'COMPETITIVE',
        badgeColor: '#39FF14',
        accent: '#39FF14',
        keywords: ['leaderboard', 'rank', 'top', 'scores', 'high score'],
      },
      {
        id: 'earn-shop',
        category: 'vault',
        title: 'Vault Token Marketplace',
        subtitle: 'Acquire token bundles, power-ups & cosmetics',
        icon: Zap,
        to: '/vault/earn',
        badge: 'ECONOMY',
        badgeColor: '#E5B800',
        accent: '#E5B800',
        keywords: ['earn', 'tokens', 'shop', 'buy', 'bundles'],
      },
      {
        id: 'earn-claim',
        category: 'vault',
        title: 'Redeem Daily Rewards',
        subtitle: 'Claim streak bonuses, token crates & prizes',
        icon: Sparkles,
        to: '/vault/claim',
        badge: 'FREE CRATE',
        badgeColor: '#E5B800',
        accent: '#E5B800',
        keywords: ['redeem', 'claim', 'daily', 'streak', 'rewards'],
      },

      // ── System & Actions ──
      {
        id: 'sys-profile',
        category: 'system',
        title: 'TH3SCR1B3 Identity',
        subtitle: 'Manage profile, smart wallet, avatar & achievements',
        icon: User,
        to: '/profile',
        badge: 'IDENTITY',
        badgeColor: '#A855F7',
        accent: '#A855F7',
        keywords: ['profile', 'identity', 'scribe', 'user', 'avatar', 'th3scr1b3'],
      },
      {
        id: 'sys-transmissions',
        category: 'system',
        title: 'Transmissions & Broadcasts',
        subtitle: 'System notifications, game balance updates & logs',
        icon: Bell,
        action: () => useNotificationStore.getState().setIsOpen(true),
        badge: 'ALERTS',
        badgeColor: '#FF1493',
        accent: '#FF1493',
        keywords: ['notifications', 'transmissions', 'alerts', 'news', 'inbox'],
      },
      {
        id: 'sys-options',
        category: 'system',
        title: 'Options & Calibration',
        subtitle: 'Configure audio latency, 3-lane DSP filters & skins',
        icon: Settings,
        action: () => setOptionsModalOpen(true),
        badge: 'DSP AUDIO',
        badgeColor: '#A855F7',
        accent: '#A855F7',
        keywords: ['options', 'settings', 'audio', 'offset', 'volume', 'keys'],
      },
      {
        id: 'sys-wallet',
        category: 'system',
        title: 'Connect Base Smart Wallet',
        subtitle: 'Authorize with Coinbase Smart Wallet / EVM key',
        icon: Shield,
        action: () => setShowAuthModal(true),
        badge: 'BASE EVM',
        badgeColor: '#0052FF',
        accent: '#0052FF',
        keywords: ['wallet', 'connect', 'auth', 'base', 'coinbase', 'login'],
      },
      {
        id: 'sys-4k',
        category: 'system',
        title: 'Toggle 4K HDR Display Mode',
        subtitle: 'Switch high dynamic range visual shaders on/off',
        icon: Monitor,
        action: () => toggle4K(),
        badge: 'SHADERS',
        badgeColor: '#FFD700',
        accent: '#FFD700',
        keywords: ['4k', 'hdr', 'graphics', 'display', 'resolution'],
      },
      {
        id: 'sys-legal',
        category: 'system',
        title: 'Terms of Protocol & Legal',
        subtitle: 'Smart contract licenses, privacy & security policies',
        icon: FileText,
        to: '/vault/legal',
        badge: 'LEGAL',
        badgeColor: '#888888',
        accent: '#888888',
        keywords: ['legal', 'terms', 'privacy', 'policy', 'license'],
      },
    ];

    // ── 365 Song Releases (Day-Locked & Prophecy Card Supported) ──
    if (Array.isArray(staticSongCatalog)) {
      staticSongCatalog.forEach((song: any) => {
        if (!song || !song.day) return;
        const dayNum = song.day;
        const isFuture = dayNum > currentDay;
        const hasProphecy = prophecyDays.has(dayNum);

        // STRICT RULE: If it's a future day and the user DOES NOT own a prophecy/unlocked card, DO NOT include in search
        if (isFuture && !hasProphecy) {
          return;
        }

        const monthName = getMonthFromDay(dayNum);
        const formattedDate = formatDate(dayNum);
        const title = song.title || `Day ${dayNum}`;
        const bpm = song.bpm ? `${song.bpm} BPM` : '100 BPM';
        const mood = song.mood ? song.mood.toUpperCase() : 'ENERGY';

        items.push({
          id: `track-day-${dayNum}`,
          category: 'tracks',
          day: dayNum,
          isProphecy: isFuture && hasProphecy,
          title: `Day ${dayNum}: ${title}`,
          subtitle: `${formattedDate} // ${bpm} • ${mood} • ${monthName.toUpperCase()}`,
          icon: Music,
          to: `/play/day-${String(dayNum).padStart(3, '0')}`,
          badge: isFuture && hasProphecy ? '✦ PROPHECY' : `DAY ${dayNum}`,
          badgeColor: isFuture && hasProphecy ? '#A855F7' : '#FF1493',
          accent: isFuture && hasProphecy ? '#A855F7' : '#FF1493',
          keywords: [
            `day ${dayNum}`,
            `day${dayNum}`,
            title.toLowerCase(),
            monthName.toLowerCase(),
            song.artist ? song.artist.toLowerCase() : '',
            ...(Array.isArray(song.genre) ? song.genre.map((g: string) => g.toLowerCase()) : []),
          ],
        });
      });
    }

    return items;
  }, [collection, claimedRewards, setOptionsModalOpen, setShowAuthModal, toggle4K]);

  // Filter items by query and active category
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commandIndex.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!q) return true;

      const inTitle = item.title.toLowerCase().includes(q);
      const inSubtitle = item.subtitle.toLowerCase().includes(q);
      const inBadge = item.badge?.toLowerCase().includes(q);
      const inKeywords = item.keywords?.some((k) => k.includes(q));

      return inTitle || inSubtitle || inBadge || inKeywords;
    });
  }, [commandIndex, query, activeCategory]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      haptics.lightTap();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      haptics.lightTap();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        executeItem(filteredItems[selectedIndex]);
      }
    }
  };

  const executeItem = (item: CommandItem) => {
    haptics.mediumTap();
    saveRecentSearch(query || item.title);
    setOpen(false);

    if (item.action) {
      item.action();
    } else if (item.to) {
      setLocation(item.to);
    }
  };

  // Gamepad / Controller Navigation inside Command Palette
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;
    let lastNavTime = 0;
    let prevA = false;
    let prevB = false;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gamepads).find(g => g !== null && g.connected);

      if (gp) {
        const now = performance.now();
        const dpadUp = gp.buttons[12]?.pressed || (gp.axes[1] !== undefined && gp.axes[1] < -0.5);
        const dpadDown = gp.buttons[13]?.pressed || (gp.axes[1] !== undefined && gp.axes[1] > 0.5);
        const btnA = gp.buttons[0]?.pressed || false;
        const btnB = gp.buttons[1]?.pressed || false;

        // Up / Down navigation with debounce
        if (now - lastNavTime > 180) {
          if (dpadDown) {
            setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
            haptics.lightTap();
            lastNavTime = now;
          } else if (dpadUp) {
            setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
            haptics.lightTap();
            lastNavTime = now;
          }
        }

        // A button to select
        if (btnA && !prevA) {
          if (filteredItems[selectedIndex]) {
            executeItem(filteredItems[selectedIndex]);
          }
        }

        // B button to close
        if (btnB && !prevB) {
          setOpen(false);
        }

        prevA = btnA;
        prevB = btnB;
      }

      animId = requestAnimationFrame(pollGamepad);
    };

    animId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, filteredItems, selectedIndex, setOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-start justify-center pt-16 sm:pt-24 px-3 sm:px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
          onClick={() => setOpen(false)}
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-2xl bg-[#080706]/95 border border-[#ff3800]/30 shadow-[0_20px_70px_rgba(0,0,0,0.9),0_0_30px_rgba(255,56,0,0.2)] rounded-lg overflow-hidden flex flex-col max-h-[80vh] z-10"
          style={{
            clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
          }}
        >
          {/* Header Strip */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#ff3800]/15 border-b border-[#ff3800]/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#ff3800] rounded-full animate-pulse shadow-[0_0_8px_#ff3800]" />
              <span className="font-mono text-[10px] font-black uppercase tracking-widest text-[#ff7700]">
                TH3SCR1B3 // COMMAND MATRIX & QUICK JUMP
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] text-white/50">
              <span className="hidden sm:inline bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                DAY LOCK ACTIVE
              </span>
              <button
                onClick={() => setOpen(false)}
                className="hover:text-white transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="relative flex items-center px-4 py-3.5 border-b border-white/10 bg-black/40">
            <Search size={18} className="text-[#ff5500] shrink-0 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Jump to any mode, 365 track, vault lab, or setting... (Type 'Day 1', 'Forge', etc.)"
              className="w-full bg-transparent text-white font-mono text-sm sm:text-base outline-none placeholder:text-white/30"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-white/40 hover:text-white p-1"
                title="Clear query"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-black/30 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'all', label: 'ALL COMMANDS', count: commandIndex.length },
                { id: 'modes', label: 'EXPEDITIONS', count: commandIndex.filter(i => i.category === 'modes').length },
                { id: 'vault', label: 'VAULT & FORGE', count: commandIndex.filter(i => i.category === 'vault').length },
                { id: 'tracks', label: '365 TRACKS', count: commandIndex.filter(i => i.category === 'tracks').length },
                { id: 'system', label: 'SYSTEM', count: commandIndex.filter(i => i.category === 'system').length },
              ] as const
            ).map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    haptics.lightTap();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] font-mono text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#ff3800] text-black shadow-[0_0_10px_rgba(255,56,0,0.5)] font-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[8px] opacity-70 ${active ? 'text-black' : 'text-white/40'}`}>
                    ({cat.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Recent Searches (when query is empty) */}
          {!query && recentSearches.length > 0 && (
            <div className="px-4 py-2 border-b border-white/5 bg-black/20 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="font-mono text-[8px] text-white/40 uppercase tracking-widest shrink-0 flex items-center gap-1">
                <History size={10} /> RECENT:
              </span>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-[#ff3800]/20 hover:text-[#ff7700] text-white/70 font-mono text-[9px] transition-colors whitespace-nowrap cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          )}

          {/* Results List */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[220px] max-h-[360px] custom-scrollbar"
          >
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
                <Lock size={28} className="mb-2 text-[#ff3800]/60 animate-bounce" />
                <span className="font-impact text-lg text-white/80 uppercase tracking-wider">
                  No Accessible Transmissions Found
                </span>
                <span className="font-mono text-[10px] text-white/40 max-w-sm mt-1">
                  Future 365 releases are locked to current calendar day unless unlocked via a Prophecy Card in your Vault.
                </span>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const ItemIcon = item.icon;
                const isSelected = idx === selectedIndex;

                return (
                  <div
                    key={item.id}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-[#ff3800]/18 border-l-4 border-[#ff3800] pl-3 shadow-[inset_0_0_15px_rgba(255,56,0,0.15)]'
                        : 'bg-transparent border-l-4 border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded shrink-0 border"
                        style={{
                          background: isSelected ? `${item.accent || '#ff3800'}25` : 'rgba(255,255,255,0.03)',
                          borderColor: isSelected ? `${item.accent || '#ff3800'}60` : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <ItemIcon
                          size={16}
                          style={{ color: isSelected ? item.accent || '#ff3800' : 'rgba(255,255,255,0.6)' }}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-impact text-sm sm:text-base uppercase tracking-tight truncate ${
                              isSelected ? 'text-white' : 'text-white/85'
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.badge && (
                            <span
                              className="font-mono text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0"
                              style={{
                                background: `${item.badgeColor || '#ff3800'}22`,
                                color: item.badgeColor || '#ff3800',
                                border: `1px solid ${item.badgeColor || '#ff3800'}40`,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.isProphecy && (
                            <span className="font-mono text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center gap-0.5">
                              <Unlock size={8} /> PROPHECY UNLOCKED
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[9px] text-white/40 uppercase tracking-wide truncate">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected ? (
                        <span className="flex items-center gap-1 font-mono text-[9px] font-bold text-[#ff5500] uppercase tracking-wider">
                          ENTER <CornerDownLeft size={10} />
                        </span>
                      ) : (
                        <ChevronRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Controls & Telemetry */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-t border-white/10 font-mono text-[9px] text-white/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/80">↑</kbd>
                <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/80">↓</kbd> NAVIGATE
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/80">↵</kbd> SELECT
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/80">ESC</kbd> CLOSE
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[#ff7700]">
              <span>TH3SCR1B3 PROTOCOL v2.1</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
