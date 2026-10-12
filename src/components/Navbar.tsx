// ════════════════════════════════════════════════════════════════════════════════
// Navbar.tsx — PIM : th3v4ult "Console" shell
// A persistent sidebar lists every destination (a drawer below 1024px), and the
// sticky command bar on top is the entry point to super search.
// Destinations live in nav/navConfig.ts so search and the sidebar stay in sync.
// ════════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Bell, LogOut, Menu, Wallet, X, Zap } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { useDisplayMode } from '../store/useDisplayMode';
import { useNotificationStore } from '../store/useNotificationStore';
import GuideModal from './GuideModal';
import FloatingTicker from './FloatingTicker';
import { haptics } from '../utils/haptics';
import { farcasterService } from '../services/farcasterService';
import { getIdenticon } from '../utils/identicon';
import { getCurrentDay, getTimeUntilNextDay } from '../utils/dayCalc';
import { audioManager } from '../game/audio';
import {
  NAV_SECTIONS,
  OPEN_GUIDE_EVENT,
  sectionForPath,
  visibleItems,
  type NavItem,
  type NavSection,
} from './nav/navConfig';
import '../styles/consoleShell.css';

const pad2 = (n: number) => String(n).padStart(2, '0');

function useNextDropCountdown() {
  const [t, setT] = useState(getTimeUntilNextDay);
  useEffect(() => {
    const id = window.setInterval(() => setT(getTimeUntilNextDay()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return `${pad2(t.hours)}:${pad2(t.minutes)}:${pad2(t.seconds)}`;
}

function isItemActive(item: NavItem, location: string) {
  if (!item.to) return false;
  if (item.to === '/vault') return location === '/vault';
  return location === item.to || location.startsWith(item.to + '/');
}

// ── Identity block at the foot of the sidebar ────────────────────────────────
function IdentityBlock({ onNavigate }: { onNavigate: () => void }) {
  const { user, signOut, status, error: authError, setShowAuthModal } = useAuthStore();
  const tokenBalance = useVaultStore((s) => s.tokenBalance);
  const displayName = useVaultStore((s) => s.displayName);
  const avatarUrl = useVaultStore((s) => s.avatarUrl);

  const isAnonymous =
    user?.is_anonymous ||
    user?.app_metadata?.provider === 'anonymous' ||
    (!user?.email && !user?.user_metadata?.wallet && !user?.user_metadata?.wallet_address);

  if (!user || isAnonymous) {
    const guestLabel = farcasterService.getUser()?.username
      ? `@${farcasterService.getUser()?.username}`
      : farcasterService.isFarcaster()
        ? 'Farcaster guest'
        : user
          ? 'Guest session'
          : 'Not signed in';
    return (
      <div className="pim-who" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <span style={{ fontFamily: 'var(--shell-mono)', fontSize: 10.5, color: 'var(--shell-text-3)', letterSpacing: '0.08em' }}>
          {guestLabel.toUpperCase()} · <span style={{ color: 'var(--shell-gold)' }}>{tokenBalance} V</span>
        </span>
        <button
          type="button"
          className="pim-shear"
          data-fill="true"
          style={{ ['--c' as string]: authError ? '#ff3800' : 'var(--shell-gold)' }}
          disabled={status === 'loading'}
          onClick={() => {
            haptics.lightTap();
            setShowAuthModal(true);
            onNavigate();
          }}
        >
          <Wallet size={13} />
          {status === 'loading' ? 'Connecting' : authError ? 'Retry connect' : 'Connect identity'}
        </button>
      </div>
    );
  }

  const ident = getIdenticon(user.id || '', displayName);
  const name =
    displayName ||
    (() => {
      const cleaned = user.email?.split('@')[0];
      if (cleaned?.startsWith('0x') && cleaned.length === 42) return `${cleaned.slice(0, 6)}…${cleaned.slice(-4)}`;
      return cleaned || user.id.slice(0, 8);
    })();

  return (
    <div className="pim-who">
      {avatarUrl ? (
        <img className="pim-avatar" src={avatarUrl} alt="" />
      ) : (
        <span className="pim-avatar" style={{ background: ident.bgColor }}>{ident.initials}</span>
      )}
      <Link to="/profile" className="pim-who-meta" onClick={onNavigate} title="Open your profile">
        <b>{name}</b>
        <span>{tokenBalance.toLocaleString()} V</span>
      </Link>
      <button
        type="button"
        className="pim-iconbtn"
        style={{ width: 32, height: 32 }}
        onClick={() => signOut()}
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut size={14} />
      </button>
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
  const { is4K, toggle: toggle4K, detectCapability } = useDisplayMode();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const countdown = useNextDropCountdown();
  const currentDay = getCurrentDay();
  const activeSection = sectionForPath(location);

  useEffect(() => {
    detectCapability();
  }, [detectCapability]);

  // The sidebar is fixed, so the page needs an offset while the shell is mounted.
  useEffect(() => {
    document.body.classList.add('pim-has-sidebar');
    return () => document.body.classList.remove('pim-has-sidebar');
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    const open = () => setGuideOpen(true);
    window.addEventListener(OPEN_GUIDE_EVENT, open);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, open);
  }, []);

  const openSearch = () => {
    haptics.lightTap();
    audioManager.playSfx('tap_nav', 0.2);
    setDrawerOpen(false);
    setCommandPaletteOpen(true);
  };

  const runItem = (item: NavItem) => {
    haptics.lightTap();
    audioManager.playSfx('tap_nav', 0.3);
    if (item.action === 'options') setOptionsModalOpen(true);
    else if (item.action === 'guide') setGuideOpen(true);
    else if (item.action === 'notifications') useNotificationStore.getState().setIsOpen(true);
    else if (item.action === 'hdr') return toggle4K();
    setDrawerOpen(false);
  };

  const renderSection = (section: NavSection) => (
    <div key={section.id} style={{ ['--sec-accent' as string]: section.accent }}>
      <h4>{section.label}</h4>
      {visibleItems(section.items).map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item, location);
        const tag =
          item.action === 'hdr' ? (
            <span className="pim-navlink-tag" data-on={is4K}>{is4K ? 'ON' : 'OFF'}</span>
          ) : item.action === 'notifications' && unreadCount > 0 ? (
            <span className="pim-navlink-tag" data-on="true">{unreadCount > 9 ? '9+' : unreadCount}</span>
          ) : item.devOnly ? (
            <span className="pim-navlink-tag">DEV</span>
          ) : null;

        if (item.to) {
          return (
            <Link
              key={item.id}
              to={item.to}
              className="pim-navlink"
              aria-current={active ? 'page' : undefined}
              onClick={() => runItem(item)}
              title={item.desc}
            >
              <Icon size={16} />
              {item.label}
              {tag}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className="pim-navlink"
            onClick={() => runItem(item)}
            title={item.desc}
            role={item.action === 'hdr' ? 'switch' : undefined}
            aria-checked={item.action === 'hdr' ? is4K : undefined}
          >
            <Icon size={16} />
            {item.label}
            {tag}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* ══ SIDEBAR (fixed on desktop, drawer below 1024px) ══════════════════ */}
      {drawerOpen && <div className="pim-sidebar-scrim" onClick={() => setDrawerOpen(false)} />}
      <aside className="pim-sidebar" data-open={drawerOpen} aria-label="Main navigation">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Link to="/" className="pim-brand" aria-label="PIM home">
            <img src="/data/logos/top_left_site.png" alt="PIM th3v4ult" />
            <small>365 days of dark and light</small>
          </Link>
          <button
            type="button"
            className="pim-iconbtn pim-drawer-close"
            style={{ width: 32, height: 32 }}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="pim-sidenav">{NAV_SECTIONS.map(renderSection)}</nav>
        <IdentityBlock onNavigate={() => setDrawerOpen(false)} />
      </aside>

      {/* ══ COMMAND BAR ══════════════════════════════════════════════════════ */}
      <header className="pim-cmdbar" data-section={activeSection ?? undefined}>
        <button
          type="button"
          className="pim-iconbtn pim-only-narrow"
          onClick={() => {
            haptics.lightTap();
            setDrawerOpen(true);
          }}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          <Menu size={18} />
        </button>

        <button type="button" className="pim-cmdbox" onClick={openSearch} aria-label="Open super search">
          <span className="pim-caret">&gt;_</span>
          <span className="pim-cmdbox-text">search 365 tracks, vault, modes, settings</span>
          <span className="pim-kbd pim-only-wide">⌘K</span>
        </button>

        <div className="pim-readout pim-only-wide" aria-label="Vault status">
          <span>DAY <b>{currentDay}</b>/365</span>
          <span>NEXT DROP <b>{countdown}</b></span>
        </div>

        <Link
          to="/vault/earn"
          className="pim-tokens"
          data-empty={tokenBalance <= 0}
          title="Vault tokens"
          onClick={() => audioManager.playSfx('tap_nav', 0.2)}
        >
          <Zap size={12} />
          {tokenBalance.toLocaleString()}
        </Link>

        <button
          type="button"
          className="pim-iconbtn"
          onClick={() => {
            haptics.lightTap();
            useNotificationStore.getState().setIsOpen(true);
          }}
          aria-label={unreadCount > 0 ? `Transmissions, ${unreadCount} unread` : 'Transmissions'}
          title="Transmissions"
        >
          <Bell size={16} />
          {unreadCount > 0 && <span className="pim-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
      </header>

      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <FloatingTicker />
    </>
  );
}
