/**
 * ProfilePage.tsx — Award-Winning Identity Hub (user.th3scr1b3.art)
 *
 * Visual DNA: Apple Music × Monument Valley × Arcane × Persona 5.
 * Synchronizes identity across all th3scr1b3 subdomains.
 *
 * Features:
 * - Museum exhibit aesthetic matching the Hero Landing Page.
 * - Dynamic Artwork Palette extraction & ambient shader light beams.
 * - Interactive 3D Collector Sovereign Card with mouse tilt & spinning vinyl disc.
 * - Live Collector Stats: Cards Owned, Shards Balance, Packs Opened, Sovereign Score.
 * - 365 Collection Heatmap Preview.
 * - Ecosystem Orbit Node Hub.
 * - Centralized audioManager sound FX triggers.
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint, RefreshCw, LogOut, Layers, ArrowUpRight,
  Shield, Zap, User, ExternalLink, Wallet, Sparkles, Award, Play, Disc, Lock
} from 'lucide-react';
import IdentitySetup from '../components/IdentitySetup';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { supabase } from '../services/supabaseClient';
import { getCurrentDay, formatDate } from '../utils/dayCalc';
import { extractPalette, getFallbackPalette, type ExtractedPalette } from '../utils/extractPalette';
import { audioManager } from '../game/audio';
import '../styles/ProfilePage.css';
import '../styles/HeroLandingPage.css';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function shortenAddress(addr: string) {
  if (addr.startsWith('0x') && addr.length === 42) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return addr;
}

function providerLabel(p: string | undefined): string {
  if (!p) return 'Unknown';
  if (p === 'email') return 'Magic Link';
  if (p === 'github') return 'GitHub OAuth';
  if (p === 'anonymous') return 'Guest Wallet';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ProfilePage() {
  const { user, signOut } = useAuthStore();
  const isAnonymous = user?.is_anonymous ?? false;
  const { collection, tokenBalance, totalPulls, streakCount, loadVaultData } = useVaultStore();
  const [, navigate] = useLocation();

  const currentDay = getCurrentDay();
  const [displayName, setDisplayName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [palette, setPalette] = useState<ExtractedPalette>(getFallbackPalette());
  const [topCoverArt, setTopCoverArt] = useState<string>('/screenshots/06_rhythm_gameplay.png');

  // 3D Perspective Card Tilt
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch today's song artwork for dynamic palette
  useEffect(() => {
    fetch('/data/song_catalog.json')
      .then(r => r.json())
      .then(data => {
        const todaySong = data.find((s: any) => s.day === currentDay) || data[data.length - 1];
        if (todaySong?.coverArt) {
          setTopCoverArt(todaySong.coverArt);
          extractPalette(todaySong.coverArt).then(setPalette).catch(() => {});
        }
      })
      .catch(console.error);
  }, [currentDay]);

  // Load user profile
  useEffect(() => {
    if (!user) {
      setLoadingProfile(false);
      return;
    }
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        setLoadingProfile(false);
      });
  }, [user]);

  const provider = user?.app_metadata?.provider as string | undefined;
  const walletAddr = user?.user_metadata?.wallet as string | undefined;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  const identityDisplay =
    displayName ||
    (walletAddr ? shortenAddress(walletAddr) : '') ||
    user?.email?.split('@')[0] ||
    user?.id?.slice(0, 12) ||
    'SOVEREIGN SCRIBE';

  const rootStyle = useMemo(
    () =>
      ({
        '--palette-dominant': palette.dominant.hex,
        '--palette-secondary': palette.secondary.hex,
        '--palette-accent': palette.accent.hex,
        '--palette-muted': palette.muted.hex,
        '--palette-dark': palette.dark.hex,
      }) as React.CSSProperties,
    [palette]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * 20, y: -x * 20 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  return (
    <div className="profile-page" style={rootStyle}>
      {/* Noise Texture & Shader Beams */}
      <div className="hero-noise-overlay" />
      <div className="hero-ambient-beams">
        <div className="hero-beam-1" />
        <div className="hero-beam-2" />
        <div className="hero-beam-3" />
      </div>

      <div className="profile-container">

        {/* ═══════════ SECTION 1 : HERO IDENTITY PEDESTAL ═══════════ */}
        <section className="profile-hero-pedestal">
          <motion.div
            ref={cardRef}
            className="profile-card-3d-wrap"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_OUT }}
          >
            <div className="hero-drop-glow" />

            {/* Spinning Holographic Vinyl Disc */}
            <div className="hero-vinyl-disc playing">
              <div
                className="hero-vinyl-label"
                style={{ backgroundImage: `url(${topCoverArt})` }}
              />
            </div>

            {/* Front Card */}
            <div className="profile-card-3d-card">
              <div className="hero-specular-glare" />

              <div className="profile-avatar-frame">
                {/* @TODO: Wrap with a label that triggers a file input when the user already has an identity. */}
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="profile-avatar-img" />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#0d0d14] flex items-center justify-center">
                    <User size={32} className="text-white/40" />
                  </div>
                )}
              </div>

              <div>
                <span className="font-mono text-[9px] text-[#00E5FF] uppercase font-bold tracking-[0.25em] block mb-1">
                  YOUR 365 // PERSONAL IDENTITY
                </span>
                <h1 className="profile-identity-title">
                  {loadingProfile ? '…' : identityDisplay}
                </h1>
                <p className="profile-identity-sub">
                  {isAnonymous ? 'GUEST SESSION // EPHEMERAL PASS' : 'SOVEREIGN IDENTITY // VERIFIED'}
                </p>

                <div className="profile-badge-row">
                  <span className="profile-badge-tag">{providerLabel(provider)}</span>
                  {walletAddr && <span className="profile-badge-tag">{shortenAddress(walletAddr)}</span>}
                  <span className="profile-badge-tag text-[#39FF14]">Day {currentDay} Active</span>
                </div>
              </div>

              <div className="font-mono text-[9px] text-white/30 tracking-widest uppercase">
                YOUR 365 // SOVEREIGN PASSPORT
              </div>
            </div>
          </motion.div>

          {/* Action Row */}
          <div className="profile-actions-row">
            <Link
              to="/vault/collection"
              className="profile-btn-primary"
              onClick={() => audioManager.playSfx('select_start_song', 0.4)}
            >
              <Layers size={16} /> My Vault Collection
            </Link>

            <Link
              to="/campaign"
              className="profile-btn-secondary"
              onClick={() => audioManager.playSfx('tap_nav', 0.3)}
            >
              <Award size={14} /> My 365 Journey
            </Link>

            <button
              onClick={() => {
                audioManager.playSfx('tap_nav', 0.3);
                if (loadVaultData) loadVaultData(true);
              }}
              className="profile-btn-secondary"
              title="Refresh Vault Data"
            >
              <RefreshCw size={14} /> Refresh
            </button>

            {user && (
              <button
                onClick={() => {
                  audioManager.playSfx('back', 0.3);
                  signOut();
                  navigate('/');
                }}
                className="profile-btn-secondary"
                title="Sign out"
              >
                <LogOut size={14} /> Sign Out
              </button>
            )}
          </div>
        </section>

        {/* ═══════════ SECTION 1.5 : CREATE YOUR PIM ID ═══════════ */}
        {isAnonymous && (
          <section className="profile-glass-panel border-l-4 border-[#E5B800] mt-6 mb-6">
            <div className="profile-panel-header text-[#E5B800]">
              <Sparkles size={18} /> PRESERVE YOUR 365 PROGRESS
            </div>
            <p className="font-mono text-xs text-white/70 leading-relaxed mb-4">
              You are currently playing as a Guest. Connect an Email or Web3 Smart Wallet to bind your earned daily cards, medals, and streaks permanently to your sovereign profile.
            </p>
            <IdentitySetup compact onComplete={() => { if (loadVaultData) loadVaultData(true); }} />
          </section>
        )}

        {/* ═══════════ SECTION 2 : LIVE COLLECTOR STATS ═══════════ */}
        <section>
          <div className="profile-stats-grid">
            <div className="profile-stat-card" onMouseEnter={() => audioManager.playSfx('tap_nav', 0.15)}>
              <span className="profile-stat-val">{collection?.length || 0}</span>
              <span className="profile-stat-lbl">Cards Collected</span>
            </div>

            <div className="profile-stat-card" onMouseEnter={() => audioManager.playSfx('tap_nav', 0.15)}>
              <span className="profile-stat-val">{tokenBalance || 0}</span>
              <span className="profile-stat-lbl">V⚡ Tokens</span>
            </div>

            <div className="profile-stat-card" onMouseEnter={() => audioManager.playSfx('tap_nav', 0.15)}>
              <span className="profile-stat-val">{totalPulls || 0}</span>
              <span className="profile-stat-lbl">Packs Opened</span>
            </div>

            <div className="profile-stat-card" onMouseEnter={() => audioManager.playSfx('tap_nav', 0.15)}>
              <span className="profile-stat-val">{streakCount || 0}</span>
              <span className="profile-stat-lbl">Daily Streak</span>
            </div>
          </div>
        </section>

        {/* ═══════════ SECTION 3 : IDENTITY MATRIX DETAILS ═══════════ */}
        <section className="profile-glass-panel">
          <div className="profile-panel-header">
            <Fingerprint size={18} /> Identity Matrix
          </div>

          <div className="flex flex-col gap-3 font-mono text-xs">
            {displayName && (
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-white/40 uppercase tracking-wider">Alias</span>
                <span className="text-white font-bold">{displayName}</span>
              </div>
            )}

            {user?.email && (
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-white/40 uppercase tracking-wider">Email</span>
                <span className="text-white font-bold">{user.email}</span>
              </div>
            )}

            {walletAddr && (
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-white/40 uppercase tracking-wider">Wallet</span>
                <span className="text-[#00E5FF] font-bold font-mono">{walletAddr}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-white/40 uppercase tracking-wider">Authentication</span>
              <span className="text-white font-bold">{providerLabel(provider)}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-white/40 uppercase tracking-wider">Session ID</span>
              <span className="text-white/40 font-mono text-[10px]">{user?.id || 'ANONYMOUS'}</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
