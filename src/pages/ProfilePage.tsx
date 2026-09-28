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
  Shield, Zap, User, ExternalLink, Wallet, Sparkles, Award, Play, Disc, Lock, KeyRound, Copy, Eye, EyeOff, AlertTriangle, Check
} from 'lucide-react';
import IdentitySetup from '../components/IdentitySetup';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { supabase } from '../services/supabaseClient';
import { Wallet } from 'ethers';
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
  const { user, signOut, registerPasskey, ensureProfileAndWallet, isPasskeySupported } = useAuthStore();
  const isAnonymous = user?.is_anonymous ?? false;
  const { collection, tokenBalance, totalPulls, streakCount, loadVaultData, username } = useVaultStore();
  const [, navigate] = useLocation();

  const currentDay = getCurrentDay();
  const [displayName, setDisplayName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [palette, setPalette] = useState<ExtractedPalette>(getFallbackPalette());
  const [topCoverArt, setTopCoverArt] = useState<string>('/screenshots/06_rhythm_gameplay.png');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyFeedback, setPasskeyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Ephemeral wallet keys — shown only when this session runs on the
  // browser-generated ephemeral wallet (th3vault_is_ephemeral_wallet).
  const [ephemeralKeys, setEphemeralKeys] = useState<{ address: string; pkey: string } | null>(null);
  const [showPkey, setShowPkey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setEphemeralKeys(null);
      return;
    }
    try {
      const isEphemeral = localStorage.getItem('th3vault_is_ephemeral_wallet') === 'true';
      const pkey =
        localStorage.getItem(`th3vault_ephemeral_wallet_pkey_${user.id}`) ||
        localStorage.getItem('th3vault_ephemeral_wallet_pkey');
      if (isEphemeral && pkey) {
        const w = new Wallet(pkey);
        setEphemeralKeys({ address: w.address, pkey });
      } else {
        setEphemeralKeys(null);
      }
    } catch {
      setEphemeralKeys(null);
    }
    setShowPkey(false);
  }, [user]);

  const copyField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1800);
  };

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
        {(!username || isAnonymous) && (
          <section className="profile-glass-panel border-l-4 border-[#E5B800] mt-6 mb-6">
            <div className="profile-panel-header text-[#E5B800]">
              <Sparkles size={18} /> {isAnonymous ? "PRESERVE YOUR 365 PROGRESS" : "LOCK IN YOUR PILOT @USERNAME"}
            </div>
            <p className="font-mono text-xs text-white/70 leading-relaxed mb-4">
              {isAnonymous
                ? "You are currently playing as a Guest. Connect an Email or Web3 Smart Wallet to bind your earned daily cards, medals, and streaks permanently to your sovereign profile."
                : "Choose your unique pilot @username and profile avatar to record and broadcast scores on competitive leaderboards."}
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

            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-white/40 uppercase tracking-wider">Session ID</span>
              <span className="text-white/40 font-mono text-[10px]">{user?.id || 'ANONYMOUS'}</span>
            </div>

            {/* Passkey Biometric Security Row */}
            <div className="pt-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-white font-bold block text-xs">Biometric Passkey</span>
                  <span className="text-white/40 text-[10px]">
                    {isPasskeySupported()
                      ? 'Secure this device with Touch ID / Face ID'
                      : 'WebAuthn not supported on this browser'}
                  </span>
                </div>

                <button
                  onClick={async () => {
                    audioManager.playSfx('tap_nav', 0.3);
                    if (isAnonymous || !user?.email) {
                      useAuthStore.getState().setShowAuthModal(true);
                      return;
                    }
                    setPasskeyLoading(true);
                    setPasskeyFeedback(null);
                    const res = await registerPasskey();
                    if (res.error) {
                      setPasskeyFeedback({ type: 'error', message: res.error });
                    } else {
                      audioManager.playSfx('reward_claim', 0.5);
                      setPasskeyFeedback({
                        type: 'success',
                        message: 'Passkey enrolled successfully! You can now log in with 1 touch.',
                      });
                    }
                    setPasskeyLoading(false);
                  }}
                  disabled={passkeyLoading || !isPasskeySupported()}
                  className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/20 transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Fingerprint size={12} />
                  {passkeyLoading ? 'Enrolling...' : 'Create & Link Passkey'}
                </button>
              </div>

              {passkeyFeedback && (
                <div
                  className={`mt-2 p-2 font-mono text-[10px] rounded border ${
                    passkeyFeedback.type === 'success'
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-950/30 border-red-500/30 text-red-400'
                  }`}
                >
                  {passkeyFeedback.message}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══════════ SECTION 4 : EPHEMERAL WALLET KEYS ═══════════ */}
        {ephemeralKeys && (
          <section className="profile-glass-panel border-l-4 border-[#00E5FF] mt-6">
            <div className="profile-panel-header text-[#00E5FF]">
              <KeyRound size={18} /> Ephemeral Wallet Keys
            </div>

            <div className="flex items-start gap-2 p-3 mb-4 bg-[#ff3800]/10 border border-[#ff3800]/30 font-mono text-[10px] text-[#ff9a7a] leading-relaxed">
              <AlertTriangle size={14} className="shrink-0 mt-[1px] text-[#ff3800]" />
              <span>
                This wallet was generated in this browser and lives <strong className="text-white">only here</strong>.
                Anyone holding the private key controls the wallet and everything in it.
                Back it up now — or lock in a permanent identity above to preserve your cards.
              </span>
            </div>

            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex justify-between items-center gap-3 py-2 border-b border-white/5">
                <span className="text-white/40 uppercase tracking-wider shrink-0">Public Address</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[#00E5FF] font-bold font-mono text-[10px] break-all text-right">{ephemeralKeys.address}</span>
                  <button
                    onClick={() => copyField('address', ephemeralKeys.address)}
                    className="shrink-0 p-1.5 border border-white/15 text-white/60 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                    title="Copy address"
                  >
                    {copiedField === 'address' ? <Check size={12} className="text-[#39FF14]" /> : <Copy size={12} />}
                  </button>
                </span>
              </div>

              <div className="flex justify-between items-center gap-3 py-2">
                <span className="text-white/40 uppercase tracking-wider shrink-0">Private Key</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-white/80 font-mono text-[10px] break-all text-right">
                    {showPkey ? ephemeralKeys.pkey : '•'.repeat(48)}
                  </span>
                  <button
                    onClick={() => {
                      audioManager.playSfx('tap_nav', 0.3);
                      setShowPkey((v) => !v);
                    }}
                    className="shrink-0 p-1.5 border border-white/15 text-white/60 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                    title={showPkey ? 'Hide private key' : 'Reveal private key'}
                  >
                    {showPkey ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  {showPkey && (
                    <button
                      onClick={() => copyField('pkey', ephemeralKeys.pkey)}
                      className="shrink-0 p-1.5 border border-white/15 text-white/60 hover:text-white hover:border-white/40 transition-all cursor-pointer"
                      title="Copy private key"
                    >
                      {copiedField === 'pkey' ? <Check size={12} className="text-[#39FF14]" /> : <Copy size={12} />}
                    </button>
                  )}
                </span>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
