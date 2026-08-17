// ════════════════════════════════════════════════════════════════════════════════
// Navbar.tsx — PIM : th3v4ult Command Console Navigation System
// Mega-menu architecture: Every section of PIM accessible in ≤ 2 clicks
// ════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home, Layers, Trophy, Wallet, LogOut, Zap, X, FileText,
  Flame, BookOpen, Monitor, Gift, Settings, Image, Map, Sparkles,
  User, ChevronDown, ChevronRight, Gamepad2, GraduationCap, LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { useDisplayMode } from '../store/useDisplayMode';
import GuideModal from './GuideModal';
import { haptics } from '../utils/haptics';
import FloatingTicker from './FloatingTicker';
import { getIdenticon } from '../utils/identicon';

const isDev = import.meta.env.DEV || localStorage.getItem('th3vault_dev_mode') === 'true';

// ── Menu Section Definitions ──────────────────────────────────────────────────
interface MenuItem {
  to?: string;
  action?: string;
  label: string;
  icon: any;
  desc: string;
  devOnly?: boolean;
}

interface MenuSection {
  id: string;
  label: string;
  accent: string;
  accentGlow: string;
  icon: any;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    id: 'play',
    label: 'Play',
    accent: '#FF1493',
    accentGlow: 'rgba(255, 20, 147, 0.4)',
    icon: Gamepad2,
    items: [
      { to: '/arcade', label: 'PIM Arcade', icon: Monitor, desc: 'Quick-play rhythm engine' },
      { to: '/campaign', label: 'PIM Campaign', icon: Map, desc: 'Story chapters & 365 roadmaps' },
      { to: '/songs', label: 'PIM Award Play', icon: Trophy, desc: 'Curated song selection' },
      { to: '/tutorial', label: 'PIM Tutorial', icon: GraduationCap, desc: 'Master the 3-lane controls' },
    ],
  },
  {
    id: 'vault',
    label: 'Vault',
    accent: '#FF5500',
    accentGlow: 'rgba(255, 85, 0, 0.4)',
    icon: Home,
    items: [
      { to: '/vault', label: 'Home', icon: Home, desc: 'Daily card & vault dashboard' },
      { to: '/vault/collection', label: 'Collection', icon: Layers, desc: 'Your card library' },
      { to: '/vault/reveal', label: 'Pack Reveal', icon: Sparkles, desc: 'Open earned packs' },
      { to: '/vault/codex', label: 'Codex', icon: BookOpen, desc: 'Full 365-day archive' },
      { to: '/hero', label: 'Hero Exhibit', icon: Image, desc: 'Museum-grade daily showcase' },
    ],
  },
  {
    id: 'forge',
    label: 'Forge',
    accent: '#39FF14',
    accentGlow: 'rgba(57, 255, 20, 0.4)',
    icon: Flame,
    items: [
      { to: '/vault/forge', label: 'Fusion Lab', icon: Flame, desc: 'Fuse & upgrade cards' },
      { to: '/vault/leaderboard', label: 'Leaderboard', icon: Trophy, desc: 'Global rankings' },
    ],
  },
  {
    id: 'earn',
    label: 'Earn',
    accent: '#E5B800',
    accentGlow: 'rgba(229, 184, 0, 0.4)',
    icon: Zap,
    items: [
      { to: '/vault/earn', label: 'Token Shop', icon: Zap, desc: 'Earn & spend tokens' },
      { to: '/vault/claim', label: 'Redeem', icon: Gift, desc: 'Claim prizes & rewards' },
    ],
  },
  {
    id: 'more',
    label: 'More',
    accent: '#A855F7',
    accentGlow: 'rgba(168, 85, 247, 0.4)',
    icon: LayoutGrid,
    items: [
      { to: '/profile', label: 'Profile', icon: User, desc: 'Scribe identity hub' },
      { action: 'options', label: 'Options', icon: Settings, desc: 'Audio, visuals & gameplay' },
      { action: 'guide', label: 'Guide', icon: BookOpen, desc: 'Instruction booklet' },
      { to: '/vault/legal', label: 'Legal', icon: FileText, desc: 'Terms & policies' },
      { to: '/admin/editor', label: 'Editor', icon: Monitor, desc: 'Beatmap editor', devOnly: true },
      { to: '/admin/card-designs', label: 'Card Designs', icon: Image, desc: 'Design showcase', devOnly: true },
      { to: '/pitch-deck', label: 'Pitch Deck', icon: FileText, desc: 'Investor presentation', devOnly: true },
    ],
  },
];

// Mobile bottom-left vertical quick-access tabs
const mobileQuickTabs = [
  { id: 'play', to: '/arcade', label: 'PIM', icon: Gamepad2, accent: '#FF1493', glow: 'rgba(255, 20, 147, 0.4)' },
  { id: 'vault', to: '/vault', label: 'Vault', icon: Home, accent: '#FF5500', glow: 'rgba(255, 85, 0, 0.4)' },
  { id: 'earn', to: '/vault/earn', label: 'Earn', icon: Zap, accent: '#E5B800', glow: 'rgba(229, 184, 0, 0.4)' },
];

// Active section detector from current URL
function getActiveSection(path: string): string | null {
  if (['/arcade', '/pim', '/play', '/campaign', '/songs', '/tutorial', '/chapter', '/slideshow', '/voyeur'].some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '-'))) return 'play';
  if (['/vault', '/collection', '/forge', '/shop', '/vault/earn', '/codex'].some(p => path === p || path.startsWith(p + '/'))) return 'vault';
  if (['/leaderboard', '/profile', '/deck', '/options', '/guide'].some(p => path.startsWith(p))) return 'terminal';
  if (['/editor', '/admin'].some(p => path.startsWith(p))) return 'creator';
  return null;
}

// ── Brand Logotype ────────────────────────────────────────────────────────────
function VaultLogo() {
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 no-underline group shrink-0"
      aria-label="th3vault home"
      onClick={() => setOptionsModalOpen(false)}
    >
      {/* Dynamic Cycling Icon mark */}
      <MainBrandLogo size="nav" interactive={true} priority={true} />

      {/* Word mark */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '15px',
            fontWeight: 900,
            letterSpacing: '-0.5px',
            color: '#fff',
            textShadow: '0 0 16px rgba(255,56,0,0.5), 2px 2px 0 rgba(0,0,0,0.9)',
            transform: 'scaleY(1.15)',
            transformOrigin: 'left center',
            display: 'block',
          }}
        >
          PIM : th3v4ult
        </span>
      </div>
    </Link>
  );
}

function VaultAttribution() {
  return (
    <span
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '8px',
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.25em',
        color: '#ff3800',
        opacity: 0.75,
        marginTop: '2px',
        display: 'block',
      }}
    >
      BY{' '}
      <a
        href="https://th3scr1b3.art"
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{ color: '#ffb800', textDecoration: 'none', fontWeight: 700 }}
      >
        TH3SCR1B3
      </a>
    </span>
  );
}

// ── Token Pill ────────────────────────────────────────────────────────────────
function TokenPill({ balance, compact = false }: { balance: number; compact?: boolean }) {
  const lit = balance > 0;
  return (
    <Link to="/vault/earn" className="no-underline hover:scale-105 active:scale-95 transition-all flex select-none cursor-pointer" title="Earn Vault Tokens">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: compact ? '5px 10px' : '6px 12px',
          border: '2px solid #000',
          background: lit ? '#ff9900' : '#1a1610',
          color: lit ? '#000' : '#555',
          boxShadow: lit ? '2px 2px 0 #000, 0 0 12px rgba(255,153,0,0.4)' : '2px 2px 0 #000',
          transition: 'all 0.3s ease',
          flexShrink: 0,
        }}
      >
        <Zap size={11} />
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
  const optionsModalOpen = useVaultStore((s) => s.optionsModalOpen);
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);

  // Nav state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
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

  // Desktop mega-menu hover handlers
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
    }, 250);
  }, []);

  // Handle item clicks (for action items like Options, Guide)
  const handleItemClick = useCallback((item: MenuItem) => {
    setActiveMenu(null);
    setCommandPanelOpen(false);
    haptics.lightTap();

    if (item.action === 'options') {
      setOptionsModalOpen(true);
    } else if (item.action === 'guide') {
      setGuideOpen(true);
    }
  }, [setOptionsModalOpen]);

  // Filter dev-only items
  const getVisibleItems = (items: MenuItem[]) =>
    items.filter(item => !item.devOnly || isDev);

  return (
    <>
      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <div onMouseLeave={handleMenuLeave}>
        <nav
          className="sticky top-0 z-[101] px-3 md:px-6"
          style={{
            background: 'rgba(8, 6, 4, 0.45)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: activeMenu
              ? 'none'
              : '1px solid rgba(255,56,0,0.12)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center justify-between h-14 gap-2">
            {/* ── Left: Logo ── */}
            <div className="flex flex-col shrink-0">
              <VaultLogo />
              <div className="hidden lg:block">
                <VaultAttribution />
              </div>
            </div>

            {/* ── Center: Mega-Menu Tabs (Desktop) ── */}
            <div className="hidden md:flex items-center gap-1 justify-center">
              {menuSections.map((section) => {
                const SectionIcon = section.icon;
                const isActive = activeSection === section.id;
                const isOpen = activeMenu === section.id;

                return (
                  <button
                    key={section.id}
                    onMouseEnter={() => handleMenuEnter(section.id)}
                    onClick={() => {
                      haptics.lightTap();
                      setActiveMenu(activeMenu === section.id ? null : section.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer select-none"
                    style={{
                      background: isActive
                        ? section.accent
                        : isOpen
                          ? `${section.accent}18`
                          : 'rgba(255,255,255,0.03)',
                      color: isActive ? '#000' : isOpen ? section.accent : 'rgba(255,255,255,0.7)',
                      border: isActive
                        ? '1.5px solid #000'
                        : isOpen
                          ? `1px solid ${section.accent}40`
                          : '1px solid rgba(255,255,255,0.06)',
                      clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
                      boxShadow: isActive
                        ? `2px 2px 0 #000, 0 0 14px ${section.accentGlow}`
                        : isOpen
                          ? `0 0 16px ${section.accentGlow.replace('0.4', '0.15')}`
                          : 'none',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '10px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                    title={section.label}
                  >
                    <SectionIcon size={13} />
                    <span>{section.label}</span>
                    <ChevronDown
                      size={9}
                      style={{
                        transition: 'transform 0.2s ease',
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        opacity: 0.5,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* ── Right: Desktop Controls ── */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {/* PIM Direct Access Button */}
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

              <TokenPill balance={tokenBalance} />

              {/* Wallet / Profile */}
              {user && !isAnonymous ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 no-underline transition-all hover:scale-105"
                    title="Manage Scribe Identity"
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
                          return user?.id.slice(0, 8) || 'ANONYMOUS';
                        })()}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); signOut(); }}
                    className="p-2 rounded-full transition-all hover:bg-white/10 active:scale-90"
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
                    className="sticker-gun-tag sticker-slits font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
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
                  className="sticker-gun-tag sticker-slits font-black text-[10px] uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
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
            <div className="flex md:hidden items-center gap-2">
              <TokenPill balance={tokenBalance} compact />
              <button
                onClick={() => { setCommandPanelOpen(!commandPanelOpen); haptics.lightTap(); }}
                className="flex items-center justify-center w-10 h-10 border-2 border-black transition-all active:scale-90"
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

        {/* ══ DESKTOP MEGA-MENU FLYOUT ═══════════════════════════════════════ */}
        <AnimatePresence>
          {activeMenu && (() => {
            const section = menuSections.find(s => s.id === activeMenu);
            if (!section) return null;
            const visibleItems = getVisibleItems(section.items);

            return (
              <motion.div
                key={`mega-${section.id}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="hidden md:block sticky z-[100] px-6"
                onMouseEnter={() => handleMenuEnter(section.id)}
                style={{
                  background: 'rgba(8, 6, 4, 0.97)',
                  backdropFilter: 'blur(24px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                  borderTop: `3px solid ${section.accent}`,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px ${section.accentGlow.replace('0.4', '0.12')}`,
                }}
              >
                {/* Section header */}
                <div className="flex items-center gap-2 pt-4 pb-2 px-2">
                  <div
                    style={{
                      width: '3px',
                      height: '16px',
                      background: section.accent,
                      boxShadow: `0 0 8px ${section.accentGlow}`,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                      fontSize: '13px',
                      fontWeight: 900,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: section.accent,
                      textShadow: `0 0 20px ${section.accentGlow}`,
                    }}
                  >
                    {section.label}
                  </span>
                  <div className="flex-1 h-px ml-2" style={{ background: `${section.accent}20` }} />
                </div>

                {/* Items grid */}
                <div
                  className="pb-4 px-2"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: visibleItems.length > 3 ? 'repeat(2, 1fr)' : '1fr',
                    gap: '2px',
                  }}
                >
                  {visibleItems.map((item, i) => {
                    const ItemIcon = item.icon;
                    const isItemActive = item.to ? location === item.to : false;

                    const content = (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.12 }}
                        className="flex items-center gap-3 px-3 py-2.5 transition-all group cursor-pointer"
                        style={{
                          background: isItemActive ? `${section.accent}12` : 'transparent',
                          borderLeft: isItemActive ? `3px solid ${section.accent}` : '3px solid transparent',
                          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = `${section.accent}10`;
                          (e.currentTarget as HTMLElement).style.borderLeft = `3px solid ${section.accent}`;
                          (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isItemActive) {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.borderLeft = '3px solid transparent';
                          }
                          (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                        }}
                      >
                        <div
                          className="flex items-center justify-center shrink-0"
                          style={{
                            width: '32px',
                            height: '32px',
                            background: `${section.accent}12`,
                            border: `1px solid ${section.accent}30`,
                          }}
                        >
                          <ItemIcon size={15} style={{ color: section.accent }} />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span
                            style={{
                              fontFamily: '"Impact", "Arial Black", sans-serif',
                              fontSize: '14px',
                              fontWeight: 900,
                              letterSpacing: '-0.3px',
                              textTransform: 'uppercase',
                              color: isItemActive ? section.accent : '#fff',
                            }}
                          >
                            {item.label}
                          </span>
                          <span
                            style={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '9px',
                              fontWeight: 400,
                              color: 'rgba(255,255,255,0.35)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {item.desc}
                          </span>
                        </div>
                        {isItemActive && (
                          <span
                            style={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '7px',
                              fontWeight: 900,
                              color: section.accent,
                              textTransform: 'uppercase',
                              letterSpacing: '0.15em',
                              marginLeft: 'auto',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ← NOW
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
                          {content}
                        </Link>
                      );
                    }
                    return (
                      <div
                        key={item.label}
                        onClick={() => handleItemClick(item)}
                      >
                        {content}
                      </div>
                    );
                  })}
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

      {/* ══ MOBILE COMMAND PANEL (Full-Screen Overlay) ══════════════════════ */}
      <AnimatePresence>
        {commandPanelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cmd-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] md:hidden"
              style={{ background: 'rgba(0,0,0,0.75)' }}
              onClick={() => setCommandPanelOpen(false)}
            />

            {/* Panel */}
            <motion.div
              key="cmd-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-[56] md:hidden overflow-y-auto"
              style={{
                width: 'min(88vw, 380px)',
                background: 'rgba(5, 4, 2, 0.99)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderLeft: '1px solid rgba(255,56,0,0.15)',
                boxShadow: '-10px 0 40px rgba(0,0,0,0.8)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
                style={{
                  background: 'rgba(5,4,2,0.98)',
                  borderBottom: '2px solid rgba(255,56,0,0.2)',
                }}
              >
                <div className="flex items-center gap-2">
                  <div style={{ width: '3px', height: '20px', background: '#ff3800', boxShadow: '0 0 10px rgba(255,56,0,0.5)' }} />
                  <span style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '18px',
                    fontWeight: 900,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#fff',
                  }}>
                    Command
                  </span>
                </div>
                <button
                  onClick={() => setCommandPanelOpen(false)}
                  className="flex items-center justify-center w-9 h-9 transition-all active:scale-90"
                  style={{
                    background: '#ff3800',
                    border: '2px solid #000',
                    color: '#fff',
                    boxShadow: '2px 2px 0 #000',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* th3scr1b3 credit strip */}
              <div style={{
                background: '#ff3800',
                padding: '4px 16px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.3em',
                color: '#fff',
                textTransform: 'uppercase',
              }}>
                An archive by{' '}
                <a
                  href="https://th3scr1b3.art"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#ffb800', textDecoration: 'none' }}
                  onClick={e => e.stopPropagation()}
                >
                  th3scr1b3.art
                </a>
              </div>

              {/* Section Accordions */}
              <div className="px-3 pt-3 pb-2 flex flex-col gap-2">
                {menuSections.map((section) => {
                  const SectionIcon = section.icon;
                  const isExpanded = expandedSection === section.id;
                  const visibleItems = getVisibleItems(section.items);

                  return (
                    <div key={section.id}>
                      {/* Section Header */}
                      <button
                        onClick={() => {
                          haptics.lightTap();
                          setExpandedSection(isExpanded ? null : section.id);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 transition-all active:scale-[0.98]"
                        style={{
                          background: isExpanded ? `${section.accent}10` : 'rgba(255,255,255,0.02)',
                          borderLeft: `3px solid ${section.accent}`,
                          border: isExpanded ? `1px solid ${section.accent}25` : '1px solid rgba(255,255,255,0.05)',
                          borderLeftWidth: '3px',
                          borderLeftColor: section.accent,
                          clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
                        }}
                      >
                        <div
                          className="flex items-center justify-center shrink-0"
                          style={{
                            width: '28px',
                            height: '28px',
                            background: `${section.accent}15`,
                          }}
                        >
                          <SectionIcon size={15} style={{ color: section.accent }} />
                        </div>
                        <span style={{
                          fontFamily: '"Impact", "Arial Black", sans-serif',
                          fontSize: '22px',
                          fontWeight: 900,
                          letterSpacing: '-0.5px',
                          textTransform: 'uppercase',
                          color: isExpanded ? section.accent : '#fff',
                          textShadow: isExpanded ? `0 0 20px ${section.accentGlow}` : 'none',
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
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 pr-2 py-1 flex flex-col gap-1">
                              {visibleItems.map((item) => {
                                const ItemIcon = item.icon;
                                const isItemActive = item.to ? location === item.to : false;

                                const itemContent = (
                                  <div
                                    className="flex items-center gap-3 px-3 py-2.5 transition-all active:scale-[0.97]"
                                    style={{
                                      background: isItemActive ? `${section.accent}12` : 'rgba(255,255,255,0.02)',
                                      borderLeft: isItemActive ? `2px solid ${section.accent}` : '2px solid transparent',
                                    }}
                                  >
                                    <ItemIcon
                                      size={16}
                                      style={{ color: isItemActive ? section.accent : 'rgba(255,255,255,0.4)', flexShrink: 0 }}
                                    />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <span style={{
                                        fontFamily: '"Impact", "Arial Black", sans-serif',
                                        fontSize: '16px',
                                        fontWeight: 900,
                                        letterSpacing: '-0.3px',
                                        textTransform: 'uppercase',
                                        color: isItemActive ? section.accent : '#fff',
                                      }}>
                                        {item.label}
                                      </span>
                                      <span style={{
                                        fontFamily: '"JetBrains Mono", monospace',
                                        fontSize: '8px',
                                        color: 'rgba(255,255,255,0.3)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
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
              <div className="px-3 pb-4 mt-2">
                {/* Divider */}
                <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} />

                {/* 4K HDR toggle row */}
                <div
                  className="flex items-center justify-between px-4 py-3 mb-2"
                  style={{
                    background: is4K ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.02)',
                    border: is4K ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Monitor size={16} style={{ color: is4K ? '#ffd700' : 'rgba(255,255,255,0.4)' }} />
                    <span style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                      fontSize: '18px',
                      fontWeight: 900,
                      letterSpacing: '-0.5px',
                      textTransform: 'uppercase',
                      color: is4K ? '#ffd700' : 'var(--color-text-primary)',
                    }}>
                      4K HDR
                    </span>
                    {is4K && (
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '7px',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                        color: '#ffd700',
                        background: 'rgba(255,215,0,0.15)',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        textTransform: 'uppercase',
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div
                    className={`toggle-4k${is4K ? ' active' : ''}`}
                    onClick={toggle4K}
                    role="switch"
                    aria-checked={is4K}
                    aria-label="Toggle 4K HDR mode"
                    style={{ transform: 'scale(1.3)' }}
                  />
                </div>

                {/* Wallet / Identity */}
                {user && !isAnonymous ? (
                  <div className="flex items-center justify-between w-full px-2">
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
                      title="Manage Scribe Identity"
                    >
                      {displayName || (() => {
                        const val = user.email || user.id;
                        return val.slice(0, 16) + (val.length > 16 ? '…' : '');
                      })()} →
                    </Link>
                    <button
                      onClick={() => { signOut(); setCommandPanelOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 border border-white/10 hover:bg-white/5 transition-colors"
                      style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
                    >
                      <LogOut size={12} />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {user && isAnonymous && (
                      <div className="flex items-center justify-between px-1">
                        <span style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '10px',
                          fontWeight: 900,
                          color: '#5b8cff',
                          textTransform: 'uppercase',
                        }}>
                          ✦ Guest Wallet active
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => { handleConnectWallet(); setCommandPanelOpen(false); }}
                      disabled={status === 'loading'}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-black font-black uppercase tracking-wider transition-all active:scale-95"
                      style={{
                        background: '#ff3800',
                        color: '#fff',
                        boxShadow: '4px 4px 0 #000, 0 0 20px rgba(255,56,0,0.4)',
                        fontFamily: '"Impact", "Arial Black", sans-serif',
                        fontSize: '20px',
                      }}
                    >
                      <Wallet size={18} />
                      {status === 'loading' ? 'Connecting...' : 'Connect Wallet'}
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
              onClick={() => haptics.lightTap()}
              className="relative flex flex-col items-center justify-center rounded-xl no-underline transition-all duration-150 active:scale-90 select-none"
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
