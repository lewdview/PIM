// ════════════════════════════════════════════════════════════════════════════════
// Navbar.tsx — PIM : th3v4ult Command Console & Mega-Menu Navigation System
// 5-Pass Visual Fidelity: 2-Column Tactical Dropdowns, Live Telemetry Spotlights,
// Integrated ⌘K Command Matrix, Mobile Launchpad & Brutalist Cyberpunk Polish
// ════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home, Layers, Trophy, Wallet, LogOut, Zap, X, FileText,
  Flame, BookOpen, Monitor, Gift, Settings, Image, Map, Sparkles,
  User, ChevronDown, ChevronRight, Gamepad2, GraduationCap, LayoutGrid, Bell,
  Search, Radio, Shield, CheckCircle2, CornerDownLeft, Volume2, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useDisplayMode } from '../store/useDisplayMode';
import { useNotificationStore } from '../store/useNotificationStore';
import GuideModal from './GuideModal';
import { haptics } from '../utils/haptics';
import FloatingTicker from './FloatingTicker';
import { getIdenticon } from '../utils/identicon';
import { audioManager } from '../game/audio';
import {
  PlaySpotlight,
  VaultSpotlight,
  ForgeSpotlight,
  EarnSpotlight,
  SystemSpotlight
} from './NavbarSpotlightWidgets';

const isDev = import.meta.env.DEV || localStorage.getItem('th3vault_dev_mode') === 'true';

// ── Menu Section Definitions ──────────────────────────────────────────────────
export interface MenuItem {
  to?: string;
  action?: string;
  label: string;
  icon: any;
  desc: string;
  badge?: string;
  badgeColor?: string;
  devOnly?: boolean;
}

export interface MenuSection {
  id: string;
  label: string;
  tagline: string;
  accent: string;
  accentGlow: string;
  icon: any;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    id: 'play',
    label: 'Play',
    tagline: '3-LANE RHYTHM ARCADE & 365 EXPEDITIONS',
    accent: '#FF1493',
    accentGlow: 'rgba(255, 20, 147, 0.4)',
    icon: Gamepad2,
    items: [
      { to: '/arcade', label: 'PIM Arcade', icon: Monitor, desc: 'Quick-play 3-lane DSP rhythm engine', badge: 'QUICK PLAY', badgeColor: '#FF1493' },
      { to: '/campaign', label: 'PIM Campaign', icon: Compass, desc: 'Story chapters & 365 roadmaps', badge: '365 ROADMAP', badgeColor: '#FF1493' },
      { to: '/365', label: '365 Timeline', icon: BookOpen, desc: 'Daily release archive & stages', badge: 'ARCHIVE', badgeColor: '#00E5FF' },
      { to: '/songs', label: 'PIM Award Play', icon: Trophy, desc: 'Curated song selection & score tiers', badge: 'AWARDS', badgeColor: '#FFD700' },
      { to: '/tutorial', label: 'PIM Flight Academy', icon: GraduationCap, desc: 'Master the 3-lane controls, holds & swipes', badge: 'TRAINING', badgeColor: '#39FF14' },
    ],
  },
  {
    id: 'vault',
    label: 'Vault',
    tagline: 'COLLECTIBLE CARDS & PACK DISPENSARY',
    accent: '#FF5500',
    accentGlow: 'rgba(255, 85, 0, 0.4)',
    icon: Home,
    items: [
      { to: '/vault', label: 'Vault HQ', icon: Home, desc: 'Daily card & vault dashboard', badge: 'DAILY DROP', badgeColor: '#FF5500' },
      { to: '/next-vault', label: 'Next-Gen Vault', icon: Sparkles, desc: 'Robotic claw & token machine', badge: 'CLAW GACHA', badgeColor: '#FF7700' },
      { to: '/hero', label: 'Hero Exhibit', icon: Image, desc: 'Museum-grade daily masterpiece showcase', badge: 'MUSEUM', badgeColor: '#FFAA00' },
      { to: '/vault/collection', label: 'Collection Binder', icon: Layers, desc: 'Your TH3SCR1B3 cards & proofs', badge: 'INVENTORY', badgeColor: '#FF5500' },
      { to: '/vault/reveal', label: 'Pack Reveal', icon: Sparkles, desc: 'Open earned booster packs', badge: 'UNBOX', badgeColor: '#FF1493' },
      { to: '/vault/codex', label: 'Card Codex', icon: BookOpen, desc: 'Card catalog & set tracker', badge: 'REGISTRY', badgeColor: '#39FF14' },
    ],
  },
  {
    id: 'forge',
    label: 'Forge',
    tagline: 'FUSION CHAMBER & GLOBAL PRESTIGE',
    accent: '#39FF14',
    accentGlow: 'rgba(57, 255, 20, 0.4)',
    icon: Flame,
    items: [
      { to: '/vault/forge', label: 'Fusion Lab', icon: Flame, desc: 'Synthesize & upgrade card rarities', badge: '2X BOOST', badgeColor: '#39FF14' },
      { to: '/vault/leaderboard', label: 'Global Leaderboard', icon: Trophy, desc: 'Real-time accuracy & prestige rankings', badge: 'BASE EVM', badgeColor: '#0052FF' },
    ],
  },
  {
    id: 'earn',
    label: 'Earn',
    tagline: 'TOKEN ECONOMY & DAILY CRATES',
    accent: '#E5B800',
    accentGlow: 'rgba(229, 184, 0, 0.4)',
    icon: Zap,
    items: [
      { to: '/vault/earn', label: 'Token Marketplace', icon: Zap, desc: 'Acquire token bundles & cosmetics', badge: 'BUNDLES', badgeColor: '#E5B800' },
      { to: '/vault/claim', label: 'Redeem Daily Rewards', icon: Gift, desc: 'Claim streak crates & token bonuses', badge: 'FREE CRATE', badgeColor: '#39FF14' },
    ],
  },
  {
    id: 'more',
    label: 'System',
    tagline: 'TH3SCR1B3 IDENTITY & HARDWARE CONFIG',
    accent: '#A855F7',
    accentGlow: 'rgba(168, 85, 247, 0.4)',
    icon: LayoutGrid,
    items: [
      { to: '/365', label: '365 Archive', icon: BookOpen, desc: 'Chronological timeline of all 365 days', badge: 'TIMELINE', badgeColor: '#A855F7' },
      { action: 'notifications', label: 'Transmissions', icon: Bell, desc: 'Broadcasts & system alerts', badge: 'ALERTS', badgeColor: '#FF1493' },
      { to: '/profile', label: 'TH3SCR1B3 Identity', icon: User, desc: 'Manage TH3SCR1B3 ID & wallet keys', badge: 'PROFILE', badgeColor: '#A855F7' },
      { action: 'options', label: 'Audio & Calibration', icon: Settings, desc: 'Audio latency, 3-lane DSP & skins', badge: 'DSP AUDIO', badgeColor: '#A855F7' },
      { action: 'guide', label: 'Field Guide', icon: BookOpen, desc: 'Instruction booklet & mechanics', badge: 'MANUAL', badgeColor: '#00E5FF' },
      { to: '/vault/legal', label: 'Protocol Legal', icon: FileText, desc: 'Terms & smart contract policies', badge: 'LEGAL', badgeColor: '#888888' },
      { to: '/admin/editor', label: 'Beatmap Editor', icon: Monitor, desc: 'Custom note chart editor', badge: 'DEV ONLY', badgeColor: '#FF3800', devOnly: true },
      { to: '/admin/card-designs', label: 'Card Designs', icon: Image, desc: 'Foil design showcase', badge: 'DEV ONLY', badgeColor: '#FF3800', devOnly: true },
      { to: '/pitch-deck', label: 'Pitch Deck', icon: FileText, desc: 'Executive deck', badge: 'DEV ONLY', badgeColor: '#FF3800', devOnly: true },
    ],
  },
];

// Mobile bottom-left vertical quick-access tabs
const mobileQuickTabs = [
  { id: 'play', to: '/arcade', label: 'Play', icon: Gamepad2, accent: '#FF1493', glow: 'rgba(255, 20, 147, 0.4)' },
  { id: 'vault', to: '/vault', label: 'Vault', icon: Home, accent: '#FF5500', glow: 'rgba(255, 85, 0, 0.4)' },
  { id: 'earn', to: '/vault/earn', label: 'Earn', icon: Zap, accent: '#E5B800', glow: 'rgba(229, 184, 0, 0.4)' },
];

// Active section detector from current URL
function getActiveSection(path: string): string | null {
  if (['/arcade', '/pim', '/play', '/campaign', '/songs', '/tutorial', '/chapter', '/slideshow', '/voyeur'].some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '-'))) return 'play';
  if (['/vault', '/collection', '/forge', '/shop', '/vault/earn', '/codex', '/365', '/day'].some(p => path === p || path.startsWith(p + '/'))) return 'vault';
  if (['/leaderboard', '/profile', '/deck', '/options', '/guide'].some(p => path.startsWith(p))) return 'more';
  if (['/editor', '/admin'].some(p => path.startsWith(p))) return 'more';
  return null;
}

// ── Brand Logotype ────────────────────────────────────────────────────────────
function VaultLogo() {
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 no-underline group shrink-0 select-none cursor-pointer"
      aria-label="TH3SCR1B3 : PIM Vault home"
      onClick={() => setOptionsModalOpen(false)}
    >
      <img
        src="/data/logos/top_left_site.png"
        alt="TH3SCR1B3"
        className="h-10 sm:h-11 md:h-12 w-auto max-w-[190px] sm:max-w-[230px] object-contain transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-95 filter drop-shadow-[0_2px_12px_rgba(255,184,0,0.35)]"
      />
    </Link>
  );
}

// ── Token Pill ────────────────────────────────────────────────────────────────
function TokenPill({ balance, compact = false }: { balance: number; compact?: boolean }) {
  const lit = balance > 0;
  return (
    <Link
      to="/vault/earn"
      className="no-underline hover:scale-105 active:scale-95 transition-all flex select-none cursor-pointer"
      title="Earn Vault Tokens"
      onClick={() => audioManager.playSfx('tap_nav', 0.2)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: compact ? '5px 10px' : '6px 12px',
          border: '1.5px solid #000',
          background: lit ? '#ff9900' : '#1a1610',
          color: lit ? '#000' : '#555',
          boxShadow: lit ? '2px 2px 0 #000, 0 0 12px rgba(255,153,0,0.4)' : '2px 2px 0 #000',
          transition: 'all 0.3s ease',
          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
          flexShrink: 0,
        }}
      >
        <Zap size={11} className={lit ? "animate-pulse" : ""} />
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 900 }}>
          {balance}
        </span>
      </div>
    </Link>
  );
}

// ── Main Navigation Component ─────────────────────────────────────────────────
export default function Navbar() {
  const [location] = useLocation();
  const { user, signOut, status, error: authError, setShowAuthModal } = useAuthStore();
  const isAnonymous = user?.is_anonymous ||
                      user?.app_metadata?.provider === 'anonymous' ||
                      (!user?.email && !user?.user_metadata?.wallet && !user?.user_metadata?.wallet_address);
  const tokenBalance = useVaultStore(s => s.tokenBalance);
  const displayName = useVaultStore(s => s.displayName);
  const avatarUrl = useVaultStore(s => s.avatarUrl);
  const currentTrack = useGlobalPlayer(s => s.currentTrack);
  const { is4K, toggle: toggle4K, detectCapability } = useDisplayMode();
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);
  const setCommandPaletteOpen = useVaultStore((s) => s.setCommandPaletteOpen);

  // Nav state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [mobileFilterQuery, setMobileFilterQuery] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const activeSection = getActiveSection(location);

  const handleConnectWallet = () => {
    setShowAuthModal(true);
  };

  useEffect(() => {
    detectCapability();
  }, [detectCapability]);

  // Close all menus on navigation
  useEffect(() => {
    setActiveMenu(null);
    setCommandPanelOpen(false);
  }, [location]);

  // Desktop mega-menu hover handlers with safe exit hysteresis timer
  const handleMenuEnter = useCallback((sectionId: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveMenu(sectionId);
  }, []);

  const handleMenuLeave = useCallback(() => {
    closeTimerRef.current = window.setTimeout(() => {
      setActiveMenu(null);
    }, 180);
  }, []);

  // Handle item clicks (for action items like Options, Guide, Transmissions)
  const handleItemClick = useCallback((item: MenuItem) => {
    setActiveMenu(null);
    setCommandPanelOpen(false);
    haptics.lightTap();
    audioManager.playSfx('tap_nav', 0.35);

    if (item.action === 'options') {
      setOptionsModalOpen(true);
    } else if (item.action === 'guide') {
      setGuideOpen(true);
    } else if (item.action === 'notifications') {
      useNotificationStore.getState().setIsOpen(true);
    }
  }, [setOptionsModalOpen]);

  // Filter dev-only items
  const getVisibleItems = (items: MenuItem[]) =>
    items.filter(item => !item.devOnly || isDev);

  // Render appropriate spotlight widget for each section
  const renderSpotlightWidget = (sectionId: string) => {
    const handleClose = () => setActiveMenu(null);
    switch (sectionId) {
      case 'play':
        return <PlaySpotlight onClose={handleClose} />;
      case 'vault':
        return <VaultSpotlight onClose={handleClose} />;
      case 'forge':
        return <ForgeSpotlight onClose={handleClose} />;
      case 'earn':
        return <EarnSpotlight onClose={handleClose} />;
      case 'more':
        return <SystemSpotlight onClose={handleClose} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <div onMouseLeave={handleMenuLeave} className="relative z-[101]">
        <nav
          className="sticky top-0 px-3 md:px-6"
          style={{
            background: 'rgba(8, 6, 4, 0.65)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            borderBottom: activeMenu
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(255,56,0,0.18)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-center justify-between h-15 md:h-16 gap-3 py-1">
            {/* ── Left: Logo & Attributions ── */}
            <div className="flex items-center gap-3 shrink-0">
              <VaultLogo />
            </div>

            {/* ── Center: Mega-Menu Tabs (Desktop) ── */}
            <div className="hidden md:flex items-center gap-1.5 justify-center">
              {menuSections.map((section) => {
                const SectionIcon = section.icon;
                const isActive = activeSection === section.id;
                const isOpen = activeMenu === section.id;

                return (
                  <button
                    key={section.id}
                    onMouseEnter={() => {
                      handleMenuEnter(section.id);
                      audioManager.playSfx('tap_nav', 0.1);
                    }}
                    onClick={() => {
                      haptics.lightTap();
                      audioManager.playSfx('tap_nav', 0.25);
                      setActiveMenu(activeMenu === section.id ? null : section.id);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer select-none"
                    style={{
                      background: isActive
                        ? section.accent
                        : isOpen
                          ? `${section.accent}20`
                          : 'rgba(255,255,255,0.03)',
                      color: isActive ? '#000' : isOpen ? section.accent : 'rgba(255,255,255,0.75)',
                      border: isActive
                        ? '1.5px solid #000'
                        : isOpen
                          ? `1px solid ${section.accent}50`
                          : '1px solid rgba(255,255,255,0.07)',
                      clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
                      boxShadow: isActive
                        ? `2px 2px 0 #000, 0 0 14px ${section.accentGlow}`
                        : isOpen
                          ? `0 0 16px ${section.accentGlow.replace('0.4', '0.2')}`
                          : 'none',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '11px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                    title={section.label}
                  >
                    <SectionIcon size={13} />
                    <span>{section.label}</span>
                    <ChevronDown
                      size={10}
                      style={{
                        transition: 'transform 0.2s ease',
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        opacity: 0.6,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* ── Right: Desktop Controls ── */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {/* ⌘K Command Palette Quick Jump Trigger */}
              <button
                onClick={() => {
                  setCommandPaletteOpen(true);
                  haptics.lightTap();
                  audioManager.playSfx('tap_nav', 0.2);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/5 hover:bg-[#ff3800]/20 border border-white/10 hover:border-[#ff3800]/50 text-white/70 hover:text-white transition-all cursor-pointer select-none group"
                title="Open TH3SCR1B3 Command Matrix (Cmd+K or /)"
              >
                <Search size={12} className="text-[#ff5500] group-hover:scale-110 transition-transform" />
                <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-white/60 group-hover:text-white">
                  SEARCH
                </span>
                <kbd className="font-mono text-[8px] bg-black/60 px-1 py-0.5 rounded border border-white/15 text-[#ffaa00]">
                  ⌘K
                </kbd>
              </button>

              {/* Direct Play Arcade CTA */}
              <Link
                to="/arcade"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-[#FF1493]/25 via-[#FF5500]/20 to-[#00E5FF]/25 hover:from-[#FF1493]/40 hover:to-[#00E5FF]/40 border border-[#FF1493]/60 text-white font-mono text-[10px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(255,20,147,0.3)] transition-all hover:scale-105 active:scale-95 cursor-pointer no-underline mr-1"
                title="Launch PIM (Poetry in Motion) Rhythm Arcade"
                onClick={() => haptics.lightTap()}
              >
                <Gamepad2 size={13} className="text-[#FF1493] animate-pulse" />
                <span>PLAY PIM</span>
              </Link>

              {/* 4K HDR Toggle */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer"
                style={{
                  background: is4K ? 'rgba(255,215,0,0.06)' : 'transparent',
                  border: is4K ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent',
                  transition: 'all 0.3s ease',
                }}
                onClick={toggle4K}
                title="Toggle 4K HDR mode"
              >
                <Monitor size={11} style={{ color: is4K ? '#ffd700' : 'rgba(255,255,255,0.3)', transition: 'color 0.3s' }} />
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '8px',
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  color: is4K ? '#ffd700' : 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                  transition: 'color 0.3s',
                  whiteSpace: 'nowrap',
                }}>
                  {is4K ? '4K HDR' : 'HDR'}
                </span>
                <div
                  className={`toggle-4k${is4K ? ' active' : ''}`}
                  role="switch"
                  aria-checked={is4K}
                  aria-label="Toggle 4K HDR mode"
                />
              </div>

              {/* Notification Bell */}
              <button
                onClick={() => {
                  useNotificationStore.getState().setIsOpen(true);
                  haptics.lightTap();
                  audioManager.playSfx('tap_nav', 0.2);
                }}
                className="relative flex items-center justify-center w-8 h-8 border border-white/10 hover:border-pink-500/50 bg-black/40 hover:bg-pink-500/10 transition-all rounded-[2px] cursor-pointer"
                title="System Transmissions & Broadcasts"
                aria-label="System Transmissions"
              >
                <Bell size={15} className={useNotificationStore.getState().unreadCount > 0 ? "text-[#ff1493] animate-pulse" : "text-white/60 hover:text-white"} />
                {useNotificationStore.getState().unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 flex items-center justify-center bg-[#ff1493] text-black font-mono font-black text-[8px] rounded-full shadow-[0_0_8px_#ff1493]"
                  >
                    {useNotificationStore.getState().unreadCount > 9 ? '9+' : useNotificationStore.getState().unreadCount}
                  </span>
                )}
              </button>

              <TokenPill balance={tokenBalance} />

              {/* Wallet / TH3SCR1B3 Identity */}
              {user && !isAnonymous ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 no-underline transition-all hover:scale-105"
                    title="Manage TH3SCR1B3 Identity"
                  >
                    {(() => {
                      if (avatarUrl) {
                        return (
                          <img
                            src={avatarUrl}
                            alt="avatar"
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              border: '1.5px solid #ff3800',
                              objectFit: 'cover',
                              background: '#111',
                            }}
                          />
                        );
                      }
                      const ident = getIdenticon(user?.id || '', displayName);
                      return (
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: '1.5px solid #ff3800',
                            background: ident.bgColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '9px',
                            fontWeight: 900,
                            color: 'rgba(255,255,255,0.85)',
                            flexShrink: 0,
                          }}
                        >
                          {ident.initials}
                        </div>
                      );
                    })()}
                    <div
                      className="sticker-gun-tag sticker-slits"
                      style={{
                        background: '#fff5f0',
                        '--slit-color': 'rgba(255,56,0,0.1)',
                        padding: '5px 10px',
                        transform: 'rotate(-1deg)',
                        cursor: 'pointer',
                      } as any}
                    >
                      <span className="text-[9px] font-black tracking-tighter uppercase" style={{ color: '#1a0a00' }}>
                        {displayName || (() => {
                          const email = user?.email;
                          if (email) {
                            const cleaned = email.split('@')[0];
                            if (cleaned.startsWith('0x') && cleaned.length === 42) {
                              return `${cleaned.slice(0, 6)}...${cleaned.slice(-4)}`;
                            }
                            return cleaned;
                          }
                          return user?.id.slice(0, 8) || 'TH3SCR1B3';
                        })()}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); signOut(); }}
                    className="p-2 rounded-full transition-all hover:bg-white/10 active:scale-90 cursor-pointer"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Disconnect Wallet"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              ) : user && isAnonymous ? (
                <div className="flex items-center gap-2">
                  <div
                    className="sticker-gun-tag sticker-slits"
                    style={{
                      background: '#f0f4ff',
                      '--slit-color': 'rgba(0,100,255,0.1)',
                      padding: '5px 10px',
                      transform: 'rotate(-1deg)',
                    } as any}
                  >
                    <span className="text-[9px] font-black tracking-tighter uppercase" style={{ color: '#0033aa' }}>
                      GUEST WALLET
                    </span>
                  </div>
                  <button
                    onClick={handleConnectWallet}
                    disabled={status === 'loading'}
                    className="sticker-gun-tag sticker-slits font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                    style={{
                      background: authError ? '#ff3800' : 'var(--color-neon-gold)',
                      color: '#000',
                      '--slit-color': 'rgba(0,0,0,0.12)',
                      padding: '6px 14px',
                      transform: 'rotate(1deg)',
                      boxShadow: `2px 2px 0 #000, 0 0 10px ${authError ? 'rgba(255,56,0,0.3)' : 'rgba(255,215,0,0.3)'}`,
                      border: '1.5px solid #000',
                    } as any}
                  >
                    <div className="flex items-center gap-1">
                      {status === 'loading' ? (
                        <div className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Wallet size={11} />
                      )}
                      <span>{status === 'loading' ? 'Connecting...' : 'Connect Identity'}</span>
                    </div>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  disabled={status === 'loading'}
                  className="sticker-gun-tag sticker-slits font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                  style={{
                    background: authError ? '#ff3800' : 'var(--color-neon-gold)',
                    color: '#000',
                    '--slit-color': 'rgba(0,0,0,0.12)',
                    padding: '7px 16px',
                    transform: 'rotate(1deg)',
                    boxShadow: `3px 3px 0 #000, 0 0 14px ${authError ? 'rgba(255,56,0,0.4)' : 'rgba(255,215,0,0.4)'}`,
                    border: '2px solid #000',
                  } as any}
                >
                  <div className="flex items-center gap-1.5">
                    {status === 'loading' ? (
                      <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Wallet size={13} />
                    )}
                    <span>{status === 'loading' ? 'Connecting...' : authError ? 'Retry Connect' : 'Connect Identity'}</span>
                  </div>
                </button>
              )}
            </div>

            {/* ── Right: Mobile Controls ── */}
            <div className="flex md:hidden items-center gap-1.5">
              {/* Mobile ⌘K Search Icon */}
              <button
                onClick={() => {
                  setCommandPaletteOpen(true);
                  haptics.lightTap();
                }}
                className="flex items-center justify-center w-9 h-9 border border-white/15 bg-black/50 text-[#ff5500] active:scale-95 transition-all rounded-[2px]"
                aria-label="Open Command Search"
              >
                <Search size={15} />
              </button>

              <button
                onClick={() => {
                  useNotificationStore.getState().setIsOpen(true);
                  haptics.lightTap();
                }}
                className="relative flex items-center justify-center w-9 h-9 border border-white/15 bg-black/50 text-white/80 active:scale-95 transition-all rounded-[2px]"
                aria-label="Open Transmissions"
              >
                <Bell size={15} className={useNotificationStore.getState().unreadCount > 0 ? "text-[#ff1493]" : "text-white/70"} />
                {useNotificationStore.getState().unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center bg-[#ff1493] text-black font-mono font-black text-[8px] rounded-full"
                  >
                    {useNotificationStore.getState().unreadCount > 9 ? '9+' : useNotificationStore.getState().unreadCount}
                  </span>
                )}
              </button>

              <TokenPill balance={tokenBalance} compact />

              <button
                onClick={() => {
                  setCommandPanelOpen(!commandPanelOpen);
                  haptics.lightTap();
                  audioManager.playSfx('tap_nav', 0.2);
                }}
                className="flex items-center justify-center w-10 h-10 border-2 border-black transition-all active:scale-90 cursor-pointer"
                style={{
                  background: commandPanelOpen ? '#ff3800' : '#1a1610',
                  color: '#fff',
                  boxShadow: commandPanelOpen ? '2px 2px 0 #000, 0 0 12px rgba(255,56,0,0.5)' : '2px 2px 0 #000',
                }}
                aria-label="Toggle command panel"
              >
                {commandPanelOpen ? <X size={18} /> : <LayoutGrid size={18} />}
              </button>
            </div>
          </div>
        </nav>

        {/* ══ DESKTOP 2-COLUMN MEGA-MENU FLYOUT ═══════════════════════════════ */}
        <AnimatePresence>
          {activeMenu && (() => {
            const section = menuSections.find(s => s.id === activeMenu);
            if (!section) return null;
            const visibleItems = getVisibleItems(section.items);

            return (
              <motion.div
                key={`mega-${section.id}`}
                initial={{ opacity: 0, y: -8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="hidden md:block absolute left-0 right-0 top-full z-[100] px-6 lg:px-12 py-5"
                onMouseEnter={() => handleMenuEnter(section.id)}
                style={{
                  background: 'rgba(8, 6, 4, 0.98)',
                  backdropFilter: 'blur(30px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
                  borderTop: `3px solid ${section.accent}`,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 50px ${section.accentGlow.replace('0.4', '0.15')}`,
                }}
              >
                {/* Mega-Menu Top Header Strip */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: '4px',
                        height: '18px',
                        background: section.accent,
                        boxShadow: `0 0 10px ${section.accentGlow}`,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                        fontSize: '15px',
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: section.accent,
                        textShadow: `0 0 20px ${section.accentGlow}`,
                      }}
                    >
                      {section.label} // {section.tagline}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[9px] text-white/40 uppercase">
                    <span>HOTKEY: <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/70">ESC</kbd> CLOSE</span>
                  </div>
                </div>

                {/* 2-Column Content Layout: Left Grid (58%) + Right Live Spotlight (42%) */}
                <div className="grid grid-cols-12 gap-6 items-stretch">
                  {/* Left Column: Action Items Grid */}
                  <div
                    className="col-span-7 grid gap-2 content-start"
                    style={{
                      gridTemplateColumns: visibleItems.length > 4 ? 'repeat(2, 1fr)' : '1fr',
                    }}
                  >
                    {visibleItems.map((item, i) => {
                      const ItemIcon = item.icon;
                      const isItemActive = item.to ? location === item.to : false;

                      const itemContent = (
                        <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02, duration: 0.12 }}
                          className="flex items-start gap-3 p-3 transition-all group cursor-pointer border rounded"
                          style={{
                            background: isItemActive ? `${section.accent}16` : 'rgba(255,255,255,0.02)',
                            borderColor: isItemActive ? `${section.accent}50` : 'rgba(255,255,255,0.06)',
                            clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
                          }}
                          onMouseEnter={(e) => {
                            audioManager.playSfx('tap_nav', 0.08);
                            (e.currentTarget as HTMLElement).style.background = `${section.accent}12`;
                            (e.currentTarget as HTMLElement).style.borderColor = `${section.accent}60`;
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isItemActive) {
                              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                            }
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                          }}
                        >
                          <div
                            className="flex items-center justify-center shrink-0 w-8 h-8 rounded border"
                            style={{
                              background: isItemActive ? `${section.accent}25` : 'rgba(255,255,255,0.04)',
                              borderColor: isItemActive ? `${section.accent}80` : `${section.accent}30`,
                            }}
                          >
                            <ItemIcon size={16} style={{ color: section.accent }} />
                          </div>

                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                style={{
                                  fontFamily: '"Impact", "Arial Black", sans-serif',
                                  fontSize: '15px',
                                  fontWeight: 900,
                                  letterSpacing: '-0.2px',
                                  textTransform: 'uppercase',
                                  color: isItemActive ? section.accent : '#fff',
                                }}
                              >
                                {item.label}
                              </span>
                              {item.badge && (
                                <span
                                  className="font-mono text-[7px] font-black uppercase px-1.5 py-0.5 rounded"
                                  style={{
                                    background: `${item.badgeColor || section.accent}22`,
                                    color: item.badgeColor || section.accent,
                                    border: `1px solid ${item.badgeColor || section.accent}40`,
                                  }}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <span
                              style={{
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: '9px',
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                lineHeight: '1.3',
                              }}
                            >
                              {item.desc}
                            </span>
                          </div>

                          {isItemActive && (
                            <span
                              style={{
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: '8px',
                                fontWeight: 900,
                                color: section.accent,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                marginLeft: 'auto',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              ← ACTIVE
                            </span>
                          )}
                        </motion.div>
                      );

                      if (item.to) {
                        return (
                          <Link
                            key={item.label}
                            to={item.to}
                            className="no-underline"
                            onClick={() => handleItemClick(item)}
                          >
                            {itemContent}
                          </Link>
                        );
                      }
                      return (
                        <div
                          key={item.label}
                          onClick={() => handleItemClick(item)}
                        >
                          {itemContent}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Column: Live Telemetry Spotlight Widget */}
                  <div className="col-span-5 h-full">
                    {renderSpotlightWidget(section.id)}
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Invisible click-outside backdrop for desktop mega-menu */}
        {activeMenu && (
          <div
            className="fixed inset-0 z-[99] hidden md:block"
            onClick={() => setActiveMenu(null)}
          />
        )}
      </div>

      {/* ══ MOBILE COMMAND PANEL (Full-Screen Tactical Overlay) ══════════════ */}
      <AnimatePresence>
        {commandPanelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cmd-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] md:hidden bg-black/80 backdrop-blur-md"
              onClick={() => setCommandPanelOpen(false)}
            />

            {/* Panel Drawer */}
            <motion.div
              key="cmd-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-[151] md:hidden overflow-y-auto flex flex-col"
              style={{
                width: 'min(90vw, 400px)',
                background: 'rgba(5, 4, 2, 0.99)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderLeft: '1.5px solid rgba(255,56,0,0.3)',
                boxShadow: '-10px 0 50px rgba(0,0,0,0.9)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3.5 sticky top-0 z-10"
                style={{
                  background: 'rgba(5,4,2,0.98)',
                  borderBottom: '2px solid rgba(255,56,0,0.3)',
                }}
              >
                <div className="flex items-center gap-2">
                  <div style={{ width: '4px', height: '20px', background: '#ff3800', boxShadow: '0 0 10px rgba(255,56,0,0.6)' }} />
                  <span style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '19px',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#fff',
                  }}>
                    TH3SCR1B3 COMMAND
                  </span>
                </div>
                <button
                  onClick={() => setCommandPanelOpen(false)}
                  className="flex items-center justify-center w-9 h-9 transition-all active:scale-90 cursor-pointer"
                  style={{
                    background: '#ff3800',
                    border: '1.5px solid #000',
                    color: '#fff',
                    boxShadow: '2px 2px 0 #000',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Banner */}
              <div style={{
                background: '#ff3800',
                padding: '4px 16px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.25em',
                color: '#000',
                textTransform: 'uppercase',
              }}>
                BASE EVM // 3-LANE RHYTHM PROTOCOL
              </div>

              {/* Top Search Bar */}
              <div className="px-3 pt-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-black/60 border border-white/15 rounded">
                  <Search size={14} className="text-[#ff5500]" />
                  <input
                    type="text"
                    value={mobileFilterQuery}
                    onChange={(e) => setMobileFilterQuery(e.target.value)}
                    placeholder="Filter sections & shortcuts..."
                    className="w-full bg-transparent text-white font-mono text-xs outline-none placeholder:text-white/30"
                  />
                  {mobileFilterQuery && (
                    <button onClick={() => setMobileFilterQuery('')} className="text-white/40 hover:text-white">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* 4-Tile Tactical Launchpad */}
              <div className="px-3 pt-3 grid grid-cols-4 gap-1.5">
                {[
                  { label: 'ARCADE', icon: Gamepad2, to: '/arcade', color: '#FF1493' },
                  { label: 'VAULT', icon: Home, to: '/vault', color: '#FF5500' },
                  { label: 'FORGE', icon: Flame, to: '/vault/forge', color: '#39FF14' },
                  { label: 'EARN', icon: Zap, to: '/vault/earn', color: '#E5B800' },
                ].map((tile) => {
                  const TileIcon = tile.icon;
                  return (
                    <Link
                      key={tile.label}
                      to={tile.to}
                      onClick={() => {
                        haptics.lightTap();
                        setCommandPanelOpen(false);
                      }}
                      className="flex flex-col items-center justify-center p-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-all no-underline text-center"
                      style={{
                        clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
                      }}
                    >
                      <TileIcon size={16} style={{ color: tile.color }} />
                      <span className="font-mono text-[8px] font-black text-white mt-1 uppercase">
                        {tile.label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Section Accordions */}
              <div className="px-3 pt-3 pb-2 flex-1 flex flex-col gap-2">
                {menuSections.map((section) => {
                  const SectionIcon = section.icon;
                  const visibleItems = getVisibleItems(section.items).filter(item => {
                    if (!mobileFilterQuery.trim()) return true;
                    const q = mobileFilterQuery.toLowerCase();
                    return item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
                  });

                  if (visibleItems.length === 0 && mobileFilterQuery) return null;

                  const isExpanded = expandedSection === section.id || Boolean(mobileFilterQuery);

                  return (
                    <div key={section.id} className="rounded overflow-hidden border border-white/5">
                      {/* Section Header */}
                      <button
                        onClick={() => {
                          haptics.lightTap();
                          setExpandedSection(isExpanded ? null : section.id);
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all active:scale-[0.98] cursor-pointer"
                        style={{
                          background: isExpanded ? `${section.accent}12` : 'rgba(255,255,255,0.02)',
                          borderLeft: `3px solid ${section.accent}`,
                        }}
                      >
                        <div
                          className="flex items-center justify-center shrink-0 w-7 h-7 rounded"
                          style={{
                            background: `${section.accent}15`,
                          }}
                        >
                          <SectionIcon size={14} style={{ color: section.accent }} />
                        </div>
                        <span style={{
                          fontFamily: '"Impact", "Arial Black", sans-serif',
                          fontSize: '18px',
                          fontWeight: 900,
                          letterSpacing: '-0.3px',
                          textTransform: 'uppercase',
                          color: isExpanded ? section.accent : '#fff',
                        }}>
                          {section.label}
                        </span>
                        {activeSection === section.id && (
                          <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '7px',
                            fontWeight: 900,
                            color: section.accent,
                            background: `${section.accent}15`,
                            padding: '2px 6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                          }}>
                            ACTIVE
                          </span>
                        )}
                        <ChevronRight
                          size={14}
                          className="ml-auto transition-transform duration-200"
                          style={{
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                            color: isExpanded ? section.accent : 'rgba(255,255,255,0.3)',
                          }}
                        />
                      </button>

                      {/* Expanded Items */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="overflow-hidden bg-black/40"
                          >
                            <div className="pl-3 pr-2 py-1.5 flex flex-col gap-1">
                              {visibleItems.map((item) => {
                                const ItemIcon = item.icon;
                                const isItemActive = item.to ? location === item.to : false;

                                const itemContent = (
                                  <div
                                    className="flex items-center gap-3 px-3 py-2 transition-all active:scale-[0.97]"
                                    style={{
                                      background: isItemActive ? `${section.accent}15` : 'rgba(255,255,255,0.02)',
                                      borderLeft: isItemActive ? `2px solid ${section.accent}` : '2px solid transparent',
                                    }}
                                  >
                                    <ItemIcon
                                      size={15}
                                      style={{ color: isItemActive ? section.accent : 'rgba(255,255,255,0.4)', flexShrink: 0 }}
                                    />
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span style={{
                                          fontFamily: '"Impact", "Arial Black", sans-serif',
                                          fontSize: '14px',
                                          fontWeight: 900,
                                          letterSpacing: '-0.2px',
                                          textTransform: 'uppercase',
                                          color: isItemActive ? section.accent : '#fff',
                                        }}>
                                          {item.label}
                                        </span>
                                        {item.badge && (
                                          <span
                                            className="font-mono text-[7px] font-black uppercase px-1 py-0.2 rounded"
                                            style={{
                                              background: `${item.badgeColor || section.accent}20`,
                                              color: item.badgeColor || section.accent,
                                            }}
                                          >
                                            {item.badge}
                                          </span>
                                        )}
                                      </div>
                                      <span style={{
                                        fontFamily: '"JetBrains Mono", monospace',
                                        fontSize: '8px',
                                        color: 'rgba(255,255,255,0.35)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                      }}>
                                        {item.desc}
                                      </span>
                                    </div>
                                    {isItemActive && (
                                      <span style={{
                                        fontFamily: '"JetBrains Mono", monospace',
                                        fontSize: '7px',
                                        fontWeight: 900,
                                        color: section.accent,
                                        marginLeft: 'auto',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        ← NOW
                                      </span>
                                    )}
                                  </div>
                                );

                                if (item.to) {
                                  return (
                                    <Link
                                      key={item.label}
                                      to={item.to}
                                      className="no-underline"
                                      onClick={() => { handleItemClick(item); }}
                                    >
                                      {itemContent}
                                    </Link>
                                  );
                                }
                                return (
                                  <div
                                    key={item.label}
                                    className="cursor-pointer"
                                    onClick={() => handleItemClick(item)}
                                  >
                                    {itemContent}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* ── Command Panel Footer ── */}
              <div className="px-3 pb-4 mt-auto">
                <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} />

                {/* 4K HDR toggle row */}
                <div
                  className="flex items-center justify-between px-3.5 py-2.5 mb-2 rounded"
                  style={{
                    background: is4K ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.02)',
                    border: is4K ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Monitor size={15} style={{ color: is4K ? '#ffd700' : 'rgba(255,255,255,0.4)' }} />
                    <span style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                      fontSize: '16px',
                      fontWeight: 900,
                      letterSpacing: '-0.3px',
                      textTransform: 'uppercase',
                      color: is4K ? '#ffd700' : 'var(--color-text-primary)',
                    }}>
                      4K HDR SHADERS
                    </span>
                  </div>
                  <div
                    className={`toggle-4k${is4K ? ' active' : ''}`}
                    onClick={toggle4K}
                    role="switch"
                    aria-checked={is4K}
                    aria-label="Toggle 4K HDR mode"
                    style={{ transform: 'scale(1.2)' }}
                  />
                </div>

                {/* Wallet / TH3SCR1B3 Identity */}
                {user && !isAnonymous ? (
                  <div className="flex items-center justify-between w-full px-2 py-1">
                    <Link
                      to="/profile"
                      onClick={() => setCommandPanelOpen(false)}
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '10px',
                        color: 'var(--color-neon-gold)',
                        textTransform: 'uppercase',
                        textDecoration: 'none',
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                      }}
                      title="Manage TH3SCR1B3 Identity"
                    >
                      {displayName || (() => {
                        const val = user.email || user.id;
                        return val.slice(0, 16) + (val.length > 16 ? '…' : '');
                      })()} →
                    </Link>
                    <button
                      onClick={() => { signOut(); setCommandPanelOpen(false); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                      style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
                    >
                      <LogOut size={11} />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { handleConnectWallet(); setCommandPanelOpen(false); }}
                      disabled={status === 'loading'}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-black font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                      style={{
                        background: '#ff3800',
                        color: '#fff',
                        boxShadow: '4px 4px 0 #000, 0 0 20px rgba(255,56,0,0.4)',
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                        fontSize: '18px',
                      }}
                    >
                      <Wallet size={16} />
                      {status === 'loading' ? 'Connecting...' : 'Connect Identity'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ MOBILE BOTTOM-LEFT VERTICAL NAVIGATION DOCK ════════════════════ */}
      <nav
        className="fixed z-40 md:hidden flex flex-col items-center gap-1.5 p-1.5 rounded-2xl"
        style={{
          bottom: currentTrack
            ? 'calc(76px + env(safe-area-inset-bottom, 0px))'
            : 'max(14px, env(safe-area-inset-bottom, 14px))',
          left: '12px',
          background: 'rgba(8, 6, 4, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(255, 56, 0, 0.3)',
          boxShadow: '3px 3px 0 #000, 0 0 24px rgba(0, 0, 0, 0.85), 0 0 14px rgba(255, 56, 0, 0.15)',
        }}
        aria-label="Quick mobile navigation"
      >
        {mobileQuickTabs.map(({ id, to, label, icon: Icon, accent, glow }) => {
          const isTabActive = activeSection === id;

          return (
            <Link
              key={id}
              to={to}
              onClick={() => {
                haptics.lightTap();
                audioManager.playSfx('tap_nav', 0.2);
              }}
              className="relative flex flex-col items-center justify-center rounded-xl no-underline transition-all duration-150 active:scale-90 select-none cursor-pointer"
              style={{
                width: '42px',
                height: '42px',
                background: isTabActive
                  ? `${accent}22`
                  : 'rgba(255, 255, 255, 0.03)',
                border: isTabActive
                  ? `1.5px solid ${accent}`
                  : '1px solid rgba(255, 255, 255, 0.07)',
                color: isTabActive ? accent : 'rgba(255, 255, 255, 0.5)',
                boxShadow: isTabActive
                  ? `0 0 12px ${glow}, 2px 2px 0 #000`
                  : '1px 1px 0 #000',
              }}
              title={label}
              aria-label={label}
            >
              <Icon
                size={17}
                style={{
                  filter: isTabActive ? `drop-shadow(0 0 6px ${accent})` : 'none',
                }}
              />
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '7px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: '1px',
                  lineHeight: 1,
                  color: isTabActive ? accent : 'rgba(255, 255, 255, 0.45)',
                }}
              >
                {label}
              </span>
              {isTabActive && (
                <span
                  className="absolute -left-[2.5px] top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: '3px',
                    height: '14px',
                    background: accent,
                    boxShadow: `0 0 6px ${accent}`,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <FloatingTicker />
    </>
  );
}
