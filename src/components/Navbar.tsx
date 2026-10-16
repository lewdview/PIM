// ════════════════════════════════════════════════════════════════════════════════
// Navbar.tsx — PIM : th3v4ult "Stage" shell
// Desktop: logo, four section tabs (Play, Collect, Compete, You) that open a
// menu, a wide super-search pill, tokens, alerts and identity.
// Phone: a slim top bar plus a bottom dock with a raised Play button; section
// tabs open bottom sheets.
// Destinations live in nav/navConfig.ts so search and the menus stay in sync.
// ════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { Bell, ChevronDown, Home, LogOut, MoreHorizontal, Play, Search, Wallet, Zap } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { useDisplayMode } from '../store/useDisplayMode';
import { useNotificationStore } from '../store/useNotificationStore';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import GuideModal from './GuideModal';
import LiveActivity from './LiveActivity';
import { haptics } from '../utils/haptics';
import { farcasterService } from '../services/farcasterService';
import { getIdenticon } from '../utils/identicon';
import { audioManager } from '../game/audio';
import {
  HOME_PATH,
  NAV_SECTIONS,
  OPEN_GUIDE_EVENT,
  sectionForPath,
  visibleItems,
  type NavItem,
  type NavSection,
  type NavSectionId,
} from './nav/navConfig';
import '../styles/stageShell.css';

const sectionById = (id: NavSectionId) => NAV_SECTIONS.find((s) => s.id === id)!;

function isItemActive(item: NavItem, location: string) {
  if (!item.to) return false;
  if (item.to === '/vault') return location === '/vault';
  return location === item.to || location.startsWith(item.to + '/');
}

function useIdentity() {
  const { user } = useAuthStore();
  const displayName = useVaultStore((s) => s.displayName);
  const avatarUrl = useVaultStore((s) => s.avatarUrl);
  const isAnonymous =
    !user ||
    user.is_anonymous ||
    user.app_metadata?.provider === 'anonymous' ||
    (!user.email && !user.user_metadata?.wallet && !user.user_metadata?.wallet_address);

  const name = (() => {
    if (!user) return null;
    if (isAnonymous) {
      const fc = farcasterService.getUser()?.username;
      return fc ? `@${fc}` : farcasterService.isFarcaster() ? 'Farcaster guest' : 'Guest';
    }
    if (displayName) return displayName;
    const cleaned = user.email?.split('@')[0];
    if (cleaned?.startsWith('0x') && cleaned.length === 42) return `${cleaned.slice(0, 6)}…${cleaned.slice(-4)}`;
    return cleaned || user.id.slice(0, 8);
  })();

  const ident = getIdenticon(user?.id || '', displayName);
  return { user, isAnonymous, name, avatarUrl, ident };
}

function Avatar({ size = 40 }: { size?: number }) {
  const { avatarUrl, ident } = useIdentity();
  const style = { width: size, height: size };
  return avatarUrl ? (
    <img className="pim-avatar" src={avatarUrl} alt="" style={style} />
  ) : (
    <span className="pim-avatar" style={{ ...style, background: ident.bgColor }}>{ident.initials}</span>
  );
}

function ConnectButton({ onDone, size }: { onDone?: () => void; size?: 'sm' }) {
  const { status, error: authError, setShowAuthModal } = useAuthStore();
  return (
    <button
      type="button"
      className="btn-3d"
      data-tone="gold"
      data-size={size}
      disabled={status === 'loading'}
      onClick={() => {
        haptics.lightTap();
        setShowAuthModal(true);
        onDone?.();
      }}
    >
      <Wallet size={15} />
      {status === 'loading' ? 'Connecting…' : authError ? 'Retry connect' : 'Connect'}
    </button>
  );
}

// ── Section menu body, shared by the desktop flyout and the phone sheet ─────
function SectionItems({
  section,
  location,
  onRun,
}: {
  section: NavSection;
  location: string;
  onRun: (item: NavItem) => void;
}) {
  const { is4K } = useDisplayMode();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <div className="pim-menu-grid">
      {visibleItems(section.items).map((item) => {
        const Icon = item.icon;
        const tag =
          item.action === 'hdr' ? (
            <span className="pim-menu-tag" data-on={is4K}>{is4K ? 'ON' : 'OFF'}</span>
          ) : item.action === 'notifications' && unreadCount > 0 ? (
            <span className="pim-menu-tag" data-on="true">{unreadCount > 9 ? '9+' : unreadCount} new</span>
          ) : item.devOnly ? (
            <span className="pim-menu-tag">DEV</span>
          ) : null;
        const body = (
          <>
            <span className="pim-menu-icon"><Icon size={18} /></span>
            <span className="pim-menu-text">
              <b>{item.label}</b>
              <small>{item.desc}</small>
            </span>
            {tag}
          </>
        );
        return item.to ? (
          <Link
            key={item.id}
            to={item.to}
            className="pim-menu-item"
            aria-current={isItemActive(item, location) ? 'page' : undefined}
            onClick={() => onRun(item)}
          >
            {body}
          </Link>
        ) : (
          <button
            key={item.id}
            type="button"
            className="pim-menu-item"
            onClick={() => onRun(item)}
            role={item.action === 'hdr' ? 'switch' : undefined}
            aria-checked={item.action === 'hdr' ? is4K : undefined}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

// ── Main shell ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const [location] = useLocation();
  const tokenBalance = useVaultStore((s) => s.tokenBalance);
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);
  const setCommandPaletteOpen = useVaultStore((s) => s.setCommandPaletteOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const hasTrack = useGlobalPlayer((s) => Boolean(s.currentTrack));
  const { toggle: toggle4K, detectCapability } = useDisplayMode();
  const { signOut } = useAuthStore();
  const identity = useIdentity();

  const [menu, setMenu] = useState<NavSectionId | null>(null);
  // Phone sheets: a single section, or 'more' for Compete + You together.
  const [sheet, setSheet] = useState<NavSectionId | 'more' | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const activeSection = sectionForPath(location);

  useEffect(() => {
    detectCapability();
  }, [detectCapability]);

  // The dock is fixed, so the page needs bottom room on phones while the shell is mounted.
  useEffect(() => {
    document.body.classList.add('pim-has-dock');
    return () => document.body.classList.remove('pim-has-dock');
  }, []);

  // Lift the dock above the global player bar when a track is loaded.
  useEffect(() => {
    document.body.style.setProperty('--pim-dock-lift', hasTrack ? '64px' : '0px');
    return () => {
      document.body.style.removeProperty('--pim-dock-lift');
    };
  }, [hasTrack]);

  useEffect(() => {
    setMenu(null);
    setSheet(null);
  }, [location]);

  useEffect(() => {
    if (!menu && !sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
        setSheet(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, sheet]);

  useEffect(() => {
    const open = () => setGuideOpen(true);
    window.addEventListener(OPEN_GUIDE_EVENT, open);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, open);
  }, []);

  const tap = (volume = 0.25) => {
    haptics.lightTap();
    audioManager.playSfx('tap_nav', volume);
  };

  const openSearch = () => {
    tap(0.2);
    setMenu(null);
    setSheet(null);
    setCommandPaletteOpen(true);
  };

  const runItem = useCallback(
    (item: NavItem) => {
      tap(0.3);
      if (item.action === 'options') setOptionsModalOpen(true);
      else if (item.action === 'guide') setGuideOpen(true);
      else if (item.action === 'notifications') useNotificationStore.getState().setIsOpen(true);
      else if (item.action === 'hdr') return toggle4K();
      setMenu(null);
      setSheet(null);
    },
    [setOptionsModalOpen, toggle4K]
  );

  const openSection = sectionById(menu ?? 'play');
  const dockActive = (id: string) => {
    if (id === 'home') return location === HOME_PATH;
    if (id === 'more') return activeSection === 'compete' || activeSection === 'you';
    return activeSection === id;
  };

  return (
    <>
      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <header className="pim-topbar">
        <Link to={HOME_PATH} className="pim-logo" aria-label="PIM home" onClick={() => tap(0.2)}>
          <img src="/data/logos/top_left_site.png" alt="PIM th3v4ult" />
        </Link>

        <nav className="pim-tabs pim-only-wide" aria-label="Sections">
          {NAV_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className="pim-tab"
              style={{ ['--sec-accent' as string]: section.accent }}
              data-active={activeSection === section.id}
              aria-expanded={menu === section.id}
              aria-haspopup="menu"
              onClick={() => {
                tap();
                setMenu(menu === section.id ? null : section.id);
              }}
            >
              {section.label}
              <ChevronDown size={14} className="pim-chev" />
            </button>
          ))}
        </nav>

        <button type="button" className="pim-searchpill" onClick={openSearch} aria-label="Open super search">
          <Search size={17} />
          <span className="pim-searchpill-text">Search songs, cards, modes</span>
          <span className="pim-kbd">/</span>
        </button>

        <div className="pim-right">
          <LiveActivity />
          <Link
            to="/vault/earn"
            className="pim-tokens pim-only-wide"
            data-empty={tokenBalance <= 0}
            title="Vault tokens"
            onClick={() => tap(0.2)}
          >
            <Zap size={14} />
            {tokenBalance.toLocaleString()}
          </Link>
          <button
            type="button"
            className="pim-iconbtn"
            onClick={() => {
              tap(0.2);
              useNotificationStore.getState().setIsOpen(true);
            }}
            aria-label={unreadCount > 0 ? `Transmissions, ${unreadCount} unread` : 'Transmissions'}
            title="Transmissions"
          >
            <Bell size={17} />
            {unreadCount > 0 && <span className="pim-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <span className="pim-only-wide" style={{ display: 'contents' }}>
            {identity.user && !identity.isAnonymous ? (
              <Link to="/profile" title={identity.name ?? 'Profile'} onClick={() => tap(0.2)} style={{ display: 'flex' }}>
                <Avatar />
              </Link>
            ) : (
              <ConnectButton size="sm" />
            )}
          </span>
        </div>

        {/* Desktop section menu */}
        {menu && (
          <>
            <div className="pim-menu-scrim" onClick={() => setMenu(null)} />
            <div
              className="pim-menu pim-only-wide"
              role="menu"
              aria-label={openSection.label}
              style={{ ['--sec-accent' as string]: openSection.accent }}
            >
              <h3>{openSection.label}</h3>
              <SectionItems section={openSection} location={location} onRun={runItem} />
              {menu === 'you' && identity.user && !identity.isAnonymous && (
                <div className="pim-sheet-account" style={{ margin: '12px 6px 2px' }}>
                  <Avatar size={34} />
                  <b style={{ flex: 1, fontSize: 14 }}>{identity.name}</b>
                  <button type="button" className="btn-3d" data-tone="quiet" data-size="sm" onClick={() => signOut()}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </header>

      {/* ══ PHONE DOCK ═══════════════════════════════════════════════════════ */}
      <nav className="pim-dock" aria-label="Main">
        <Link to={HOME_PATH} data-active={dockActive('home')} onClick={() => tap(0.2)}>
          <Home size={21} />
          Home
        </Link>
        <button
          type="button"
          data-active={dockActive('play')}
          style={{ ['--sec-accent' as string]: sectionById('play').accent }}
          onClick={() => {
            tap(0.2);
            setSheet('play');
          }}
        >
          {(() => {
            const Icon = sectionById('play').icon;
            return <Icon size={21} />;
          })()}
          Play
        </button>
        <Link to="/daily" aria-label="Play today's drop" onClick={() => tap(0.35)}>
          <span className="pim-dock-play"><Play size={26} fill="currentColor" /></span>
        </Link>
        <button
          type="button"
          data-active={dockActive('collect')}
          style={{ ['--sec-accent' as string]: sectionById('collect').accent }}
          onClick={() => {
            tap(0.2);
            setSheet('collect');
          }}
        >
          {(() => {
            const Icon = sectionById('collect').icon;
            return <Icon size={21} />;
          })()}
          Collect
        </button>
        <button
          type="button"
          data-active={dockActive('more')}
          onClick={() => {
            tap(0.2);
            setSheet('more');
          }}
        >
          <MoreHorizontal size={21} />
          More
        </button>
      </nav>

      {/* ══ PHONE SHEET ══════════════════════════════════════════════════════ */}
      {sheet && (
        <>
          <div className="pim-sheet-scrim pim-only-narrow" onClick={() => setSheet(null)} />
          <div
            className="pim-sheet pim-only-narrow"
            role="dialog"
            aria-label={sheet === 'more' ? 'More' : sectionById(sheet).label}
            style={{ ['--sec-accent' as string]: sheet === 'more' ? sectionById('compete').accent : sectionById(sheet).accent }}
          >
            <div className="pim-sheet-grip" />
            {sheet === 'more' ? (
              <>
                <div className="pim-sheet-account" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                  {identity.user && !identity.isAnonymous ? (
                    <>
                      <Avatar size={40} />
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <b style={{ fontSize: 15, color: '#fff' }}>{identity.name}</b>
                        <span style={{ fontFamily: 'var(--shell-mono)', fontSize: 12, color: 'var(--shell-gold)' }}>
                          {tokenBalance.toLocaleString()} tokens
                        </span>
                      </span>
                      <button type="button" className="btn-3d" data-tone="quiet" data-size="sm" onClick={() => signOut()}>
                        <LogOut size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontFamily: 'var(--shell-mono)', fontSize: 12, color: 'var(--shell-text-2)' }}>
                        {identity.name ?? 'Not signed in'} · <span style={{ color: 'var(--shell-gold)' }}>{tokenBalance} tokens</span>
                      </span>
                      <ConnectButton size="sm" onDone={() => setSheet(null)} />
                    </>
                  )}
                </div>
                {(['compete', 'you'] as NavSectionId[]).map((id) => {
                  const section = sectionById(id);
                  return (
                    <div key={id} style={{ ['--sec-accent' as string]: section.accent }}>
                      <h4>{section.label}</h4>
                      <SectionItems section={section} location={location} onRun={runItem} />
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <h3>{sectionById(sheet).label}</h3>
                <SectionItems section={sectionById(sheet)} location={location} onRun={runItem} />
              </>
            )}
          </div>
        </>
      )}

      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
